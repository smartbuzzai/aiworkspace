import { z } from "zod";
import nodemailer from "nodemailer";
import { query } from "../lib/db.js";
import { hashToken, generateToken } from "../lib/auth.js";
import { redis } from "../lib/redis.js";

const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

// Rate limit: max 3 magic links per email per 10 minutes.
// Stops link-spamming someone else's inbox.
async function checkRateLimit(email, ip) {
  const emailKey = `ml:email:${email}`;
  const ipKey = `ml:ip:${ip}`;

  const [emailCount, ipCount] = await Promise.all([
    redis.incr(emailKey),
    redis.incr(ipKey)
  ]);

  if (emailCount === 1) await redis.expire(emailKey, 600);
  if (ipCount === 1)    await redis.expire(ipKey, 600);

  if (emailCount > 3)  return "Too many attempts for this email. Wait 10 minutes.";
  if (ipCount > 10)    return "Too many attempts from this network. Wait 10 minutes.";
  return null;
}

export default async function authRoutes(app) {

  // POST /auth/request — send magic link
  app.post("/request", async (req, reply) => {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    const normalized = email.toLowerCase();

    const limit = await checkRateLimit(normalized, req.ip);
    if (limit) return reply.code(429).send({ error: limit });

    const token = generateToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + LINK_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO magic_links (email, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [normalized, tokenHash, expiresAt]
    );

    const link = `${process.env.APP_URL}/auth/verify?token=${token}`;

    // For MVP: log the link. Wire up SMTP once the first email account is connected.
    req.log.info({ email, link }, "magic link issued");

    if (process.env.SMTP_HOST) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: "Sign in to Workspace",
          text: `Click to sign in:\n\n${link}\n\nThis link expires in ${LINK_MINUTES} minutes.\nIf you didn't request this, ignore this email.`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 16px">Sign in to Workspace</h2>
            <p>Click the button below to sign in:</p>
            <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Sign in</a>
            <p style="color:#64748b;font-size:13px;margin-top:24px">This link expires in ${LINK_MINUTES} minutes.<br>If you didn't request this, ignore this email.</p>
          </div>`
        });
        req.log.info({ email }, "magic link emailed");
      } catch (err) {
        req.log.error({ err, email }, "magic link email failed — link still in logs above");
      }
    }

    return { ok: true, message: "If that email exists, a link was sent." };
  });

  // POST /auth/verify — exchange token for session cookie
  app.post("/verify", async (req, reply) => {
    const schema = z.object({ token: z.string().min(20) });
    const { token } = schema.parse(req.body);
    const tokenHash = hashToken(token);

    const { rows } = await query(
      `UPDATE magic_links
          SET used_at = now()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING email`,
      [tokenHash]
    );

    if (rows.length === 0) {
      reply.code(400);
      return { error: "Invalid or expired link" };
    }

    const email = rows[0].email;

    // Find or create user
    const { rows: userRows } = await query(
      `INSERT INTO users (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, name`,
      [email]
    );
    const user = userRows[0];

    // Create session
    const sessionToken = generateToken(32);
    const sessionHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, sessionHash, req.headers["user-agent"] || "", req.ip, expiresAt]
    );

    reply.setCookie("session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt
    });

    return { ok: true, user };
  });

  // POST /auth/logout — revoke current session
  app.post("/logout", { preHandler: app.requireAuth }, async (req, reply) => {
    await query(`DELETE FROM sessions WHERE id = $1`, [req.user.session_id]);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });

  // POST /auth/logout-all — revoke all sessions for this user
  app.post("/logout-all", { preHandler: app.requireAuth }, async (req, reply) => {
    const { rowCount } = await query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [req.user.user_id]
    );
    reply.clearCookie("session", { path: "/" });
    return { ok: true, revoked: rowCount };
  });

  // GET /auth/sessions — list active sessions
  app.get("/sessions", { preHandler: app.requireAuth }, async (req) => {
    const { rows } = await query(
      `SELECT id, user_agent, ip::text, last_seen_at, created_at, expires_at
         FROM sessions
        WHERE user_id = $1 AND expires_at > now()
        ORDER BY last_seen_at DESC`,
      [req.user.user_id]
    );
    return {
      sessions: rows.map(s => ({
        ...s,
        is_current: s.id === req.user.session_id
      }))
    };
  });

  // DELETE /auth/sessions/:id — revoke a specific session
  app.delete("/sessions/:id", { preHandler: app.requireAuth }, async (req, reply) => {
    const { rowCount } = await query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Session not found" });
    return { ok: true };
  });

  // GET /auth/me
  app.get("/me", { preHandler: app.requireAuth }, async (req) => {
    return {
      user: {
        id: req.user.user_id,
        email: req.user.email,
        name: req.user.name,
        timezone: req.user.timezone
      }
    };
  });
}
