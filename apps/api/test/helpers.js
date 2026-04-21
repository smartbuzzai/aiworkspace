// ═══════════════════════════════════════════════════════════════
//  Test helpers — builds a Fastify app instance with a real DB
//  connection for integration tests.
//
//  Requires: TEST_DATABASE_URL env var pointing to a test database.
//  Run: npm test  (uses node --test)
// ═══════════════════════════════════════════════════════════════

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import crypto from "node:crypto";

// ─── Mock redis (in-memory) ─────────────────────────────────
const mockRedis = {
  incr: async () => 1,
  expire: async () => {},
  ping: async () => "PONG",
  disconnect: () => {},
  on: () => {},
  status: "ready",
};

// ─── Build a test-ready Fastify app ─────────────────────────
export async function buildApp() {
  // Import the real db module — tests need a live Postgres
  const { db, query } = await import("../src/lib/db.js");

  const app = Fastify({ logger: false });

  await app.register(cookie, { secret: process.env.SESSION_SECRET || "test-secret" });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Auth decorator
  const { requireAuth } = await import("../src/lib/auth.js");
  app.decorate("requireAuth", requireAuth);

  // Routes
  const { default: authRoutes } = await import("../src/routes/auth.js");
  const { default: contactsRoutes } = await import("../src/routes/contacts.js");
  const { default: tasksRoutes } = await import("../src/routes/tasks.js");
  const { default: eventsRoutes } = await import("../src/routes/events.js");
  const { default: projectsRoutes } = await import("../src/routes/projects.js");

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(contactsRoutes, { prefix: "/contacts" });
  await app.register(tasksRoutes, { prefix: "/tasks" });
  await app.register(eventsRoutes, { prefix: "/events" });
  await app.register(projectsRoutes, { prefix: "/projects" });

  // Health
  app.get("/health", async () => ({ ok: true }));

  await app.ready();
  return { app, db, query };
}

// ─── Create a test user and session cookie ───────────────────
export async function createTestUser(query) {
  const email = `test-${Date.now()}@test.local`;
  const { rows } = await query(
    `INSERT INTO users (email, name, timezone)
     VALUES ($1, 'Test User', 'UTC')
     ON CONFLICT (email) DO UPDATE SET name = 'Test User'
     RETURNING id, email, name, timezone`,
    [email]
  );
  const user = rows[0];

  // Create session
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 86400000);

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return { user, token, cookie: `session=${token}` };
}

// ─── Clean up test data ──────────────────────────────────────
export async function cleanup(query, userId) {
  // Delete in dependency order
  await query(`DELETE FROM tasks WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM projects WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM events WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM contacts WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
}
