#!/bin/bash
# Backup chiffré quotidien : SQLite → GPG → Backblaze B2
# Cron : 0 3 * * * /scripts/backup.sh >> /var/log/backup.log 2>&1
set -e

DATE=$(date +%F-%H%M)
BACKUP_DIR=${BACKUP_DIR:-/backups}
DB_PATH=${DB_PATH:-/data/telemetry.db}
RETENTION_DAYS=${RETENTION_DAYS:-30}

mkdir -p "$BACKUP_DIR"

# 1. Snapshot SQLite cohérent (.backup garantit l'atomicité)
SNAPSHOT="$BACKUP_DIR/telemetry-$DATE.db"
sqlite3 "$DB_PATH" ".backup '$SNAPSHOT'"

# 2. Compresser
gzip -9 "$SNAPSHOT"

# 3. Chiffrer si destinataire GPG configuré
if [ -n "$BACKUP_GPG_RECIPIENT" ]; then
  gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$SNAPSHOT.gz"
  rm "$SNAPSHOT.gz"
  FINAL="$SNAPSHOT.gz.gpg"
else
  FINAL="$SNAPSHOT.gz"
fi

echo "[$(date)] Backup créé : $FINAL ($(du -h $FINAL | cut -f1))"

# 4. Upload vers Backblaze B2 si configuré
if [ -n "$BACKBLAZE_BUCKET" ] && command -v rclone &> /dev/null; then
  rclone copy "$FINAL" "backblaze:$BACKBLAZE_BUCKET/telemetry-backups/" \
    && echo "[$(date)] Uploadé vers Backblaze" \
    || echo "[$(date)] WARN: échec upload Backblaze"
fi

# 5. Nettoyer les backups locaux > RETENTION_DAYS
find "$BACKUP_DIR" -name "telemetry-*.db.gz*" -mtime +$RETENTION_DAYS -delete

# 6. Test de restauration (1 fois par semaine, le dimanche)
if [ "$(date +%u)" = "7" ]; then
  TMPDIR=$(mktemp -d)
  if [ -n "$BACKUP_GPG_RECIPIENT" ]; then
    gpg --batch --yes --decrypt --output "$TMPDIR/test.db.gz" "$FINAL"
  else
    cp "$FINAL" "$TMPDIR/test.db.gz"
  fi
  gunzip "$TMPDIR/test.db.gz"
  COUNT=$(sqlite3 "$TMPDIR/test.db" "SELECT COUNT(*) FROM devices;")
  echo "[$(date)] Test restauration OK : $COUNT devices"
  rm -rf "$TMPDIR"
fi
