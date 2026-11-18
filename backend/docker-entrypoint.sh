#!/bin/sh
set -e
# Les migrations ne tournent que dans le conteneur « backend » (pas dans le planificateur).
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
fi
exec "$@"
