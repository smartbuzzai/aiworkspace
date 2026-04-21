#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Bootstrap script for a fresh Contabo Ubuntu 24.04 VPS
#  Usage:  curl -fsSL https://your-repo/bootstrap.sh | sudo bash
#     or:  sudo bash scripts/bootstrap.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

log() { echo -e "\n\033[1;34m==> $*\033[0m"; }

log "Updating system packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "Installing base tools"
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  git rsync restic htop jq

log "Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

log "Hardening SSH"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl reload ssh

log "Configuring firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp  # HTTP/3
yes | ufw enable

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

log "Enabling auto security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

log "Creating data directories"
mkdir -p /data/{postgres,redis,minio,meili,ollama,whisper,piper,radicale,n8n,uptime,api-uploads,backups}

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
fi
chown -R app:app /data

log "Done. Next steps:"
cat <<EOF

  1. Log in as the app user:   su - app
  2. Clone the repo:            git clone <your-repo> workspace && cd workspace
  3. Configure secrets:         cp .env.example .env && nano .env
  4. Point DNS A records for app.yourdomain.com, api.yourdomain.com,
     n8n.yourdomain.com, files.yourdomain.com, dav.yourdomain.com,
     status.yourdomain.com, logs.yourdomain.com at this server's IP.
  5. Start the stack:           docker compose up -d
  6. Pull the LLM (one-time):   docker exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
                                docker exec ollama ollama pull nomic-embed-text
  7. Visit https://app.yourdomain.com and sign in.

EOF
