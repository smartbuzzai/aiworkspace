# Self-Hosted AI Workspace — Build Map

**Target:** Contabo VPS · Docker Compose · zero paid SaaS dependencies
**Stack philosophy:** open-source only, one server for MVP, horizontal-ready later

---

## 1. Server Sizing

Pick the Contabo tier based on how much AI workload stays on-box.

| Tier | Specs | Monthly (EU) | Fits |
|---|---|---|---|
| VPS S | 4 vCPU, 8 GB, 100 GB NVMe | ~€6 | App only, AI calls go to a free-tier remote model |
| **VPS M** | **6 vCPU, 16 GB, 200 GB NVMe** | **~€9** | **Full app + small local LLM (7B quantized) + Whisper** |
| VPS L | 8 vCPU, 30 GB, 400 GB NVMe | ~€15 | Full app + 13B model + Whisper + Piper TTS comfortably |
| VDS with GPU | dedicated + GPU | ~€70+ | Real-time voice + larger models |

Start on VPS M. You can migrate to VPS L with a single `rsync` + `docker compose up` later.

**OS:** Ubuntu 24.04 LTS. Contabo provides it as a default image.

---

## 2. Architecture At A Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    Contabo VPS (Ubuntu 24.04)                │
│                                                              │
│   ┌──────────────┐                                           │
│   │ Caddy (443)  │ ← auto TLS via Let's Encrypt (free)       │
│   └──────┬───────┘                                           │
│          │                                                   │
│   ┌──────┴────────────────────────────────────┐             │
│   │         Docker Compose network             │             │
│   │                                            │             │
│   │  web (Next.js) ──┐                         │             │
│   │                   ├─→ api (Node/Fastify)   │             │
│   │  mobile PWA ──────┘         │              │             │
│   │                              ├─→ postgres  │             │
│   │                              ├─→ redis     │             │
│   │                              ├─→ minio     │             │
│   │                              ├─→ meili     │             │
│   │                              ├─→ ollama    │             │
│   │                              ├─→ whisper   │             │
│   │                              ├─→ piper     │             │
│   │                              └─→ n8n       │             │
│   │                                            │             │
│   │  workers (BullMQ consumers) ───────────────┤             │
│   └────────────────────────────────────────────┘             │
│                                                              │
│   Volumes: /data/postgres, /data/minio, /data/ollama, ...   │
│   Backups: restic → Backblaze B2 free tier OR local cron    │
└─────────────────────────────────────────────────────────────┘
```

Every block above is free and self-hostable.

---

## 3. Container-by-Container Breakdown

### 3.1 Reverse proxy — Caddy
Free TLS, auto-renewal, HTTP/3, one-file config. Simpler than Nginx + Certbot.

```
caddy:
  image: caddy:2-alpine
  ports: ["80:80", "443:443"]
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
    - caddy_config:/config
```

**Caddyfile:**
```
app.yourdomain.com {
  reverse_proxy web:3000
}
api.yourdomain.com {
  reverse_proxy api:4000
}
```

---

### 3.2 Database — Postgres 16
The backbone for users, contacts, emails, events, projects, tasks, files metadata, and vector embeddings via `pgvector`.

```
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_PASSWORD: ${PG_PASSWORD}
    POSTGRES_DB: workspace
  volumes:
    - /data/postgres:/var/lib/postgresql/data
```

Why `pgvector`: semantic search over emails, docs, notes, meeting transcripts — no separate vector DB needed. Saves a container.

---

### 3.3 Cache + queue — Redis 7

```
redis:
  image: redis:7-alpine
  command: redis-server --save 60 1 --loglevel warning
  volumes:
    - /data/redis:/data
```

Powers BullMQ (job queue for AI tasks, email sync, reminders) and session cache.

---

### 3.4 Object storage — MinIO
S3-compatible. Stores uploaded files, email attachments, voice recordings, meeting audio.

```
minio:
  image: minio/minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
  volumes:
    - /data/minio:/data
