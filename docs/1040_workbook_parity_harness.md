# 1040 Workbook Parity Harness

This harness compares the local 1040-family workbook files against the
implemented 2025 `UsTaxes` forms.

## Inputs

- `/Users/tkhan/Downloads/24_1040.xlsx`
- `/Users/tkhan/Downloads/25_1040.xlsx`
- `/Users/tkhan/Downloads/26_1040 Forecast (Rev. 41).xlsx`

## What it produces

- `docs/1040_workbook_parity_inventory.json`
- `docs/1040_workbook_parity_matrix.json`
- `docs/1040_workbook_parity_matrix.csv`

The inventory file captures every workbook sheet, its formula count, and its
role in the 1040 family scan. The matrix file compares each target form family
to the local implementation files under `src/forms/Y2025/irsForms`.

## Run

```bash
python3 scripts/1040_workbook_parity_harness.py
```

Optional overrides:

- `--workbook <path>` can be repeated to inspect a different workbook set.
- `--output-dir <path>` writes the JSON and CSV outputs somewhere else.

## Scope

The matrix is intentionally limited to the 1040-family forms requested for the
parity audit:

- W-2
- 1099s
- 1040
- Schedule 1
- Schedule 1-A
- Schedule A
- Schedule B
- Schedule C
- Schedule D
- Schedule E
- Schedule F
- Schedule SE
- 6251
- 8812
- 8949
- 8995
- EIC

Everything else in the workbooks is still captured in the inventory file, but it
is marked as auxiliary or excluded from the 1040-family matrix.
