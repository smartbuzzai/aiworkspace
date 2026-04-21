# Deployment Guide

Step-by-step production deployment for AI Workspace on a Contabo (or any Ubuntu 24.04) VPS.

## Prerequisites

- Ubuntu 24.04 LTS VPS (recommended: 6 vCPU, 16 GB RAM, 200 GB NVMe)
- SSH access with key-based auth
- A domain with DNS control (e.g. Cloudflare, Namecheap)
- 30 minutes for initial setup

## 1. DNS Setup

Create these A records pointing to your VPS IP **before** running the stack (Caddy needs them for TLS):

| Subdomain | Purpose |
|---|---|
| `app.yourdomain.com` | Web app (Next.js) |
| `api.yourdomain.com` | REST API (Fastify) |
| `n8n.yourdomain.com` | Workflow automation |
| `files.yourdomain.com` | MinIO console |
| `dav.yourdomain.com` | CalDAV (Radicale) |
| `status.yourdomain.com` | Uptime Kuma |
| `logs.yourdomain.com` | Dozzle log viewer |

**Tip:** Set TTL to 300 seconds during setup so changes propagate fast.

## 2. Server Bootstrap

```bash
ssh root@YOUR_VPS_IP
git clone https://github.com/smartbuzzai/ai-workspace.git /opt/workspace
cd /opt/workspace
sudo bash scripts/bootstrap.sh
```

The bootstrap script will:
- Install Docker, firewall (UFW), fail2ban, auto-updates
- Create `/data/*` directories and an `app` user
- Generate all secrets in `.env` automatically
- Prompt for your domain name
- Generate VAPID keys for web push
- Start `docker compose up -d`
- Pull Ollama models (~5 GB download)
- Verify all services are healthy

## 3. Verify Services

```bash
docker compose ps
```

All services should show `Up` or `healthy`. If any are restarting:

```bash
docker compose logs <service-name> --tail 50
```

### Health endpoints

```bash
# API health
curl -s https://api.yourdomain.com/health | jq

# Readiness (DB + Redis + Ollama/Whisper/Piper status)
curl -s https://api.yourdomain.com/ready | jq
```

## 4. First Sign-in

1. Visit `https://app.yourdomain.com`
2. Enter your email address
3. Since no SMTP is configured yet, find the magic link in the API logs:
   ```bash
   docker compose logs api | grep "magic link"
   ```
4. Copy the full URL and paste it in your browser
5. You're now signed in with a 30-day session

## 5. Post-Deploy Checklist

### Security
- [ ] SSH key-only auth is enforced (`PasswordAuthentication no`)
- [ ] UFW is active: `sudo ufw status` should show 22, 80, 443 open
- [ ] fail2ban is running: `sudo systemctl status fail2ban`
- [ ] `.env` file has 0600 permissions: `chmod 600 .env`
- [ ] No default passwords remain: `grep 'change_me' .env` should return nothing
- [ ] Dozzle log viewer has basic auth configured in Caddyfile

### TLS
- [ ] All subdomains resolve: `dig +short app.yourdomain.com`
- [ ] HTTPS works: `curl -I https://app.yourdomain.com` returns 200
- [ ] Caddy issued certs: `docker compose logs caddy | grep "certificate obtained"`

### Services
- [ ] Postgres is healthy: `docker exec workspace-postgres-1 pg_isready`
- [ ] Redis responds: `docker exec workspace-redis-1 redis-cli -a $REDIS_PASSWORD ping`
- [ ] Ollama models loaded: `docker exec ollama ollama list`
- [ ] MinIO bucket exists: check `docker compose logs workers | grep "bucket"`

### Email
- [ ] Connect first IMAP/SMTP account in Settings
- [ ] Wait 2 minutes for first sync
- [ ] Verify threads appear in Inbox

### Backups
- [ ] Configure `RESTIC_REPOSITORY` and `RESTIC_PASSWORD` in `.env`
- [ ] Run initial backup: `sudo bash scripts/backup.sh`
- [ ] Add to cron: `0 3 * * * /opt/workspace/scripts/backup.sh >> /data/backups/backup.log 2>&1`
- [ ] Test restore monthly: `restic restore latest --target /tmp/test --include /data/postgres`

### Monitoring
- [ ] Set up Uptime Kuma at `https://status.yourdomain.com`
- [ ] Add monitors: API health, web app, Postgres, Redis, Ollama
- [ ] Configure alert notifications (email, Slack, Telegram)

## 6. Database Migrations

Migrations run automatically on API startup. To add a new migration:

1. Create `db/migrations/NNNN_description.sql` (e.g., `0002_add_teams.sql`)
2. Write your SQL — it runs inside a transaction
3. Restart the API: `docker compose restart api`
4. Check logs: `docker compose logs api | grep "Migration"`

Applied migrations are tracked in the `schema_migrations` table.

## 7. Updating

```bash
cd /opt/workspace
git pull origin main
docker compose build
docker compose up -d
```

Migrations apply automatically. Zero-downtime updates work if you pull/build first, then restart one service at a time:

```bash
docker compose up -d --no-deps --build api
docker compose up -d --no-deps --build web
docker compose up -d --no-deps --build workers
```

## 8. Troubleshooting

### API won't start
```bash
docker compose logs api --tail 30
```
- `FATAL: Missing required environment variables` — check `.env`
- `ECONNREFUSED postgres:5432` — Postgres not healthy yet, wait or restart

### Ollama is slow / not responding
```bash
docker exec ollama ollama list    # check models are pulled
docker stats ollama               # check CPU/memory usage
```
- If no models: `docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M`
- If OOM: increase VPS RAM or use a smaller model

### IMAP sync errors
```bash
docker compose logs workers | grep "imap sync error"
```
- `Authentication failed` — wrong password/app password
- `Connection refused` — check IMAP host/port in Settings
- `ENOTFOUND` — DNS resolution issue inside container

### Caddy TLS failures
```bash
docker compose logs caddy | grep "error"
```
- DNS not propagated yet — wait and `docker compose restart caddy`
- Port 80/443 blocked — check `ufw status`

### High disk usage
```bash
df -h /data
docker system df
docker system prune -a --volumes  # WARNING: removes unused data
```

### Reset everything
```bash
docker compose down -v
rm -rf /data/postgres /data/redis  # WARNING: deletes all data
docker compose up -d               # reinitializes from scratch
```

## 9. Resource Usage (Typical)

| Service | RAM (idle) | RAM (active) | Disk |
|---|---|---|---|
| Postgres | ~200 MB | ~500 MB | grows with data |
| Redis | ~30 MB | ~100 MB | ~50 MB |
| Ollama (llama3.1 8B) | ~5 GB | ~6 GB | ~5 GB models |
| Whisper | ~500 MB | ~800 MB | ~300 MB models |
| Piper | ~100 MB | ~200 MB | ~50 MB |
| API + Web + Workers | ~300 MB | ~500 MB | ~200 MB |
| MinIO | ~100 MB | ~200 MB | grows with files |
| **Total** | **~6.5 GB** | **~8.5 GB** | **~6 GB base** |

A 16 GB VPS handles this comfortably with room for growth.

## 10. API Documentation

The full OpenAPI 3.1 spec is at `docs/openapi.yaml`. You can view it with:

```bash
# Local Swagger UI
docker run -p 8080:8080 -e URL=/spec.yaml -v $(pwd)/docs/openapi.yaml:/usr/share/nginx/html/spec.yaml swaggerapi/swagger-ui
```

Or paste it into [editor.swagger.io](https://editor.swagger.io).
