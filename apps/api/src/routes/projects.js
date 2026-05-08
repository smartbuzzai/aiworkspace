import crypto from "node:crypto";
import { z } from "zod";
import { query } from "../lib/db.js";
import { queueClientNotify } from "../lib/notify.js";

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  stage: z.enum(["backlog","discovery","in_progress","review","done"]).optional().default("backlog"),
  owner: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  progress: z.number().int().min(0).max(100).optional().default(0),
  color: z.string().optional().default("#3b82f6")
});

// ─── Access helpers ─────────────────────────────────────────
// Returns the user's role on a project: 'owner', 'editor', 'viewer', or null
async function getUserRole(projectId, userId) {
  const { rows } = await query(
    `SELECT 'owner' AS role FROM projects WHERE id = $1 AND user_id = $2 AND NOT is_archived
     UNION ALL
     SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2
     LIMIT 1`,
    [projectId, userId]
  );
  return rows[0]?.role || null;
}

async function requireAccess(req, reply, minRole = "viewer") {
  const role = await getUserRole(req.params.id, req.user.user_id);
  if (!role) { reply.code(404).send({ error: "Project not found" }); return null; }
  const levels = { viewer: 1, editor: 2, owner: 3 };
  if ((levels[role] || 0) < (levels[minRole] || 0)) {
    reply.code(403).send({ error: "Insufficient permissions" }); return null;
  }
  return role;
}

