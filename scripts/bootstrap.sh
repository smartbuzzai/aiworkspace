#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Bootstrap script for a fresh Contabo Ubuntu 24.04 VPS
#  Usage:  sudo bash scripts/bootstrap.sh
#
#  Phase 1: System setup (packages, Docker, firewall, user)
#  Phase 2: App setup (.env generation, compose up, model pulls)
#  Phase 3: Verification (health checks on all services)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

log()  { echo -e "\n\033[1;34m==> $*\033[0m"; }
ok()   { echo -e "  \033[1;32m✓\033[0m $*"; }
warn() { echo -e "  \033[1;33m⚠\033[0m $*"; }
fail() { echo -e "  \033[1;31m✗\033[0m $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ═══════════════════════════════════════════════════════════════
#  PHASE 1: System packages, Docker, firewall, user
# ═══════════════════════════════════════════════════════════════

log "Phase 1: System setup"

log "Updating system packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "Installing base tools"
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  git rsync restic htop jq openssl

if ! command -v docker &>/dev/null; then
  log "Installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed"
else
  ok "Docker already installed"
fi

log "Hardening SSH"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl reload ssh
ok "SSH hardened"

log "Configuring firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp  # HTTP/3
yes | ufw enable
ok "Firewall configured"

log "Configuring fail2ban"
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban
ok "fail2ban configured"

log "Enabling auto security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades
ok "Auto updates enabled"

log "Creating data directories"
mkdir -p /data/{postgres,redis,minio,meili,ollama,whisper,piper,radicale,n8n,uptime,api-uploads,backups}
ok "Data directories created"

log "Creating app user"
if ! id -u app >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" app
  usermod -aG docker app
  mkdir -p /home/app/.ssh
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys /home/app/.ssh/
    chown -R app:app /home/app/.ssh
    chmod 700 /home/app/.ssh
    chmod 600 /home/app/.ssh/authorized_keys
  fi
  ok "app user created"
else
  ok "app user already exists"
fi
chown -R app:app /data

# ═══════════════════════════════════════════════════════════════
#  PHASE 2: App configuration & startup
# ═══════════════════════════════════════════════════════════════

log "Phase 2: App configuration"

ENV_FILE="$PROJECT_DIR/.env"

# ─── Generate .env if it doesn't exist ────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  log "Generating .env from template"
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"

  # Auto-generate all secrets
  gen_secret() { openssl rand -hex 32; }

  sed -i "s|PG_PASSWORD=change_me_long_random_string|PG_PASSWORD=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|REDIS_PASSWORD=change_me_long_random_string|REDIS_PASSWORD=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|MINIO_PASSWORD=change_me_long_random_string|MINIO_PASSWORD=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|MEILI_KEY=change_me_long_random_string|MEILI_KEY=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|JWT_SECRET=change_me_generate_with_openssl_rand_hex_32|JWT_SECRET=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|SESSION_SECRET=change_me_generate_with_openssl_rand_hex_32|SESSION_SECRET=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|N8N_ENCRYPTION_KEY=change_me_long_random_string|N8N_ENCRYPTION_KEY=$(gen_secret)|" "$ENV_FILE"
  sed -i "s|N8N_PASSWORD=change_me_strong_password|N8N_PASSWORD=$(gen_secret)|" "$ENV_FILE"

  ok "Secrets auto-generated in .env"

  # Prompt for domain
  read -rp "  Enter your domain (e.g. example.com): " DOMAIN
  if [[ -n "$DOMAIN" ]]; then
    sed -i "s|DOMAIN=yourdomain.com|DOMAIN=$DOMAIN|" "$ENV_FILE"
    ok "Domain set to $DOMAIN"
  else
    warn "Domain not set — update DOMAIN= in .env before going live"
  fi
else
  ok ".env already exists — skipping generation"
fi

# ─── Generate VAPID keys if not set ──────────────────────────
if grep -q "^VAPID_PUBLIC_KEY=$" "$ENV_FILE" 2>/dev/null; then
  log "Generating VAPID keys for web push"
  VAPID_OUTPUT=$(docker run --rm node:20-alpine npx --yes web-push generate-vapid-keys --json 2>/dev/null || true)
  if [[ -n "$VAPID_OUTPUT" ]]; then
    VAPID_PUB=$(echo "$VAPID_OUTPUT" | jq -r '.publicKey // empty')
    VAPID_PRIV=$(echo "$VAPID_OUTPUT" | jq -r '.privateKey // empty')
    if [[ -n "$VAPID_PUB" && -n "$VAPID_PRIV" ]]; then
      sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=$VAPID_PUB|" "$ENV_FILE"
      sed -i "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=$VAPID_PRIV|" "$ENV_FILE"
      ok "VAPID keys generated"
    else
      warn "Could not parse VAPID output — generate manually later"
    fi
  else
    warn "Could not generate VAPID keys (Docker or Node issue) — generate manually later"
  fi
else
  ok "VAPID keys already set"
fi

# ─── Start the stack ──────────────────────────────────────────
log "Starting Docker Compose stack"
cd "$PROJECT_DIR"
docker compose up -d --build 2>&1 | tail -20
ok "Stack started"

# ─── Wait for core services ──────────────────────────────────
log "Waiting for core services to be healthy"

wait_for_healthy() {
  local service=$1
  local max_wait=${2:-60}
  local elapsed=0
  while [[ $elapsed -lt $max_wait ]]; do
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q "$service" 2>/dev/null)" 2>/dev/null || echo "missing")
    if [[ "$health" == "healthy" ]]; then
      ok "$service is healthy"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  fail "$service not healthy after ${max_wait}s"
  return 1
}

