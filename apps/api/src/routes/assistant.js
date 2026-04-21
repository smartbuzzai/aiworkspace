// ═══════════════════════════════════════════════════════════════
//  AI Assistant — chat stream, voice in/out, tool calls
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import { query } from "../lib/db.js";
import { buildContext, runTool, toolSchemas } from "../lib/assistant.js";

const OLLAMA = process.env.OLLAMA_HOST || "http://ollama:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b-instruct-q4_K_M";
const WHISPER = process.env.WHISPER_HOST || "http://whisper:8000";
const PIPER = process.env.PIPER_HOST || "http://piper:10200";

export default async function assistantRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  // ─── GET /assistant/threads ─────────────────────────────────
  app.get("/threads", async (req) => {
    const { rows } = await query(
      `SELECT * FROM ai_threads
        WHERE user_id = $1
        ORDER BY last_message_at DESC LIMIT 50`,
      [req.user.user_id]
    );
    return { threads: rows };
  });

  // ─── GET /assistant/threads/:id ─────────────────────────────
  app.get("/threads/:id", async (req, reply) => {
    const { rows } = await query(
      `SELECT * FROM ai_threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: "Not found" });
    const { rows: messages } = await query(
      `SELECT * FROM ai_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    return { thread: rows[0], messages };
  });

  // ─── POST /assistant/chat ─── streams tokens via SSE ────────
  app.post("/chat", async (req, reply) => {
    const schema = z.object({
      thread_id: z.string().uuid().optional(),
      message: z.string().min(1).max(8000)
    });
    const { thread_id, message } = schema.parse(req.body);

    // Create or load thread
    let threadId = thread_id;
    if (!threadId) {
      const { rows } = await query(
        `INSERT INTO ai_threads (user_id, title, last_message_at)
         VALUES ($1, $2, now()) RETURNING id`,
        [req.user.user_id, message.slice(0, 80)]
      );
      threadId = rows[0].id;
    }

    // Persist user message
    await query(
      `INSERT INTO ai_messages (thread_id, role, content)
       VALUES ($1, 'user', $2)`,
      [threadId, message]
    );

    // Load recent history
    const { rows: history } = await query(
      `SELECT role, content, tool_calls, tool_call_id
         FROM ai_messages
        WHERE thread_id = $1
        ORDER BY created_at DESC LIMIT 20`,
      [threadId]
    );
    history.reverse();

    // Build retrieval-augmented context
    const context = await buildContext(req.user.user_id, message);

    const systemPrompt = `You are the AI assistant inside a personal workspace.
You help with email, contacts, calendar, projects, tasks, and files.
Be concise. When the user asks you to act, use a tool call.
Today is ${new Date().toISOString().slice(0, 10)}.
Timezone: ${req.user.timezone || "UTC"}.

Relevant context from the user's data:
${context}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(h => ({
        role: h.role,
        content: h.content,
        ...(h.tool_calls ? { tool_calls: h.tool_calls } : {}),
        ...(h.tool_call_id ? { tool_call_id: h.tool_call_id } : {})
      }))
    ];

    // ─── SSE stream from Ollama ───────────────────────────────
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const send = (event, data) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send("thread", { thread_id: threadId });

    const started = Date.now();
    let fullReply = "";
    let toolCalls = null;

    try {
      const res = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages,
          stream: true,
          tools: toolSchemas,
          options: { temperature: 0.4, num_ctx: 8192 }
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const obj = JSON.parse(line);
          if (obj.message?.content) {
            fullReply += obj.message.content;
            send("token", { text: obj.message.content });
          }
          if (obj.message?.tool_calls) toolCalls = obj.message.tool_calls;
        }
      }

      // Run any tool calls the model requested
      if (toolCalls?.length) {
        await query(
          `INSERT INTO ai_messages (thread_id, role, content, tool_calls, model, duration_ms)
           VALUES ($1, 'assistant', $2, $3::jsonb, $4, $5)`,
          [threadId, fullReply, JSON.stringify(toolCalls), MODEL, Date.now() - started]
        );

        for (const tc of toolCalls) {
          send("tool_call", tc);
          const result = await runTool(tc, req.user.user_id);
          send("tool_result", { tool: tc.function.name, result });
          await query(
            `INSERT INTO ai_messages (thread_id, role, content, tool_call_id)
             VALUES ($1, 'tool', $2, $3)`,
            [threadId, JSON.stringify(result), tc.id || tc.function.name]
          );
        }
      } else {
        await query(
          `INSERT INTO ai_messages (thread_id, role, content, model, duration_ms)
           VALUES ($1, 'assistant', $2, $3, $4)`,
          [threadId, fullReply, MODEL, Date.now() - started]
        );
      }

      await query(
        `UPDATE ai_threads SET last_message_at = now() WHERE id = $1`,
        [threadId]
      );

      send("done", { thread_id: threadId });
    } catch (err) {
      req.log.error(err, "chat stream failed");
      send("error", { error: err.message });
    } finally {
      reply.raw.end();
    }
  });

  // ─── POST /assistant/voice/transcribe ──── audio → text ─────
  app.post("/voice/transcribe", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No audio" });
    const buf = await data.toBuffer();

    const form = new FormData();
    form.append("file", new Blob([buf], { type: data.mimetype }), data.filename || "audio.webm");
    form.append("model", "Systran/faster-whisper-base.en");
    form.append("response_format", "json");

    const r = await fetch(`${WHISPER}/v1/audio/transcriptions`, {
      method: "POST", body: form
    });
    if (!r.ok) return reply.code(502).send({ error: "Whisper failed" });
    const j = await r.json();
    return { text: j.text };
  });

  // ─── POST /assistant/voice/speak ─── text → audio (Piper) ──
  app.post("/voice/speak", async (req, reply) => {
    const schema = z.object({ text: z.string().min(1).max(2000) });
    const { text } = schema.parse(req.body);

    // Piper HTTP API (Wyoming protocol wraps it; if using Coqui or Piper-HTTP,
    // adjust endpoint. This assumes piper-http:5000/api/tts).
    const r = await fetch(`${PIPER}/api/tts?text=${encodeURIComponent(text)}`);
    if (!r.ok) return reply.code(502).send({ error: "TTS failed" });

    reply.header("Content-Type", "audio/wav");
    return reply.send(Buffer.from(await r.arrayBuffer()));
  });
}
