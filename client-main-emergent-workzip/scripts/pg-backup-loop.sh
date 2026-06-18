#!/bin/bash
# /app/scripts/pg-backup-loop.sh
# Periodic pg_dump backup. Keeps `latest.sql.gz` + last 6 timestamped snapshots.
# Runs as supervisor process (started by bootstrap).

set -u
BACKUP_DIR=/app/.backups
mkdir -p "$BACKUP_DIR"
INTERVAL_SECONDS=${PG_BACKUP_INTERVAL:-600}   # default: 10 minutes
KEEP_SNAPSHOTS=6

log() { echo "[pg-backup] $(date '+%H:%M:%S') $*"; }

while true; do
  TS=$(date +%Y%m%d-%H%M%S)
  TMP="$BACKUP_DIR/.tmp-$TS.sql.gz"
  TARGET="$BACKUP_DIR/latest.sql.gz"
  SNAP="$BACKUP_DIR/snapshot-$TS.sql.gz"

  if PGPASSWORD=root123 pg_dumpall -h localhost -U postgres 2>/tmp/pg-backup.err | gzip -c > "$TMP" 2>/dev/null; then
    SIZE=$(stat -c%s "$TMP" 2>/dev/null || echo 0)
    NEW_TABLES=$(gunzip -c "$TMP" 2>/dev/null | grep -cE "^CREATE TABLE public\." || echo 0)
    OLD_TABLES=0
    if [ -f "$TARGET" ]; then
      OLD_TABLES=$(gunzip -c "$TARGET" 2>/dev/null | grep -cE "^CREATE TABLE public\." || echo 0)
    fi

    # Refuse to overwrite if new backup has dramatically fewer tables (data-loss safeguard)
    SAFETY_THRESHOLD=$(( OLD_TABLES * 80 / 100 ))   # require ≥80% of previous table count
    if [ "$SIZE" -lt 200 ]; then
      rm -f "$TMP"
      log "skipped (dump too small: ${SIZE} bytes)"
    elif [ "$OLD_TABLES" -gt 0 ] && [ "$NEW_TABLES" -lt "$SAFETY_THRESHOLD" ]; then
      # Save as a recovery file but DO NOT overwrite latest.sql.gz
      mv "$TMP" "$BACKUP_DIR/.suspect-$TS.sql.gz"
      log "REFUSED to overwrite: new=$NEW_TABLES tables vs old=$OLD_TABLES (saved as .suspect-$TS)"
    else
      mv "$TMP" "$TARGET"
      cp "$TARGET" "$SNAP"
      log "OK $(du -h "$TARGET" | cut -f1) tables=$NEW_TABLES (was $OLD_TABLES) -> latest + snapshot-$TS"
      # Trim old snapshots
      ls -1t "$BACKUP_DIR"/snapshot-*.sql.gz 2>/dev/null | tail -n +$((KEEP_SNAPSHOTS + 1)) | xargs -r rm -f
    fi
  else
    rm -f "$TMP"
    log "FAILED ($(tail -1 /tmp/pg-backup.err 2>/dev/null))"
  fi

  sleep "$INTERVAL_SECONDS"
done
