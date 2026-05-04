// ═══════════════════════════════════════════════════════════════
//  AI Assistant — chat stream via Anthropic or Groq, voice in/out
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import { query } from "../lib/db.js";
import { buildContext, runTool, toolSchemas } from "../lib/assistant.js";
import { checkWhisper, checkPiper, fetchWithTimeout } from "../lib/services.js";

// ─── Provider config ─────────────────────────────────────────
const PROVIDER = process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq");
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const WHISPER = process.env.WHISPER_HOST || "http://whisper:8000";
const PIPER = process.env.PIPER_HOST || "http://piper:10200";

// ─── Tool format converters ──────────────────────────────────
const anthropicTools = toolSchemas.map(t => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters
}));

const groqTools = toolSchemas.map(t => ({
  type: "function",
  function: t.function
}));

function getModelName() {
  return PROVIDER === "anthropic" ? ANTHROPIC_MODEL : GROQ_MODEL;
}

// ─── History converters ──────────────────────────────────────
function historyToAnthropic(history) {
  const msgs = [];
  for (const h of history) {
    if (h.role === "user") {
      msgs.push({ role: "user", content: h.content || "" });
    } else if (h.role === "assistant") {
      const content = [];
      if (h.content) content.push({ type: "text", text: h.content });
      if (h.tool_calls && Array.isArray(h.tool_calls)) {
        for (const tc of h.tool_calls) {
          let input;
          try { input = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments; }
          catch { input = {}; }
          content.push({ type: "tool_use", id: tc.id || `toolu_${Math.random().toString(36).slice(2, 12)}`, name: tc.function.name, input });
        }
      }
      if (content.length > 0) msgs.push({ role: "assistant", content });
    } else if (h.role === "tool") {
      let toolUseId = h.tool_call_id || "unknown";
      // Find matching tool_use id from previous assistant message
      const prevAssistant = msgs.findLast(m => m.role === "assistant");
      if (prevAssistant) {
        const toolUse = prevAssistant.content?.find(b => b.type === "tool_use");
        if (toolUse) toolUseId = toolUse.id;
      }
      msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: h.content || "" }] });
    }
  }
  return msgs;
}

function historyToGroq(history) {
  return history.map(h => {
    if (h.role === "tool") {
      return { role: "tool", content: h.content || "", tool_call_id: h.tool_call_id || "unknown" };
    }
    const msg = { role: h.role, content: h.content || "" };
    if (h.tool_calls && Array.isArray(h.tool_calls) && h.tool_calls.length > 0) {
      msg.tool_calls = h.tool_calls.map(tc => ({
        id: tc.id || "call_" + Math.random().toString(36).slice(2, 10),
        type: "function",
        function: tc.function
      }));
    }
    return msg;
  });
}

// ─── Streaming helpers ───────────────────────────────────────