wait_for_healthy postgres 90
wait_for_healthy redis 30
wait_for_healthy minio 30

# ─── Create MinIO bucket ─────────────────────────────────────
log "Ensuring MinIO bucket exists"
# The workers container creates the bucket on startup, but let's make sure
sleep 5  # give workers a moment to start
WORKERS_CONTAINER=$(docker compose ps -q workers 2>/dev/null || true)
if [[ -n "$WORKERS_CONTAINER" ]]; then
  ok "Workers container running — bucket creation handled automatically"
else
  warn "Workers container not found — bucket may need manual creation"
fi

# ─── Pull Ollama models ──────────────────────────────────────
log "Pulling Ollama models (this may take 5-10 minutes)"

OLLAMA_CONTAINER=$(docker compose ps -q ollama 2>/dev/null || true)
if [[ -z "$OLLAMA_CONTAINER" ]]; then
  fail "Ollama container not found — skipping model pull"
else
  # Wait for Ollama to be ready
  for i in $(seq 1 30); do
    if docker exec ollama curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  echo "  Pulling llama3.1:8b-instruct-q4_K_M (chat model)..."
  if docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M 2>&1 | tail -3; then
    ok "Chat model pulled"
  else
    warn "Chat model pull failed — retry: docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M"
  fi

  echo "  Pulling nomic-embed-text (embedding model)..."
  if docker exec ollama ollama pull nomic-embed-text 2>&1 | tail -3; then
    ok "Embedding model pulled"
  else
    warn "Embedding model pull failed — retry: docker exec ollama ollama pull nomic-embed-text"
  fi
fi

# ═══════════════════════════════════════════════════════════════
#  PHASE 3: Verification
# ═══════════════════════════════════════════════════════════════

log "Phase 3: Verification"

# Load domain from .env
source "$ENV_FILE" 2>/dev/null || true

# Check API health
API_CONTAINER=$(docker compose ps -q api 2>/dev/null || true)
if [[ -n "$API_CONTAINER" ]]; then
  for i in $(seq 1 20); do
    if docker exec "$API_CONTAINER" wget -qO- http://localhost:4000/health >/dev/null 2>&1; then
      ok "API is responding"
      break
    fi
    sleep 3
  done

  # Check readiness (includes service status)
  READY=$(docker exec "$API_CONTAINER" wget -qO- http://localhost:4000/ready 2>/dev/null || echo '{"ok":false}')
  echo "  API readiness: $READY"
else
  fail "API container not found"
fi

# ─── Summary ──────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Before going live, make sure to:"
echo ""
echo "  1. Set DOMAIN in .env (currently: ${DOMAIN:-yourdomain.com})"
echo "  2. Point DNS A records for these subdomains to this server:"
echo "     - app.${DOMAIN:-yourdomain.com}   (web app)"
echo "     - api.${DOMAIN:-yourdomain.com}   (API)"
echo "     - n8n.${DOMAIN:-yourdomain.com}   (workflow automation)"
echo "     - files.${DOMAIN:-yourdomain.com} (MinIO console)"
echo "     - dav.${DOMAIN:-yourdomain.com}   (CalDAV)"
echo ""
echo "  3. Restart after DNS propagation:"
echo "     cd $PROJECT_DIR && docker compose restart caddy"
echo ""
echo "  4. Visit https://app.${DOMAIN:-yourdomain.com} and sign in"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f api        # API logs"
echo "    docker compose logs -f workers    # Worker logs"
echo "    docker exec ollama ollama list    # Check loaded models"
echo "    docker compose ps                 # Service status"
echo ""
