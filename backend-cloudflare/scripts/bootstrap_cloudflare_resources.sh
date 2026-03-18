#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WRANGLER_TOML="${BACKEND_DIR}/wrangler.toml"

# shellcheck source=./_prod_env.sh
source "${SCRIPT_DIR}/_prod_env.sh"

backend_load_prod_env "${1:-}"
backend_prepare_wrangler_env
backend_verify_cloudflare_token
backend_require_cmd curl
backend_require_cmd jq
backend_require_cmd node
backend_require_cmd npx

WORKER_ENV="${CLOUDFLARE_WORKER_ENV:-production}"

case "${WORKER_ENV}" in
  production)
    D1_DATABASE_NAME="${D1_DATABASE_NAME:-ustaxes-backend-production}"
    D1_DATABASE_ID_VAR="D1_PRODUCTION_DATABASE_ID"
    R2_BUCKET_NAME="${R2_BUCKET_NAME:-${R2_PRODUCTION_BUCKET:-ustaxes-artifacts-production}}"
    QUEUE_NAME="${QUEUE_NAME:-${QUEUE_PRODUCTION:-ustaxes-submissions-production}}"
    ;;
  staging)
    D1_DATABASE_NAME="${D1_DATABASE_NAME:-ustaxes-backend-staging}"
    D1_DATABASE_ID_VAR="D1_STAGING_DATABASE_ID"
    R2_BUCKET_NAME="${R2_BUCKET_NAME:-${R2_STAGING_BUCKET:-ustaxes-artifacts-staging}}"
    QUEUE_NAME="${QUEUE_NAME:-${QUEUE_STAGING:-ustaxes-submissions-staging}}"
    ;;
  *)
    echo "Unsupported CLOUDFLARE_WORKER_ENV=${WORKER_ENV}; use staging or production." >&2
    exit 1
    ;;
esac

CURRENT_D1_DATABASE_ID="${!D1_DATABASE_ID_VAR:-}"

upsert_env_line() {
  local key="$1"
  local value="$2"
  local file="${BACKEND_ENV_FILE_LOADED:-$(backend_env_file_default)}"
  [[ -f "${file}" ]] || return 0

  local tmp_file
  tmp_file="$(mktemp)"
  awk -v k="${key}" -v v="${value}" '
    BEGIN { done = 0 }
    $0 ~ ("^" k "=") {
      print k "=" v
      done = 1
      next
    }
    { print }
    END {
      if (done == 0) {
        print k "=" v
      }
    }
  ' "${file}" > "${tmp_file}"
  mv "${tmp_file}" "${file}"
}

api_get() {
  local path="$1"
  curl -sS "https://api.cloudflare.com/client/v4${path}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
}

api_post() {
  local path="$1"
  local json_body="$2"
  curl -sS -X POST "https://api.cloudflare.com/client/v4${path}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${json_body}"
}

patch_wrangler_d1_id() {
  local database_id="$1"
  local env_name="$2"
  node - "${WRANGLER_TOML}" "${database_id}" "${env_name}" <<'NODE'
const fs = require("node:fs");
const [file, databaseId, envName] = process.argv.slice(2);
if (!file || !databaseId || !envName) {
  process.exit(1);
}
let text = fs.readFileSync(file, "utf8");
const escapedEnv = envName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(`(\\[\\[env\\.${escapedEnv}\\.d1_databases\\]\\][\\s\\S]*?binding = "USTAXES_DB"[\\s\\S]*?database_name = "[^"]+"\\n)database_id = "[^"]+"`);
if (!pattern.test(text)) {
  console.error(`Unable to locate ${envName} d1 binding in ${file}`);
  process.exit(1);
}
text = text.replace(pattern, `$1database_id = "${databaseId}"`);
fs.writeFileSync(file, text);
NODE
}

backend_step "Ensure D1 database"
d1_list_payload="$(api_get "/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database")"
d1_id="$(
  printf '%s' "${d1_list_payload}" | jq -r --arg id "${CURRENT_D1_DATABASE_ID}" --arg name "${D1_DATABASE_NAME}" '
    (.result[]? | select((.uuid == $id and $id != "") or .name == $name) | .uuid) // empty
  ' | head -n 1
)"
if [[ -z "${d1_id}" ]]; then
  echo "[create] D1 ${D1_DATABASE_NAME}"
  d1_create_payload="$(api_post "/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database" "{\"name\":\"${D1_DATABASE_NAME}\"}")"
  d1_id="$(printf '%s' "${d1_create_payload}" | jq -r '.result.uuid // empty')"
fi
if [[ -z "${d1_id}" ]]; then
  echo "Unable to resolve D1 database id for ${D1_DATABASE_NAME}" >&2
  exit 1
fi
echo "[ok] D1 ${D1_DATABASE_NAME} -> ${d1_id}"
upsert_env_line "${D1_DATABASE_ID_VAR}" "${d1_id}"
patch_wrangler_d1_id "${d1_id}" "${WORKER_ENV}"

backend_step "Ensure Queue"
queue_list_payload="$(api_get "/accounts/${CLOUDFLARE_ACCOUNT_ID}/queues")"
queue_exists="$(
  printf '%s' "${queue_list_payload}" | jq -r --arg name "${QUEUE_NAME}" '
    .result[]? | select(.queue_name == $name) | .queue_name
  ' | head -n 1
)"
if [[ -z "${queue_exists}" ]]; then
  echo "[create] queue ${QUEUE_NAME}"
  queue_create_payload="$(api_post "/accounts/${CLOUDFLARE_ACCOUNT_ID}/queues" "{\"queue_name\":\"${QUEUE_NAME}\"}")"
  queue_ok="$(printf '%s' "${queue_create_payload}" | jq -r '.success // false')"
  if [[ "${queue_ok}" != "true" ]]; then
    printf '%s\n' "${queue_create_payload}" | jq '.'
    exit 1
  fi
fi
echo "[ok] queue ${QUEUE_NAME}"

backend_step "Ensure R2 bucket"
r2_list_payload="$(api_get "/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets")"
r2_code="$(printf '%s' "${r2_list_payload}" | jq -r '.errors[0].code // empty')"
if [[ "${r2_code}" == "10042" ]]; then
  echo "R2 is disabled on this account. Enable it in the Cloudflare dashboard and rerun." >&2
  exit 2
fi
r2_exists="$(
  printf '%s' "${r2_list_payload}" | jq -r --arg name "${R2_BUCKET_NAME}" '
    .result.buckets[]? | select(.name == $name) | .name
  ' | head -n 1
)"
if [[ -z "${r2_exists}" ]]; then
  echo "[create] r2 ${R2_BUCKET_NAME}"
  (
    cd "${BACKEND_DIR}"
    npx wrangler r2 bucket create "${R2_BUCKET_NAME}" >/dev/null
  )
fi
echo "[ok] r2 ${R2_BUCKET_NAME}"
upsert_env_line "$( [[ "${WORKER_ENV}" == "production" ]] && printf 'R2_PRODUCTION_BUCKET' || printf 'R2_STAGING_BUCKET' )" "${R2_BUCKET_NAME}"
upsert_env_line "$( [[ "${WORKER_ENV}" == "production" ]] && printf 'QUEUE_PRODUCTION' || printf 'QUEUE_STAGING' )" "${QUEUE_NAME}"

echo
echo "[ok] Cloudflare ${WORKER_ENV} resources verified"
