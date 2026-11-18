#!/bin/sh
# Sauvegarde quotidienne : base PostgreSQL + médias publics + stockage privé (contenu chiffré des livres).
# Lancée par le conteneur « backup » (docker-compose.yml). Conserve BACKUP_RETENTION_DAYS jours.
set -eu
STAMP=$(date +%Y-%m-%d_%H%M)
DEST="/backups/$STAMP"
mkdir -p "$DEST"
pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$DEST/base.dump"
tar -czf "$DEST/media.tar.gz" -C /data media
tar -czf "$DEST/private.tar.gz" -C /data private
# Empreintes pour vérifier l'intégrité lors d'une restauration.
(cd "$DEST" && sha256sum base.dump media.tar.gz private.tar.gz > SHA256SUMS)
# Rétention : uniquement les fichiers de sauvegarde anciens, dans /backups, puis les dossiers devenus vides.
find /backups -mindepth 2 -maxdepth 2 -type f -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
find /backups -mindepth 1 -maxdepth 1 -type d -empty -delete
echo "Sauvegarde OK : $DEST ($(du -sh "$DEST" | cut -f1))"
