import { z } from "zod";
import { query } from "../lib/db.js";

const documentSchema = z.object({
  title: z.string().min(1).max(500).default("Untitled"),
  content: z.record(z.any()).default({}),
  content_html: z.string().default(""),
  project_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
});

const patchSchema = documentSchema.partial();

export default async function documentsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // List documents (optional ?project_id=, ?folder_id=, ?location=library, ?q=)
  app.get("/", async (req) => {
    const { project_id, folder_id, location, q } = req.query;
    const params = [req.user.user_id];
    let idx = 2;
    let conditions = "WHERE user_id = $1 AND is_archived = false";
    if (project_id) { conditions += ` AND project_id = $${idx++}`; params.push(project_id); }
    if (folder_id) { conditions += ` AND folder_id = $${idx++}`; params.push(folder_id); }
    if (location === "library") { conditions += ` AND project_id IS NULL AND folder_id IS NULL`; }
    if (q) { conditions += ` AND (title ILIKE $${idx} OR content_html ILIKE $${idx})`; params.push(`%${q}%`); idx++; }
    const { rows } = await query(
      `SELECT id, title, project_id, folder_id, is_archived, created_at, updated_at,
              LEFT(content_html, 200) AS excerpt
       FROM documents ${conditions}
       ORDER BY updated_at DESC LIMIT 200`,
      params
    );
    return { documents: rows };
  });

  // Get single document (full content)
  app.get("/:id", async (req, reply) => {
    const { rows } = await query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.user_id]
    );
    if (!rows.length) return reply.code(404).send({ error: "Not found" });
    return rows[0];
  });

  // Create document
  app.post("/", async (req, reply) => {
    const data = documentSchema.parse(req.body);
    let effectiveProjectId = data.project_id ?? null;
    let effectiveFolderId = data.folder_id ?? null;
    if (effectiveProjectId) effectiveFolderId = null;
    else if (effectiveFolderId) effectiveProjectId = null;
    const { rows } = await query(
      `INSERT INTO documents (user_id, title, content, content_html, project_id, folder_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.user_id, data.title, JSON.stringify(data.content), data.content_html, effectiveProjectId, effectiveFolderId]
    );
    reply.code(201);
    return rows[0];
  });

  // Update document
  app.patch("/:id", async (req, reply) => {
    const { rows: existing } = await query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.user_id]
    );
    if (!existing.length) return reply.code(404).send({ error: "Not found" });
    const data = patchSchema.parse(req.body);
    const sets = [];
    const params = [];
    let idx = 1;
    if (data.title !== undefined)        { sets.push(`title = $${idx++}`);        params.push(data.title); }
    if (data.content !== undefined)      { sets.push(`content = $${idx++}`);      params.push(JSON.stringify(data.content)); }
    if (data.content_html !== undefined) { sets.push(`content_html = $${idx++}`); params.push(data.content_html); }
    if (data.project_id !== undefined)   { sets.push(`project_id = $${idx++}`);   params.push(data.project_id ?? null); }
    if (data.folder_id !== undefined)    { sets.push(`folder_id = $${idx++}`);    params.push(data.folder_id ?? null); }
    if (data.project_id != null && data.folder_id === undefined) { sets.push(`folder_id = $${idx++}`); params.push(null); }
    if (data.folder_id != null && data.project_id === undefined) { sets.push(`project_id = $${idx++}`); params.push(null); }
    if (!sets.length) return reply.code(400).send({ error: "Nothing to update" });
    sets.push("updated_at = NOW()");
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE documents SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    return rows[0];
  });

  // Archive (soft-delete)
  app.delete("/:id", async (req, reply) => {
    const { rows } = await query(
      "UPDATE documents SET is_archived = true WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.user_id]
    );
    if (!rows.length) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });
}