```

---

### 3.5 Search — MeiliSearch
Instant search across contacts, emails, docs, tasks. Indexes as you write.

```
meili:
  image: getmeili/meilisearch:v1.10
  environment:
    MEILI_MASTER_KEY: ${MEILI_KEY}
  volumes:
    - /data/meili:/meili_data
```

Alternative: skip it and use Postgres full-text search. MeiliSearch gives a better UX for typo-tolerant search.

---

### 3.6 Local LLM — Ollama
The brain of the assistant. Runs Llama 3.1 8B, Qwen 2.5 7B, or Mistral 7B quantized. Free forever.

```
ollama:
  image: ollama/ollama:latest
  volumes:
    - /data/ollama:/root/.ollama
```

Pull a model once:
```
docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
```

On a 16 GB VPS, 8B at 4-bit quantization runs at 8-15 tokens/sec CPU-only. Usable for drafting emails, summarizing threads, extracting action items. For snappier latency, add a cheap GPU VPS later or use a free-tier external model (Groq free tier, Cerebras free tier, Google AI Studio free tier) as a fallback.

**Fallback pattern:** set `LLM_PROVIDER=ollama` by default, fall through to Groq free API when latency matters (voice mode).

---

### 3.7 Speech-to-text — Whisper.cpp server
Free, runs on CPU, good quality. Use `faster-whisper-server` which exposes an OpenAI-compatible endpoint.

```
whisper:
  image: fedirz/faster-whisper-server:latest-cpu
  environment:
    WHISPER_MODEL: base.en
  volumes:
    - /data/whisper:/root/.cache
```

`base.en` transcribes a minute of speech in under 10 seconds on 4 vCPU. Bump to `small.en` when VPS headroom allows.

---

### 3.8 Text-to-speech — Piper
Zero-latency local TTS. The assistant talks back without any API.

```
piper:
  image: rhasspy/wyoming-piper
  command: --voice en_US-lessac-medium
  volumes:
    - /data/piper:/data
```

Voices are 20–60 MB each. Ships with a dozen accents.

---

### 3.9 Workflow engine — n8n
Free self-hosted automation. Handles email fetch cron, calendar reminders, AI task routing, webhook fan-out. Replaces Zapier + Make + half of what you'd normally build yourself.

```
n8n:
  image: n8nio/n8n:latest
  environment:
    DB_TYPE: postgresdb
    DB_POSTGRESDB_HOST: postgres
    DB_POSTGRESDB_DATABASE: n8n
  volumes:
    - /data/n8n:/home/node/.n8n
```

---

### 3.10 App — Next.js 15 (web + PWA)
One codebase serves desktop web, mobile web, and installable PWA. No separate iOS/Android build needed at MVP.

```
web:
  build: ./apps/web
  environment:
    NEXT_PUBLIC_API_URL: https://api.yourdomain.com
    DATABASE_URL: postgres://...
```

**Why PWA beats native at this stage:**
- One codebase, one deploy
- Voice input works via Web Speech API in Chrome/Edge/Safari — fully free
- Installable home-screen icon, offline cache, push notifications via Web Push (VAPID, free)
- No App Store fees, no review cycles

Add a Capacitor or Tauri wrapper later if you need deeper OS hooks.

---

### 3.11 API — Node + Fastify (or Hono)
REST + WebSocket. Fastify is fast, lean, and pairs well with BullMQ.

```
api:
  build: ./apps/api
  depends_on: [postgres, redis, minio, ollama, whisper]
