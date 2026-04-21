// ═══════════════════════════════════════════════════════════════
//  Assistant internals — context retrieval + tool calls
// ═══════════════════════════════════════════════════════════════

import { query } from "./db.js";

const OLLAMA = process.env.OLLAMA_HOST || "http://ollama:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";

// ─── Embedding helper ─────────────────────────────────────────
export async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  });
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

  // Always-on: today at a glance
  const { rows: todayEvents } = await query(
    `SELECT title, starts_at, ends_at, location
       FROM events
      WHERE user_id = $1
        AND starts_at::date = current_date
      ORDER BY starts_at LIMIT 10`,
    [userId]
  );
  if (todayEvents.length) {
    parts.push("TODAY'S EVENTS:");
    todayEvents.forEach(e => {
      const t = new Date(e.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      parts.push(`- ${t} — ${e.title}${e.location ? ` @ ${e.location}` : ""}`);
    });
  }

  const { rows: openTasks } = await query(
    `SELECT t.title, t.priority, t.due_at, p.name AS project
       FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = $1 AND t.status IN ('open','in_progress')
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.due_at NULLS LAST
      LIMIT 8`,
    [userId]
  );
  if (openTasks.length) {
    parts.push("\nOPEN TASKS:");
    openTasks.forEach(t => {
      parts.push(`- [${t.priority}] ${t.title}${t.project ? ` (${t.project})` : ""}`);
    });
  }

  const { rows: unread } = await query(
    `SELECT subject, ai_summary, participants
       FROM email_threads
      WHERE user_id = $1 AND unread_count > 0
      ORDER BY last_message_at DESC LIMIT 5`,
    [userId]
  );
  if (unread.length) {
    parts.push("\nUNREAD EMAIL THREADS:");
    unread.forEach(e => {
      parts.push(`- ${e.subject}${e.ai_summary ? ` — ${e.ai_summary}` : ""}`);
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
      description: "Search the user's document and media library.",
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
      name: "summarize_thread",
      description: "Summarize a specific email thread by id.",
      parameters: {
        type: "object",
        properties: { thread_id: { type: "string" } },
        required: ["thread_id"]
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
        const { rows } = await query(
          `SELECT id, name, kind, size_bytes, created_at
             FROM files
            WHERE user_id = $1
              AND (name ILIKE $2 OR extracted_text ILIKE $2)
            ORDER BY created_at DESC LIMIT 10`,
          [userId, `%${args.q}%`]
        );
        return { ok: true, files: rows };
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

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
