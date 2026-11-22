#!/usr/bin/env bash
# Tests de bout en bout : base SQLite jetable, API sur :8011, front Vite sur :5181, Chrome sans interface.
#   cd e2e && npm install && ./run.sh
# CHROME_PATH permet d'indiquer un autre navigateur (Linux : /usr/bin/google-chrome).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
PY=${PYTHON:-$ROOT/backend/.venv/bin/python}
DB=$ROOT/e2e/e2e.sqlite3
export DATABASE_URL="sqlite:///$DB" DEBUG=1 MEDIA_ROOT="$ROOT/e2e/.media" PRIVATE_STORAGE_ROOT="$ROOT/e2e/.private" \
  EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5181
export E2E_OTP_SECRET=$("$PY" -c "import pyotp; print(pyotp.random_base32())")
rm -f "$DB"
(cd backend && "$PY" manage.py migrate -v0 && "$PY" manage.py seed_demo >/dev/null && "$PY" manage.py load_content >/dev/null \
  && "$PY" manage.py shell < "$ROOT/e2e/seed.py")

(cd backend && exec "$PY" manage.py runserver 127.0.0.1:8011 --noreload >"$ROOT/e2e/.api.log" 2>&1) &
API=$!
(cd frontend && API_PROXY=http://127.0.0.1:8011 exec npx vite --host 127.0.0.1 --port 5181 --strictPort >"$ROOT/e2e/.front.log" 2>&1) &
FRONT=$!
trap 'kill $API $FRONT 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf http://127.0.0.1:5181/api/health/ >/dev/null && break; sleep 0.5; done

BASE_URL=http://127.0.0.1:5181 node "$ROOT/e2e/flows.mjs"
