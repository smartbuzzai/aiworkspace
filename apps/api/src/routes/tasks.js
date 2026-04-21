import { z } from "zod";
import { query } from "../lib/db.js";

const taskSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  priority: z.enum(["high","medium","low"]).optional().default("medium"),
  status: z.enum(["open","in_progress","done","cancelled"]).optional().default("open"),
  due_at: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional().default([])
});

export default async function tasksRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (req) => {
    const { project_id, status } = req.query || {};
    const params = [req.user.user_id];
    let sql = `SELECT t.*, p.name AS project_name
                 FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
                WHERE t.user_id = $1`;
    if (project_id) { params.push(project_id); sql += ` AND t.project_id = $${params.length}`; }
    if (status)     { params.push(status);     sql += ` AND t.status = $${params.length}`; }
    sql += ` ORDER BY
               CASE t.status WHEN 'done' THEN 1 ELSE 0 END,
               CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               t.due_at NULLS LAST,
               t.sort_order`;
    const { rows } = await query(sql, params);
    return { tasks: rows };
  });

  app.post("/", async (req) => {
    const d = taskSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO tasks (user_id, project_id, title, description, priority, status, due_at, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.user_id, d.project_id, d.title, d.description, d.priority, d.status, d.due_at, d.tags]
    );
    return { task: rows[0] };
  });

  app.patch("/:id", async (req, reply) => {
    const data = taskSchema.partial().parse(req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return { ok: true };
    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const extra = data.status === "done" ? ", completed_at = now()" : "";
    const { rows } = await query(
      `UPDATE tasks SET ${sets}${extra}
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.user_id, ...keys.map(k => data[k])]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { task: rows[0] };
  });

  app.delete("/:id", async (req) => {
    await query(`DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]);
    return { ok: true };
  });
}
