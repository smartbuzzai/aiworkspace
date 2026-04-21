import crypto from "node:crypto";
import { query } from "./db.js";

// SHA-256 hash for storing session tokens
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

// Middleware: verify session cookie, attach req.user
export async function requireAuth(req, reply) {
  const token = req.cookies.session;
  if (!token) {
    reply.code(401).send({ error: "Not authenticated" });
    return;
  }

  const tokenHash = hashToken(token);
  const { rows } = await query(
    `SELECT s.id AS session_id, s.user_id, u.email, u.name, u.timezone
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
      LIMIT 1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    reply.code(401).send({ error: "Invalid or expired session" });
    return;
  }

  req.user = rows[0];

  // Update last_seen async, don't block the request
  query(
    `UPDATE sessions SET last_seen_at = now() WHERE id = $1`,
    [req.user.session_id]
  ).catch(() => {});
}

// Per-user encryption key derivation (for IMAP passwords, etc.)
export function userKey(userId) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`userkey:${userId}`)
    .digest();
}

export function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decrypt(buf, key) {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
