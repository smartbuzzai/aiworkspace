// ═══════════════════════════════════════════════════════════════
//  API Server — Fastify
//  Routes: auth, contacts, emails, events, projects, tasks,
//          files, assistant (chat + voice)
// ═══════════════════════════════════════════════════════════════

import { validateEnv } from "./lib/validate-env.js";
validateEnv("api");

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";

import { db } from "./lib/db.js";
import { redis } from "./lib/redis.js";
import { requireAuth } from "./lib/auth.js";
import { checkAllServices } from "./lib/services.js";
import { runMigrations } from "./lib/migrate.js";
import { auditHook } from "./lib/audit.js";

import authRoutes from "./routes/auth.js";
import contactsRoutes from "./routes/contacts.js";
import emailsRoutes from "./routes/emails.js";
import eventsRoutes from "./routes/events.js";
import projectsRoutes from "./routes/projects.js";
import tasksRoutes from "./routes/tasks.js";
import filesRoutes from "./routes/files.js";
import assistantRoutes from "./routes/assistant.js";
import accountsRoutes from "./routes/accounts.js";
import pushRoutes from "./routes/push.js";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || "info" },
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024 // 10 MB
});

// ─── Plugins ──────────────────────────────────────────────────
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin === process.env.APP_URL) return cb(null, true);
    cb(new Error("CORS blocked"), false);
  },
  credentials: true
});

await app.register(cookie, { secret: process.env.SESSION_SECRET });
await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } }); // 100 MB
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
  redis,
  skipOnError: true
});

// ─── Health + readiness ───────────────────────────────────────
app.get("/health", async () => ({ ok: true, time: new Date().toISOString() }));

app.get("/ready", async (req, reply) => {
  try {
    await db.query("SELECT 1");
    await redis.ping();
    const services = await checkAllServices();
    return { ok: true, services };
  } catch (err) {
    reply.code(503);
    return { ok: false, error: err.message };
  }
});

// ─── Auth decorator ───────────────────────────────────────────
app.decorate("requireAuth", requireAuth);

// ─── Audit logging ───────────────────────────────────────────
auditHook(app);

// ─── Routes ───────────────────────────────────────────────────
await app.register(authRoutes, { prefix: "/auth" });
await app.register(contactsRoutes, { prefix: "/contacts" });
await app.register(emailsRoutes, { prefix: "/emails" });
await app.register(eventsRoutes, { prefix: "/events" });
await app.register(projectsRoutes, { prefix: "/projects" });
await app.register(tasksRoutes, { prefix: "/tasks" });
await app.register(filesRoutes, { prefix: "/files" });
await app.register(assistantRoutes, { prefix: "/assistant" });
await app.register(accountsRoutes, { prefix: "/accounts" });
await app.register(pushRoutes, { prefix: "/push" });

// ─── Global error handler ─────────────────────────────────────
app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  const status = err.statusCode || 500;
  reply.code(status).send({
    error: status === 500 ? "Internal error" : err.message
  });
});

// ─── Database migrations ──────────────────────────────────────
await runMigrations();

// ─── Start ────────────────────────────────────────────────────
const port = Number(process.env.PORT || 4000);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`API listening on :${port}`);

// Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    app.log.info(`${sig} received, shutting down`);
    await app.close();
    await db.end();
    redis.disconnect();
    process.exit(0);
  });
}
