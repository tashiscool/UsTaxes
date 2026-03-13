#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
WORKSPACE_ROOT=$(cd -- "$BACKEND_DIR/../.." && pwd)
TAXFLOW_DIR="$WORKSPACE_ROOT/taxflow"
PERSIST_TO=$(mktemp -d "${TMPDIR:-/tmp}/taxflow-cf-e2e.XXXXXX")
WRANGLER_LOG=$(mktemp -t taxflow-wrangler.log)
TAXFLOW_LOG=$(mktemp -t taxflow-dev.log)
BACKEND_PORT=${TAXFLOW_E2E_BACKEND_PORT:-8788}
FRONTEND_PORT=${TAXFLOW_E2E_FRONTEND_PORT:-3100}
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
INTERNAL_API_TOKEN=${INTERNAL_API_TOKEN:-integration-secret-token}
WRANGLER_PID=""
TAXFLOW_PID=""

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

find_free_port() {
  local candidate=$1
  while port_in_use "$candidate"; do
    candidate=$((candidate + 1))
  done
  echo "$candidate"
}

cleanup() {
  local status=$?
  if [[ -n "$TAXFLOW_PID" ]] && kill -0 "$TAXFLOW_PID" 2>/dev/null; then
    kill "$TAXFLOW_PID" 2>/dev/null || true
    wait "$TAXFLOW_PID" 2>/dev/null || true
  fi
  if [[ -n "$WRANGLER_PID" ]] && kill -0 "$WRANGLER_PID" 2>/dev/null; then
    kill "$WRANGLER_PID" 2>/dev/null || true
    wait "$WRANGLER_PID" 2>/dev/null || true
  fi
  if [[ $status -ne 0 ]]; then
    echo "--- wrangler log ---"
    tail -n 80 "$WRANGLER_LOG" || true
    echo "--- taxflow log ---"
    tail -n 80 "$TAXFLOW_LOG" || true
  fi
  rm -rf "$PERSIST_TO"
  rm -f "$WRANGLER_LOG" "$TAXFLOW_LOG"
}
trap cleanup EXIT

wait_for_status() {
  local url=$1
  local expected=$2
  local attempts=${3:-120}

  for ((i=0; i<attempts; i++)); do
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)
    if [[ "$status" == "$expected" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for $url to return $expected" >&2
  return 1
}

BACKEND_PORT=$(find_free_port "$BACKEND_PORT")
FRONTEND_PORT=$(find_free_port "$FRONTEND_PORT")
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

cd "$BACKEND_DIR"
npx wrangler d1 migrations apply USTAXES_DB --local --config wrangler.toml --persist-to "$PERSIST_TO"
INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN" npx wrangler dev --local --port "$BACKEND_PORT" --config wrangler.toml --persist-to "$PERSIST_TO" >"$WRANGLER_LOG" 2>&1 &
WRANGLER_PID=$!

cd "$TAXFLOW_DIR"
VITE_BACKEND_BASE_URL="$BACKEND_URL" "$(command -v pnpm)" build >"$TAXFLOW_LOG" 2>&1
PORT="$FRONTEND_PORT" BACKEND_API_BASE_URL="$BACKEND_URL" "$(command -v pnpm)" start >>"$TAXFLOW_LOG" 2>&1 &
TAXFLOW_PID=$!

wait_for_status "$BACKEND_URL/app/v1/auth/me" 401
wait_for_status "$FRONTEND_URL/" 200

cd "$BACKEND_DIR"
set +e
BACKEND_URL="$BACKEND_URL" FRONTEND_URL="$FRONTEND_URL" INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN" node ./scripts/run-taxflow-local-e2e.mjs
CLIENT_STATUS=$?
set -e

if [[ $CLIENT_STATUS -ne 0 ]]; then
  echo "TaxFlow client flow failed with exit code $CLIENT_STATUS" >&2
  exit "$CLIENT_STATUS"
fi
