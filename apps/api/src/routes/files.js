import crypto from "node:crypto";
import * as Minio from "minio";
import { z } from "zod";
import { Queue } from "bullmq";
import { query } from "../lib/db.js";
import { redis } from "../lib/redis.js";

const extractQueue = new Queue("extract", { connection: redis });

const endpoint = new URL(process.env.S3_ENDPOINT);
const mc = new Minio.Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || (endpoint.protocol === "https:" ? 443 : 80),
  useSSL: endpoint.protocol === "https:",
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY
});

const BUCKET = process.env.S3_BUCKET || "workspace";

// Ensure bucket exists on boot
try {
  const exists = await mc.bucketExists(BUCKET);
  if (!exists) await mc.makeBucket(BUCKET);
} catch (err) {
  console.warn("MinIO bucket check failed:", err.message);
}

function detectKind(mime, filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime?.startsWith("video/")) return "video";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (["xlsx","xls","csv"].includes(ext)) return "sheet";
  if (["pptx","ppt","key"].includes(ext)) return "slides";
  if (["docx","doc","md","txt"].includes(ext)) return "doc";
  return "other";
}

export default async function filesRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // GET /files
  app.get("/", async (req) => {
    const { folder_id, q } = req.query || {};
    const params = [req.user.user_id];
    let sql = `SELECT f.*, fo.name AS folder_name, fo.path AS folder_path
                 FROM files f
            LEFT JOIN folders fo ON fo.id = f.folder_id
                WHERE f.user_id = $1`;
    if (folder_id) { params.push(folder_id); sql += ` AND f.folder_id = $${params.length}`; }
    else if (!q) { sql += ` AND f.folder_id IS NULL`; }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (f.name ILIKE $${params.length} OR f.extracted_text ILIKE $${params.length})`;
    }
    sql += ` ORDER BY f.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    return { files: rows };
  });

  // POST /files — multipart upload
  app.post("/", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
  }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file" });

    const folder_id = data.fields?.folder_id?.value || null;
    const buf = await data.toBuffer();
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    const safeName = data.filename.replace(/[/\\]/g, "_").replace(/\.\./g, "_");
    const s3_key = `${req.user.user_id}/${Date.now()}-${safeName}`;
    const kind = detectKind(data.mimetype, data.filename);

    await mc.putObject(BUCKET, s3_key, buf, buf.length, {
      "Content-Type": data.mimetype
    });

    const { rows } = await query(
      `INSERT INTO files (user_id, folder_id, name, kind, mime_type, size_bytes,
                          s3_key, s3_bucket, checksum_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.user_id, folder_id, data.filename,
       kind, data.mimetype, buf.length, s3_key, BUCKET, checksum]
    );

    if (["pdf", "doc"].includes(kind)) {
      try {
        await extractQueue.add("extract", {
          file_id: rows[0].id, user_id: req.user.user_id,
          s3_key, kind, mime: data.mimetype
        }, { removeOnComplete: 50, removeOnFail: 20 });
      } catch (err) {
        req.log.warn("could not queue extraction: " + err.message);
      }
    }

    return { file: rows[0] };
  });

  // GET /files/:id/download — stream file from S3 through the API
  // ?inline=1 for in-browser preview, otherwise attachment download
  app.get("/:id/download", async (req, reply) => {
    const { rows } = await query(
      `SELECT f.s3_key, f.s3_bucket, f.name, f.mime_type, f.size_bytes FROM files f
        WHERE f.id = $1
          AND (f.user_id = $2
            OR f.project_id IN (SELECT id FROM projects WHERE user_id = $2)
            OR f.project_id IN (SELECT project_id FROM project_members WHERE user_id = $2))`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });

    const { s3_bucket, s3_key, name, mime_type, size_bytes } = rows[0];
    const inline = req.query.inline === "1";
    const disposition = inline ? `inline; filename="${encodeURIComponent(name)}"` : `attachment; filename="${encodeURIComponent(name)}"`;

    const stream = await mc.getObject(s3_bucket, s3_key);
    reply.header("Content-Type", mime_type || "application/octet-stream");
    reply.header("Content-Disposition", disposition);
    if (size_bytes) reply.header("Content-Length", size_bytes);
    reply.header("Cache-Control", "private, max-age=3600");
    return reply.send(stream);
  });

  app.delete("/:id", async (req, reply) => {
    const { rows } = await query(
      `DELETE FROM files WHERE id = $1 AND user_id = $2
        RETURNING s3_key, s3_bucket`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });

    try {
      await mc.removeObject(rows[0].s3_bucket, rows[0].s3_key);
    } catch (err) {
      req.log.error({ err, s3_key: rows[0].s3_key }, "S3 delete failed — DB record removed but object may remain");
      return { ok: true, warning: "File record deleted but storage cleanup failed." };
    }
    return { ok: true };
  });

  // PATCH /files/:id — update file metadata (client_visible)
  app.patch("/:id", async (req, reply) => {
    const schema = z.object({
      client_visible: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

    const sets = [];
    const params = [req.params.id, req.user.user_id];
    if (parsed.data.client_visible !== undefined) {
      params.push(parsed.data.client_visible);
      sets.push(`client_visible = $${params.length}`);
    }
    if (sets.length === 0) return { ok: true };

    const { rowCount } = await query(
      `UPDATE files SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2`,
      params
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });

  // ── Folder management ──────────────────────────────────────────────

  // GET /folders — list folders for the user
  app.get("/folders", async (req) => {
    const { parent_id, all } = req.query || {};
    const params = [req.user.user_id];
    let sql = `SELECT * FROM folders WHERE user_id = $1`;
    if (all === "true") {
      // no parent filter — return all folders
    } else if (parent_id) {
      params.push(parent_id);
      sql += ` AND parent_id = $${params.length}`;
    } else {
      sql += ` AND parent_id IS NULL`;
    }
    sql += ` ORDER BY name ASC`;
    const { rows } = await query(sql, params);
    return { folders: rows };
  });

  // POST /folders — create a folder
  app.post("/folders", async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(255),
      parent_id: z.string().uuid().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues });
    }
    const { name, parent_id } = parsed.data;

    let path;
    if (parent_id) {
      const { rows: parentRows } = await query(
        `SELECT path FROM folders WHERE id = $1 AND user_id = $2`,
        [parent_id, req.user.user_id]
      );
      if (parentRows.length === 0) {
        return reply.code(404).send({ error: "Parent folder not found" });
      }
      path = parentRows[0].path + "/" + name;
    } else {
      path = "/" + name;
    }

    const { rows } = await query(
      `INSERT INTO folders (user_id, parent_id, name, path)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.user_id, parent_id || null, name, path]
    );
    return { folder: rows[0] };
  });

  // PATCH /files/:id/move — move a file to a folder (or root)
  app.patch("/:id/move", async (req, reply) => {
    const schema = z.object({
      folder_id: z.string().uuid().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues });
    }
    const { folder_id } = parsed.data;

    // If moving to a folder, verify the folder belongs to the user
    if (folder_id) {
      const { rows: folderRows } = await query(
        `SELECT id FROM folders WHERE id = $1 AND user_id = $2`,
        [folder_id, req.user.user_id]
      );
      if (folderRows.length === 0) {
        return reply.code(404).send({ error: "Folder not found" });
      }
    }

    const { rowCount } = await query(
      `UPDATE files SET folder_id = $1 WHERE id = $2 AND user_id = $3`,
      [folder_id, req.params.id, req.user.user_id]
    );
    if (rowCount === 0) {
      return reply.code(404).send({ error: "File not found" });
    }
    return { ok: true };
  });

  // DELETE /folders/:folderId — delete a folder
  app.delete("/folders/:folderId", async (req, reply) => {
    const { rows } = await query(
      `DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.folderId, req.user.user_id]
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: "Folder not found" });
    }
    return { ok: true };
  });
}
