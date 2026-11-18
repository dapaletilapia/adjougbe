#!/bin/sh
# Restaure une sauvegarde. Usage (depuis le dossier du projet) :
#   docker compose stop backend scheduler
#   docker compose run --rm backup /scripts/restore.sh 2026-11-18_0300
#   docker compose up -d backend scheduler
# La base est entièrement remplacée ; les fichiers sont réécrits par-dessus les fichiers existants.
set -eu
SRC="/backups/${1:?Indiquer le dossier de sauvegarde, par exemple 2026-11-18_0300}"
cd "$SRC"
sha256sum -c SHA256SUMS
pg_restore -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner base.dump
tar -xzf media.tar.gz -C /data
tar -xzf private.tar.gz -C /data
echo "Restauration terminée depuis $SRC."
