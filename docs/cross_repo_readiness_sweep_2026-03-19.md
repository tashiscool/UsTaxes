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
- The deeper `Form 6251` farm-income-averaging branch is now real too:
  - `Form 1040 line 16` can use `Schedule J` when farm income averaging is elected
  - `Form 6251 line 10` now explicitly refigures that comparison without `Schedule J`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F1040.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F6251.ts`
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
- The worker-backed `Schedule 8812` path is now more first-class instead of
  only generic facts:
  - dedicated `/schedule-8812-adjustments` facts now surface the earned-income
    worksheet special-case inputs and W-2G-style withholding records
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/appSessionService.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`
- `Form 8879` is no longer a dead attachment stub:
  - consent and self-select PIN facts from the e-file flow now map into a real
  `F8879` attachment with current-return totals
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F8879.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/F8879Parity.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`
- `Form 1040` refund allocation now correctly splits line `35a` and line `36`:
  - the engine and backend facts can now apply part or all of an overpayment to
    next-year estimated tax instead of assuming everything is refunded
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F1040.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/F1040RefundAllocationParity.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/appSessionService.ts`
- `Form 1040` third-party designee support is no longer missing from the e-file layer:
  - authorized designee facts now flow through the shared information model and
    serialize into the real MeF designee fields instead of being only UI data
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/efile/mef/serializer.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/tests/F1040ThirdPartyDesigneeParity.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/appSessionService.ts`

### backend-cloudflare

- Backend typecheck passed:
  - `npm run check`
- Focused business/runtime proof passed for this slice:
  - `test/service/businessEntityCalc.test.ts`
  - `test/service/taxCalculationService.businessEntities.test.ts`
  - `test/service/businessParityFixtures.test.ts`
  - the `1120` runtime path inside `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`
- The umbrella backend gate still clears the heavy late suites such as:
  - `test/service/taxCalculationService.excel1040Parity.test.ts`
  - `test/service/businessEntityCalc.test.ts`
  - `test/service/taxCalculationService.businessEntities.test.ts`
  - `test/service/businessParityFixtures.test.ts`
  - but in this branch it again went quiet late rather than exiting cleanly, so this sweep does not claim a fresh fully completed `npm run test:all` result
- Business entity returns now expose richer sync outputs, not just readiness flags:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/appSessionService.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`
- Canonical business parity fixtures are now executable and green:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/business_fixture_manifest.json`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessParityFixtures.test.ts`
- The `1120` path now models key corporate timing/compliance adjustments from
  explicit facts:
  - COLI premium disallowance under `§264(a)(1)`
  - `§264(f)` interest disallowance when supplied
  - taxable employer-owned life insurance proceeds under `§101(j)` when notice,
    consent, and exception facts do not preserve the exclusion
  - Form `8925` reporting requirements and review flags under `§6039I`
  - NQDC deduction timing under `§404(a)(5)` / `§83(h)`
  - rabbi-trust current-deduction disallowance and `§409A(b)` hazard flags
  - Section `3121(v)(2)` employer-FICA timing adjustments for deferred comp
  - Section `1032` nonrecognition when the corporation issues its own stock
  - Section `162(m)` covered-employee deduction caps for publicly held corps
  - Section `280G` excess parachute disallowance on change-in-control facts
  - evidence:
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/forms/Y2025/irsForms/F1120.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessEntityCalc.test.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/1120/scenario-04-coli-and-101j.json`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/1120/scenario-05-nqdc-stockcomp-timing.json`
    - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/1120/scenario-06-executive-comp-edges.json`
- Nonprofit expert-route evidence is now fixture-backed too:
  - `990-N`-sized, `990-EZ`-sized, and full-`990` organizations all execute through the fixture harness and surface sized guidance instead of only generic expert routing
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`
- The expert-routed `990` family now exposes fuller rendered-package sections in
  review flows, not just a couple of preview totals:
  - filing identity
  - financial package
  - governance package
  - program and officer package
  - schedule-aware package rows such as contributors, fundraising, grants,
    compensation, supplemental explanations, and related organizations when the
    nonprofit facts include them
  - rendered EIN / variant rows
  - richer `990` and `990-EZ` financial subtotals such as contributions,
    special-events net, liabilities, and salaries/payroll where facts support them
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/appSessionService.ts`
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
- the farm-income averaging / AMT bridge is narrower too:
  - `Schedule J` is no longer a dead branch when comparing regular tax against tentative minimum tax on `Form 6251 line 10`
- The next workbook-led unaudited cluster we closed today was `EIC` childless eligibility gating:
  - age-at-year-end
  - U.S.-home residency proxy
  - protected by targeted tests

### Entity-return parity beyond capability proof

- `1120`, `1120-S`, `1065`, and `1041` now have audited computed output surfaces in the Cloudflare path, not just capability flags.
- They also now have canonical JSON parity-input fixtures that execute cleanly against the backend calculator.
- `1120` is no longer only a basic flat-tax story: the audited output now
  includes required forms, hazard flags, and explicit corporate tax adjustments
  for COLI, Section `101(j)`, Form `8925`, NQDC timing, rabbi-trust funding,
  Section `3121(v)(2)` FICA timing, Section `1032` stock nonrecognition,
  Section `162(m)` covered-employee caps, and Section `280G` parachute
  disallowance when those facts are supplied.
- `990` is still expert-routed, but it is no longer only a prose claim: the parity harness now proves honest `990-N`, `990-EZ`, and full-`990` sizing guidance in the service/runtime path, and the worker review now surfaces fuller rendered-package sections instead of just a couple of summary rows.
- See:
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md`
  - `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_harness.md`

