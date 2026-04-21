// ═══════════════════════════════════════════════════════════════
//  Audit logging — records write operations to audit_log table
//  Registered as a Fastify onResponse hook so it doesn't block requests.
// ═══════════════════════════════════════════════════════════════

import { db } from "./db.js";

// Methods that mutate data
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Paths to skip (health checks, auth token requests, assistant streaming)
const SKIP_PATHS = new Set(["/health", "/ready", "/auth/request", "/auth/verify"]);

function deriveAction(method, path) {
  // POST /contacts → create_contact
  // PATCH /events/uuid → update_event
  // DELETE /files/uuid → delete_file
  const segments = path.split("/").filter(Boolean);
  const verb = method === "POST" ? "create"
    : method === "DELETE" ? "delete"
    : "update";

  // Find the resource name (first non-UUID segment after /api prefix)
  let entity = segments[0] || "unknown";
  // Normalize plurals: contacts → contact
  if (entity.endsWith("s") && entity.length > 3) {
    entity = entity.slice(0, -1);
  }

  // Special sub-actions
  if (segments.length >= 3) {
    const sub = segments[segments.length - 1];
    if (["star", "archive", "read"].includes(sub)) {
      return `${sub}_${entity}`;
    }
  }

  return `${verb}_${entity}`;
}

function deriveEntityId(path) {
  const segments = path.split("/").filter(Boolean);
  // Look for UUID-shaped segment
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const seg of segments) {
    if (uuidRegex.test(seg)) return seg;
  }
  return null;
}

function deriveEntityType(path) {
  const segments = path.split("/").filter(Boolean);
  let type = segments[0] || "unknown";
  if (type.endsWith("s") && type.length > 3) type = type.slice(0, -1);
  return type;
}

export function auditHook(app) {
  app.addHook("onResponse", async (req, reply) => {
    if (!WRITE_METHODS.has(req.method)) return;
    if (SKIP_PATHS.has(req.url) || SKIP_PATHS.has(req.routeOptions?.url)) return;

    // Only log authenticated requests with successful responses
    const userId = req.user?.user_id;
    if (!userId) return;
    if (reply.statusCode >= 400) return;

    const action = deriveAction(req.method, req.url);
    const entityType = deriveEntityType(req.url);
    const entityId = deriveEntityId(req.url);

    // Fire-and-forget — don't slow down the response
    db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        entityType,
        entityId,
        req.ip,
        req.headers["user-agent"] || null,
        JSON.stringify({ method: req.method, path: req.url, status: reply.statusCode })
      ]
    ).catch(err => {
      req.log.warn("audit log write failed: " + err.message);
    });
  });
}
