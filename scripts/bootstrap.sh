#!/bin/bash
# /app/scripts/bootstrap.sh
# Idempotent startup script — safe to re-run after any container reset.
# Permanent persistence strategy (Option A + B):
#   A) Postgres data lives in /app/.pgdata (persistent /app mount)
#   B) Periodic pg_dump backups to /app/.backups/ — auto-restored if data lost.

set -e
log() { echo "[bootstrap] $(date '+%H:%M:%S') $*"; }

PGDATA=/app/.pgdata
BACKUP_DIR=/app/.backups
LATEST_BACKUP="$BACKUP_DIR/latest.sql.gz"
RESTORED_FROM_BACKUP=0

mkdir -p "$BACKUP_DIR"

# ─── 1. Install PostgreSQL 15 if missing ────────────────────────────────
if ! command -v psql >/dev/null 2>&1; then
  log "Installing PostgreSQL 15..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
else
  log "PostgreSQL already installed ($(psql --version))"
fi

# ─── 2. Ensure cluster uses /app/.pgdata (persistent) ────────────────────
# Strategy: always-fresh-init + restore from /app/.backups/latest.sql.gz
# This is more robust than adopting the existing data dir, which has a long
# history of cluster-config / file-permission edge cases.
# Source of truth = the gzipped pg_dump (idempotent SQL). Working copy = /app/.pgdata.
EXISTING_DATA_DIR=$(pg_lsclusters 2>/dev/null | awk '/^15 +main/ {print $6}')
HAS_VALID_DATA=0
HAS_BACKUP=0
[ -f "$LATEST_BACKUP" ] && [ "$(stat -c%s "$LATEST_BACKUP" 2>/dev/null || echo 0)" -gt 1024 ] && HAS_BACKUP=1

# Quick health check: can the existing cluster start AND respond?
if pg_lsclusters 2>/dev/null | grep -qE "15.*main.*(online|down)" \
   && [ "$EXISTING_DATA_DIR" = "$PGDATA" ] \
   && [ -f "$PGDATA/PG_VERSION" ] \
   && [ -f /etc/postgresql/15/main/postgresql.conf ]; then
  # Try to start (it may be already running)
  pg_ctlcluster 15 main start 2>/dev/null || true
  sleep 2
  if PGPASSWORD=root123 psql -h localhost -U postgres -tAc "SELECT 1" >/dev/null 2>&1; then
    HAS_VALID_DATA=1
  fi
fi

if [ "$HAS_VALID_DATA" = "1" ]; then
  log "Existing healthy cluster detected at $PGDATA — keeping it."
else
  log "No healthy cluster — rebuilding (HAS_BACKUP=$HAS_BACKUP)..."
  # Stop anything lingering
  pg_ctlcluster 15 main stop -m immediate 2>/dev/null || true
  pkill -9 -u postgres 2>/dev/null || true
  sleep 1
  # Drop registrations
  pg_dropcluster 15 main --stop 2>/dev/null || true
  pg_dropcluster 15 bootstrap-temp --stop 2>/dev/null || true
  rm -rf /etc/postgresql/15/main /etc/postgresql/15/bootstrap-temp 2>/dev/null || true

  # Wipe corrupted/stale data dir
  rm -rf "$PGDATA"
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"

  # Fresh init (clean cluster)
  log "Initializing fresh cluster at $PGDATA"
  pg_createcluster 15 main -d "$PGDATA" --start-conf=manual 2>&1 | tail -3
  pg_ctlcluster 15 main start 2>&1 | tail -3
  sleep 3

  # Set password (uses peer auth via local socket)
  sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'root123';" >/dev/null 2>&1 || true

  # Auto-restore from backup if available
  if [ "$HAS_BACKUP" = "1" ]; then
    log "Restoring from $LATEST_BACKUP..."
    # Use peer auth via sudo since password may not be set yet
    gunzip -c "$LATEST_BACKUP" | sudo -u postgres psql > /tmp/restore.log 2>&1 || true
    log "Restore done. Tables in metryxone_node: $(sudo -u postgres psql -d metryxone_node -tAc 'SELECT count(*) FROM information_schema.tables WHERE table_schema=$$public$$' 2>/dev/null || echo 0)"
    RESTORED_FROM_BACKUP=1
  fi
fi

