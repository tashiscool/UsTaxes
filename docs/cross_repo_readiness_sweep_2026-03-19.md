# Cross-Repo Readiness Sweep — 2026-03-19

This sweep covers the active filing stack:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare`
- `/Users/tkhan/IdeaProjects/taxes/direct-file-easy-webui`
- `/Users/tkhan/IdeaProjects/taxes/taxflow`

## What we re-verified today

### UsTaxes

- Workbook-led audit passed:
  - `npm run test:workbook-audit`
- Cross-engine selected-form parity harness passed:
  - `npm run test:form-parity-harness`
  - `rowCount=169`
  - `mismatchCount=0`
- `ScheduleEIC` childless-filer gating now has explicit age and U.S.-home coverage:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/ScheduleEIC.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/ScheduleEIC.test.ts`

### backend-cloudflare

- Full backend gate passed:
  - `npm run test:all`
  - `23/23` test files
  - `188/188` tests
- Runtime smoke passed:
  - `workbook`
  - `advanced`
  - `derivedFacts`
  - `auth`
- Business entity returns now expose richer sync outputs, not just readiness flags:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/appSessionService.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`

### direct-file-easy-webui

- Advanced Direct File regression slice passed:
  - `ATSToFactGraphConverterTest`
  - `TaxYear2025RegressionTest`
  - `SelectedFormParityExportTest`
- Current evidence still shows deeper parity improvements for:
  - `1040-NR`
  - `Schedule OI/NEC`
  - `8995-A` statement rows

### taxflow

- Build/typecheck passed:
  - `pnpm check && pnpm build`

## What is stronger now

### Workbook-led 1040 family

- `Schedule B`, qualified dividends, `1099-G`, `1099-INT`, `1099-DIV`, `Schedule E`, `F8582`, `6251`, `8812`, `8949`, `8995`, `8995-A`, and `1040-NR` all now have stronger workbook-led or direct parity evidence than they did earlier in the week.
- The next workbook-led unaudited cluster we closed today was `EIC` childless eligibility gating:
  - age-at-year-end
  - U.S.-home residency proxy
  - protected by targeted tests

### Entity-return parity beyond capability proof

- `1120-S`, `1065`, and `1041` now have audited computed output surfaces in the Cloudflare path, not just capability flags.
- See:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md`

### Cross-engine parity

- The selected-form diff between `UsTaxes` and Direct File is clean today:
  - `169` rows
  - `0` mismatches

## What still blocks a credible “100% ready” claim

### 1. Production auth trust is still not strong enough

The worker auth layer is better than before, but it is still not a full upstream
OAuth/OIDC verification boundary.

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/index.ts`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/utils/appAuth.ts`

Why this still blocks the claim:

- local/dev login is still present
- callback identity is still assembled from callback params/state instead of a
  real verified code/token exchange
- for tax-filing production readiness, auth trust is part of correctness

### 2. The 2025 tax-engine still documents important partials

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/2024_vs_2025_law_diff_matrix.csv`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/2025_form_parity_audit.csv`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/Schedule2.ts`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/ScheduleE.ts`

Why this still blocks the claim:

- the repo still marks major tax-law areas as `partial` or `patched_partial`
- live source still contains TODO-backed or simplified branches
- today’s work improved `EIC`, but not every remaining 2025-law edge case

### 3. Business/nonprofit families are still not workbook-proven

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_harness.md`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_matrix.csv`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md`

Why this still blocks the claim:

- `1120`, `1120-S`, `1065`, and `1041` are now better audited at the runtime/output level
- but they are still `IRS-reference-led`, not workbook-backed
- `990` remains expert-routed, not self-serve

### 4. Direct File advanced-form parity is still stronger, but still not final-form complete

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/direct-file-easy-webui/direct-file/backend/src/main/resources/tax/form1040NR.xml`
- `/Users/tkhan/IdeaProjects/taxes/direct-file-easy-webui/direct-file/backend/src/main/resources/tax/form8995A.xml`
- `/Users/tkhan/IdeaProjects/taxes/direct-file-easy-webui/direct-file/backend/src/main/resources/tax/scheduleE.xml`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/2025_form_parity_audit.csv`

Why this still blocks the claim:

- `1040-NR` `Schedule OI` is richer, but still not full typed line parity
- `8995-A` statement rows are stronger, but still not a full rendered IRS
  statement/election package
- `Schedule E` page 2 remains structurally flatter than a true paper-form matrix

### 5. The default release gate still uses runtime smoke, not the heaviest possible end-to-end proof

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/package.json`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/scripts/test-all.mjs`

Why this still blocks the claim:

- `test:all` is green and trustworthy for its intended gate
- but it still intentionally uses smoke checks instead of always running the
  heaviest full worker-runtime and comprehensive/manual parity suites
- that is pragmatic, but it is not the same thing as continuously proving every
  strongest parity claim on every run

## Bottom line

The stack is substantially stronger than it was:

- workbook audit is green
- cross-engine diff is green
- backend gate is green
- TaxFlow build is green
- Direct File advanced parity slice is green

But the evidence still does **not** support a clean “100% ready” claim yet.

The most honest remaining blockers are:

1. production auth trust
2. residual documented 2025-law partials
3. lack of workbook-backed business/nonprofit parity
4. still-partial Direct File final-form detail on the hardest advanced forms
5. release gating that is strong, but still smoke-weighted at the top level
