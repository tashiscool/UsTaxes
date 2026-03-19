#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=./_prod_env.sh
source "${SCRIPT_DIR}/_prod_env.sh"

backend_load_prod_env "${1:-}"
backend_require_supported_worker_env
backend_prepare_wrangler_env
backend_require_cmd npx

WORKER_ENV="${CLOUDFLARE_WORKER_ENV:-production}"
if backend_is_protected_worker_env; then
  ALLOW_MISSING_SECRETS="${ALLOW_MISSING_SECRETS:-0}"
  backend_require_worker_secrets
else
  ALLOW_MISSING_SECRETS="${ALLOW_MISSING_SECRETS:-1}"
fi

declare -a SECRET_NAMES=(
  "APP_AUTH_SECRET"
  "APP_AUTH_CALLBACK_SHARED_SECRET"
  "INTERNAL_API_TOKEN"
  "SESSION_SECRET_HMAC_KEY"
)

synced_count=0
missing_count=0

for secret_name in "${SECRET_NAMES[@]}"; do
  secret_value="${!secret_name:-}"
  if [[ -z "${secret_value}" ]]; then
    echo "[warn] ${secret_name} is not set in ${BACKEND_ENV_FILE_LOADED:-.env-prod}; skipping"
    missing_count=$((missing_count + 1))
    continue
  fi

  echo "[sync] ${secret_name}"
  if sync_output="$(
    cd "${BACKEND_DIR}"
    printf '%s' "${secret_value}" | npx wrangler secret put "${secret_name}" --env "${WORKER_ENV}" 2>&1 1>/dev/null
  )"; then
    synced_count=$((synced_count + 1))
    continue
  fi

  if [[ "${secret_name}" == "SESSION_SECRET_HMAC_KEY" ]] &&
    [[ -n "${APP_AUTH_SECRET:-}" ]] &&
    printf '%s' "${sync_output}" | grep -q "already in use"; then
    echo "[warn] ${secret_name} is still backed by a legacy worker binding; APP_AUTH_SECRET remains the active app-session secret."
    continue
  fi

  printf '%s\n' "${sync_output}" >&2
  exit 1
done

if [[ "${synced_count}" -eq 0 && "${ALLOW_MISSING_SECRETS}" != "1" ]]; then
  echo "No Wrangler secrets were synced and ALLOW_MISSING_SECRETS=0." >&2
  exit 1
fi

echo "[ok] Synced ${synced_count} Wrangler secret(s) for env=${WORKER_ENV}"