# ─── 3. Start Postgres cluster ──────────────────────────────────────────
if ! pg_lsclusters 2>/dev/null | grep -qE "15.*main.*online"; then
  log "Starting Postgres cluster 15/main (data: $PGDATA)..."
  pg_ctlcluster 15 main start 2>&1 || true
fi

# Wait for Postgres to accept connections (max 15s)
for i in $(seq 1 15); do
  if sudo -u postgres psql -c '\q' >/dev/null 2>&1; then break; fi
  sleep 1
done

# ─── 4. Set password & create databases (idempotent) ─────────────────────
log "Ensuring postgres password + databases..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'root123';" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='metryxone'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE metryxone;" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='metryxone_node'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE metryxone_node;" >/dev/null

# ─── 5. AUTO-RESTORE check (kept for legacy paths; main restore happens in step 2) ─
TABLE_COUNT=$(PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
  -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo 0)

if [ "$TABLE_COUNT" -lt 5 ] && [ -f "$LATEST_BACKUP" ] && [ "$RESTORED_FROM_BACKUP" != "1" ]; then
  log "Empty cluster detected (only $TABLE_COUNT tables) — restoring from $LATEST_BACKUP..."
  gunzip -c "$LATEST_BACKUP" | PGPASSWORD=root123 psql -h localhost -U postgres > /tmp/restore.log 2>&1 || true
  log "Restore complete. Tables: $(PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  RESTORED_FROM_BACKUP=1
fi

# ─── 6. Push Drizzle schema to metryxone_node (idempotent) ──────────────
# CRITICAL: skip drizzle push if we just restored from backup —
# `drizzle-kit push --force` drops tables not defined in schema.ts (and the
# competency framework tables are managed by raw SQL, not drizzle).
if [ "$RESTORED_FROM_BACKUP" = "1" ]; then
  log "Skipping drizzle push — restored from backup (would drop unmanaged tables)"
elif [ -d /app/backend/node_modules/drizzle-kit ]; then
  log "Pushing Drizzle schema to metryxone_node..."
  cd /app/backend
  DATABASE_URL="postgresql://postgres:root123@localhost:5432/metryxone_node" \
    npx drizzle-kit push --force 2>&1 | tail -2 || log "(drizzle push skipped or already synced)"
fi

# ─── 7. Seed LBI Behavioural Framework (idempotent) ──────────────────────
if [ -f /app/scripts/seed-lbi-data.sql ]; then
  log "Seeding LBI domains/subdomains/age-bands..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-lbi-data.sql 2>&1 | tail -3 || log "(LBI seed skipped)"
fi

# ─── 7b. Seed flat Competency Library (317 micro-competencies) ───────────
if [ -f /app/scripts/seed-competency-library.sql ]; then
  log "Seeding Competency Library..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-competency-library.sql 2>&1 | tail -3 || log "(Competency Library seed skipped)"
fi

# ─── 7c. Seed Professional Competency Framework (DDL + data) ─────────────
if [ -f /app/scripts/seed-competency-framework.sql ]; then
  log "Seeding Competency Framework schema + data..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-competency-framework.sql 2>&1 | tail -5 || log "(Competency Framework seed skipped)"
fi

# ─── 7d. Seed Concern Areas (160 parent concerns × 18 categories) ────────
if [ -f /app/scripts/seed-concern-areas.sql ]; then
  log "Seeding Concern Areas..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-concern-areas.sql 2>&1 | tail -3 || log "(Concern Areas seed skipped)"
fi

# ─── 7e. Seed SDI Domains (Student Development Index — 18 domains) ───────
if [ -f /app/scripts/seed-sdi-domains.sql ]; then
  log "Seeding SDI Domains..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-sdi-domains.sql 2>&1 | tail -3 || log "(SDI domains seed skipped)"
fi

# ─── 7f. Seed Competency Engine extras (cohorts, versions, tag column) ───
if [ -f /app/scripts/seed-competency-engine-extras.sql ]; then
  log "Seeding Competency Engine extras (cohorts + versions)..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-competency-engine-extras.sql 2>&1 | tail -3 || log "(extras seed skipped)"
fi

# ─── 7g. Seed SDI extras (subdomains + items tables) ─────────────────────
if [ -f /app/scripts/seed-sdi-extras.sql ]; then
  log "Seeding SDI subdomains + items..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-sdi-extras.sql 2>&1 | tail -3 || log "(SDI extras seed skipped)"
fi

