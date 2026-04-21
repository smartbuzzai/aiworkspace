// ═══════════════════════════════════════════════════════════════
//  Audit logging — records write operations to audit_log table
//  Registered as a Fastify onResponse hook so it doesn't block requests.
// ═══════════════════════════════════════════════════════════════

import { db } from "./db.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SKIP_PATHS = new Set(["/health", "/ready", "/auth/request", "/auth/verify"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function singularize(word) {
  return (word.endsWith("s") && word.length > 3) ? word.slice(0, -1) : word;
}

function parseAuditInfo(method, url) {
  const segments = url.split("/").filter(Boolean);
  const entity = singularize(segments[0] || "unknown");

  // Action: sub-action routes like /threads/:id/star
  let action;
  const lastSeg = segments[segments.length - 1];
  if (segments.length >= 3 && ["star", "archive", "read"].includes(lastSeg)) {
    action = `${lastSeg}_${entity}`;
  } else {
    const verb = method === "POST" ? "create" : method === "DELETE" ? "delete" : "update";
    action = `${verb}_${entity}`;
  }

  // Entity ID: first UUID-shaped segment
  const entityId = segments.find(s => UUID_RE.test(s)) || null;

  return { action, entityType: entity, entityId };
}

export function auditHook(app) {
  app.addHook("onResponse", async (req, reply) => {
    if (!WRITE_METHODS.has(req.method)) return;
    if (SKIP_PATHS.has(req.url) || SKIP_PATHS.has(req.routeOptions?.url)) return;

    const userId = req.user?.user_id;
    if (!userId) return;
    if (reply.statusCode >= 400) return;

    const { action, entityType, entityId } = parseAuditInfo(req.method, req.url);

    db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId, req.ip,
       req.headers["user-agent"] || null,
       JSON.stringify({ method: req.method, path: req.url, status: reply.statusCode })]
    ).catch(err => {
      req.log.warn({ err }, "audit log write failed");
    });
  });
}