async function streamAnthropic(systemPrompt, messages, tools, send, timeout = 60000) {
  const res = await fetchWithTimeout(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: systemPrompt,
      messages,
      stream: true,
      tools,
      max_tokens: 2048,
      temperature: 0.4
    })
  }, timeout);

  if (!res.ok) {
    const errBody = await res.text().catch(() => "unknown");
    let errMsg;
    try { errMsg = JSON.parse(errBody).error?.message; } catch { errMsg = errBody; }
    return { ok: false, error: errMsg };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullReply = "";
  let toolCalls = [];
  let currentToolUse = null;
  let currentToolArgs = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;

      const event = JSON.parse(payload);

      if (event.type === "content_block_start") {
        if (event.content_block?.type === "tool_use") {
          currentToolUse = { id: event.content_block.id, function: { name: event.content_block.name, arguments: "" } };
          currentToolArgs = "";
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta?.type === "text_delta") {
          fullReply += event.delta.text;
          send("token", { text: event.delta.text });
        } else if (event.delta?.type === "input_json_delta" && currentToolUse) {
          currentToolArgs += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolUse) {
          currentToolUse.function.arguments = currentToolArgs;
          toolCalls.push(currentToolUse);
          currentToolUse = null;
          currentToolArgs = "";
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  toolCalls = toolCalls.filter(tc => {
    const key = `${tc.function.name}:${tc.function.arguments}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ok: true, fullReply, toolCalls };
}

async function streamGroq(systemPrompt, messages, tools, send, timeout = 30000) {
  const res = await fetchWithTimeout(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true, tools, temperature: 0.4, max_tokens: 1024
    })
  }, timeout);

  if (!res.ok) {
    const errBody = await res.text().catch(() => "unknown");
    let errMsg;
    try { errMsg = JSON.parse(errBody).error?.message; } catch { errMsg = errBody; }
    return { ok: false, error: errMsg };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullReply = "";
  let toolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      const chunk = JSON.parse(payload);
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) { fullReply += delta.content; send("token", { text: delta.content }); }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: tc.id || "", function: { name: "", arguments: "" } };
            if (tc.id) toolCalls[tc.index].id = tc.id;
            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }
    }
  }

  toolCalls = toolCalls.filter(tc => tc && tc.function.name);
  const seen = new Set();
  toolCalls = toolCalls.filter(tc => { const k = `${tc.function.name}:${tc.function.arguments}`; if (seen.has(k)) return false; seen.add(k); return true; });

  return { ok: true, fullReply, toolCalls };
}

// ═══════════════════════════════════════════════════════════════

export default async function assistantRoutes(app) {
  app.addHook("preHandler", app.requireAuth);

  app.get("/threads", async (req) => {
    const { rows } = await query(
      `SELECT * FROM ai_threads WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT 50`,
      [req.user.user_id]
    );
    return { threads: rows };
  });

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

  // ─── POST /assistant/chat ─────────────────────────────────────
  app.post("/chat", {
    config: { rateLimit: { max: 40, timeWindow: "1 minute" } }
  }, async (req, reply) => {
    const schema = z.object({
      thread_id: z.string().uuid().nullable().optional(),
      message: z.string().min(1).max(8000)
    });
    const { thread_id, message } = schema.parse(req.body);

    let threadId = thread_id;
    if (!threadId) {
      const { rows } = await query(
        `INSERT INTO ai_threads (user_id, title, last_message_at) VALUES ($1, $2, now()) RETURNING id`,
        [req.user.user_id, message.slice(0, 80)]
      );
      threadId = rows[0].id;
    }

    await query(`INSERT INTO ai_messages (thread_id, role, content) VALUES ($1, 'user', $2)`, [threadId, message]);

    const { rows: history } = await query(
      `SELECT role, content, tool_calls, tool_call_id FROM ai_messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [threadId]
    );
    history.reverse();

    let context = "(no contextual data yet)";
    try { context = await buildContext(req.user.user_id, message); }
    catch (err) { req.log.warn("buildContext failed: " + err.message); }

    const systemPrompt = `You are the AI assistant inside a personal workspace.
You help with email, contacts, calendar, projects, tasks, and files.
Be concise and helpful. Reply with plain text by default.
ONLY use a tool call when the user explicitly asks you to create, update, delete, schedule, read, or analyze something.
For greetings, questions, and conversation, just respond with text — never call a tool.
Today is ${new Date().toISOString().slice(0, 10)}.
Timezone: ${req.user.timezone || "UTC"}.

Relevant context from the user's data:
${context}`;

    // ─── SSE stream ─────────────────────────────────────────
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
    const model = getModelName();

    const hasKey = PROVIDER === "anthropic" ? !!ANTHROPIC_KEY : !!GROQ_KEY;
    if (!hasKey) {
      send("token", { text: `AI assistant is not configured — missing ${PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "GROQ_API_KEY"}.` });
      send("done", { thread_id: threadId });
      reply.raw.end();
      return;
    }

    try {
      // Build provider-specific messages
      const tools = PROVIDER === "anthropic" ? anthropicTools : groqTools;
      const providerMessages = PROVIDER === "anthropic"
        ? historyToAnthropic(history)
        : [{ role: "system", content: systemPrompt }, ...historyToGroq(history)];

      // First streaming call
      const result = PROVIDER === "anthropic"
        ? await streamAnthropic(systemPrompt, providerMessages, tools, send)
        : await streamGroq(systemPrompt, providerMessages, tools, send);

      if (!result.ok) {
        send("token", { text: `AI service error: ${result.error}` });
        send("done", { thread_id: threadId });
        reply.raw.end();
        return;
      }

      const { fullReply, toolCalls } = result;

      if (toolCalls.length > 0) {
        // Save assistant message with tool calls
        await query(
          `INSERT INTO ai_messages (thread_id, role, content, tool_calls, model, duration_ms)
           VALUES ($1, 'assistant', $2, $3::jsonb, $4, $5)`,
          [threadId, fullReply, JSON.stringify(toolCalls), model, Date.now() - started]
        );

        const toolEntries = [];
        for (const tc of toolCalls) {
          send("tool_call", tc);
          const toolResult = await runTool(tc, req.user.user_id);
          send("tool_result", { tool: tc.function.name, result: toolResult });
          const toolCallId = tc.id || tc.function.name;
          await query(
            `INSERT INTO ai_messages (thread_id, role, content, tool_call_id)
             VALUES ($1, 'tool', $2, $3)`,
            [threadId, JSON.stringify(toolResult), toolCallId]
          );
          toolEntries.push({ role: "tool", content: JSON.stringify(toolResult), tool_call_id: toolCallId });
        }

        const updatedHistory = [
          ...history,
          { role: "assistant", content: fullReply, tool_calls: toolCalls },
          ...toolEntries,
        ];

        const followMsgs = PROVIDER === "anthropic"
          ? historyToAnthropic(updatedHistory)
          : [{ role: "system", content: systemPrompt }, ...historyToGroq(updatedHistory)];

        const followResult = PROVIDER === "anthropic"
          ? await streamAnthropic(systemPrompt, followMsgs, [], send, 30000)
          : await streamGroq(systemPrompt, followMsgs, [], send, 30000);

        if (followResult.ok && followResult.fullReply) {
          await query(
            `INSERT INTO ai_messages (thread_id, role, content, model, duration_ms)
             VALUES ($1, 'assistant', $2, $3, $4)`,
            [threadId, followResult.fullReply, model, Date.now() - started]
          );
        }
      } else {
        await query(
          `INSERT INTO ai_messages (thread_id, role, content, model, duration_ms)
           VALUES ($1, 'assistant', $2, $3, $4)`,
          [threadId, fullReply, model, Date.now() - started]
        );
      }

      await query(`UPDATE ai_threads SET last_message_at = now() WHERE id = $1`, [threadId]);
      send("done", { thread_id: threadId });
    } catch (err) {
      req.log.error(err, "chat stream failed");
      send("error", { error: err.message });
    } finally {
      reply.raw.end();
    }
  });

  // ─── Voice routes (unchanged) ─────────────────────────────────

  app.post("/voice/transcribe", {
    config: { rateLimit: { max: 15, timeWindow: "1 minute" } }
  }, async (req, reply) => {
    const whisperStatus = await checkWhisper();
    if (!whisperStatus.ok) return reply.code(503).send({ error: "Voice transcription unavailable." });
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No audio" });
    const buf = await data.toBuffer();
    const form = new FormData();
    form.append("file", new Blob([buf], { type: data.mimetype }), data.filename || "audio.webm");
    form.append("model", "Systran/faster-whisper-base.en");
    form.append("response_format", "json");
    try {
      const r = await fetchWithTimeout(`${WHISPER}/v1/audio/transcriptions`, { method: "POST", body: form }, 30000);
      if (!r.ok) return reply.code(502).send({ error: "Whisper transcription failed" });
      const j = await r.json();
      return { text: j.text };
    } catch (err) {
      req.log.error(err, "whisper request failed");
      return reply.code(502).send({ error: "Voice transcription timed out or failed" });
    }
  });

  app.post("/voice/speak", {
    config: { rateLimit: { max: 15, timeWindow: "1 minute" } }
  }, async (req, reply) => {
    const piperStatus = await checkPiper();
    if (!piperStatus.ok) return reply.code(503).send({ error: "Text-to-speech unavailable." });
    const schema = z.object({ text: z.string().min(1).max(2000) });
    const { text } = schema.parse(req.body);
    try {
      const r = await fetchWithTimeout(`${PIPER}/api/tts?text=${encodeURIComponent(text)}`, {}, 15000);
      if (!r.ok) return reply.code(502).send({ error: "TTS synthesis failed" });
      reply.header("Content-Type", "audio/wav");
      return reply.send(Buffer.from(await r.arrayBuffer()));
    } catch (err) {
      req.log.error(err, "piper request failed");
      return reply.code(502).send({ error: "Text-to-speech timed out or failed" });
    }
  });
}
