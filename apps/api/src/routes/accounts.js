// ═══════════════════════════════════════════════════════════════
//  Email Account Management
//  Add, test, and remove IMAP/SMTP credentials per user.
//  Passwords are encrypted with AES-256-GCM using a per-user key
//  derived from JWT_SECRET.
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { Queue } from "bullmq";
import { query } from "../lib/db.js";
import { encrypt, userKey } from "../lib/auth.js";
import { redis } from "../lib/redis.js";

const imapQueue = new Queue("imap-sync", { connection: redis });

const accountSchema = z.object({
  label: z.string().min(1).max(50),
  email_address: z.string().email(),
  imap_host: z.string().optional().default(""),
  imap_port: z.number().int().min(1).max(65535).optional().default(993),
  imap_user: z.string().optional().default(""),
  imap_pass: z.string().optional().default(""),
  smtp_host: z.string().optional().default(""),
  smtp_port: z.number().int().min(1).max(65535).optional().default(465),
  smtp_user: z.string().optional().default(""),
  smtp_pass: z.string().optional().default("")
}).refine(
  d => (d.imap_host && d.imap_user && d.imap_pass) || (d.smtp_host && d.smtp_user && d.smtp_pass),
  { message: "At least one of IMAP or SMTP must be fully configured" }
);

// Preset configs for common providers — saves user time
const PRESETS = {
  gmail:       { imap_host: "imap.gmail.com",     imap_port: 993, smtp_host: "smtp.gmail.com",     smtp_port: 465 },
  outlook:     { imap_host: "outlook.office365.com", imap_port: 993, smtp_host: "smtp.office365.com", smtp_port: 587 },
  hostinger:   { imap_host: "imap.hostinger.com", imap_port: 993, smtp_host: "smtp.hostinger.com", smtp_port: 465 },
  fastmail:    { imap_host: "imap.fastmail.com",  imap_port: 993, smtp_host: "smtp.fastmail.com",  smtp_port: 465 },
  icloud:      { imap_host: "imap.mail.me.com",   imap_port: 993, smtp_host: "smtp.mail.me.com",   smtp_port: 587 },
  proton:      { imap_host: "127.0.0.1",          imap_port: 1143, smtp_host: "127.0.0.1",         smtp_port: 1025 },
  yahoo:       { imap_host: "imap.mail.yahoo.com", imap_port: 993, smtp_host: "smtp.mail.yahoo.com", smtp_port: 465 }
};

export default async function accountsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // GET /accounts/presets — return known provider configs
  app.get("/presets", async () => ({ presets: PRESETS }));

  // POST /accounts/test — verify credentials before saving
  app.post("/test", async (req, reply) => {
    const data = accountSchema.parse(req.body);
    const hasImap = data.imap_host && data.imap_user && data.imap_pass;
    const hasSmtp = data.smtp_host && data.smtp_user && data.smtp_pass;

    if (hasImap) {
      const client = new ImapFlow({
        host: data.imap_host,
        port: data.imap_port,
        secure: data.imap_port === 993,
        auth: { user: data.imap_user, pass: data.imap_pass },
        logger: false,
        connectionTimeout: 10000,
        tls: { rejectUnauthorized: !["127.0.0.1", "localhost"].includes(data.imap_host) }
      });
      try {
        await client.connect();
        await client.logout();
      } catch (err) {
        return reply.code(400).send({ error: `IMAP failed: ${err.message}` });
      }
    }

    if (hasSmtp) {
      const transporter = nodemailer.createTransport({
        host: data.smtp_host,
        port: data.smtp_port,
        secure: data.smtp_port === 465,
        auth: { user: data.smtp_user, pass: data.smtp_pass },
        connectionTimeout: 10000,
        tls: { rejectUnauthorized: !["127.0.0.1", "localhost"].includes(data.smtp_host) }
      });
      try {
        await transporter.verify();
      } catch (err) {
        return reply.code(400).send({ error: `SMTP failed: ${err.message}` });
      }
    }

    return { ok: true, tested: { imap: !!hasImap, smtp: !!hasSmtp } };
  });

  // POST /accounts — create (encrypts passwords)
  app.post("/", async (req, reply) => {
    const data = accountSchema.parse(req.body);
    const key = userKey(req.user.user_id);

    const imapEnc = data.imap_pass ? encrypt(data.imap_pass, key) : null;
    const smtpEnc = data.smtp_pass ? encrypt(data.smtp_pass, key) : null;

    try {
      const { rows } = await query(
        `INSERT INTO email_accounts
          (user_id, label, email_address,
           imap_host, imap_port, imap_user, imap_pass_enc,
           smtp_host, smtp_port, smtp_user, smtp_pass_enc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, label, email_address, imap_host, smtp_host, is_active`,
        [req.user.user_id, data.label, data.email_address,
         data.imap_host || null, data.imap_port, data.imap_user || null, imapEnc,
         data.smtp_host || null, data.smtp_port, data.smtp_user || null, smtpEnc]
      );
      return { account: rows[0] };
    } catch (err) {
      if (err.code === "23505") {
        return reply.code(409).send({ error: "Account already exists" });
      }
      throw err;
    }
  });

  // GET /accounts — list (no passwords returned)
  app.get("/", async (req) => {
    const { rows } = await query(
      `SELECT id, label, email_address, imap_host, smtp_host,
              last_sync_at, sync_status, sync_error, is_active
         FROM email_accounts
        WHERE user_id = $1
        ORDER BY created_at`,
      [req.user.user_id]
    );
    return { accounts: rows };
  });

  // PATCH /accounts/:id — toggle active, rename, etc.
  app.patch("/:id", async (req, reply) => {
    const schema = z.object({
      label: z.string().min(1).optional(),
      is_active: z.boolean().optional()
    });
    const data = schema.parse(req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return { ok: true };

    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const { rows } = await query(
      `UPDATE email_accounts SET ${sets}
        WHERE id = $1 AND user_id = $2
        RETURNING id, label, email_address, is_active`,
      [req.params.id, req.user.user_id, ...keys.map(k => data[k])]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { account: rows[0] };
  });

  // POST /accounts/:id/sync — clear error state and trigger immediate sync
  app.post("/:id/sync", async (req, reply) => {
    const { rowCount } = await query(
      `UPDATE email_accounts SET sync_status = 'idle', sync_error = NULL
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    try {
      await imapQueue.add("sync", { account_id: req.params.id }, {
        removeOnComplete: 100, removeOnFail: 50, attempts: 3,
        backoff: { type: "custom" },
      });
    } catch (err) {
      req.log.warn("could not enqueue imap sync: " + err.message);
    }
    return { ok: true };
  });

  // DELETE /accounts/:id
  app.delete("/:id", async (req, reply) => {
    const { rowCount } = await query(
      `DELETE FROM email_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });
}
