import crypto from "node:crypto";
import * as Minio from "minio";
import { query } from "../lib/db.js";

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
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (f.name ILIKE $${params.length} OR f.extracted_text ILIKE $${params.length})`;
    }
    sql += ` ORDER BY f.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    return { files: rows };
  });

  // POST /files — multipart upload
  app.post("/", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file" });

    const folder_id = data.fields?.folder_id?.value || null;
    const buf = await data.toBuffer();
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    const s3_key = `${req.user.user_id}/${Date.now()}-${data.filename}`;
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

    // Queue text extraction job for searchable content (workers process)
    if (["pdf", "doc"].includes(kind)) {
      try {
        const { Queue } = await import("bullmq");
        const { default: Redis } = await import("ioredis");
        const r = new Redis(process.env.REDIS_URL);
        const q = new Queue("extract", { connection: r });
        await q.add("extract", {
          file_id: rows[0].id, user_id: req.user.user_id,
          s3_key, kind, mime: data.mimetype
        }, { removeOnComplete: 50, removeOnFail: 20 });
        r.disconnect();
      } catch (err) {
        req.log.warn("could not queue extraction: " + err.message);
      }
    }

    return { file: rows[0] };
  });

  // GET /files/:id/download — presigned URL (15 min)
  app.get("/:id/download", async (req, reply) => {
    const { rows } = await query(
      `SELECT s3_key, s3_bucket, name FROM files
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });

    const url = await mc.presignedGetObject(
      rows[0].s3_bucket, rows[0].s3_key, 15 * 60
    );
    return { url, filename: rows[0].name };
  });

  app.delete("/:id", async (req, reply) => {
    const { rows } = await query(
      `DELETE FROM files WHERE id = $1 AND user_id = $2
        RETURNING s3_key, s3_bucket`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length > 0) {
      mc.removeObject(rows[0].s3_bucket, rows[0].s3_key).catch(() => {});
    }
    return { ok: true };
  });
}
