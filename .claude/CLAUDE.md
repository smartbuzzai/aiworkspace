# AI Workspace — Project Context for Claude Code

You are working on **AI Workspace**, a self-hosted AI-managed productivity platform deployed to a Contabo VPS via Docker Compose. This file is your source of truth. Read it before touching anything.

---

## Environment — Read First, Assume Never

This project deploys to a **Contabo VPS running Ubuntu 24.04 on QEMU/KVM virtualization**. Treat that as a constraint, not a detail.

- **Architecture:** x86_64 (KVM-virtualized — not bare metal, not ARM)
- **Host OS:** Ubuntu 24.04 LTS
- **Container runtime:** Docker CE + Docker Compose v2 (plugin, not standalone)
- **Resource ceiling:** 6 vCPU, 16 GB RAM, 200 GB NVMe (VPS M tier)
- **Data root:** `/data/{postgres,redis,minio,meili,ollama,whisper,piper,radicale,uptime,api-uploads,backups}`
- **App directory:** `/opt/aiworkspace`
- **Network:** ports 22, 80, 443 (TCP + UDP) open via UFW — nothing else

### Known platform quirks — do not rediscover these
- **SWC SIGBUS on QEMU/KVM.** Next.js SWC binary crashes on this VPS. Use the WASM fallback by setting `NEXT_DISABLE_SWC_NATIVE=1` or pinning `@next/swc-wasm-nodejs` before suggesting any alternative.
- **Contabo IPs are often greylisted.** Do not propose running a self-hosted mail server (Postfix, docker-mailserver). Use IMAP/SMTP to the user's existing provider instead.
- **Docker UID mapping.** Host `app` user is UID 1000. Containers that write to `/data/*` must match or use named volumes. Permission errors after restart almost always mean a container wrote as root.
- **Watchtower Docker API version mismatches.** If you touch Watchtower, verify the Docker API version pinned in the compose file matches the host's Docker daemon.
- **Read-only mount symlinks break container boot.** Never mount config files as symlinks inside read-only volumes. Copy the file or use a named volume.

---

## Workflow Rules — Apply Every Session

### Before making any changes
1. **Run `docker ps` first** to confirm actual container state. Do not assume anything is running or not running.
2. **Run `pwd` and `ls`** before assuming file paths. The real paths are documented below.
3. **Read the relevant file** before editing. Never edit from memory of a previous session.
4. For infrastructure or deployment tasks, **outline your approach in 3-5 lines** before executing. Wait for confirmation on anything irreversible.

### After making changes
1. **Run `docker compose config`** to validate YAML before `up -d`.
2. **Run `docker compose up -d`** and then `docker ps` to verify all containers are healthy.
3. **Check logs of any unhealthy container** with `docker logs <name> --tail 50`.
4. **Never report success until containers show "healthy" or "running".**
5. Do not mark a task done based on compilation alone — verify runtime behavior.

### When debugging
- **Express/Fastify route ordering:** auth middleware must come before the protected routes it guards. 401 errors usually mean order is wrong, not that auth is broken.
- **JSON serialization:** Postgres `BIGINT`, `TIMESTAMPTZ`, and UUID columns need explicit handling before `JSON.stringify`. The project uses custom serializers in `apps/api/src/lib/` — extend those, don't invent new ones.
- **Redis hostname:** inside Docker, use `redis` not `localhost`. In development, use `localhost:6379`.
- **Postgres hostname:** same pattern — `postgres` inside Docker, `localhost:5432` outside.

---

## Project Layout — Authoritative Paths

