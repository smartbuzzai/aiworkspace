import { z } from "zod";
import { query } from "../lib/db.js";

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  score: z.number().int().min(0).max(100).optional().default(50),
  status: z.enum(["hot", "active", "nurture", "cold"]).optional().default("active"),
  notes: z.string().optional().nullable()
});

export default async function contactsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // GET /contacts
  app.get("/", async (req) => {
    const { q, status, tag } = req.query || {};
    const params = [req.user.user_id];
    let sql = `SELECT * FROM contacts WHERE user_id = $1`;

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (tag) {
      params.push(tag);
      sql += ` AND $${params.length} = ANY(tags)`;
    }
    sql += ` ORDER BY last_touch_at DESC NULLS LAST, created_at DESC LIMIT 200`;

    const { rows } = await query(sql, params);
    return { contacts: rows };
  });

  // GET /contacts/:id
  app.get("/:id", async (req, reply) => {
    const { rows } = await query(
      `SELECT * FROM contacts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });

    const { rows: interactions } = await query(
      `SELECT * FROM contact_interactions
        WHERE contact_id = $1
        ORDER BY occurred_at DESC LIMIT 50`,
      [req.params.id]
    );
    return { contact: rows[0], interactions };
  });

  // POST /contacts
  app.post("/", async (req) => {
    const data = contactSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO contacts (user_id, name, email, phone, company, role, tags, score, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [req.user.user_id, data.name, data.email, data.phone, data.company,
       data.role, data.tags, data.score, data.status, data.notes]
    );
    return { contact: rows[0] };
  });

  // PATCH /contacts/:id
  app.patch("/:id", async (req, reply) => {
    const data = contactSchema.partial().parse(req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return { ok: true };

    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const values = keys.map((k) => data[k]);

    const { rows } = await query(
      `UPDATE contacts SET ${sets}
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
      [req.params.id, req.user.user_id, ...values]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { contact: rows[0] };
  });

  // DELETE /contacts/:id
  app.delete("/:id", async (req, reply) => {
    const { rowCount } = await query(
      `DELETE FROM contacts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });
}
