import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { query } from "../lib/db.js";

export default async function inviteRoutes(app) {

  // GET /invites — list all invites created by this user
  app.get("/", { preHandler: app.requireAuth }, async (req) => {
    const { rows } = await query(
      `SELECT id, code, label, email, max_uses, use_count, expires_at, created_at
         FROM invites
        WHERE created_by = $1
        ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    return { invites: rows };
  });

  // POST /invites — create an invite code (optionally email it)
  app.post("/", { preHandler: app.requireAuth }, async (req) => {
    const schema = z.object({
      label: z.string().max(100).optional(),
      email: z.string().email().optional(),
      max_uses: z.number().int().min(0).default(1),  // 0 = unlimited
      expires_in_days: z.number().int().min(1).max(365).optional(),
    });
    const { label, email, max_uses, expires_in_days } = schema.parse(req.body);

    const code = crypto.randomBytes(6).toString("hex"); // 12-char hex code
    const expires_at = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000)
      : null;

    const { rows } = await query(
      `INSERT INTO invites (created_by, code, label, email, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, label, email, max_uses, use_count, expires_at, created_at`,
      [req.user.user_id, code, label || null, email || null, max_uses, expires_at]
    );

    const invite = rows[0];
    let emailed = false;

    // Send invite email if address provided and SMTP configured
    if (email && process.env.SMTP_HOST) {
      try {
        const signupUrl = `${process.env.APP_URL}?invite=${code}`;
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: `You're invited to Workspace`,
          text: `You've been invited to join Workspace!\n\nYour invite code: ${code}\n\nSign up here: ${signupUrl}\n\nThis invite ${expires_at ? `expires on ${expires_at.toLocaleDateString()}.` : "does not expire."}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 16px">You're invited to Workspace</h2>
            <p>You've been invited to join Workspace. Use the button below to sign up:</p>
            <a href="${signupUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Sign up</a>
            <p style="color:#64748b;font-size:13px">Or enter this invite code manually:</p>
            <code style="display:inline-block;background:#f1f5f9;padding:8px 16px;border-radius:6px;font-size:16px;font-weight:bold;letter-spacing:2px">${code}</code>
            <p style="color:#64748b;font-size:13px;margin-top:24px">${expires_at ? `This invite expires on ${expires_at.toLocaleDateString()}.` : "This invite does not expire."}</p>
          </div>`,
        });
        emailed = true;
        req.log.info({ email }, "invite emailed");
      } catch (err) {
        req.log.error({ err, email }, "invite email failed");
      }
    }

    return { invite, emailed };
  });

  // DELETE /invites/:id — revoke an invite
  app.delete("/:id", { preHandler: app.requireAuth }, async (req, reply) => {
    const { rowCount } = await query(
      `DELETE FROM invites WHERE id = $1 AND created_by = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Not found" });
    return { ok: true };
  });
}