export default async function projectsRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // GET /projects — includes owned + member projects
  app.get("/", async (req) => {
    const { rows } = await query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS tasks_done,
              CASE WHEN p.user_id = $1 THEN 'owner'
                   ELSE (SELECT pm.role FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)
              END AS my_role
         FROM projects p
        WHERE NOT p.is_archived
          AND (p.user_id = $1 OR p.id IN (SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $1))
        ORDER BY p.updated_at DESC`,
      [req.user.user_id]
    );
    return { projects: rows };
  });

  app.post("/", async (req) => {
    const d = projectSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO projects (user_id, name, description, stage, owner, due_date, progress, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.user_id, d.name, d.description, d.stage, d.owner, d.due_date, d.progress, d.color]
    );
    return { project: rows[0] };
  });

  app.patch("/:id", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const data = projectSchema.partial().parse(req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return { ok: true };
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const { rows } = await query(
      `UPDATE projects SET ${sets} WHERE id = $1 AND NOT is_archived RETURNING *`,
      [req.params.id, ...keys.map(k => data[k])]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    return { project: rows[0] };
  });

  app.delete("/:id", async (req, reply) => {
    const role = await requireAccess(req, reply, "owner");
    if (!role) return;
    await query(`UPDATE projects SET is_archived = true WHERE id = $1`, [req.params.id]);
    return { ok: true };
  });

  // ── Share management ──────────────────────────────────────────

  // GET /projects/:id/shares — list shares for a project
  app.get("/:id/shares", async (req, reply) => {
    const role = await requireAccess(req, reply, "viewer");
    if (!role) return;
    const { rows } = await query(
      `SELECT id, token, client_name, client_email, permissions, notify_on,
              is_active, last_viewed_at, created_at
         FROM project_shares
        WHERE project_id = $1
        ORDER BY created_at DESC`,
      [req.params.id]
    );
    return { shares: rows };
  });

  // POST /projects/:id/shares — create a share link (owner/editor)
  app.post("/:id/shares", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const schema = z.object({
      client_name: z.string().max(100).optional(),
      client_email: z.string().email().optional(),
      permissions: z.enum(["view", "comment"]).default("view")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
    const { client_name, client_email, permissions } = parsed.data;

    const token = crypto.randomBytes(24).toString("base64url");

    const { rows } = await query(
      `INSERT INTO project_shares (project_id, user_id, token, client_name, client_email, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, token, client_name, client_email, permissions, created_at`,
      [req.params.id, req.user.user_id, token, client_name || null, client_email || null, permissions]
    );

    const portalUrl = `${process.env.APP_URL}/portal/${token}`;
    return { share: rows[0], portal_url: portalUrl };
  });

  // DELETE /projects/:id/shares/:shareId — revoke a share (owner/editor)
  app.delete("/:id/shares/:shareId", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const { rowCount } = await query(
      `UPDATE project_shares SET is_active = false
        WHERE id = $1 AND project_id = $2`,
      [req.params.shareId, req.params.id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Share not found" });
    return { ok: true };
  });

  // PATCH /tasks/:taskId/visibility — toggle client_visible on a task (editor+)
  app.patch("/:id/tasks/:taskId/visibility", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const schema = z.object({ client_visible: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

    const { rowCount } = await query(
      `UPDATE tasks SET client_visible = $1
        WHERE id = $2 AND project_id = $3`,
      [parsed.data.client_visible, req.params.taskId, req.params.id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Task not found" });
    return { ok: true };
  });

  // ── Project updates (status reports) ──────────────────────────

  // GET /projects/:id/updates — list updates for a project
  app.get("/:id/updates", async (req, reply) => {
    const role = await requireAccess(req, reply, "viewer");
    if (!role) return;
    const { rows } = await query(
      `SELECT * FROM project_updates
        WHERE project_id = $1
        ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );
    return { updates: rows };
  });

  // POST /projects/:id/updates — create/save an update (editor+)
  app.post("/:id/updates", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const schema = z.object({
      title: z.string().max(200).optional(),
      body: z.string().min(1).max(5000),
      publish: z.boolean().default(false)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
    const { title, body, publish } = parsed.data;

    const { rows } = await query(
      `INSERT INTO project_updates (project_id, user_id, title, body, published_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user.user_id, title || null, body,
       publish ? new Date() : null]
    );
    if (publish) {
      queueClientNotify(req.params.id, "update_published", title || "Status update");
    }
    return { update: rows[0] };
  });

  // PATCH /projects/:id/updates/:updateId — publish or edit
  app.patch("/:id/updates/:updateId", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const schema = z.object({
      title: z.string().max(200).optional(),
      body: z.string().min(1).max(5000).optional(),
      publish: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
    const { title, body, publish } = parsed.data;

    const sets = [];
    const params = [req.params.updateId, req.params.id, req.user.user_id];
    if (title !== undefined) { params.push(title); sets.push(`title = $${params.length}`); }
    if (body !== undefined) { params.push(body); sets.push(`body = $${params.length}`); }
    if (publish === true) sets.push(`published_at = now()`);
    if (sets.length === 0) return { ok: true };

    const { rows } = await query(
      `UPDATE project_updates SET ${sets.join(", ")}
        WHERE id = $1 AND project_id = $2 AND user_id = $3
        RETURNING *`,
      params
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Update not found" });
    if (publish === true) {
      queueClientNotify(req.params.id, "update_published", rows[0].title || "Status update");
    }
    return { update: rows[0] };
  });

  // GET /projects/:id/comments — view comments
  app.get("/:id/comments", async (req, reply) => {
    const role = await requireAccess(req, reply, "viewer");
    if (!role) return;
    const { rows } = await query(
      `SELECT * FROM project_comments
        WHERE project_id = $1
        ORDER BY created_at ASC LIMIT 100`,
      [req.params.id]
    );
    return { comments: rows };
  });

  // POST /projects/:id/comments — team member posts a comment
  app.post("/:id/comments", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const schema = z.object({
      body: z.string().min(1).max(2000),
      task_id: z.string().uuid().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

    const { rows } = await query(
      `INSERT INTO project_comments (project_id, task_id, author_type, author_name, body)
       VALUES ($1, $2, 'owner', $3, $4) RETURNING *`,
      [req.params.id, parsed.data.task_id || null,
       req.user.name || req.user.email, parsed.data.body]
    );
    queueClientNotify(req.params.id, "comment_added", "New comment from the team");
    return { comment: rows[0] };
  });

  // ── Team member management ────────────────────────────────────

  // GET /projects/:id/members — list team members
  app.get("/:id/members", async (req, reply) => {
    const role = await requireAccess(req, reply, "viewer");
    if (!role) return;

    // Get owner
    const { rows: ownerRows } = await query(
      `SELECT u.id, u.email, u.name, 'owner' AS role, p.created_at
         FROM projects p JOIN users u ON u.id = p.user_id
        WHERE p.id = $1`,
      [req.params.id]
    );

    // Get members
    const { rows: memberRows } = await query(
      `SELECT u.id, u.email, u.name, pm.role, pm.created_at
         FROM project_members pm JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = $1
        ORDER BY pm.created_at`,
      [req.params.id]
    );

    return { members: [...ownerRows, ...memberRows] };
  });

  // POST /projects/:id/members — invite a team member by email
  app.post("/:id/members", async (req, reply) => {
    const role = await requireAccess(req, reply, "owner");
    if (!role) return;

    const schema = z.object({
      email: z.string().email(),
      role: z.enum(["editor", "viewer"]).default("editor")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

    // Find the user by email
    const { rows: userRows } = await query(
      `SELECT id, email, name FROM users WHERE email = $1`,
      [parsed.data.email.toLowerCase()]
    );
    if (userRows.length === 0) {
      return reply.code(404).send({ error: "No workspace account found for that email. They need to sign up first." });
    }

    const targetUser = userRows[0];

    // Check they're not already the owner
    const { rows: proj } = await query(
      `SELECT user_id FROM projects WHERE id = $1`, [req.params.id]
    );
    if (proj[0].user_id === targetUser.id) {
      return reply.code(400).send({ error: "That user is already the project owner." });
    }

    // Upsert membership
    const { rows } = await query(
      `INSERT INTO project_members (project_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING id, role, created_at`,
      [req.params.id, targetUser.id, parsed.data.role, req.user.user_id]
    );

    return {
      member: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: rows[0].role,
        created_at: rows[0].created_at
      }
    };
  });

  // PATCH /projects/:id/members/:userId — change a member's role
  app.patch("/:id/members/:userId", async (req, reply) => {
    const role = await requireAccess(req, reply, "owner");
    if (!role) return;

    const schema = z.object({ role: z.enum(["editor", "viewer"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

    const { rowCount } = await query(
      `UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3`,
      [parsed.data.role, req.params.id, req.params.userId]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Member not found" });
    return { ok: true };
  });

  // DELETE /projects/:id/members/:userId — remove a member
  app.delete("/:id/members/:userId", async (req, reply) => {
    const role = await requireAccess(req, reply, "owner");
    if (!role) return;

    const { rowCount } = await query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [req.params.id, req.params.userId]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "Member not found" });
    return { ok: true };
  });

  // ── Project files ─────────────────────────────────────────────

  // GET /projects/:id/files — list files linked to this project
  app.get("/:id/files", async (req, reply) => {
    const role = await requireAccess(req, reply, "viewer");
    if (!role) return;
    const { rows } = await query(
      `SELECT f.id, f.name, f.kind, f.mime_type, f.size_bytes, f.client_visible,
              f.created_at, fo.name AS folder_name, fo.path AS folder_path
         FROM files f
    LEFT JOIN folders fo ON fo.id = f.folder_id
        WHERE f.project_id = $1
        ORDER BY fo.path NULLS FIRST, f.name`,
      [req.params.id]
    );
    return { files: rows };
  });

  // POST /projects/:id/files/:fileId — link a file to the project
  app.post("/:id/files/:fileId", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const { rowCount } = await query(
      `UPDATE files SET project_id = $1 WHERE id = $2
        AND (user_id = $3 OR user_id IN (SELECT user_id FROM projects WHERE id = $1))`,
      [req.params.id, req.params.fileId, req.user.user_id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "File not found" });
    return { ok: true };
  });

  // DELETE /projects/:id/files/:fileId — unlink a file from the project
  app.delete("/:id/files/:fileId", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const { rowCount } = await query(
      `UPDATE files SET project_id = NULL WHERE id = $1 AND project_id = $2`,
      [req.params.fileId, req.params.id]
    );
    if (rowCount === 0) return reply.code(404).send({ error: "File not found" });
    return { ok: true };
  });

  // GET /projects/:id/available-files — files owned by any team member, not yet linked
  app.get("/:id/available-files", async (req, reply) => {
    const role = await requireAccess(req, reply, "editor");
    if (!role) return;
    const { rows } = await query(
      `SELECT f.id, f.name, f.kind, f.size_bytes, f.created_at,
              fo.name AS folder_name, fo.path AS folder_path
         FROM files f
    LEFT JOIN folders fo ON fo.id = f.folder_id
        WHERE f.project_id IS NULL
          AND f.user_id IN (
            SELECT user_id FROM projects WHERE id = $1
            UNION
            SELECT user_id FROM project_members WHERE project_id = $1
          )
        ORDER BY f.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    return { files: rows };
  });
}
