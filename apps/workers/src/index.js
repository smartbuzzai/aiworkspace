// ═══════════════════════════════════════════════════════════════
//  Background Workers
//  - IMAP poll every 2 min (fetches new mail, parses, stores)
//  - Embedding generator (emails, tasks, notes → pgvector)
//  - Daily digest (morning briefing)
//  - Reminder dispatcher (events + task due-dates → web push)
// ═══════════════════════════════════════════════════════════════

import { Worker, Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import pg from "pg";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import webpush from "web-push";
import * as Minio from "minio";

const redisUrl = process.env.REDIS_URL;
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const OLLAMA = process.env.OLLAMA_HOST || "http://ollama:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";

// ─── MinIO client for attachment storage ─────────────────────
const s3url = new URL(process.env.S3_ENDPOINT || "http://minio:9000");
const mc = new Minio.Client({
  endPoint: s3url.hostname,
  port: Number(s3url.port) || (s3url.protocol === "https:" ? 443 : 80),
  useSSL: s3url.protocol === "https:",
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY
});
const S3_BUCKET = process.env.S3_BUCKET || "workspace";
try {
  const exists = await mc.bucketExists(S3_BUCKET);
  if (!exists) await mc.makeBucket(S3_BUCKET);
} catch (err) {
  console.warn("MinIO check failed:", err.message);
}

// ─── Queues ────────────────────────────────────────────────────
const imapQueue   = new Queue("imap-sync",   { connection });
const embedQueue  = new Queue("embed",       { connection });
const remindQueue = new Queue("reminders",   { connection });
const digestQueue = new Queue("digest",      { connection });

// ═══════════════════════════════════════════════════════════════
//  IMAP SYNC
// ═══════════════════════════════════════════════════════════════

import crypto from "node:crypto";
function userKey(userId) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "dev").update(`userkey:${userId}`).digest();
}
function decrypt(buf, key) {
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

new Worker("imap-sync", async (job) => {
  const { account_id } = job.data;
  const { rows } = await db.query(
    `SELECT * FROM email_accounts WHERE id = $1 AND is_active`,
    [account_id]
  );
  if (rows.length === 0) return;
  const acc = rows[0];
  const pass = decrypt(acc.imap_pass_enc, userKey(acc.user_id));

  await db.query(
    `UPDATE email_accounts SET sync_status='syncing' WHERE id=$1`,
    [account_id]
  );

  const client = new ImapFlow({
    host: acc.imap_host,
    port: acc.imap_port,
    secure: true,
    auth: { user: acc.imap_user, pass },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = acc.last_uid || 1;
      let maxUid = since;

      for await (const msg of client.fetch(
        { uid: `${since + 1}:*` },
        { uid: true, envelope: true, source: true, flags: true }
      )) {
        try {
          const parsed = await simpleParser(msg.source);
          const fromAddr = parsed.from?.value?.[0]?.address || "unknown";
          const fromName = parsed.from?.value?.[0]?.name || null;
          const toArr = (parsed.to?.value || []).map(v => v.address).filter(Boolean);
          const ccArr = (parsed.cc?.value || []).map(v => v.address).filter(Boolean);
          const subject = parsed.subject || "(no subject)";
          const messageId = parsed.messageId;
          const inReplyTo = parsed.inReplyTo || null;

          // Find or create thread — match by subject (normalized) + participants
          const normSubject = subject.replace(/^(Re:|Fwd:|Fw:)\s*/gi, "").trim();
          const participants = [...new Set([fromAddr, ...toArr])].sort();

          let threadId;
          const { rows: existing } = await db.query(
            `SELECT id FROM email_threads
              WHERE user_id = $1 AND account_id = $2
                AND (
                  (in_reply_to IS NOT NULL AND EXISTS (
                    SELECT 1 FROM emails e WHERE e.thread_id = email_threads.id AND e.message_id = $3
                  ))
                  OR (subject ILIKE $4 AND participants && $5::text[])
                )
              ORDER BY last_message_at DESC LIMIT 1`,
            [acc.user_id, acc.id, inReplyTo, `%${normSubject}%`, participants]
          );

          if (existing.length) {
            threadId = existing[0].id;
          } else {
            const { rows: tRows } = await db.query(
              `INSERT INTO email_threads (user_id, account_id, subject, participants, last_message_at, unread_count)
               VALUES ($1,$2,$3,$4,$5,1) RETURNING id`,
              [acc.user_id, acc.id, subject, participants, parsed.date || new Date()]
            );
            threadId = tRows[0].id;
          }

          // Insert message (dedupe on message_id)
          const { rows: emailRows } = await db.query(
            `INSERT INTO emails (thread_id, account_id, message_id, in_reply_to,
                                 from_address, from_name, to_addresses, cc_addresses,
                                 subject, body_text, body_html, is_read, received_at, raw_uid)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12,$13)
             ON CONFLICT (message_id) DO NOTHING
             RETURNING id`,
            [threadId, acc.id, messageId, inReplyTo,
             fromAddr, fromName, toArr, ccArr,
             subject, parsed.text || "", parsed.html || "",
             parsed.date || new Date(), msg.uid]
          );

          // Save attachments to MinIO + email_attachments table
          if (emailRows.length && parsed.attachments?.length) {
            for (const att of parsed.attachments) {
              try {
                const safeName = (att.filename || "attachment").replace(/[^\w.-]/g, "_");
                const s3_key = `${acc.user_id}/email-att/${emailRows[0].id}/${safeName}`;
                await mc.putObject(S3_BUCKET, s3_key, att.content, att.content.length, {
                  "Content-Type": att.contentType || "application/octet-stream"
                });
                await db.query(
                  `INSERT INTO email_attachments
                     (email_id, filename, content_type, size_bytes, s3_key)
                   VALUES ($1,$2,$3,$4,$5)`,
                  [emailRows[0].id, att.filename || "attachment",
                   att.contentType, att.content.length, s3_key]
                );
              } catch (attErr) {
                console.warn("attachment save failed:", attErr.message);
              }
            }
          }

          // Update thread metadata
          await db.query(
            `UPDATE email_threads
                SET last_message_at = $2,
                    unread_count = unread_count + 1
              WHERE id = $1`,
            [threadId, parsed.date || new Date()]
          );

          // Link email to contact (if from/to matches a known contact)
          // and bump last_touch_at so CRM stays current.
          const allAddrs = [fromAddr, ...toArr, ...ccArr].filter(Boolean);
          if (allAddrs.length) {
            const { rows: matched } = await db.query(
              `UPDATE contacts
                  SET last_touch_at = GREATEST(COALESCE(last_touch_at, $3), $3)
                WHERE user_id = $1 AND email = ANY($2::text[])
                RETURNING id`,
              [acc.user_id, allAddrs, parsed.date || new Date()]
            );
            for (const c of matched) {
              await db.query(
                `INSERT INTO contact_interactions
                   (contact_id, kind, summary, ref_type, ref_id, occurred_at)
                 VALUES ($1,'email',$2,'email',$3,$4)`,
                [c.id, subject.slice(0, 200), threadId, parsed.date || new Date()]
              );
            }
          }

          // Queue embedding + AI summary
          await embedQueue.add("email", {
            user_id: acc.user_id,
            thread_id: threadId,
            subject,
            text: (parsed.text || "").slice(0, 4000)
          });

          if (msg.uid > maxUid) maxUid = msg.uid;
        } catch (err) {
          console.error("msg parse error:", err.message);
        }
      }

      await db.query(
        `UPDATE email_accounts
            SET last_uid = $2, last_sync_at = now(),
                sync_status = 'idle', sync_error = NULL
          WHERE id = $1`,
        [account_id, maxUid]
      );
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("imap sync error:", err);
    await db.query(
      `UPDATE email_accounts
          SET sync_status = 'error', sync_error = $2
        WHERE id = $1`,
      [account_id, err.message]
    );
    throw err;
  } finally {
    await client.logout().catch(() => {});
  }
}, { connection, concurrency: 3 });

// ─── Repeat: poll every 2 min for each active account ────────
setInterval(async () => {
  try {
    const { rows } = await db.query(
      `SELECT id FROM email_accounts WHERE is_active`
    );
    for (const r of rows) {
      await imapQueue.add("sync", { account_id: r.id }, {
        removeOnComplete: 100,
        removeOnFail: 50
      });
    }
  } catch (err) {
    console.error("imap scheduler error:", err);
  }
}, 2 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
//  EMBEDDINGS WORKER
// ═══════════════════════════════════════════════════════════════

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  });
  if (!r.ok) throw new Error("embed failed");
  return (await r.json()).embedding;
}

