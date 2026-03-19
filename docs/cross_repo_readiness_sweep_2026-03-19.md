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
- Targeted 2025 `Schedule 2` workbook slice now covers:
  - Form `4137` -> `Schedule 2 line 5`
  - Form `8919` -> `Schedule 2 line 6`
  - W-2 box 12 `A/B/M/N` -> `Schedule 2 line 13`
  - Evidence:
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/Schedule2.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F4137.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F8919.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/Workbook2025AdditionsParity.test.ts`
- Cross-engine selected-form parity harness passed:
  - `npm run test:form-parity-harness`
  - `rowCount=169`
  - `mismatchCount=0`
- The AMT capital-gains path now uses real Schedule D tax-worksheet lines in the
  `F6251` Part III branch instead of stubbed worksheet methods:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/worksheets/SDTaxWorksheet.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/worksheets/ScheduleDTaxWorksheet.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/f6251.test.ts`
- `ScheduleEIC` childless-filer gating now has explicit age and U.S.-home coverage:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/ScheduleEIC.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/ScheduleEIC.test.ts`
- `Schedule 8812` earned-income worksheet special-case adjustments now flow through
  `Schedule 1` lines `8r` through `8u`, and `Form 1040 line 25c` now carries
  normalized other-federal-withholding credits alongside Additional Medicare
  withholding:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/Schedule1.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/Schedule8812.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F1040.ts`

### backend-cloudflare

- Full backend gate passed:
  - `npm run test:all`
  - `24/24` test files
  - `197/197` tests
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
- Canonical business parity fixtures are now executable and green:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/business_fixture_manifest.json`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessParityFixtures.test.ts`
- Nonprofit expert-route evidence is now fixture-backed too:
  - `990-N`-sized, `990-EZ`-sized, and full-`990` organizations all execute through the fixture harness and surface sized guidance instead of only generic expert routing
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`
- Protected auth callbacks now require a signed upstream identity assertion
  instead of trusting raw query params:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/utils/appAuth.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/index.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/utils/appAuth.test.ts`
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
- The capital-gains / AMT bridge is also narrower now:
  - the Schedule D tax worksheet no longer feeds `F6251 Part III` through
    undefined line methods for the core `l10`, `l13`, `l14`, and `l21` values
- The next workbook-led unaudited cluster we closed today was `EIC` childless eligibility gating:
  - age-at-year-end
  - U.S.-home residency proxy
  - protected by targeted tests

### Entity-return parity beyond capability proof

- `1120`, `1120-S`, `1065`, and `1041` now have audited computed output surfaces in the Cloudflare path, not just capability flags.
- They also now have canonical JSON parity-input fixtures that execute cleanly against the backend calculator.
- `990` is still expert-routed, but it is no longer only a prose claim: the parity harness now proves honest `990-N`, `990-EZ`, and full-`990` sizing guidance in the service/runtime path.
- See:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_harness.md`

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
- protected callback identity is now verified from a signed upstream assertion
  instead of raw query params, but the stack still is not a full OIDC
  code/token exchange boundary
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

### 3. Business/nonprofit families are stronger, but still not fully workbook-proven

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_harness.md`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_matrix.csv`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md`

Why this still blocks the claim:

- `1120`, `1120-S`, `1065`, `1041`, and the expert-routed `990` family are no longer only `IRS-reference-led`; they are now fixture-backed and executable through the backend test harness
- none of the business/nonprofit forms are backed by private workbook sources the way the `1040` family is
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
3. lack of full private-workbook-backed business/nonprofit parity, especially the entire `990` family
4. still-partial Direct File final-form detail on the hardest advanced forms
5. release gating that is strong, but still smoke-weighted at the top level
