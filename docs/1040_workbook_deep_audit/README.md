# 1040 Workbook Deep Audit

This report inventories the 2024, 2025, and 2026 forecast workbooks sheet-by-sheet,
tracks formula cells, extracts defined names, and maps workbook areas to local
`UsTaxes`, `direct-file-easy-webui`, and `backend-cloudflare` implementations.

## Quick findings

- `2024`: 62 sheets, 24,309 formula cells, 789 defined names.
- `2025`: 66 sheets, 36,018 formula cells, 874 defined names.
- `2026_forecast`: 66 sheets, 36,315 formula cells, 874 defined names.

## Coverage interpretation

- `mapped`: workbook sheet/name has an explicit mapping to local code artifacts.
- `missing_direct_file_mapping`: the workbook area is mapped in `UsTaxes`, but no direct-file mapping was configured in this audit.
- `missing_ustaxes_mapping`: direct-file/backend hooks exist but no `UsTaxes` mapping was configured.
- `informational_only`: workbook tab is metadata, navigation, or instructions rather than tax computation.

## Evidence-based caution

- A workbook-to-code mapping is not proof of line-by-line parity.
- Full parity requires comparing output values and logic branches for each workbook area against the implementations.
- The formula trace CSV is the starting point for that proof, not the proof by itself.

