import { z } from "zod";
import nodemailer from "nodemailer";
import { query } from "../lib/db.js";
import { decrypt, userKey } from "../lib/auth.js";

export default async function emailsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // GET /emails/threads
  app.get("/threads", async (req) => {
    const { account_id, unread, q } = req.query || {};
    const params = [req.user.user_id];
    let sql = `SELECT t.* FROM email_threads t WHERE t.user_id = $1 AND t.is_archived = false`;

    if (account_id) {
      params.push(account_id);
      sql += ` AND t.account_id = $${params.length}`;
    }
    if (unread === "true") sql += ` AND t.unread_count > 0`;
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (t.subject ILIKE $${params.length} OR t.participants::text ILIKE $${params.length} OR EXISTS (
        SELECT 1 FROM emails e WHERE e.thread_id = t.id AND e.body_text ILIKE $${params.length}
      ))`;
    }

    sql += ` ORDER BY t.last_message_at DESC NULLS LAST LIMIT 100`;
    const { rows } = await query(sql, params);
    return { threads: rows };
  });

  // GET /emails/threads/:id
  app.get("/threads/:id", async (req, reply) => {
    const { rows: threadRows } = await query(
      `SELECT * FROM email_threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (threadRows.length === 0) return reply.code(404).send({ error: "Not found" });

    const { rows: messages } = await query(
      `SELECT * FROM emails WHERE thread_id = $1 ORDER BY received_at ASC`,
      [req.params.id]
    );

    // Mark as read
    await query(
      `UPDATE email_threads SET unread_count = 0 WHERE id = $1`,
      [req.params.id]
    );
    await query(
      `UPDATE emails SET is_read = true WHERE thread_id = $1`,
      [req.params.id]
    );

    return { thread: threadRows[0], messages };
  });

  // POST /emails/send
  app.post("/send", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
  }, async (req, reply) => {
    const schema = z.object({
      account_id: z.string().uuid(),
      to: z.array(z.string().email()).min(1),
      cc: z.array(z.string().email()).optional().default([]),
      subject: z.string().max(500),
      body_text: z.string().optional(),
      body_html: z.string().optional(),
      in_reply_to: z.string().optional(),
      thread_id: z.string().uuid().optional()
    });
    const data = schema.parse(req.body);

    const { rows } = await query(
      `SELECT id, email_address, smtp_host, smtp_port, smtp_user, smtp_pass_enc
         FROM email_accounts WHERE id = $1 AND user_id = $2 AND is_active`,
      [data.account_id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Account not found" });
    const acc = rows[0];

    const smtpPass = decrypt(acc.smtp_pass_enc, userKey(req.user.user_id));

    const transporter = nodemailer.createTransport({
      host: acc.smtp_host,
      port: acc.smtp_port,
      secure: acc.smtp_port === 465,
      auth: { user: acc.smtp_user, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    let info;
    try {
      info = await transporter.sendMail({
        from: acc.email_address,
        to: data.to.join(","),
        cc: data.cc.join(","),
        subject: data.subject,
        text: data.body_text,
        html: data.body_html,
        inReplyTo: data.in_reply_to,
        references: data.in_reply_to ? [data.in_reply_to] : undefined
      });
    } catch (err) {
      req.log.error({ err, account_id: acc.id }, "SMTP send failed");
      return reply.code(502).send({ error: "Failed to send email. Check your SMTP settings." });
    }

    // Persist a local copy
    let threadId = data.thread_id;
    if (threadId) {
      // Verify thread belongs to this user
      const { rows: threadCheck } = await query(
        `SELECT id FROM email_threads WHERE id = $1 AND user_id = $2`,
        [threadId, req.user.user_id]
      );
      if (threadCheck.length === 0) threadId = null; // fall through to create new thread
    }
    if (!threadId) {
      const { rows: t } = await query(
        `INSERT INTO email_threads (user_id, account_id, subject, participants, last_message_at)
         VALUES ($1,$2,$3,$4, now()) RETURNING id`,
        [req.user.user_id, acc.id, data.subject, [acc.email_address, ...data.to]]
      );
      threadId = t[0].id;
    }

    await query(
      `INSERT INTO emails (thread_id, account_id, message_id, in_reply_to,
                           from_address, to_addresses, cc_addresses, subject,
                           body_text, body_html, is_read, is_sent, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,true, now())`,
      [threadId, acc.id, info.messageId, data.in_reply_to,
       acc.email_address, data.to, data.cc, data.subject,
       data.body_text, data.body_html]
    );

    return { ok: true, message_id: info.messageId, thread_id: threadId };
  });

  // PATCH /emails/threads/:id/star
  app.patch("/threads/:id/star", async (req, reply) => {
    const { rows } = await query(
      `UPDATE email_threads SET is_starred = NOT is_starred
        WHERE id = $1 AND user_id = $2 RETURNING id, is_starred`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true, is_starred: rows[0].is_starred };
  });

  // PATCH /emails/threads/:id/archive
  app.patch("/threads/:id/archive", async (req, reply) => {
    const { rows } = await query(
      `UPDATE email_threads SET is_archived = NOT is_archived
        WHERE id = $1 AND user_id = $2 RETURNING id, is_archived`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true, is_archived: rows[0].is_archived };
  });

  // DELETE /emails/threads/:id
  app.delete("/threads/:id", async (req, reply) => {
    const { rowCount } = await query(
      `DELETE FROM email_threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });

  // GET /emails/accounts
  app.get("/accounts", async (req) => {
    const { rows } = await query(
      `SELECT id, label, email_address, imap_host, smtp_host,
              last_sync_at, sync_status, is_active
         FROM email_accounts
        WHERE user_id = $1
        ORDER BY created_at`,
      [req.user.user_id]
    );
    return { accounts: rows };
  });
}
