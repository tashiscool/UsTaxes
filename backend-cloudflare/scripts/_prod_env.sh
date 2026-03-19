#!/usr/bin/env bash

backend_root_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

taxes_workspace_dir() {
  cd "$(backend_root_dir)/../.." && pwd
}

taxflow_root_dir() {
  printf '%s/taxflow\n' "$(taxes_workspace_dir)"
}

backend_env_file_default() {
  printf '%s/.env-prod\n' "$(backend_root_dir)"
}

backend_env_file_fallback() {
  local idea_projects_dir
  idea_projects_dir="$(cd "$(backend_root_dir)/../../.." && pwd)"
  printf '%s/alovoa/.env-prod\n' "${idea_projects_dir}"
}

backend_resolve_env_file() {
  local requested="${1:-}"
  if [[ -n "${requested}" ]]; then
    printf '%s\n' "${requested}"
    return 0
  fi

  local local_default
  local_default="$(backend_env_file_default)"
  if [[ -f "${local_default}" ]]; then
    printf '%s\n' "${local_default}"
    return 0
  fi

  local sibling_fallback
  sibling_fallback="$(backend_env_file_fallback)"
  if [[ -f "${sibling_fallback}" ]]; then
    printf '%s\n' "${sibling_fallback}"
    return 0
  fi

  printf '%s\n' "${local_default}"
}

backend_load_prod_env() {
  local env_file
  env_file="$(backend_resolve_env_file "${1:-${ENV_FILE:-}}")"

  if [[ ! -f "${env_file}" ]]; then
    echo "Missing production env file: ${env_file}" >&2
    return 1
  fi

  local preserved_worker_env="${CLOUDFLARE_WORKER_ENV-}"
  local preserved_api_token="${CLOUDFLARE_API_TOKEN-}"
  local preserved_account_id="${CLOUDFLARE_ACCOUNT_ID-}"
  local preserved_run_predeploy="${RUN_PREDEPLOY_TESTS-}"
  local preserved_apply_migrations="${APPLY_D1_MIGRATIONS-}"
  local preserved_run_smoke="${RUN_POST_DEPLOY_SMOKE-}"
  local preserved_run_bootstrap="${RUN_CF_BOOTSTRAP-}"
  local preserved_sync_secrets="${SYNC_WRANGLER_SECRETS-}"

  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a

  if [[ -n "${preserved_worker_env}" ]]; then
    export CLOUDFLARE_WORKER_ENV="${preserved_worker_env}"
  fi
  if [[ -n "${preserved_api_token}" ]]; then
    export CLOUDFLARE_API_TOKEN="${preserved_api_token}"
  fi
  if [[ -n "${preserved_account_id}" ]]; then
    export CLOUDFLARE_ACCOUNT_ID="${preserved_account_id}"
  fi
  if [[ -n "${preserved_run_predeploy}" ]]; then
    export RUN_PREDEPLOY_TESTS="${preserved_run_predeploy}"
  fi
  if [[ -n "${preserved_apply_migrations}" ]]; then
    export APPLY_D1_MIGRATIONS="${preserved_apply_migrations}"
  fi
  if [[ -n "${preserved_run_smoke}" ]]; then
    export RUN_POST_DEPLOY_SMOKE="${preserved_run_smoke}"
  fi
  if [[ -n "${preserved_run_bootstrap}" ]]; then
    export RUN_CF_BOOTSTRAP="${preserved_run_bootstrap}"
  fi
  if [[ -n "${preserved_sync_secrets}" ]]; then
    export SYNC_WRANGLER_SECRETS="${preserved_sync_secrets}"
  fi

  export BACKEND_ENV_FILE_LOADED="${env_file}"
}

backend_require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required variable: ${name}" >&2
    return 1
  fi
}

backend_require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    return 1
  fi
}

backend_step() {
  local label="$1"
  printf '\n[%s]\n' "${label}"
}

backend_prepare_wrangler_env() {
  backend_require_var CLOUDFLARE_API_TOKEN
  backend_require_var CLOUDFLARE_ACCOUNT_ID
  export CLOUDFLARE_API_TOKEN
  export CLOUDFLARE_ACCOUNT_ID
}

backend_worker_env() {
  printf '%s\n' "${CLOUDFLARE_WORKER_ENV:-production}"
}

backend_require_supported_worker_env() {
  local worker_env
  worker_env="$(backend_worker_env)"
  case "${worker_env}" in
    production|staging) return 0 ;;
    *)
      echo "Unsupported CLOUDFLARE_WORKER_ENV=${worker_env}; use staging or production." >&2
      return 1
      ;;
  esac
}

backend_is_protected_worker_env() {
  local worker_env
  worker_env="$(backend_worker_env)"
  [[ "${worker_env}" == "production" || "${worker_env}" == "staging" ]]
}

