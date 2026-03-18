#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=./_prod_env.sh
source "${SCRIPT_DIR}/_prod_env.sh"

TAXFLOW_DIR="$(taxflow_root_dir)"

backend_load_prod_env "${1:-}"
backend_prepare_wrangler_env
if ! backend_verify_cloudflare_token; then
  echo "[warn] Cloudflare token preflight failed; continuing because the deploy may still succeed." >&2
fi

backend_require_cmd npm
backend_require_cmd npx
backend_require_cmd node
backend_require_cmd curl
backend_require_cmd pnpm

WORKER_ENV="${CLOUDFLARE_WORKER_ENV:-production}"
RUN_CF_BOOTSTRAP="${RUN_CF_BOOTSTRAP:-1}"
SYNC_WRANGLER_SECRETS="${SYNC_WRANGLER_SECRETS:-0}"
RUN_PREDEPLOY_TESTS="${RUN_PREDEPLOY_TESTS:-1}"
APPLY_D1_MIGRATIONS="${APPLY_D1_MIGRATIONS:-1}"
RUN_POST_DEPLOY_SMOKE="${RUN_POST_DEPLOY_SMOKE:-1}"
SKIP_FRONTEND_DEPLOY="${SKIP_FRONTEND_DEPLOY:-0}"

echo "=== FreeTaxFlow Cloudflare Deploy ==="
echo "Worker env: ${WORKER_ENV}"
echo "Account: ${CLOUDFLARE_ACCOUNT_ID}"
echo "Env file: ${BACKEND_ENV_FILE_LOADED}"

backend_step "Workers deploy access preflight"
backend_verify_workers_deploy_access

if [[ "${RUN_CF_BOOTSTRAP}" == "1" ]]; then
  backend_step "Cloudflare resource bootstrap"
  CLOUDFLARE_WORKER_ENV="${WORKER_ENV}" bash "${SCRIPT_DIR}/bootstrap_cloudflare_resources.sh"
else
  echo "[skip] RUN_CF_BOOTSTRAP=0"
fi

if [[ "${SYNC_WRANGLER_SECRETS}" == "1" ]]; then
  backend_step "Sync Wrangler secrets"
  CLOUDFLARE_WORKER_ENV="${WORKER_ENV}" bash "${SCRIPT_DIR}/sync_wrangler_secrets.sh"
else
  echo "[skip] SYNC_WRANGLER_SECRETS=0"
fi

if [[ "${RUN_PREDEPLOY_TESTS}" == "1" ]]; then
  backend_step "Backend predeploy checks"
  (
    cd "${BACKEND_DIR}"
    npm run test:all
  )

  if [[ -d "${TAXFLOW_DIR}" ]]; then
    backend_step "TaxFlow predeploy checks"
    (
      cd "${TAXFLOW_DIR}"
      pnpm check
      pnpm build
    )
  else
    echo "[warn] TaxFlow directory not found; skipping frontend predeploy checks"
  fi
else
  echo "[skip] RUN_PREDEPLOY_TESTS=0"
fi

if [[ "${APPLY_D1_MIGRATIONS}" == "1" ]]; then
  backend_step "Apply D1 migrations (${WORKER_ENV})"
  (
    cd "${BACKEND_DIR}"
    npx wrangler d1 migrations apply USTAXES_DB --env "${WORKER_ENV}" --remote
  )
else
  echo "[skip] APPLY_D1_MIGRATIONS=0"
fi

backend_step "Deploy backend worker"
(
  cd "${BACKEND_DIR}"
  npx wrangler deploy --env "${WORKER_ENV}"
)

if [[ "${SKIP_FRONTEND_DEPLOY}" == "1" ]]; then
  echo "[skip] SKIP_FRONTEND_DEPLOY=1"
elif [[ -d "${TAXFLOW_DIR}" ]]; then
  backend_step "Build frontend"
  (
    cd "${TAXFLOW_DIR}"
    pnpm build
  )

  backend_step "Deploy frontend worker"
  (
    cd "${TAXFLOW_DIR}/deploy/cloudflare"
    npx wrangler deploy --env production
  )
else
  echo "[warn] TaxFlow directory not found; skipping frontend deploy"
fi

if [[ "${RUN_POST_DEPLOY_SMOKE}" == "1" ]]; then
  backend_step "Post-deploy smoke test"
  backend_url="${USTAXES_PROD_BASE_URL:-https://api.freetaxflow.com}"
  frontend_url="${USTAXES_FRONTEND_URL:-https://freetaxflow.com}"

  health="$(curl -sS --max-time 10 "${backend_url}/health" 2>&1 || true)"
  if echo "${health}" | grep -q '"ok"'; then
    echo "[ok] API health check passed"
  else
    echo "[warn] API health response: ${health}"
  fi

  frontend="$(curl -sS --max-time 10 "${frontend_url}/" 2>&1 | head -1 || true)"
  if echo "${frontend}" | grep -qi "doctype\\|html"; then
    echo "[ok] Frontend serving HTML"
  else
    echo "[warn] Frontend response: ${frontend}"
  fi
else
  echo "[skip] RUN_POST_DEPLOY_SMOKE=0"
fi

echo
echo "[ok] Cloudflare deploy pipeline completed"
