#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAXFLOW_DIR="$(cd "${BACKEND_DIR}/../../taxflow" && pwd)"

# Load .env-prod
if [[ -f "${BACKEND_DIR}/.env-prod" ]]; then
  set -a
  # shellcheck source=../.env-prod
  source "${BACKEND_DIR}/.env-prod"
  set +a
fi

export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID

echo "=== FreeTaxFlow Production Deploy ==="
echo "Account: ${CLOUDFLARE_ACCOUNT_ID}"
echo ""

# ── Step 1: Run tests ────────────────────────────────────────────────────────
echo "[1/6] Running backend tests..."
cd "${BACKEND_DIR}"
npx vitest run --reporter=dot 2>&1 | tail -5

# ── Step 2: TypeScript check ─────────────────────────────────────────────────
echo "[2/6] TypeScript check..."
npx tsc --noEmit

# ── Step 3: Apply D1 migrations ──────────────────────────────────────────────
echo "[3/6] Applying D1 migrations to production..."
npx wrangler d1 migrations apply USTAXES_DB --env production --remote

# ── Step 4: Deploy backend worker ────────────────────────────────────────────
echo "[4/6] Deploying backend worker..."
npx wrangler deploy --env production

# ── Step 5: Build and deploy frontend ────────────────────────────────────────
echo "[5/6] Building frontend..."
cd "${TAXFLOW_DIR}"
pnpm run build 2>&1 | tail -5

echo "[5/6] Deploying frontend worker..."
cd "${TAXFLOW_DIR}/deploy/cloudflare"
npx wrangler deploy --env production

# ── Step 6: Smoke test ───────────────────────────────────────────────────────
echo "[6/6] Post-deploy smoke test..."
sleep 2

HEALTH=$(curl -sS --max-time 10 --resolve "api.freetaxflow.com:443:$(dig api.freetaxflow.com A @1.1.1.1 +short | head -1)" \
  "https://api.freetaxflow.com/health" 2>&1 || true)

if echo "$HEALTH" | grep -q '"ok"'; then
  echo "[ok] API health check passed"
else
  echo "[warn] API health check response: $HEALTH"
fi

FRONTEND=$(curl -sS --max-time 10 "https://freetaxflow.com/" 2>&1 | head -1 || true)
if echo "$FRONTEND" | grep -q "doctype\|DOCTYPE\|html"; then
  echo "[ok] Frontend serving HTML"
else
  echo "[warn] Frontend response: $FRONTEND"
fi

echo ""
echo "[ok] Production deployment complete"
echo "  API:      https://api.freetaxflow.com"
echo "  Frontend: https://freetaxflow.com"