backend_secret_value_is_weak() {
  local value="${1:-}"
  case "${value}" in
    ""|ustaxes-local-dev-secret|dev-secret-change-in-production|integration-secret-token)
      return 0
      ;;
  esac

  if [[ ${#value} -lt 32 ]]; then
    return 0
  fi

  return 1
}

backend_require_secret() {
  local name="$1"
  backend_require_var "${name}" || return 1

  local value="${!name:-}"
  if backend_is_protected_worker_env && backend_secret_value_is_weak "${value}"; then
    echo "Secret ${name} is too weak for env=$(backend_worker_env). Use a random value with at least 32 characters." >&2
    return 1
  fi
}

backend_require_worker_secrets() {
  if ! backend_is_protected_worker_env; then
    return 0
  fi

  backend_require_var APP_OIDC_ISSUER_URL
  backend_require_var APP_OIDC_CLIENT_ID
  backend_require_var APP_AUTH_CALLBACK_URL
  backend_require_secret APP_AUTH_SECRET
  backend_require_secret APP_OIDC_CLIENT_SECRET
  backend_require_secret INTERNAL_API_TOKEN
  backend_require_secret SESSION_SECRET_HMAC_KEY

  if [[ "${APP_DEV_ALLOW_LOCAL_LOGIN:-}" == "true" ]] || [[ "${LOCAL_DEV_AUTH_ENABLED:-}" == "true" ]]; then
    echo "Local development auth flags must be disabled for env=$(backend_worker_env)." >&2
    return 1
  fi
}

backend_worker_service_name() {
  local worker_env
  worker_env="$(backend_worker_env)"
  case "${worker_env}" in
    production) printf 'ustaxes-backend\n' ;;
    staging) printf 'ustaxes-backend-staging\n' ;;
    *) printf 'ustaxes-backend\n' ;;
  esac
}

backend_verify_cloudflare_token() {
  backend_require_cmd curl
  backend_require_cmd node
  backend_require_var CLOUDFLARE_API_TOKEN
  backend_require_var CLOUDFLARE_ACCOUNT_ID

  local configured_verify_url="${CLOUDFLARE_TOKEN_VERIFY_URL:-https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify}"
  local fallback_verify_url="https://api.cloudflare.com/client/v4/user/tokens/verify"
  local payload=""

  backend_fetch_token_verify_payload() {
    local verify_url="$1"
    local response=""
    local attempt
    for attempt in 1 2 3; do
      if response="$(curl -sS --fail-with-body "${verify_url}" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"; then
        printf '%s' "${response}"
        return 0
      fi
      sleep 1
    done
    return 1
  }

  if ! payload="$(backend_fetch_token_verify_payload "${configured_verify_url}")"; then
    if [[ "${configured_verify_url}" != "${fallback_verify_url}" ]]; then
      payload="$(backend_fetch_token_verify_payload "${fallback_verify_url}")"
    else
      return 1
    fi
  fi

  printf '%s' "${payload}" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.success) {
      const errors = Array.isArray(parsed.errors) ? parsed.errors.map((e) => e?.message || JSON.stringify(e)).join("; ") : "unknown error";
      console.error(`Cloudflare token verify failed: ${errors}`);
      process.exit(1);
    }
    const status = String(parsed?.result?.status ?? "unknown");
    const tokenId = String(parsed?.result?.id ?? "n/a");
    if (status.toLowerCase() !== "active") {
      console.error(`Cloudflare token is not active (status=${status}, id=${tokenId})`);
      process.exit(1);
    }
    console.log(`[ok] Cloudflare token verified (status=${status}, id=${tokenId})`);
  } catch (error) {
    console.error(`Unable to parse Cloudflare token verify response: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
});
'
}

backend_verify_workers_deploy_access() {
  backend_require_cmd curl
  backend_require_cmd node
  backend_require_var CLOUDFLARE_API_TOKEN
  backend_require_var CLOUDFLARE_ACCOUNT_ID

  local service_name="${1:-$(backend_worker_service_name)}"
  local check_url="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/services/${service_name}"
  local payload
  payload="$(curl -sS "${check_url}" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"

  printf '%s' "${payload}" | SERVICE_NAME="${service_name}" node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.success === true) {
      console.log(`[ok] Workers deploy API access confirmed for service=${process.env.SERVICE_NAME}`);
      return;
    }
    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const codeSet = new Set(errors.map((item) => Number(item?.code)));
    const messages = errors.map((item) => item?.message || JSON.stringify(item)).join("; ") || "unknown error";
    if (codeSet.has(10000) || codeSet.has(10001) || codeSet.has(9106)) {
      console.error(`Workers deploy API access denied for service=${process.env.SERVICE_NAME}: ${messages}`);
      process.exit(1);
    }
    if (codeSet.has(1003)) {
      console.log(`[ok] Workers API reachable (service not found yet for ${process.env.SERVICE_NAME})`);
      return;
    }
    console.warn(`[warn] Workers API preflight returned non-success: ${messages}`);
  } catch (error) {
    console.error(`Unable to parse Workers API preflight response: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
});
'
}