new Worker("embed", async (job) => {
  const { user_id, thread_id, subject, text } = job.data;
  if (!text || text.length < 20) return;
  try {
    const vec = await embed(`${subject}\n${text}`);
    await db.query(
      `INSERT INTO embeddings (user_id, source_type, source_id, content, embedding)
       VALUES ($1,'email',$2,$3,$4::vector)`,
      [user_id, thread_id, `${subject}\n${text.slice(0, 1000)}`, `[${vec.join(",")}]`]
    );
  } catch (err) {
    // Embedding model not pulled yet — skip, will retry on later messages
    console.warn("embed skipped:", err.message);
  }

  // Also queue AI summary for this thread (fire-and-forget)
  summarizeQueue.add("summary", { user_id, thread_id, subject, text }, {
    removeOnComplete: 50,
    removeOnFail: 20
  }).catch(() => {});
}, { connection, concurrency: 2 });

// ═══════════════════════════════════════════════════════════════
//  AI SUMMARY WORKER — generates ai_summary + ai_priority per thread
// ═══════════════════════════════════════════════════════════════

const summarizeQueue = new Queue("summarize", { connection });

async function llmComplete(prompt, maxTokens = 120) {
  const r = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.1:8b-instruct-q4_K_M",
      prompt,
      stream: false,
      options: { temperature: 0.2, num_predict: maxTokens }
    })
  });
  if (!r.ok) throw new Error(`llm failed: ${r.status}`);
  const j = await r.json();
  return (j.response || "").trim();
}