```
/opt/aiworkspace/
├── docker-compose.yml           # All 14 services; edit carefully
├── .env                         # Secrets — never commit, never print
├── caddy/Caddyfile              # Reverse proxy + auto-TLS
├── db/init/01-schema.sql        # Postgres schema — runs once on first boot only
├── radicale/config              # CalDAV server config
├── scripts/
│   ├── bootstrap.sh             # Fresh VPS setup; idempotent
│   └── backup.sh                # Nightly restic cron job
└── apps/
    ├── api/                     # Fastify + Node 20 + Zod + pg
    │   └── src/
    │       ├── server.js        # Entry; route registration
    │       ├── lib/             # db, redis, auth, assistant helpers
    │       └── routes/          # auth, contacts, emails, events, projects,
    │                            # tasks, files, assistant, accounts, push
    ├── web/                     # Next.js 14 PWA
    │   ├── app/                 # App Router
    │   └── components/          # App, Login, Settings, InboxView, CRMView
    └── workers/                 # BullMQ workers
        └── src/
            ├── index.js         # IMAP sync, embeddings, summaries,
            │                    # reminders, digest, file extraction
            └── caldav.js        # Two-way Radicale sync
```

### Do not move or rename these without explicit instruction
- `docker-compose.yml` at the repo root
- `caddy/Caddyfile` (referenced by compose mount)
- `db/init/*.sql` (Postgres auto-runs this only on empty data volume)
- `apps/{api,web,workers}/Dockerfile` (compose build contexts)

---

## Code Standards

- **Language:** JavaScript (ES modules, Node 20+). Do not introduce TypeScript without asking — this is a deliberately-simple codebase.
- **Linting:** none configured. Write clean code on the first pass.
- **Testing:** none configured yet. If you add tests, propose the framework first (Vitest preferred for parity with Next).
- **Async:** always `async/await`, never raw `.then()` chains.
- **Error handling:** every async route handler must catch its own errors; the Fastify error handler is a last resort, not a crutch.
- **Validation:** every request body goes through Zod. No exceptions.
- **SQL:** parameterized queries only. Never interpolate user input, never build dynamic SQL with string concatenation.
- **Secrets:** read from `process.env`. Never log secret values. Never echo `.env` contents to the terminal.

### Known bug patterns to check on every PR
- **BigInt in JSON responses:** Postgres bigints come back as strings from `pg` driver — safe — but `Number(bigintValue)` overflows at 2^53. Keep them as strings in API responses.
- **Timestamp precision:** Postgres `TIMESTAMPTZ` stores microseconds, JS `Date` stores milliseconds. Audit comparisons require truncation to millisecond precision on both sides.
- **Express/Fastify route order:** define public routes before `app.addHook("preHandler", requireAuth)`.
- **Dependency injection:** every route module receives `app` as the sole parameter. Do not import `db` or `redis` inside a route factory — import at the top level.

---

## The AI Assistant Tool Layer

The assistant at `apps/api/src/lib/assistant.js` exposes server-side functions to Ollama's tool-calling. When adding tools:

1. Add the schema to `toolSchemas` with clear parameter descriptions.
2. Add the case to `runTool`'s switch statement.
3. Every tool executes scoped to `req.user.user_id` — never accept user_id as a tool parameter.
4. Tools that mutate data must return `{ ok, ...summary }`. Tools that read return the data directly.
5. Never let a tool execute raw SQL — wrap everything in parameterized queries.

---

## What Not to Do

- **Do not add n8n back.** It was removed deliberately. BullMQ workers cover every automation case.
- **Do not propose OpenAI, Anthropic, or Google as required dependencies.** Ollama is the default. Groq free tier is the optional voice-mode fallback.
- **Do not suggest rewriting to a monorepo tool** (Nx, Turborepo, Lerna). The three-app structure is intentional.
- **Do not install dependencies globally** inside containers. Use package.json.
- **Do not `docker system prune -af` without asking.** This VPS has real data on real volumes.
- **Do not reset or recreate the Postgres volume** unless the user explicitly requests a fresh schema.

---

## Session Discipline

- **Work in phases.** Do not attempt marathon builds that span multiple subsystems in a single session. If a task requires 100+ file changes, break it into explicit phases, verify after each, and stop for confirmation before proceeding.
- **Commit after each phase.** A good checkpoint is a working phase, not a working session.
- **Ask before destructive operations.** Database migrations, container recreates, file deletes, force pushes, and any `rm -rf` — all require explicit confirmation.
- **Report real status.** "All services deployed" requires `docker ps` showing healthy. Log output is not proof of success.
