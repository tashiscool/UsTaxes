# Business Workbook Parity Harness

This inventory extends the workbook parity approach beyond the 1040 family.
When a private workbook is unavailable locally, the matrix records the workbook gap
and inventories local IRS MeF/ATS materials instead so parity work stays evidence-based.
Canonical JSON parity fixtures now back 1120, 1120-S, 1065, and 1041, and they also cover honest expert-route sizing scenarios for the 990 family, so those forms are no longer IRS-reference-led only.

| Form | Workbook | IRS refs | Fixtures | Local impl | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1120 | no | 83 | 6 | 4 | 3 | fixture_backed_irs_reference | C-corporation parity now has executable fixture coverage for baseline operations, credits/payments, zero-income carryover, COLI/Section 101(j)/Form 8925 exposure, NQDC/rabbi-trust timing, and executive-compensation edge cases under Sections 3121(v)(2), 1032, 162(m), and 280G. |
| 1120-S | no | 35 | 3 | 4 | 3 | fixture_backed_irs_reference | S-corp parity should include ordinary business income, Schedule K/K-1 allocation, and shareholder ownership inputs. |
| 1065 | no | 25 | 3 | 4 | 3 | fixture_backed_irs_reference | Partnership parity should cover guaranteed payments, partner allocations, Schedule K/K-1, and liabilities. |
| 1041 | no | 14 | 3 | 5 | 2 | fixture_backed_irs_reference | Trust and estate parity is driven by fiduciary, beneficiary, distribution, and compressed-bracket logic. |
| 990 | no | 48 | 3 | 6 | 2 | fixture_backed_irs_reference | Nonprofit parity is partially implemented in local forms, but Cloudflare still routes Form 990-family work to expert handling. |

## Reading the status

- `workbook_and_irs_reference_present`: local workbook and IRS support materials are both available.
- `workbook_present_without_irs_reference`: local workbook found, but no IRS support assets were discovered in the scanned materials.
- `fixture_backed_irs_reference`: no local workbook was found, but canonical parity fixtures and IRS materials are both present.
- `irs_reference_only`: no local workbook found, but IRS MeF/ATS assets are available and should anchor parity work until a workbook is supplied.
- `missing_external_reference`: neither a local workbook nor IRS materials were detected for that form.
- `local_implementation_missing`: the form did not resolve to local implementation files, so parity should stop until source support exists.

## Canonical business fixtures

- Fixture manifest: `/Users/tkhan/IdeaProjects/taxes/UsTaxes/src/tests/ats/business/fixtures/business_fixture_manifest.json`
- Fixture-backed forms in this pass: `1120`, `1120-S`, `1065`, `1041`, and expert-route `990` sizing scenarios.
