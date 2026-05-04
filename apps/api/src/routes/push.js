// ═══════════════════════════════════════════════════════════════
//  Web Push — VAPID key distribution + subscription management
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import { query } from "../lib/db.js";

export default async function pushRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // GET /push/vapid — public key for the browser subscribe call
  app.get("/vapid", async (req, reply) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return reply.code(503).send({ error: "Push not configured" });
    return { public_key: key };
  });

  // POST /push/subscribe — persist the browser subscription
  app.post("/subscribe", async (req) => {
    const schema = z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string()
      })
    });
    const sub = schema.parse(req.body);

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.user.user_id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, req.headers["user-agent"] || ""]
    );
    return { ok: true };
  });

  // POST /push/unsubscribe
  app.post("/unsubscribe", async (req) => {
    const schema = z.object({ endpoint: z.string().url() });
    const { endpoint } = schema.parse(req.body);
    await query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [req.user.user_id, endpoint]
    );
    return { ok: true };
  });

  // GET /push/notifications — list in-app notifications (paginated)
  app.get("/notifications", async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { rows } = await query(
      `SELECT * FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.user_id, limit + 1, offset]
    );
    const hasMore = rows.length > limit;
    return { notifications: rows.slice(0, limit), hasMore };
  });

  // POST /push/notifications/:id/read
  app.post("/notifications/:id/read", async (req, reply) => {
    const { rowCount } = await query(
      `UPDATE notifications SET read_at = now()
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });
}
