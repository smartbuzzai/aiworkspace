import { z } from "zod";
import { query } from "../lib/db.js";

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  stage: z.enum(["backlog","discovery","in_progress","review","done"]).optional().default("backlog"),
  owner: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  progress: z.number().int().min(0).max(100).optional().default(0),
  color: z.string().optional().default("#3b82f6")
});

export default async function projectsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (req) => {
    const { rows } = await query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS tasks_done
         FROM projects p
        WHERE p.user_id = $1 AND NOT p.is_archived
        ORDER BY p.updated_at DESC`,
      [req.user.user_id]
    );
    return { projects: rows };
  });

  app.post("/", async (req) => {
    const d = projectSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO projects (user_id, name, description, stage, owner, due_date, progress, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.user_id, d.name, d.description, d.stage, d.owner, d.due_date, d.progress, d.color]
    );
    return { project: rows[0] };
  });

  app.patch("/:id", async (req, reply) => {
    const data = projectSchema.partial().parse(req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return { ok: true };
    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const { rows } = await query(
      `UPDATE projects SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.user_id, ...keys.map(k => data[k])]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { project: rows[0] };
  });

  app.delete("/:id", async (req) => {
    await query(`UPDATE projects SET is_archived = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]);
    return { ok: true };
  });
}