new Worker("summarize", async (job) => {
  const { thread_id, subject, text } = job.data;
  if (!text || text.length < 40) return;

  try {
    const summary = await llmComplete(
      `Summarize this email in ONE sentence, under 20 words, highlighting what action the recipient needs to take. No preamble.

Subject: ${subject}
${text.slice(0, 2000)}

Summary:`,
      60
    );

    const priorityRaw = await llmComplete(
      `Classify the priority of this email as exactly one word: high, medium, or low.
An email is "high" if it needs a same-day response or concerns a deadline.
Medium if it needs a response this week.
Low if it's informational or automated.

Subject: ${subject}
${text.slice(0, 1000)}

Priority:`,
      10
    );
    const priority = (priorityRaw.toLowerCase().match(/high|medium|low/) || ["medium"])[0];

    await db.query(
      `UPDATE email_threads
          SET ai_summary = $2, ai_priority = $3
        WHERE id = $1`,
      [thread_id, summary.slice(0, 300), priority]
    );
  } catch (err) {
    console.warn("summarize skipped:", err.message);
  }
}, { connection, concurrency: 1 }); // Sequential to keep LLM pressure low

// ═══════════════════════════════════════════════════════════════
//  REMINDERS — sends web push for upcoming events & overdue tasks
// ═══════════════════════════════════════════════════════════════

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:admin@${process.env.DOMAIN || "localhost"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPush(userId, payload) {
  const { rows } = await db.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
      }
    }
  }
}

