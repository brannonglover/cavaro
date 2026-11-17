#!/bin/bash
#
# Verifies the authorization rules on POST /api/upload.
#
# That endpoint used to accept an image from anyone and hand back a public URL,
# which made it an open image host. It now requires a Supabase token, and the
# destination folder is matched against a whitelist rather than interpolated.
# This script proves both, plus the compatibility flag that keeps builds already
# in the field working during the rollout.
#
# Shell rather than node (unlike the other scripts/verify-*.js) because the
# behaviour under test is HTTP middleware ordering, so it needs the real server
# listening on a real socket.
#
# NO CREDENTIALS NEEDED, and nothing is written to real storage: the server is
# started with deliberately invalid Supabase and Postgres settings, so a request
# that PASSES authorization fails later at the storage call and returns 500,
# while one that is REJECTED returns 401. The status code is the assertion.
#
# The authenticated success path (a real token yielding 200 with the object at
# avatars/<userId>/...) is not covered here; it needs a live token and would
# write to the production bucket. Exercise it from the app instead.
#
# Usage: ./scripts/verify-upload-auth.sh
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/server/index.js"
PORT="${UPLOAD_TEST_PORT:-5055}"
URL="http://127.0.0.1:$PORT/api/upload"
TMP="$(mktemp -d)"
PNG="$TMP/pixel.png"
SERVER_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

[ -f "$SERVER" ] || { echo "server not found at $SERVER"; exit 1; }
command -v curl >/dev/null || { echo "curl is required"; exit 1; }
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "port $PORT is in use; set UPLOAD_TEST_PORT to something free"
  exit 1
fi

# Smallest valid PNG, so multer's mimetype filter is satisfied.
printf '\211PNG\r\n\032\n\0\0\0\rIHDR\0\0\0\1\0\0\0\1\10\6\0\0\0\37\25\304\211\0\0\0\nIDATx\234c\370\17\0\1\1\1\0\30\335\212\333\0\0\0\0IEND\256B`\202' > "$PNG"

pass=0
fail=0

start_server() { # $1 = ALLOW_UNAUTHENTICATED_UPLOADS
  # Explicit values beat dotenv, which does not override an existing env var,
  # so server/.env secrets are never loaded for these runs.
  SUPABASE_URL=https://invalid.invalid \
  SUPABASE_SERVICE_ROLE_KEY=invalid-key-for-testing \
  DATABASE_URL=postgresql://invalid:invalid@127.0.0.1:1/invalid \
  ALLOW_UNAUTHENTICATED_UPLOADS="$1" \
  NODE_ENV=test PORT="$PORT" \
  node "$SERVER" > "$TMP/server.log" 2>&1 &
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null   # keep job control from printing "Terminated"
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/api/upload"; then return 0; fi
    sleep 0.5
  done
  echo "server failed to start:"; tail -5 "$TMP/server.log"
  return 1
}

stop_server() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
  sleep 1
}

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@"; }

check() { # name expected actual
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1)); printf '  ✓ %-56s %s\n' "$1" "$3"
  else
    fail=$((fail + 1)); printf '  ✗ %-56s expected %s, got %s\n' "$1" "$2" "$3"
  fi
}

echo
echo "Rollout window — ALLOW_UNAUTHENTICATED_UPLOADS=1"
start_server 1 || exit 1
# 500 means the request got past authorization and died at the storage call,
# which is the only way to observe "allowed" without writing anything.
check "legacy unauthenticated cigar upload still allowed" 500 \
  "$(code -X POST -F folder=cigars -F image=@"$PNG" "$URL")"
check "folder omitted (older clients) defaults to cigars" 500 \
  "$(code -X POST -F image=@"$PNG" "$URL")"
check "avatars rejected even while the flag is on" 401 \
  "$(code -X POST -F folder=avatars -F image=@"$PNG" "$URL")"
check "avatars rejected with an invalid bearer token" 401 \
  "$(code -X POST -H 'Authorization: Bearer not-a-real-token' -F folder=avatars -F image=@"$PNG" "$URL")"
check "unknown folder rejected" 400 \
  "$(code -X POST -F folder=nonsense -F image=@"$PNG" "$URL")"
check "folder traversal rejected" 400 \
  "$(code -X POST -F 'folder=../../secrets' -F image=@"$PNG" "$URL")"
check "absolute folder rejected" 400 \
  "$(code -X POST -F 'folder=/etc' -F image=@"$PNG" "$URL")"
check "request with no file rejected" 400 \
  "$(code -X POST -F folder=cigars "$URL")"
stop_server

echo
echo "Steady state — flag unset, once pre-auth builds are gone"
start_server 0 || exit 1
check "unauthenticated cigar upload now rejected" 401 \
  "$(code -X POST -F folder=cigars -F image=@"$PNG" "$URL")"
check "unauthenticated avatar upload rejected" 401 \
  "$(code -X POST -F folder=avatars -F image=@"$PNG" "$URL")"
check "folder validated before authorization" 400 \
  "$(code -X POST -F folder=nonsense -F image=@"$PNG" "$URL")"
stop_server

echo
echo "$pass passed, $fail failed"
echo
exit $((fail > 0))
