# Business Workbook Parity Harness

This inventory extends the workbook parity approach beyond the 1040 family.
When a private workbook is unavailable locally, the matrix records the workbook gap
and inventories local IRS MeF/ATS materials instead so parity work stays evidence-based.

For the richer Cloudflare-backed output proof that goes beyond simple capability
flags, see
[`business_entity_output_audit_2026-03-19.md`](/Users/tkhan/IdeaProjects/taxes/UsTaxes/docs/business_entity_output_audit_2026-03-19.md).

| Form   | Workbook | IRS refs | Local impl | Tests | Status             | Notes                                                                                                                          |
| ------ | -------- | -------- | ---------- | ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 1120   | no       | 83       | 4          | 3     | irs_reference_only | C-corporation parity should track Form 1120 computation, MeF serialization, and backend entity-return handling.                |
| 1120-S | no       | 35       | 4          | 3     | irs_reference_only | S-corp parity should include ordinary business income, Schedule K/K-1 allocation, and shareholder ownership inputs.            |
| 1065   | no       | 25       | 4          | 3     | irs_reference_only | Partnership parity should cover guaranteed payments, partner allocations, Schedule K/K-1, and liabilities.                     |
| 1041   | no       | 14       | 5          | 2     | irs_reference_only | Trust and estate parity is driven by fiduciary, beneficiary, distribution, and compressed-bracket logic.                       |
| 990    | no       | 48       | 6          | 2     | irs_reference_only | Nonprofit parity is partially implemented in local forms, but Cloudflare still routes Form 990-family work to expert handling. |

## Reading the status

- `workbook_and_irs_reference_present`: local workbook and IRS support materials are both available.
- `workbook_present_without_irs_reference`: local workbook found, but no IRS support assets were discovered in the scanned materials.
- `irs_reference_only`: no local workbook found, but IRS MeF/ATS assets are available and should anchor parity work until a workbook is supplied.
- `missing_external_reference`: neither a local workbook nor IRS materials were detected for that form.
- `local_implementation_missing`: the form did not resolve to local implementation files, so parity should stop until source support exists.
