# AI Workspace — Self-Hosted

A self-hosted, AI-managed workspace: CRM, email, unified inbox, calendar, project manager, document library, and a voice + text AI assistant. Runs on a single Contabo VPS in Docker. Zero paid SaaS dependencies.

## What's in the box

| Service | Role |
|---|---|
| **Caddy** | Reverse proxy + auto-HTTPS |
| **Postgres 16 + pgvector** | Primary DB + vector store |
| **Redis** | Queues + cache |
| **MinIO** | S3-compatible object storage |
| **MeiliSearch** | Typo-tolerant full-text search |
| **Ollama** | Local LLM (Llama 3.1 8B) |
| **Whisper** | Speech-to-text |
| **Piper** | Text-to-speech |
| **Radicale** | CalDAV / CardDAV server |
| **n8n** | Workflow automation |
| **Next.js** | Web app / PWA |
| **Fastify API** | REST + SSE + WebSockets |
| **BullMQ workers** | IMAP sync, embeddings, reminders, digest |
| **Uptime Kuma + Dozzle** | Monitoring + log viewer |

Total monthly cost: ~$10 for the VPS, ~$15 for the domain, $0 for everything else.

## Repository layout

```
.
├── docker-compose.yml       # all services
├── .env.example             # fill in secrets → .env
├── caddy/Caddyfile          # auto-HTTPS + subdomains
├── radicale/config          # CalDAV config
├── db/init/01-schema.sql    # Postgres schema (runs on first boot)
├── scripts/
│   ├── bootstrap.sh         # one-shot VPS setup
│   └── backup.sh            # nightly restic backup
└── apps/
    ├── api/                 # Fastify REST API
    ├── web/                 # Next.js PWA
    └── workers/             # BullMQ workers
```

## Quick start

### 1. Provision the VPS

- Order a **Contabo VPS M** (6 vCPU, 16 GB RAM, 200 GB NVMe — ~€9/mo)
- Choose Ubuntu 24.04 LTS
- Add your SSH public key

### 2. Bootstrap

```bash
ssh root@YOUR_VPS_IP
curl -fsSL https://raw.githubusercontent.com/you/workspace/main/scripts/bootstrap.sh | bash
```

Or clone first, then run `sudo bash scripts/bootstrap.sh`.

This installs Docker, sets up the firewall, hardens SSH, enables fail2ban, creates `/data/*` volumes, and creates an `app` user.

### 3. DNS

Point these A records at your VPS IP:

```
app.yourdomain.com
api.yourdomain.com
n8n.yourdomain.com
files.yourdomain.com
dav.yourdomain.com
status.yourdomain.com
logs.yourdomain.com
```

Caddy handles all TLS automatically the first time each subdomain is requested.

### 4. Configure secrets

```bash
su - app
git clone https://github.com/you/workspace && cd workspace
cp .env.example .env
nano .env
```

Generate each secret with:
```bash
openssl rand -hex 32
```

Set `DOMAIN=yourdomain.com` and fill every `change_me_*` value.

### 5. Launch

```bash
docker compose up -d
docker compose logs -f caddy   # watch TLS certs get issued
```

Wait ~90 seconds for Caddy to finish initial cert issuance.

### 6. Pull the AI models (one-time, ~6 GB download)

```bash
docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
docker exec ollama ollama pull nomic-embed-text
```

The chat model is ~4.7 GB. The embedding model is ~270 MB.

### 7. Sign in

Visit `https://app.yourdomain.com` and enter your email. Check the API logs for the magic link (until you connect an SMTP account, the link is only logged, not emailed):

```bash
docker compose logs api | grep "magic link"
```

Copy the link, paste it in your browser, and you're in.

### 8. Connect your first email account

From Settings → Email Accounts, add IMAP + SMTP credentials for Gmail, Outlook, Fastmail, ProtonMail Bridge, or any IMAP-compatible service. App passwords are recommended for providers that support them.

Once connected, the IMAP sync worker polls every 2 minutes. Threads appear in the unified inbox automatically.

## How the AI assistant works

**Text flow:**
1. User types in the assistant panel
2. API loads recent thread history + retrieves related context via pgvector similarity search
3. Prompt is built with today's events, open high-priority tasks, unread threads, and semantic matches
4. Ollama streams the response token-by-token via Server-Sent Events
5. If the model invokes a tool (`create_task`, `schedule_event`, `draft_email_reply`, etc.), the API validates arguments and executes the call
6. Tool results are appended to the thread and streamed back to the user

**Voice flow:**
1. User taps the mic button — browser captures audio with MediaRecorder
2. Audio POST'd to `/assistant/voice/transcribe` → Whisper → text transcript
3. Transcript sent through the normal chat flow
4. Response text sent to `/assistant/voice/speak` → Piper → WAV audio
5. Browser auto-plays the audio response

## Backups

Edit `scripts/backup.sh` to point at your off-site repo (SFTP, Backblaze B2 free tier, or Storj free tier), then add to cron:

```bash
crontab -e
# Add: 0 3 * * * /home/app/workspace/scripts/backup.sh >> /data/backups/backup.log 2>&1
```

Test a restore monthly:
```bash
restic restore latest --target /tmp/restore-test --include /data/postgres
```

## Monitoring

- `https://status.yourdomain.com` — Uptime Kuma (add monitors for each service)
- `https://logs.yourdomain.com` — Dozzle (live container logs; update basic auth hash in Caddyfile)
- `docker stats` — real-time resource use

## Scaling up

**If the LLM feels slow:**
- Upgrade to VPS L (~€15/mo) for more cores
- Or drop a free-tier Groq API key into `.env` — the assistant uses it automatically when available for snappier voice replies, while Ollama stays as the free fallback
- Or lease a GPU VPS and uncomment the NVIDIA section in `docker-compose.yml`

**If you add team members:**
- Row-level security is already baked in (`user_id` on every table)
- Add a `teams` + `team_members` table and scope queries by team
- Invite flow: magic link with a pre-populated team ID

**If you need real email sending reputation:**
- Swap the SMTP backend to Amazon SES or Postmark (cheapest paid option, ~$0.10/1k emails)
- Or stand up `docker-mailserver` on a separate VPS with a warmed IP

## What this isn't (yet)

- **Native mobile apps.** It's a PWA. Install from the browser's "Add to Home Screen" menu. Wrap in Capacitor later if the App Store matters.
- **Real-time collaboration.** Single-user per tenant. Add Yjs + Hocuspocus when needed.
- **Zero-admin.** You still manage a server. If you don't want to, use Cal.com + Cap.so + Obsidian + OpenAI and pay ~$50/mo.

## Development

For local development without Docker:

```bash
# Terminal 1
cd apps/api && npm install && DATABASE_URL=postgres://... npm run dev

# Terminal 2
cd apps/web && npm install && npm run dev

# Terminal 3
cd apps/workers && npm install && npm start
```

Point the web app at the local API by setting `NEXT_PUBLIC_API_URL=http://localhost:4000` in `apps/web/.env.local`.

## License

MIT. Run it anywhere. Sell it. Fork it. Just don't blame me when you forget to test your backups.
