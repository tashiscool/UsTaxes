#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./_prod_env.sh
source "${SCRIPT_DIR}/_prod_env.sh"

backend_load_prod_env "${1:-}"
backend_require_supported_worker_env
backend_prepare_wrangler_env
backend_verify_cloudflare_token
backend_verify_workers_deploy_access
