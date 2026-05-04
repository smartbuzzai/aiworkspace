# Deploy

Use this skill whenever the user asks to deploy, redeploy, restart, bring up, or ship the AI Workspace stack. Also trigger on any `docker compose up`, post-edit deploy verification, or "is everything running" question.

The insights report identified post-deployment issues (401s from route ordering, Redis hostname failures, port conflicts, permission errors) that surfaced late. This skill catches them systematically instead of discovering them when the user tests manually.

## The Flow

Execute every step in order. Do not skip steps. Report results of each step before moving to the next.

### Step 1 — Pre-flight
```bash
cd /home/app/workspace || { echo "not in workspace"; exit 1; }
docker compose config --quiet 2>&1 | head -20
```
If `docker compose config` prints anything, stop and fix the YAML before proceeding.

### Step 2 — Build
```bash
docker compose build 2>&1 | tail -30
```
Check for build errors. Do not assume success — parse the output.

### Step 3 — Launch
```bash
docker compose up -d 2>&1 | tail -20
```

### Step 4 — Settle
Wait 15 seconds. Containers with healthchecks need time to converge.
```bash
sleep 15
```

### Step 5 — Status audit
```bash
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.State}}'
```
Every row must show `running` or `healthy`. Anything else is a failure.

### Step 6 — Per-service log scan
For each service that is not `healthy`, run:
```bash
docker logs <container_name> --tail 30
```

Look for these specific patterns first:
- `EADDRINUSE` → port conflict
- `ECONNREFUSED` → service dependency not ready (Redis, Postgres)
- `permission denied` → UID mismatch on a host-mounted volume
- `password authentication failed` → .env mismatch
- `no such file or directory` → volume mount path wrong
- `SIGBUS` → SWC crash, needs WASM fallback

### Step 7 — Endpoint probes
```bash
curl -fsS http://localhost:4000/health | head -5 || echo "API down"
curl -fsS http://localhost:3000 | head -5 || echo "Web down"
```

### Step 8 — Report
Produce a table with one row per service: `service | state | issue (if any) | next action`. Do not declare success unless every service is green.

## What Not to Do

- Do not run `docker compose down -v` as a "fix" — that destroys volumes.
- Do not restart the whole stack if only one service failed. Restart the specific container: `docker compose restart <service>`.
- Do not assume "container started" means "service ready." A container can be running while its process is crash-looping.
- Do not call the deploy successful until Step 8 is green.
