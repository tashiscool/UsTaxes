# UsTaxes Cloudflare Backend (Local-First)

This package provides a Cloudflare-native backend using:

- Workers (HTTP API)
- D1 (relational tax return + submission metadata)
- R2 (facts/payload/ack artifacts)
- Queues (submission pipeline)
- Durable Objects (idempotent orchestration)

## API Surface

- `GET /health`
- `POST /api/v1/returns`
- `GET /api/v1/returns/:returnId`
- `GET /api/v1/returns/:returnId/submissions`
- `POST /api/v1/returns/:returnId/submit`
- `GET /api/v1/submissions/:submissionId`
- `GET /api/v1/submissions/:submissionId/ack`
- `GET /api/v1/submissions/:submissionId/payload` (internal auth, optional)
- `POST /api/v1/internal/process/:submissionId` (internal auth, local/manual trigger)
- `POST /api/v1/internal/submissions/:submissionId/retry` (internal auth)

## Local Setup

```bash
cd backend-cloudflare
npm install
npm run d1:migrate:local
npm run test
npm run dev
```

## Production Setup

This package now uses the same production ergonomics pattern as the sibling
`alovoa` Cloudflare worker project:

- a dedicated env loader in `scripts/_prod_env.sh`
- token verification in `scripts/verify_cloudflare_token.sh`
- resource bootstrap in `scripts/bootstrap_cloudflare_resources.sh`
- optional Wrangler secret sync in `scripts/sync_wrangler_secrets.sh`
- a safer end-to-end deploy pipeline in `scripts/deploy-prod.sh`

### Env files

- Local production config lives in `.env-prod`
- A template is provided in `.env-prod.example`
- `.env-prod` is gitignored
- If local `.env-prod` is missing, the helper can fall back to a sibling
  `../alovoa/.env-prod` on this workstation for convenience

Recommended production-only secrets to keep out of `wrangler.toml`:

- `APP_AUTH_SECRET`
- `APP_OIDC_CLIENT_SECRET`
- `INTERNAL_API_TOKEN`
- `SESSION_SECRET_HMAC_KEY`

Recommended production OIDC configuration:

- `APP_OIDC_ISSUER_URL`
- `APP_OIDC_CLIENT_ID`
- `APP_AUTH_CALLBACK_URL`

### Production commands

Verify Cloudflare access:

```bash
npm run cf:verify
```

Bootstrap remote resources:

```bash
npm run cf:bootstrap:production
```

Sync Wrangler secrets from `.env-prod`:

```bash
npm run cf:secrets:production
```

Full production pipeline:

```bash
npm run deploy:pipeline:production
```

The deploy pipeline can:

- verify the Cloudflare token
- preflight Workers deploy access
- optionally bootstrap D1 / Queue / R2 resources
- optionally sync Wrangler secrets
- run backend and TaxFlow predeploy checks
- apply remote D1 migrations
- deploy the backend worker
- build and deploy the TaxFlow frontend worker
- run basic post-deploy smoke checks against `api.freetaxflow.com` and `freetaxflow.com`

## Local Flow (manual smoke)

1. Create return

```bash
curl -s http://127.0.0.1:8787/api/v1/returns \
  -H 'content-type: application/json' \
  -d '{"taxYear":2025,"filingStatus":"single","facts":{"primaryTIN":"400011032"}}'
```

2. Submit return

```bash
curl -s http://127.0.0.1:8787/api/v1/returns/<RETURN_ID>/submit \
  -H 'content-type: application/json' \
  -d '{
    "idempotencyKey":"37b75df4-342f-4ec5-96df-e126672cd377",
    "payload":{
      "taxYear":2025,
      "primaryTIN":"400011032",
      "filingStatus":"single",
      "form1040":{"totalTax":2974,"totalPayments":2713}
    }
  }'
```

3. Check status + ack

```bash
curl -s http://127.0.0.1:8787/api/v1/submissions/<SUBMISSION_ID>
curl -s http://127.0.0.1:8787/api/v1/submissions/<SUBMISSION_ID>/ack
```

## Test Strategy

`test/ats/*.test.ts` provides IRS-style scenario tests:

- acceptance path for all 36 ATS scenarios (1040, 1040-NR, 1040-SS, 4868)
- rejection path (IND-031)
- idempotency behavior

Validation pipeline coverage includes:

- filing status + form type normalization/validation
- TIN structural checks
- Form 1040 financial consistency checks (tax/payments/refund/amount owed)
- ATS expected-values verification (when expected values are provided in payload metadata)
- retry/reset semantics (clears stale ack/error state on manual requeue)

`test/unit`, `test/service`, and `test/worker` add broad backend coverage:

- deterministic payload hashing
- ack engine rule validation
- API idempotency conflict behavior
- retry semantics + max-attempt failover
- worker queue ack/retry routing behavior
- local Worker runtime integration (`unstable_dev`) with migrated D1 + real DO routing

These run locally with in-memory adapters while production code uses D1/R2/Queue/DO bindings.

## Deployment Notes

- `APP_DEV_ALLOW_LOCAL_LOGIN` is now wired in `wrangler.toml` for development,
  staging, and production, so the runtime flag matches what the app actually reads.
- `appAuth` now accepts `APP_AUTH_SECRET` first and `SESSION_SECRET_HMAC_KEY`
  second, which lets production use Wrangler-managed secrets without breaking the
  current local setup.
- protected environments now use a backend-owned OIDC flow with signed state,
  PKCE, authorization-code exchange, and ID token verification instead of the
  older custom signed callback-assertion bridge.
