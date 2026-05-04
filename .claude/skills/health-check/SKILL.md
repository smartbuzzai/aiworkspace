# Health Check

Use this skill when the user asks about the current state of the stack — "is everything running," "check the server," "any errors," "what's broken," "status of the containers." Also trigger proactively after non-deploy changes that could affect running services (env var changes, Caddy edits, schema migrations).

This is lighter than the `deploy` skill — it inspects without rebuilding.

## The Flow

### Step 1 — Where are we
```bash
pwd
hostname
whoami
```
If not in `/home/app/workspace`, `cd` there first.

### Step 2 — Container state
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### Step 3 — Disk pressure
```bash
df -h /data | tail -1
du -sh /data/* 2>/dev/null | sort -h | tail -10
```
Flag anything over 80% disk use or volumes over 10 GB.

### Step 4 — Recent errors across all containers
```bash
for svc in $(docker compose ps --services); do
  count=$(docker logs "$svc" --since 1h 2>&1 | grep -ciE "error|fatal|panic|refused" || echo 0)
  if [ "$count" -gt 0 ]; then
    echo "=== $svc ($count error lines in last hour) ==="
    docker logs "$svc" --since 1h 2>&1 | grep -iE "error|fatal|panic|refused" | tail -5
  fi
done
```

### Step 5 — Critical service probes
```bash
docker exec postgres pg_isready -U workspace 2>&1 | head -1
docker exec redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping 2>&1 | head -1
curl -fsS http://localhost:4000/ready 2>&1 | head -1
```

### Step 6 — Queue backlog
```bash
docker exec redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
  --scan --pattern 'bull:*:wait' | head -10
```
A growing `wait` queue means workers are falling behind.

### Step 7 — Report
Summarize in one paragraph: what's running, what's degraded, what needs attention. List specific next-action commands for anything degraded.

## What Not to Do

- Do not restart anything without reporting first and asking.
- Do not clear logs, queues, or caches as a "fix."
- Do not run this skill's commands with `sudo` — everything should work as the `app` user.
