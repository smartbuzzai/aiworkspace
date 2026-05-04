// ═══════════════════════════════════════════════════════════════
//  Client Portal — public project view for external clients
//  Serves HTML page + JSON API, connects as portal_reader
// ═══════════════════════════════════════════════════════════════

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import pg from "pg";
import { portalPage } from "./page.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000
});

async function query(text, params) {
  return pool.query(text, params);
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "OPTIONS"]
});

await app.register(rateLimit, {
  max: 60,
  timeWindow: "1 minute"
});

// ─── Health check ─────────────────────────────────────────────
app.get("/health", async () => {
  return { ok: true, time: new Date().toISOString() };
});

// ─── Token resolution middleware ──────────────────────────────
app.decorateRequest("share", null);
app.decorateRequest("project", null);

async function resolveToken(req, reply) {
  const { token } = req.params;
  if (!token || token.length < 10) {
    return reply.code(400).send({ error: "Invalid token" });
  }

  const { rows } = await query(
    `SELECT s.*, p.name AS project_name, p.description AS project_description,
            p.stage, p.progress, p.due_date, p.color
       FROM project_shares s
       JOIN projects p ON p.id = s.project_id
      WHERE s.token = $1 AND s.is_active = true AND NOT p.is_archived`,
    [token]
  );

  if (rows.length === 0) {
    return reply.code(404).send({ error: "Share not found or expired" });
  }

  req.share = rows[0];
  req.project = {
    id: rows[0].project_id,
    name: rows[0].project_name,
    description: rows[0].project_description,
    stage: rows[0].stage,
    progress: rows[0].progress,
    due_date: rows[0].due_date,
    color: rows[0].color
  };

  query(`UPDATE project_shares SET last_viewed_at = now() WHERE id = $1`, [rows[0].id]).catch(() => {});
}

// ─── GET /:token — HTML portal page ──────────────────────────
app.get("/:token", { preHandler: resolveToken }, async (req, reply) => {
  reply.header("Content-Type", "text/html; charset=utf-8");
  return portalPage(req.project, req.share, req.params.token);
});

// ─── API routes under /:token/api/* ──────────────────────────

app.get("/:token/api/overview", { preHandler: resolveToken }, async (req) => {
  const { rows: taskStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE client_visible) AS visible_tasks,
       COUNT(*) FILTER (WHERE client_visible AND status = 'done') AS completed_tasks
     FROM tasks WHERE project_id = $1`,
    [req.project.id]
  );
  return {
    project: req.project,
    share: { client_name: req.share.client_name, permissions: req.share.permissions },
    stats: {
      visible_tasks: Number(taskStats[0]?.visible_tasks || 0),
      completed_tasks: Number(taskStats[0]?.completed_tasks || 0),
    }
  };
});

app.get("/:token/api/tasks", { preHandler: resolveToken }, async (req) => {
  const { rows } = await query(
    `SELECT id, title, description, priority, status, due_at,
            completed_at, tags, created_at, updated_at
       FROM tasks
      WHERE project_id = $1 AND client_visible = true
      ORDER BY
        CASE status WHEN 'in_progress' THEN 1 WHEN 'open' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
        created_at DESC`,
    [req.project.id]
  );
  return { tasks: rows };
});

app.get("/:token/api/updates", { preHandler: resolveToken }, async (req) => {
  const { rows } = await query(
    `SELECT id, title, body, published_at
       FROM project_updates
      WHERE project_id = $1 AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT 20`,
    [req.project.id]
  );
  return { updates: rows };
});

app.get("/:token/api/comments", { preHandler: resolveToken }, async (req) => {
  const { rows } = await query(
    `SELECT id, task_id, author_type, author_name, body, created_at
       FROM project_comments WHERE project_id = $1
       ORDER BY created_at ASC LIMIT 100`,
    [req.project.id]
  );
  return { comments: rows };
});

app.post("/:token/api/comments", {
  preHandler: resolveToken,
  config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
}, async (req, reply) => {
  if (req.share.permissions !== "comment") {
    return reply.code(403).send({ error: "Comments not enabled for this share" });
  }
  const { z } = await import("zod");
  const schema = z.object({
    body: z.string().min(1).max(2000),
    task_id: z.string().uuid().nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

  const { body, task_id } = parsed.data;
  const { rows } = await query(
    `INSERT INTO project_comments (project_id, task_id, share_id, author_type, author_name, body)
     VALUES ($1, $2, $3, 'client', $4, $5)
     RETURNING id, author_type, author_name, body, created_at`,
    [req.project.id, task_id || null, req.share.id,
     req.share.client_name || "Client", body]
  );
  return { comment: rows[0] };
});

// ─── Start ────────────────────────────────────────────────────
const port = Number(process.env.PORT || 4100);
await app.listen({ port, host: "0.0.0.0" });
console.log(`Portal listening on :${port}`);
