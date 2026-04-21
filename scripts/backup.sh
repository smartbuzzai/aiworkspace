#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Nightly backup script — run via cron
#  Add to crontab: 0 3 * * * /home/app/workspace/scripts/backup.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

cd "$(dirname "$0")/.."

# Load secrets
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

# Required env vars:
#   RESTIC_REPOSITORY  — e.g. sftp:backup@other-host:/backups/workspace
#                        or   b2:bucket-name:/path
#   RESTIC_PASSWORD    — long random string (KEEP THIS SAFE)
#   B2_ACCOUNT_ID / B2_ACCOUNT_KEY (if using B2)

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY in .env}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD in .env}"

export RESTIC_REPOSITORY RESTIC_PASSWORD
[[ -n "${B2_ACCOUNT_ID:-}" ]] && export B2_ACCOUNT_ID
[[ -n "${B2_ACCOUNT_KEY:-}" ]] && export B2_ACCOUNT_KEY

STAMP=$(date +%Y%m%d_%H%M%S)
DUMP_DIR=/data/backups/pg
mkdir -p "$DUMP_DIR"

echo "[$(date)] Dumping Postgres"
docker exec -t workspace-postgres-1 \
  pg_dumpall -U "$PG_USER" | gzip > "$DUMP_DIR/pg_${STAMP}.sql.gz"

# Keep last 7 local dumps
ls -1t "$DUMP_DIR"/pg_*.sql.gz | tail -n +8 | xargs -r rm --

echo "[$(date)] restic init (if new)"
restic snapshots >/dev/null 2>&1 || restic init

echo "[$(date)] Backing up /data"
restic backup /data \
  --exclude '/data/redis/dump.rdb' \
  --exclude '/data/postgres/pg_wal' \
  --tag nightly \
  --tag "host-$(hostname)"

echo "[$(date)] Pruning old snapshots"
restic forget \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6 \
  --prune

echo "[$(date)] Backup complete"
