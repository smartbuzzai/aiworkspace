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
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Your sign-in link",
        text: `Click to sign in: ${link}\n\nExpires in ${LINK_MINUTES} minutes.`
      });
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

  // POST /auth/logout
  app.post("/logout", { preHandler: app.requireAuth }, async (req, reply) => {
    await query(`DELETE FROM sessions WHERE id = $1`, [req.user.session_id]);
    reply.clearCookie("session", { path: "/" });
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
