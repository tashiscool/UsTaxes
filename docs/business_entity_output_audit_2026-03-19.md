# Business Entity Output Audit — 2026-03-19

This audit extends the business-return story beyond simple capability gating.
The goal is to prove that the Cloudflare-backed TaxFlow path emits meaningful,
form-aligned computed outputs for the entity-return families we currently
present as self-service.

Canonical fixture inputs now complement the runtime/service proof:

- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/business_fixture_manifest.json`
- `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessParityFixtures.test.ts`

## Scope

- Cloudflare runtime `returns/sync` output
- backend calculation service output
- worker-backed TaxFlow session flow

## Audited forms

| Form | Audited output surface | Evidence | Current result | Remaining gap |
| --- | --- | --- | --- | --- |
| `1120` | `entityName`, `totalIncome`, `totalDeductions`, `taxableIncome`, `totalTax`, `totalPayments`, `amountOwed`, `overpayment`, `effectiveTaxRate`, `schedules` | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Worker/runtime and service output now expose stable entity-level totals for the `1120` path. | No workbook-backed business parity yet; still IRS-reference-led. |
| `1120-S` | All core entity totals above plus `ownerAllocations[]` with shareholder names, ownership %, ordinary income, interest, dividends/capital gains, qualified dividends, section 179, other deductions, cash distributions, and SE earnings behavior | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessParityFixtures.test.ts` | Worker/runtime now proves richer pass-through output instead of only support flags, and canonical fixture inputs execute cleanly with dividend, section 179, other-deduction, and cash-distribution fields present in the audited surface. | Still not workbook-backed and still thinner than a fully rendered Schedule K/K-1 audit package. |
| `1065` | All core entity totals above plus `ownerAllocations[]` with partner names, profit %, ordinary income, rental income, capital gains, qualified dividends, tax-exempt interest, section 179, other deductions, cash distributions, and SE earnings behavior | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessParityFixtures.test.ts` | Worker/runtime now proves named partner allocations and pass-through detail rather than only generic readiness, and canonical fixture inputs now exercise qualified-dividend, tax-exempt-interest, section 179, and other-deduction paths. | Guaranteed-payment nuance, liabilities, and richer K-1 rendering still need deeper parity audit. |
| `1041` | All core entity totals above plus `adjustedTotalIncome`, `distributionDeduction`, `exemption`, `beneficiaryCount`, and payment detail via withholding/estimated-tax-backed totals | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/businessParityFixtures.test.ts` | Worker/runtime now proves trust-specific outputs beyond scalar readiness and schedules, and canonical fixture inputs execute cleanly with beneficiary count plus withholding and estimated-payment-backed totals. | Still not a full fiduciary package audit; beneficiary K-1 rendering and distribution-line fidelity need deeper work. |
| `990` | Capability gating, review support, blocked submit | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Honest expert-only routing is in place and worker-tested. | Not self-serve; cannot support a “100% self-service” production claim. |

## Takeaway

The current Cloudflare path is now stronger than a simple capability matrix for
`1120-S`, `1065`, and `1041`: it emits audited computed outputs that are
verified in service-level tests, worker-level tests, and canonical fixture-backed
parity scenarios.

That said, these forms are still not workbook-backed, and they are not yet
equivalent to a full rendered IRS-output parity package.