```

**Endpoints it exposes:**
- `/auth/*` — email magic link login (no OAuth provider, no cost)
- `/contacts`, `/emails`, `/events`, `/projects`, `/tasks`, `/files`
- `/assistant/chat` — streams tokens from Ollama
- `/assistant/voice` — receives audio blob, pipes to Whisper, sends transcript to LLM, pipes response to Piper, streams audio back
- `/sync/gmail`, `/sync/imap` — email fetch workers

---

### 3.12 Background workers
Separate container running BullMQ consumers. Handles email polling every 2 minutes, embedding generation, calendar reminders, digest creation.

```
workers:
  build: ./apps/workers
  depends_on: [redis, postgres, ollama]
```

---

## 4. Email — The Hardest Part

Two options, both zero-cost for receiving.

**Option A — IMAP/SMTP client (recommended for MVP).**
The user keeps their existing Gmail, Outlook, ProtonMail, or Fastmail account. The app logs in via IMAP (read) and SMTP (send) using credentials stored encrypted in Postgres.

- Library: `imapflow` + `nodemailer`
- Sync pattern: IDLE connection per mailbox for real-time pushes, fallback poll every 2 min
- Works with any provider

This is the path of least resistance. No DNS, no MX records, no deliverability hell.

**Option B — Run your own mail server.**
Docker Mailserver (`docker-mailserver/docker-mailserver`) + rspamd. You own the inbox end-to-end. Free, but three real costs in time:

1. A clean IP (Contabo IPs are often greylisted; warm-up takes weeks)
2. SPF + DKIM + DMARC + rDNS configured correctly
3. Bounce monitoring, blocklist monitoring, ongoing sysadmin

Do Option A for months 1–3. Evaluate Option B once the product is real.

---

## 5. Calendar — CalDAV via Radicale

Radicale is a 200-line Python CalDAV/CardDAV server. Free, self-hosted, syncs with iOS Calendar, Google Calendar (read-only import), Thunderbird, anything CalDAV-aware.

```
radicale:
  image: tomsquest/docker-radicale
  volumes:
    - /data/radicale:/data
```

Your app writes events directly to Postgres for speed, then mirrors them to Radicale for external device sync. Two-way sync back from Radicale runs in a worker.

---

## 6. AI Assistant — How It All Connects

**Text flow:**
```
user types → api /assistant/chat
  → fetch user context (relevant contacts, events, unread emails) from Postgres + pgvector
  → build system prompt with context
  → stream completion from Ollama
  → persist thread in Postgres
  → return SSE stream to web client
```

**Voice flow:**
```
mic button → browser records WebM via MediaRecorder
  → POST blob to /assistant/voice
  → api pipes audio to Whisper container
  → transcript → LLM (context-enriched) → text response
  → text → Piper → WAV stream
  → client plays audio while showing transcript
```

**Tool use (where it gets interesting):**
The LLM has function-calling access to your own API. Use `ollama`'s tool-call support (Llama 3.1+ supports this natively) to let the assistant:
- `create_task`, `schedule_event`, `send_email_draft`
- `search_contacts`, `find_files`, `summarize_thread`
- `add_note_to_contact`, `set_reminder`

Define tools as JSON schemas. The API validates every tool call before executing. Never let the model write raw SQL — always go through validated endpoints.

---

## 7. Auth Without Paying

- **Magic link email login** — send a one-time link via whatever SMTP the user already has (their Gmail app password works fine). Zero cost.
- **Passkeys (WebAuthn)** — free, built into every modern browser. Use `simplewebauthn` library.
- **Single-user mode first.** Multi-tenant SaaS is a later concern. For solo or small-team use, skip SSO providers entirely.

No Auth0. No Clerk. No Firebase. No bill.

---

## 8. Backups — Free Tier

**restic** is the backup tool. Backs up `/data` encrypted and deduplicated.

Two free targets:
- **Local:** second Contabo disk or a friend's server via SFTP
- **Off-site free:** Backblaze B2 free tier (10 GB), Storj free tier (25 GB), or a rotation of two servers cross-backing-up

Cron:
```
0 3 * * * restic -r sftp:backup@otherhost:/backups backup /data --tag nightly
0 4 * * 0 restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

Test restore monthly. An untested backup is a wish.

---

## 9. Monitoring — Free Stack

- **Uptime Kuma** — self-hosted uptime monitor, pretty dashboards, Discord/Telegram alerts
- **Netdata** — real-time metrics, one container, zero config
- **Dozzle** — container log viewer in the browser

All three run in under 400 MB combined. Put them on a subdomain behind Caddy basic auth.

---

## 10. 90-Day Build Sequence

**Weeks 1–2 — Infrastructure.**
Provision VPS, install Docker, lock down SSH (key-only, fail2ban, UFW), set up Caddy + domain, spin up Postgres + Redis + MinIO + MeiliSearch. Verify backups restore. Ship a "hello world" Next.js behind TLS.

**Weeks 3–5 — Core data layer.**
Build the schema: users, contacts, emails, threads, events, projects, tasks, files. Write the API endpoints. Build the web app shell using the prototype JSX as the visual spec. Auth via magic link.

**Weeks 6–7 — Email ingestion.**
IMAP sync worker. Store threads in Postgres. Full-text + semantic index. Unified inbox view wired to real data.

**Week 8 — Calendar + CalDAV.**
Radicale container. Two-way sync worker. Calendar UI wired.

**Weeks 9–10 — AI assistant, text-only first.**
Ollama container. `/assistant/chat` endpoint with streaming. Context retrieval via pgvector. Tool-calling for the 6–8 most useful actions. Text chat works end-to-end.

**Week 11 — Voice.**
Whisper + Piper containers. MediaRecorder on the client. Full voice loop. Test on phone over 4G.

**Week 12 — PWA polish + installable mobile.**
Service worker, offline cache for the shell, Web Push notifications, home-screen install manifest, icon set.

**Weeks 13 — Harden and document.**
Rate limits, input validation pass, backup verification, runbook for common failures, user onboarding flow.

---

## 11. Realistic Cost Summary

| Line item | Monthly |
|---|---|
| Contabo VPS M | ~€9 |
| Domain (one-time ~€12/yr, amortized) | ~€1 |
| Backblaze B2 (within free tier) | €0 |
| Everything else (software) | €0 |
| **Total** | **~€10/mo** |

Scale-up to VPS L when the LLM needs more headroom: ~€15/mo.

---

## 12. What This Plan Does Not Cover (Yet)

- **Real-time collaboration** (multiple users editing the same doc). Add Yjs + Hocuspocus container when needed. Still free.
- **Native mobile apps.** PWA first. Wrap with Capacitor if app store presence becomes necessary.
- **Multi-tenant SaaS.** Single-tenant now. Row-level security + tenant_id comes later if you commercialize.
- **Phone-grade voice latency.** CPU Whisper + CPU Piper gives ~2-4s total round-trip on an 8-core VPS. For sub-second, you need a GPU or a free-tier remote ASR (Groq Whisper is free-tier friendly). Keep both paths in the code.

---

## 13. First Commands To Run

```bash
# On fresh Contabo Ubuntu 24.04
ssh root@your-vps-ip

# Harden
apt update && apt upgrade -y
apt install ufw fail2ban docker.io docker-compose-plugin -y
ufw allow 22,80,443/tcp && ufw enable
systemctl enable --now fail2ban docker

# Create app user
adduser app && usermod -aG docker app
su - app

# Pull repo
git clone your-repo && cd your-repo
cp .env.example .env  # fill in secrets
docker compose up -d

# Pull the LLM
docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M

# Point DNS A records for app. and api. at your VPS IP
# Caddy gets certs automatically within 60 seconds
```

The app is live.

---

## 14. When To Break The "No Paid Services" Rule

A few places where spending $5-20/mo pays back many times over:

- **Transactional email deliverability.** If you need to send cold emails, self-hosted SMTP will land in spam. A pay-as-you-go relay like Amazon SES is $0.10 per 1000 emails.
- **Push notifications at scale.** Web Push is free. iOS native push via APNs requires an Apple Developer account ($99/yr) only if you wrap with Capacitor.
- **Faster LLM.** Groq free tier is generous, but if you hit limits, their paid tier is cheap. Keep the Ollama path as fallback so you're never locked in.

Stay self-hosted for everything else. The savings compound, and you own your data.