# ─── 7h. Seed framework-parity (LBI + SDI: norms, weights, versions, clusters, learning) ─
if [ -f /app/scripts/seed-framework-parity.sql ]; then
  log "Seeding framework parity (LBI + SDI architecture)..."
  PGPASSWORD=root123 psql -h localhost -U postgres -d metryxone_node \
    -f /app/scripts/seed-framework-parity.sql 2>&1 | tail -3 || log "(framework parity seed skipped)"
fi

# ─── 8. Ensure emergentintegrations is installed (LLM proxy) ─────────────
if ! /root/.venv/bin/python -c "import emergentintegrations" 2>/dev/null; then
  log "Installing emergentintegrations..."
  /root/.venv/bin/pip install emergentintegrations \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ 2>&1 | tail -2
fi

# ─── 9. Register pg-backup-loop with supervisor (Option B) ───────────────
SUPERVISOR_CONF=/etc/supervisor/conf.d/pg-backup.conf
if [ ! -f "$SUPERVISOR_CONF" ] || ! grep -q "pg-backup-loop.sh" "$SUPERVISOR_CONF"; then
  log "Registering pg-backup-loop with supervisor..."
  cat > "$SUPERVISOR_CONF" <<'EOF'
[program:pg-backup]
command=/app/scripts/pg-backup-loop.sh
autostart=true
autorestart=true
startretries=10
stdout_logfile=/var/log/supervisor/pg-backup.log
stderr_logfile=/var/log/supervisor/pg-backup.err.log
environment=PG_BACKUP_INTERVAL="600"
EOF
  chmod +x /app/scripts/pg-backup-loop.sh 2>/dev/null || true
fi

# ─── 10. Start supervisord if not running ────────────────────────────────
if ! pgrep -x supervisord >/dev/null; then
  log "Starting supervisord..."
  /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
  sleep 4
else
  log "supervisord already running"
  # Reload config so pg-backup is picked up
  supervisorctl reread >/dev/null 2>&1 || true
  supervisorctl update >/dev/null 2>&1 || true
fi

# ─── 11. Restart all services to pick up Postgres ────────────────────────
if command -v supervisorctl >/dev/null 2>&1; then
  supervisorctl reread >/dev/null 2>&1 || true
  supervisorctl update >/dev/null 2>&1 || true
  supervisorctl restart backend backend-py pg-backup >/dev/null 2>&1 || true
  sleep 4
fi

# ─── 12. Take an immediate baseline backup (with safety check) ───────────
if [ -x /app/scripts/pg-backup-loop.sh ]; then
  log "Taking immediate baseline backup..."
  TMP_BAK="$LATEST_BACKUP".tmp
  if PGPASSWORD=root123 pg_dumpall -h localhost -U postgres 2>/dev/null | gzip -c > "$TMP_BAK"; then
    NEW_TABLES=$(gunzip -c "$TMP_BAK" 2>/dev/null | grep -cE "^CREATE TABLE public\." || echo 0)
    OLD_TABLES=0
    if [ -f "$LATEST_BACKUP" ]; then
      OLD_TABLES=$(gunzip -c "$LATEST_BACKUP" 2>/dev/null | grep -cE "^CREATE TABLE public\." || echo 0)
    fi
    SAFETY_THRESHOLD=$(( OLD_TABLES * 80 / 100 ))
    if [ "$OLD_TABLES" -gt 0 ] && [ "$NEW_TABLES" -lt "$SAFETY_THRESHOLD" ]; then
      mv "$TMP_BAK" "$BACKUP_DIR/.suspect-baseline-$(date +%Y%m%d-%H%M%S).sql.gz"
      log "REFUSED to overwrite latest.sql.gz: new=$NEW_TABLES tables, old=$OLD_TABLES (saved as .suspect-)"
    else
      mv "$TMP_BAK" "$LATEST_BACKUP"
      log "Baseline backup: $(du -h "$LATEST_BACKUP" | cut -f1), tables=$NEW_TABLES (was $OLD_TABLES)"
    fi
  else
    rm -f "$TMP_BAK"
    log "(baseline backup failed)"
  fi
fi

# ─── 13. Status ──────────────────────────────────────────────────────────
log "Data dir: $(sudo -u postgres psql -tAc "SHOW data_directory" 2>/dev/null)"
log "Service status:"
supervisorctl status 2>&1 || true
log "Done."
