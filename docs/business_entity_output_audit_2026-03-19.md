# Business Entity Output Audit — 2026-03-19

This audit extends the business-return story beyond simple capability gating.
The goal is to prove that the Cloudflare-backed TaxFlow path emits meaningful,
form-aligned computed outputs for the entity-return families we currently
present as self-service.

## Scope

- Cloudflare runtime `returns/sync` output
- backend calculation service output
- worker-backed TaxFlow session flow

## Audited forms

| Form | Audited output surface | Evidence | Current result | Remaining gap |
| --- | --- | --- | --- | --- |
| `1120` | `entityName`, `totalIncome`, `totalDeductions`, `taxableIncome`, `totalTax`, `totalPayments`, `amountOwed`, `overpayment`, `effectiveTaxRate`, `schedules` | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Worker/runtime and service output now expose stable entity-level totals for the `1120` path. | No workbook-backed business parity yet; still IRS-reference-led. |
| `1120-S` | All core entity totals above plus `ownerAllocations[]` with shareholder names, ownership %, ordinary income, interest, dividends/capital gains, deductions, and SE earnings behavior | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Worker/runtime now proves richer pass-through output instead of only support flags. | Still not workbook-backed and still thinner than a fully rendered Schedule K/K-1 audit package. |
| `1065` | All core entity totals above plus `ownerAllocations[]` with partner names, profit %, ordinary income, rental income, capital gains, section 179, other deductions, and SE earnings behavior | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Worker/runtime now proves named partner allocations and pass-through detail rather than only generic readiness. | Guaranteed-payment nuance, liabilities, and richer K-1 rendering still need deeper parity audit. |
| `1041` | All core entity totals above plus `adjustedTotalIncome`, `distributionDeduction`, `exemption`, and `beneficiaryCount` | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/service/taxCalculationService.businessEntities.test.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Worker/runtime now proves trust-specific outputs beyond scalar readiness and schedules. | Still not a full fiduciary package audit; beneficiary K-1 rendering and distribution-line fidelity need deeper work. |
| `990` | Capability gating, review support, blocked submit | `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/src/services/taxCalculationService.ts`, `/Users/tkhan/IdeaProjects/taxes/UsTaxes/backend-cloudflare/test/worker/cloudflareRuntime.e2e.test.ts` | Honest expert-only routing is in place and worker-tested. | Not self-serve; cannot support a “100% self-service” production claim. |

## Takeaway

The current Cloudflare path is now stronger than a simple capability matrix for
`1120-S`, `1065`, and `1041`: it emits audited computed outputs that are
verified in both service-level and worker-level tests.

That said, these forms are still not workbook-backed, and they are not yet
equivalent to a full rendered IRS-output parity package.