### Cross-engine parity

- The selected-form diff between `UsTaxes` and Direct File is clean today:
  - `169` rows
  - `0` mismatches

## What still blocks a credible “100% ready” claim

### 1. Production auth now has the right verification boundary, but still needs rollout validation

The worker auth layer now has a real upstream OAuth/OIDC verification boundary,
but production readiness still depends on operational rollout and provider-side validation.

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/index.ts`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/utils/appAuth.ts`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/utils/oidc.ts`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/utils/oidc.test.ts`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`

Why this still blocks the claim:

- local/dev login is still present
- protected environments now use backend-owned OIDC state, PKCE,
  authorization-code exchange, and ID token verification
- both the helper-level and worker-level OIDC code-exchange paths now run green locally
- the remaining auth gap is operational: this still needs live production
  provider rollout validation, not a different trust architecture
- local production env validation is still blocked because
  `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/.env-prod`
  does not currently contain real `APP_OIDC_ISSUER_URL`,
  `APP_OIDC_CLIENT_ID`, `APP_OIDC_CLIENT_SECRET`, and
  `APP_AUTH_CALLBACK_URL` values for a live-provider round-trip
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
- recent work shrank `Schedule A` casualty/other-deduction handling and
  `Form 1040` line-38 penalty handling, but not every remaining 2025-law edge case

### 3. Business/nonprofit families are stronger, but still not fully workbook-proven

Evidence:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_harness.md`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_workbook_parity_matrix.csv`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md`

Why this still blocks the claim:

- `1120`, `1120-S`, `1065`, `1041`, and the expert-routed `990` family are no longer only `IRS-reference-led`; they are now fixture-backed and executable through the backend test harness
- the expert-routed `990` family now also exposes richer rendered preview fields in checklist/review flows instead of only sizing prose
- the `1120` family now models key COLI, Section `101(j)`, Form `8925`, NQDC,
  rabbi-trust, Section `3121(v)(2)`, Section `1032`, Section `162(m)`, and
  Section `280G` adjustments from explicit facts, but it still is not backed by
  a private workbook and it still does not model every payroll-form, stock
  settlement, or transaction-trigger nuance
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

- the scripted gate is still intentionally smoke-weighted at the top level
- in this branch, the umbrella run again cleared the heaviest business and
  Excel-parity suites but then went quiet late instead of exiting cleanly
- even when that runner behaves, it still does not always execute the heaviest
  full worker-runtime and comprehensive/manual parity suites on every pass
- that is pragmatic, but it is not the same thing as continuously proving every
  strongest parity claim on every run

## Bottom line

The stack is substantially stronger than it was:

- workbook audit is green
- cross-engine diff is green
- targeted backend business/runtime slices are green
- TaxFlow build is green
- Direct File advanced parity slice is green

But the evidence still does **not** support a clean “100% ready” claim yet.

The most honest remaining blockers are:

1. production auth rollout validation
2. residual documented 2025-law partials
3. lack of full private-workbook-backed business/nonprofit parity, especially the entire `990` family
4. still-partial Direct File final-form detail on the hardest advanced forms
5. release gating that is strong, but still smoke-weighted at the top level
