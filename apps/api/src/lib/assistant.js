// ═══════════════════════════════════════════════════════════════
//  Assistant internals — context retrieval + tool calls
// ═══════════════════════════════════════════════════════════════

import crypto from "node:crypto";
import * as Minio from "minio";
import { query } from "./db.js";
import { fetchWithTimeout } from "./services.js";

// ─── MinIO client for reading file objects ───────────────────
let mc, S3_BUCKET;
try {
  const ep = new URL(process.env.S3_ENDPOINT || "http://minio:9000");
  mc = new Minio.Client({
    endPoint: ep.hostname,
    port: Number(ep.port) || (ep.protocol === "https:" ? 443 : 80),
    useSSL: ep.protocol === "https:",
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY
  });
  S3_BUCKET = process.env.S3_BUCKET || "workspace";
} catch {}

const PROVIDER = process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq");
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const OLLAMA = process.env.OLLAMA_HOST || "http://ollama:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";

// ─── Embedding helper ─────────────────────────────────────────
export async function embed(text) {
  const r = await fetchWithTimeout(`${OLLAMA}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  }, 15000);
  if (!r.ok) throw new Error(`embed failed: ${r.status}`);
  const j = await r.json();
  return j.embedding;
}

// ─── Context builder ──────────────────────────────────────────
//  Pulls relevant data for the user's query using:
//    1. Vector similarity on the embeddings table
//    2. Always-fresh structural data (today's events, unread, open tasks)
// ─────────────────────────────────────────────────────────────
export async function buildContext(userId, userMessage) {
  const parts = [];

  const [
    { rows: todayEvents },
    { rows: openTasks },
    { rows: unread },
    { rows: projects },
  ] = await Promise.all([
    query(
      `SELECT title, starts_at, ends_at, location
         FROM events
        WHERE user_id = $1
          AND starts_at::date = current_date
        ORDER BY starts_at LIMIT 10`,
      [userId]
    ),
    query(
      `SELECT t.title, t.priority, t.due_at, p.name AS project
         FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.user_id = $1 AND t.status IN ('open','in_progress')
        ORDER BY
          CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          t.due_at NULLS LAST
        LIMIT 8`,
      [userId]
    ),
    query(
      `SELECT subject, ai_summary, participants
         FROM email_threads
        WHERE user_id = $1 AND unread_count > 0
        ORDER BY last_message_at DESC LIMIT 5`,
      [userId]
    ),
    query(
      `SELECT p.name, p.stage, p.progress,
              (SELECT COUNT(*) FROM project_shares s WHERE s.project_id = p.id AND s.is_active) AS share_count
         FROM projects p
        WHERE p.user_id = $1 AND NOT p.is_archived
        ORDER BY p.updated_at DESC LIMIT 8`,
      [userId]
    ),
  ]);

  if (todayEvents.length) {
    parts.push("TODAY'S EVENTS:");
    todayEvents.forEach(e => {
      const t = new Date(e.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      parts.push(`- ${t} — ${e.title}${e.location ? ` @ ${e.location}` : ""}`);
    });
  }

  if (openTasks.length) {
    parts.push("\nOPEN TASKS:");
    openTasks.forEach(t => {
      parts.push(`- [${t.priority}] ${t.title}${t.project ? ` (${t.project})` : ""}`);
    });
  }

  if (unread.length) {
    parts.push("\nUNREAD EMAIL THREADS:");
    unread.forEach(e => {
      parts.push(`- ${e.subject}${e.ai_summary ? ` — ${e.ai_summary}` : ""}`);
    });
  }

  if (projects.length) {
    parts.push("\nACTIVE PROJECTS:");
    projects.forEach(p => {
      parts.push(`- ${p.name} (${p.stage}, ${p.progress}% done${Number(p.share_count) > 0 ? `, shared with ${p.share_count} client${Number(p.share_count) > 1 ? "s" : ""}` : ""})`);
    });
  }

  // Semantic retrieval — only if the embeddings table has data
  try {
    const qvec = await embed(userMessage);
    const { rows: related } = await query(
      `SELECT source_type, content
         FROM embeddings
        WHERE user_id = $1
        ORDER BY embedding <=> $2::vector
        LIMIT 5`,
      [userId, `[${qvec.join(",")}]`]
    );
    if (related.length) {
      parts.push("\nRELATED CONTEXT:");
      related.forEach(r => {
        parts.push(`[${r.source_type}] ${r.content.slice(0, 300)}`);
      });
    }
  } catch (err) {
    // Embedding model not pulled yet or no data — skip silently
  }

  return parts.join("\n") || "(no contextual data yet)";
}

// ─── Tool schemas exposed to the model ────────────────────────
export const toolSchemas = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task for the user.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["high","medium","low"] },
          due_at: { type: "string", description: "ISO 8601 datetime, optional" },
          project_name: { type: "string", description: "Match to existing project if possible" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_event",
      description: "Create a calendar event.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          starts_at: { type: "string", description: "ISO 8601" },
          ends_at: { type: "string", description: "ISO 8601" },
          location: { type: "string" },
          event_type: { type: "string", enum: ["meeting","call","focus","task","personal"] }
        },
        required: ["title","starts_at","ends_at"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Find contacts by name, company, or email.",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_contact_note",
      description: "Append a note to an existing contact.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          note: { type: "string" }
        },
        required: ["contact_id","note"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_email_reply",
      description: "Draft a reply to an email thread. Returns draft text — user must approve before sending.",
      parameters: {
        type: "object",
        properties: {
          thread_id: { type: "string" },
          body: { type: "string" }
        },
        required: ["thread_id","body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_files",
      description: "Search the user's document and media library. Returns file IDs and names. Use read_file to get the actual content.",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the extracted text content of a PDF or document file. Use find_files first to get the file ID, then read_file to get its content. Works for PDFs and documents that have been processed.",
      parameters: {
        type: "object",
        properties: {
          file_name: { type: "string", description: "Name or partial name of the file to read. Will fuzzy-match." }
        },
        required: ["file_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_image",
      description: "Analyze an uploaded image using AI vision. Describe what's in the image, read text from screenshots, extract data from charts, or answer questions about visual content. Works with PNG, JPG, GIF, WebP images.",
      parameters: {
        type: "object",
        properties: {
          file_name: { type: "string", description: "Name or partial name of the image file." },
          question: { type: "string", description: "What to analyze or look for in the image. Default: describe the image." }
        },
        required: ["file_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "summarize_thread",
      description: "Summarize a specific email thread by id.",
      parameters: {
        type: "object",
        properties: { thread_id: { type: "string" } },
        required: ["thread_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_project_update",
      description: "Generate an AI-drafted status update for a client project. Pulls recent task activity and produces a professional summary. The user can review and publish it.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Name or partial name of the project" }
        },
        required: ["project_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "share_project",
      description: "Create a share link so an external client can view the project portal. Returns the portal URL.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Name or partial name of the project" },
          client_name: { type: "string", description: "Client's name or company" },
          client_email: { type: "string", description: "Client's email address, optional" },
          permissions: { type: "string", enum: ["view", "comment"], description: "Whether the client can comment or just view" }
        },
        required: ["project_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "notify_client",
      description: "Send a one-off notification email to all active shared clients on a project with a custom message.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Name or partial name of the project" },
          message: { type: "string", description: "The message to send to clients" }
        },
        required: ["project_name", "message"]
      }
    }
  }
];

// ─── Tool runner ──────────────────────────────────────────────
//  Each tool is server-side validated before touching the DB.
//  The model never writes raw SQL — only invokes these functions.
// ─────────────────────────────────────────────────────────────
export async function runTool(toolCall, userId) {
  const name = toolCall.function?.name;
  const args = typeof toolCall.function?.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : (toolCall.function?.arguments || {});

  try {
    switch (name) {

      case "create_task": {
        let projectId = null;
        if (args.project_name) {
          const { rows } = await query(
            `SELECT id FROM projects
              WHERE user_id = $1 AND name ILIKE $2 AND NOT is_archived
              LIMIT 1`,
            [userId, `%${args.project_name}%`]
          );
          projectId = rows[0]?.id || null;
        }
        const { rows } = await query(
          `INSERT INTO tasks (user_id, project_id, title, priority, due_at, source)
           VALUES ($1,$2,$3,$4,$5,'ai') RETURNING id, title, priority`,
          [userId, projectId, args.title, args.priority || "medium", args.due_at || null]
        );
        return { ok: true, task: rows[0] };
      }

      case "schedule_event": {
        const { rows } = await query(
          `INSERT INTO events (user_id, title, starts_at, ends_at, location, event_type)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id, title, starts_at`,
          [userId, args.title, args.starts_at, args.ends_at,
           args.location || null, args.event_type || "meeting"]
        );
        return { ok: true, event: rows[0] };
      }

      case "search_contacts": {
        const { rows } = await query(
          `SELECT id, name, email, company, role, score, status
             FROM contacts
            WHERE user_id = $1
              AND (name ILIKE $2 OR email ILIKE $2 OR company ILIKE $2)
            ORDER BY score DESC LIMIT 10`,
          [userId, `%${args.q}%`]
        );
        return { ok: true, contacts: rows };
      }

      case "add_contact_note": {
        const { rows } = await query(
          `UPDATE contacts
              SET notes = COALESCE(notes,'') || E'\n' || $3
            WHERE id = $1 AND user_id = $2
            RETURNING id, name`,
          [args.contact_id, userId, args.note]
        );
        if (rows.length === 0) return { ok: false, error: "Contact not found" };
        await query(
          `INSERT INTO contact_interactions (contact_id, kind, summary, ref_type)
           VALUES ($1,'note',$2,'manual')`,
          [args.contact_id, args.note]
        );
        return { ok: true, contact: rows[0] };
      }

      case "draft_email_reply": {
        return {
          ok: true,
          draft: args.body,
          thread_id: args.thread_id,
          message: "Draft prepared. User must review and click Send."
        };
      }

      case "find_files": {
        const cleanQ = args.q.replace(/\b(file|document|pdf|doc|image|photo)\b/gi, "").replace(/\s+/g, " ").trim() || args.q;
        const { rows } = await query(
          `SELECT id, name, kind, size_bytes, created_at,
                  CASE WHEN extracted_text IS NOT NULL THEN true ELSE false END AS has_content
             FROM files
            WHERE (user_id = $1
              OR project_id IN (SELECT id FROM projects WHERE user_id = $1)
              OR project_id IN (SELECT project_id FROM project_members WHERE user_id = $1))
              AND (name ILIKE $2 OR extracted_text ILIKE $2)
            ORDER BY created_at DESC LIMIT 10`,
          [userId, `%${cleanQ}%`]
        );
        return { ok: true, files: rows };
      }

      case "read_file": {
        const cleanFileName = args.file_name
          .replace(/\b(file|document|pdf|doc|docx|txt)\b/gi, "")
          .replace(/\s+/g, " ").trim() || args.file_name;
        const { rows } = await query(
          `SELECT f.id, f.name, f.kind, f.extracted_text
             FROM files f
            WHERE f.name ILIKE $2
              AND f.extracted_text IS NOT NULL
              AND (f.user_id = $1
                OR f.project_id IN (SELECT id FROM projects WHERE user_id = $1)
                OR f.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1))
            ORDER BY f.created_at DESC LIMIT 1`,
          [userId, `%${cleanFileName}%`]
        );
        if (rows.length === 0) {
          return { ok: false, error: `No readable file found matching "${args.file_name}". The file may not have been processed yet, or it may not be a PDF/document.` };
        }
        return {
          ok: true,
          file_name: rows[0].name,
          file_type: rows[0].kind,
          content: rows[0].extracted_text
        };
      }

      case "analyze_image": {
        if (!mc) return { ok: false, error: "Storage not configured" };
        if (!ANTHROPIC_KEY && !GROQ_KEY) return { ok: false, error: "No vision API key configured" };

        // Clean search term — strip words like "image", "file", "photo", "picture"
        const cleanName = args.file_name
          .replace(/\b(image|file|photo|picture|screenshot|png|jpg|jpeg|gif|webp)\b/gi, "")
          .replace(/\s+/g, " ").trim();
        const searchTerm = cleanName || args.file_name;

        // Find the image file
        const { rows: imgFiles } = await query(
          `SELECT f.id, f.name, f.mime_type, f.s3_key, f.s3_bucket, f.size_bytes
             FROM files f
            WHERE f.name ILIKE $2
              AND f.mime_type LIKE 'image/%'
              AND (f.user_id = $1
                OR f.project_id IN (SELECT id FROM projects WHERE user_id = $1)
                OR f.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1))
            ORDER BY f.created_at DESC LIMIT 1`,
          [userId, `%${searchTerm}%`]
        );
        if (imgFiles.length === 0) {
          return { ok: false, error: `No image found matching "${args.file_name}". Make sure it's uploaded to the Library.` };
        }

        const img = imgFiles[0];

        // Limit to 10MB
        if (img.size_bytes > 10 * 1024 * 1024) {
          return { ok: false, error: `Image "${img.name}" is too large (${Math.round(img.size_bytes / 1048576)}MB). Max 10MB.` };
        }

        // Fetch image from MinIO and convert to base64
        const stream = await mc.getObject(img.s3_bucket || S3_BUCKET, img.s3_key);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        const base64 = buf.toString("base64");
        const dataUrl = `data:${img.mime_type};base64,${base64}`;

        const question = args.question || "Describe this image in detail.";

        let analysis;

        if (PROVIDER === "anthropic" && ANTHROPIC_KEY) {
          // Use Claude's native vision
          const visionRes = await fetchWithTimeout(ANTHROPIC_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_KEY,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: ANTHROPIC_MODEL,
              messages: [{
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: img.mime_type, data: base64 } },
                  { type: "text", text: question }
                ]
              }],
              max_tokens: 1024,
              temperature: 0.3
            })
          }, 30000);

          if (!visionRes.ok) {
            const errBody = await visionRes.text().catch(() => "");
            let errMsg;
            try { errMsg = JSON.parse(errBody).error?.message; } catch { errMsg = errBody; }
            return { ok: false, error: `Vision analysis failed: ${errMsg}` };
          }
          const visionData = await visionRes.json();
          analysis = visionData.content?.[0]?.text || "No analysis returned.";
        } else if (GROQ_KEY) {
          // Fallback to Groq vision
          const visionRes = await fetchWithTimeout(GROQ_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
              model: GROQ_VISION_MODEL,
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: question },
                  { type: "image_url", image_url: { url: dataUrl } }
                ]
              }],
              max_tokens: 800,
              temperature: 0.3
            })
          }, 30000);

          if (!visionRes.ok) {
            const errBody = await visionRes.text().catch(() => "");
            let errMsg;
            try { errMsg = JSON.parse(errBody).error?.message; } catch { errMsg = errBody; }
            return { ok: false, error: `Vision analysis failed: ${errMsg}` };
          }
          const visionData = await visionRes.json();
          analysis = visionData.choices?.[0]?.message?.content || "No analysis returned.";
        } else {
          return { ok: false, error: "No vision-capable API configured" };
        }

        return {
          ok: true,
          file_name: img.name,
          analysis
        };
      }

      case "summarize_thread": {
        const { rows: thread } = await query(
          `SELECT subject, ai_summary FROM email_threads
            WHERE id = $1 AND user_id = $2`,
          [args.thread_id, userId]
        );
        if (thread.length === 0) return { ok: false, error: "Thread not found" };

        const { rows: msgs } = await query(
          `SELECT from_address, body_text
             FROM emails WHERE thread_id = $1
             ORDER BY received_at ASC LIMIT 20`,
          [args.thread_id]
        );
        return {
          ok: true,
          subject: thread[0].subject,
          existing_summary: thread[0].ai_summary,
          messages: msgs.map(m => ({
            from: m.from_address,
            preview: (m.body_text || "").slice(0, 400)
          }))
        };
      }

      case "generate_project_update": {
        const { rows: proj } = await query(
          `SELECT id, name FROM projects
            WHERE user_id = $1 AND name ILIKE $2 AND NOT is_archived LIMIT 1`,
          [userId, `%${args.project_name}%`]
        );
        if (proj.length === 0) return { ok: false, error: `Project "${args.project_name}" not found` };
        const projectId = proj[0].id;
        const projectName = proj[0].name;

        const [
          { rows: recentTasks },
          { rows: taskStats },
          { rows: lastUpdate },
        ] = await Promise.all([
          query(
            `SELECT title, status, priority, completed_at, updated_at
               FROM tasks WHERE project_id = $1
               ORDER BY updated_at DESC LIMIT 15`,
            [projectId]
          ),
          query(
            `SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'done') AS done,
               COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
               COUNT(*) FILTER (WHERE status = 'open') AS open
             FROM tasks WHERE project_id = $1`,
            [projectId]
          ),
          query(
            `SELECT published_at FROM project_updates
              WHERE project_id = $1 AND published_at IS NOT NULL
              ORDER BY published_at DESC LIMIT 1`,
            [projectId]
          ),
        ]);

        const stats = taskStats[0] || {};
        const sinceText = lastUpdate[0]?.published_at
          ? `since last update on ${new Date(lastUpdate[0].published_at).toLocaleDateString()}`
          : "to date";

        const activitySummary = recentTasks.map(t =>
          `- [${t.status}] ${t.title} (${t.priority} priority)${t.completed_at ? " — completed " + new Date(t.completed_at).toLocaleDateString() : ""}`
        ).join("\n");

        // Use Groq to draft the update
        if (!GROQ_KEY) return { ok: false, error: "Groq API key not configured" };

        const draftRes = await fetchWithTimeout(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: "You write concise, professional project status updates for clients. Use bullet points. Be positive but honest. Do not mention internal tools or task IDs. Keep it under 200 words." },
              { role: "user", content: `Write a status update for project "${projectName}" ${sinceText}.\n\nTask stats: ${Number(stats.total)} total, ${Number(stats.done)} completed, ${Number(stats.in_progress)} in progress, ${Number(stats.open)} open.\n\nRecent activity:\n${activitySummary || "(no tasks yet)"}` }
            ],
            temperature: 0.5,
            max_tokens: 400
          })
        }, 15000);

        if (!draftRes.ok) return { ok: false, error: "Failed to generate update via AI" };
        const draftJson = await draftRes.json();
        const draftBody = draftJson.choices?.[0]?.message?.content || "";

        // Save as unpublished draft
        const { rows: saved } = await query(
          `INSERT INTO project_updates (project_id, user_id, title, body, ai_generated)
           VALUES ($1, $2, $3, $4, true) RETURNING id`,
          [projectId, userId, `Status Update — ${new Date().toLocaleDateString()}`, draftBody]
        );

        return {
          ok: true,
          project: projectName,
          update_id: saved[0].id,
          draft: draftBody,
          message: "Draft saved. Review it in the project updates, then publish when ready."
        };
      }

      case "share_project": {
        const { rows: proj } = await query(
          `SELECT id, name FROM projects
            WHERE user_id = $1 AND name ILIKE $2 AND NOT is_archived LIMIT 1`,
          [userId, `%${args.project_name}%`]
        );
        if (proj.length === 0) return { ok: false, error: `Project "${args.project_name}" not found` };

        const token = crypto.randomBytes(24).toString("base64url");
        const { rows } = await query(
          `INSERT INTO project_shares (project_id, user_id, token, client_name, client_email, permissions)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, token`,
          [proj[0].id, userId, token,
           args.client_name || null, args.client_email || null,
           args.permissions || "view"]
        );

        const portalUrl = `${process.env.APP_URL}/portal/${rows[0].token}`;
        return {
          ok: true,
          project: proj[0].name,
          portal_url: portalUrl,
          permissions: args.permissions || "view",
          message: `Share link created for ${args.client_name || "client"}. Send them this URL: ${portalUrl}`
        };
      }

      case "notify_client": {
        const { rows: proj } = await query(
          `SELECT id, name FROM projects
            WHERE user_id = $1 AND name ILIKE $2 AND NOT is_archived LIMIT 1`,
          [userId, `%${args.project_name}%`]
        );
        if (proj.length === 0) return { ok: false, error: `Project "${args.project_name}" not found` };

        const { rows: shares } = await query(
          `SELECT client_name, client_email, token FROM project_shares
            WHERE project_id = $1 AND is_active = true AND client_email IS NOT NULL`,
          [proj[0].id]
        );
        if (shares.length === 0) return { ok: false, error: "No active shares with email addresses on this project" };

        // Send emails via nodemailer if SMTP is configured
        let sent = 0;
        if (process.env.SMTP_HOST) {
          const { default: nodemailer } = await import("nodemailer");
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          });

          const results = await Promise.allSettled(shares.map(share => {
            const portalUrl = `${process.env.APP_URL}/portal/${share.token}`;
            return transporter.sendMail({
              from: process.env.SMTP_FROM,
              to: share.client_email,
              subject: `Update on ${proj[0].name}`,
              text: `Hi ${share.client_name || "there"},\n\n${args.message}\n\nView the project portal: ${portalUrl}\n\nBest regards`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="margin:0 0 16px">Update: ${proj[0].name}</h2>
                <p>Hi ${share.client_name || "there"},</p>
                <p>${args.message.replace(/\n/g, "<br>")}</p>
                <a href="${portalUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">View Project Portal</a>
              </div>`
            });
          }));
          sent = results.filter(r => r.status === "fulfilled").length;
        }

        return {
          ok: true,
          project: proj[0].name,
          recipients: shares.map(s => s.client_name || s.client_email),
          emails_sent: sent,
          message: sent > 0
            ? `Notified ${sent} client${sent > 1 ? "s" : ""} about ${proj[0].name}.`
            : "Notification recorded but email delivery is not configured (no SMTP)."
        };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