setInterval(async () => {
  try {
    // Events starting in next 15 min
    const { rows: events } = await db.query(
      `SELECT id, user_id, title, starts_at FROM events
        WHERE starts_at BETWEEN now() AND now() + interval '15 minutes'`
    );
    for (const e of events) {
      await sendPush(e.user_id, {
        title: "Upcoming: " + e.title,
        body: `Starts at ${new Date(e.starts_at).toLocaleTimeString()}`,
        link: `/calendar?event=${e.id}`
      });
      await db.query(
        `INSERT INTO notifications (user_id, kind, title, body, link)
         VALUES ($1,'event',$2,$3,$4)`,
        [e.user_id, `Upcoming: ${e.title}`,
         `Starts at ${new Date(e.starts_at).toLocaleTimeString()}`,
         `/calendar?event=${e.id}`]
      );
    }
  } catch (err) {
    console.error("reminder loop error:", err);
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
//  DAILY DIGEST — 7 AM in each user's timezone
// ═══════════════════════════════════════════════════════════════

async function runDigestForUser(userId) {
  const { rows: events } = await db.query(
    `SELECT title, starts_at FROM events
      WHERE user_id = $1 AND starts_at::date = current_date
      ORDER BY starts_at`, [userId]);

  const { rows: tasks } = await db.query(
    `SELECT title, priority FROM tasks
      WHERE user_id = $1 AND status IN ('open','in_progress')
        AND priority = 'high'
      ORDER BY due_at NULLS LAST LIMIT 5`, [userId]);

  const { rows: unread } = await db.query(
    `SELECT COUNT(*) AS n FROM email_threads
      WHERE user_id = $1 AND unread_count > 0`, [userId]);

  const lines = [
    `${events.length} meeting${events.length === 1 ? "" : "s"} today`,
    `${tasks.length} high-priority task${tasks.length === 1 ? "" : "s"}`,
    `${unread[0].n} unread thread${unread[0].n === "1" ? "" : "s"}`
  ];

  await sendPush(userId, {
    title: "Your daily briefing",
    body: lines.join(" · "),
    link: "/"
  });
  await db.query(
    `INSERT INTO notifications (user_id, kind, title, body, link)
     VALUES ($1,'system',$2,$3,'/')`,
    [userId, "Your daily briefing", lines.join(" · ")]
  );
}

// Simple hour check once per minute — fires once per user per day at 7 AM local
const digestFired = new Map();
setInterval(async () => {
  try {
    const { rows: users } = await db.query(`SELECT id, timezone FROM users`);
    const today = new Date().toISOString().slice(0, 10);
    for (const u of users) {
      const localHour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: u.timezone || "UTC",
        hour: "numeric", hour12: false
      }).format(new Date()));
      const key = `${u.id}:${today}`;
      if (localHour === 7 && !digestFired.has(key)) {
        digestFired.set(key, true);
        await runDigestForUser(u.id);
      }
    }
    // prune old keys
    if (digestFired.size > 1000) digestFired.clear();
  } catch (err) {
    console.error("digest loop error:", err);
  }
}, 60 * 1000);

console.log("workers online: imap-sync, embed, summarize, reminders, digest, caldav");

// ═══════════════════════════════════════════════════════════════
//  CALDAV SYNC — push new/updated events to Radicale; pull back
// ═══════════════════════════════════════════════════════════════

import { pushEvent, deleteEvent, pullEvents } from "./caldav.js";

const caldavQueue = new Queue("caldav", { connection });

new Worker("caldav", async (job) => {
  const { kind, user_id, event_id, caldav_uid } = job.data;

  if (kind === "push") {
    const { rows } = await db.query(
      `SELECT * FROM events WHERE id = $1 AND user_id = $2`,
      [event_id, user_id]
    );
    if (rows.length === 0) return;
    const uid = await pushEvent(user_id, rows[0]);
    if (!rows[0].caldav_uid) {
      await db.query(
        `UPDATE events SET caldav_uid = $2 WHERE id = $1`,
        [event_id, uid]
      );
    }
  }

  if (kind === "delete") {
    await deleteEvent(user_id, caldav_uid);
  }

  if (kind === "pull") {
    await pullEvents(user_id, db);
  }
}, { connection, concurrency: 2 });

