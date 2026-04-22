// ═══════════════════════════════════════════════════════════════
//  External service helpers — health checks, timeouts, fallbacks
//  Wraps Ollama, Whisper, Piper so the app stays usable when
//  any of them are down or models aren't pulled yet.
// ═══════════════════════════════════════════════════════════════

const OLLAMA  = process.env.OLLAMA_HOST  || "http://ollama:11434";
const WHISPER = process.env.WHISPER_HOST || "http://whisper:8000";
const PIPER   = process.env.PIPER_HOST   || "http://piper:10200";

// ─── Cached health status (refreshed periodically) ───────────
const status = {
  ollama:  { ok: false, checkedAt: 0, model: false },
  whisper: { ok: false, checkedAt: 0 },
  piper:   { ok: false, checkedAt: 0 },
};

const CHECK_INTERVAL_MS = 30_000; // re-check every 30s

async function probe(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkOllama() {
  const now = Date.now();
  if (now - status.ollama.checkedAt < CHECK_INTERVAL_MS) return status.ollama;

  // Single request: /api/tags confirms reachability AND lists models
  let ok = false, model = false;
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      ok = true;
      const data = await r.json();
      const modelName = process.env.OLLAMA_MODEL || "llama3.1:8b-instruct-q4_K_M";
      const baseModel = modelName.split(":")[0];
      model = (data.models || []).some(m =>
        m.name === modelName || m.name.startsWith(baseModel)
      );
    }
  } catch { /* unreachable */ }

  status.ollama = { ok, model, checkedAt: now };
  return status.ollama;
}

export async function checkWhisper() {
  const now = Date.now();
  if (now - status.whisper.checkedAt < CHECK_INTERVAL_MS) return status.whisper;
  const ok = await probe(`${WHISPER}/health`, 3000) || await probe(`${WHISPER}/`, 3000);
  status.whisper = { ok, checkedAt: now };
  return status.whisper;
}

export async function checkPiper() {
  const now = Date.now();
  if (now - status.piper.checkedAt < CHECK_INTERVAL_MS) return status.piper;
  const ok = await probe(`${PIPER}/health`, 3000);
  status.piper = { ok, checkedAt: now };
  return status.piper;
}

// ─── Fetch with timeout ──────────────────────────────────────
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Combined health check for /ready endpoint ──────────────
export async function checkAllServices() {
  const [ollama, whisper, piper] = await Promise.all([
    checkOllama(),
    checkWhisper(),
    checkPiper(),
  ]);
  return {
    ollama: { reachable: ollama.ok, model_loaded: ollama.model },
    whisper: { reachable: whisper.ok },
    piper:   { reachable: piper.ok },
  };
}
