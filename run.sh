#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[INFO] Creating virtual environment..."
  python3 -m venv .venv
fi

echo "[INFO] Activating virtual environment..."
# shellcheck disable=SC1091
. .venv/bin/activate

if [ -z "${FIREBASE_SERVICE_ACCOUNT:-}" ] && [ -f "serviceAccountKey.json" ]; then
  FIREBASE_SERVICE_ACCOUNT="serviceAccountKey.json"
  export FIREBASE_SERVICE_ACCOUNT
fi

if [ -z "${FIREBASE_SERVICE_ACCOUNT:-}" ] && [ -f "firebase-service-account.json" ]; then
  FIREBASE_SERVICE_ACCOUNT="firebase-service-account.json"
  export FIREBASE_SERVICE_ACCOUNT
fi

if [ -z "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then
  FIRST_MATCH="$(ls *firebase*adminsdk*.json 2>/dev/null | head -n 1 || true)"
  if [ -n "$FIRST_MATCH" ]; then
    FIREBASE_SERVICE_ACCOUNT="$FIRST_MATCH"
    export FIREBASE_SERVICE_ACCOUNT
  fi
fi

if [ -n "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then
  echo "[INFO] Using Firebase service account: $FIREBASE_SERVICE_ACCOUNT"
fi

echo "[INFO] Installing dependencies..."
.venv/bin/python -m pip install -r requirements.txt

echo "[INFO] Starting server at http://127.0.0.1:8000"
.venv/bin/python -m uvicorn app.main:app --reload --lifespan off