// Listen for Postgres NOTIFY on events table — pushes changes instantly.
// Requires a trigger that emits NOTIFY; we set it up here if missing.
async function installEventNotifyTrigger() {
  try {
    await db.query(`
      CREATE OR REPLACE FUNCTION notify_event_change()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM pg_notify('event_changed', json_build_object(
            'kind', 'delete', 'user_id', OLD.user_id, 'caldav_uid', OLD.caldav_uid
          )::text);
        ELSE
          PERFORM pg_notify('event_changed', json_build_object(
            'kind', 'push', 'user_id', NEW.user_id, 'event_id', NEW.id
          )::text);
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS events_notify_trig ON events;
      CREATE TRIGGER events_notify_trig
        AFTER INSERT OR UPDATE OR DELETE ON events
        FOR EACH ROW EXECUTE FUNCTION notify_event_change();
    `);
  } catch (err) {
    console.warn("notify trigger install failed:", err.message);
  }
}

async function startEventListener() {
  const client = await db.connect();
  await client.query("LISTEN event_changed");
  client.on("notification", async (msg) => {
    try {
      const data = JSON.parse(msg.payload);
      if (data.kind === "push" && data.event_id) {
        await caldavQueue.add("push", data, { removeOnComplete: 100, removeOnFail: 50 });
      }
      if (data.kind === "delete" && data.caldav_uid) {
        await caldavQueue.add("delete", data, { removeOnComplete: 100, removeOnFail: 50 });
      }
    } catch (err) {
      console.warn("notify handler error:", err.message);
    }
  });
  client.on("error", err => console.error("listen client error:", err));
}

// Periodic pull — catches external changes (phone, Thunderbird, etc.)
setInterval(async () => {
  try {
    const { rows } = await db.query(`SELECT id FROM users`);
    for (const u of rows) {
      await caldavQueue.add("pull", { kind: "pull", user_id: u.id }, {
        removeOnComplete: 50, removeOnFail: 20
      });
    }
  } catch (err) {
    console.error("caldav pull loop error:", err);
  }
}, 10 * 60 * 1000); // every 10 minutes

await installEventNotifyTrigger();
startEventListener().catch(err => console.error("listener boot failed:", err));

// ═══════════════════════════════════════════════════════════════
//  FILE TEXT EXTRACTION — pulls from MinIO, extracts text,
//  writes to files.extracted_text so find_files tool can search it.
// ═══════════════════════════════════════════════════════════════

new Worker("extract", async (job) => {
  const { file_id, user_id, s3_key, kind, mime } = job.data;
  try {
    // Stream the object into a buffer
    const stream = await mc.getObject(S3_BUCKET, s3_key);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);

    let text = "";

    if (kind === "pdf" || mime === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buf, { max: 50 }); // cap at 50 pages
      text = parsed.text || "";
    } else if (mime === "text/plain" || mime === "text/markdown") {
      text = buf.toString("utf8");
    }

    if (text.trim()) {
      // Truncate to 500k chars to keep DB reasonable
      const truncated = text.slice(0, 500_000);
      await db.query(
        `UPDATE files SET extracted_text = $2 WHERE id = $1`,
        [file_id, truncated]
      );

      // Queue embedding of the first 2000 chars for semantic search
      try {
        const vec = await embed(truncated.slice(0, 2000));
        await db.query(
          `INSERT INTO embeddings (user_id, source_type, source_id, content, embedding)
           VALUES ($1,'file',$2,$3,$4::vector)`,
          [user_id, file_id, truncated.slice(0, 500), `[${vec.join(",")}]`]
        );
      } catch { /* skip if embed model not pulled */ }
    }
  } catch (err) {
    console.warn("extract failed:", err.message);
  }
}, { connection, concurrency: 1 });
