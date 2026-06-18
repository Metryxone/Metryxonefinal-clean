#!/bin/bash
# /app/scripts/start-postgres.sh
# Supervisor wrapper for Postgres.
# 1. Runs bootstrap.sh once to ensure Postgres is installed + cluster ready.
# 2. Hands off to pg_ctlcluster which manages the cluster as a daemon.
# 3. Tail-on-exit keeps a foreground process so supervisor can monitor it.

set -u
PGDATA=/app/.pgdata

log() { echo "[start-postgres] $(date '+%H:%M:%S') $*"; }

# 1. Always run bootstrap to ensure Postgres is installed + cluster ready.
log "Running bootstrap to ensure Postgres + data are ready..."
bash /app/scripts/bootstrap.sh > /tmp/bootstrap-supervisor.log 2>&1 || {
  log "Bootstrap failed — see /tmp/bootstrap-supervisor.log"
  cat /tmp/bootstrap-supervisor.log | tail -40
}

# 2. Make sure cluster is started (bootstrap usually starts it, but defensive)
if ! sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; then
  log "Starting cluster via pg_ctlcluster..."
  pg_ctlcluster 15 main start 2>&1 || true
  sleep 2
fi

# 3. Always re-set the postgres password (idempotent, ensures TCP auth works
#    even after a fresh init that lost the password)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'root123';" >/dev/null 2>&1 || true

# 4. Verify connectivity
if PGPASSWORD=root123 psql -h localhost -U postgres -tAc "SELECT 'OK'" >/dev/null 2>&1; then
  log "Postgres healthy on localhost:5432"
else
  log "WARNING: Postgres not reachable yet"
fi

# 5. Foreground monitor: tail Postgres log so supervisor sees a long-running process.
#    If Postgres dies, we exit so supervisor restarts us (which will rerun bootstrap).
PGLOG=/var/log/postgresql/postgresql-15-main.log
[ -f "$PGLOG" ] || PGLOG=/dev/null

log "Postgres is now under supervisor monitoring (tailing $PGLOG)..."
while sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; do
  sleep 30
done

log "Postgres became unreachable — exiting so supervisor can restart us"
exit 1
