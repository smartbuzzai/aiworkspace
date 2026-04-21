import { z } from "zod";
import { query } from "../lib/db.js";

const eventSchema = z.object({
  calendar_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  all_day: z.boolean().optional().default(false),
  event_type: z.enum(["meeting","call","focus","task","personal"]).optional().default("meeting"),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    status: z.enum(["pending","accepted","declined"]).optional()
  })).optional().default([])
});

export default async function eventsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (req) => {
    const { from, to } = req.query || {};
    const params = [req.user.user_id];
    let sql = `SELECT * FROM events WHERE user_id = $1`;
    if (from) { params.push(from); sql += ` AND ends_at >= $${params.length}`; }
    if (to)   { params.push(to);   sql += ` AND starts_at <= $${params.length}`; }
    sql += ` ORDER BY starts_at ASC LIMIT 500`;
    const { rows } = await query(sql, params);
    return { events: rows };
  });

  app.post("/", async (req) => {
    const d = eventSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO events (user_id, calendar_id, title, description, location,
                           starts_at, ends_at, all_day, event_type, attendees)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [req.user.user_id, d.calendar_id, d.title, d.description, d.location,
       d.starts_at, d.ends_at, d.all_day, d.event_type, JSON.stringify(d.attendees)]
    );
    return { event: rows[0] };
  });

  app.patch("/:id", async (req, reply) => {
    const data = eventSchema.partial().parse(req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return { ok: true };
    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const values = keys.map(k => k === "attendees" ? JSON.stringify(data[k]) : data[k]);
    const { rows } = await query(
      `UPDATE events SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.user_id, ...values]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { event: rows[0] };
  });

  app.delete("/:id", async (req) => {
    await query(`DELETE FROM events WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]);
    return { ok: true };
  });
}
