#!/usr/bin/env python3
"""Executable workbook-led coverage assertions for the 1040 audit artifacts."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path("/Users/tkhan/IdeaProjects/taxes/UsTaxes")
AUDIT_DIR = ROOT / "docs" / "1040_workbook_deep_audit"

PRIORITY_LOGICAL_AREAS = {
    "schedule_e": {
        "test_files": ["src/forms/Y2025/tests/ScheduleEParity.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "schedule_e_page_2": {
        "test_files": ["src/forms/Y2025/tests/ScheduleEParity.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "form_6251": {
        "test_files": ["src/forms/Y2025/tests/f6251.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "form_8812": {
        "test_files": ["src/forms/Y2025/tests/Schedule8812.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "eitc": {
        "test_files": ["src/forms/Y2025/tests/ScheduleEIC.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "earned_income_worksheet": {
        "test_files": ["src/forms/Y2025/tests/ScheduleEIC.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "eitc_table": {
        "test_files": ["src/forms/Y2025/tests/ScheduleEIC.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "form_8949": {
        "test_files": [
            "src/forms/Y2025/tests/F8949Parity.test.ts",
            "src/forms/Y2025/tests/ScheduleD.test.ts",
        ],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "schedule_d": {
        "test_files": [
            "src/forms/Y2025/tests/F8949Parity.test.ts",
            "src/forms/Y2025/tests/ScheduleD.test.ts",
        ],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "schedule_d_worksheet": {
        "test_files": [
            "src/forms/Y2025/tests/F8949Parity.test.ts",
            "src/forms/Y2025/tests/ScheduleD.test.ts",
        ],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "form_8995": {
        "test_files": ["src/forms/Y2025/tests/obbba2025Law.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "form_1040": {
        "test_files": [
            "src/forms/Y2025/tests/obbba2025Law.test.ts",
            "src/forms/Y2025/tests/f1040nrParity.test.ts",
        ],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "1099_g": {
        "test_files": ["src/forms/Y2025/tests/F1099GParity.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "1099_r": {
        "test_files": ["src/forms/Y2025/tests/F1099GParity.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "social_security_worksheet": {
        "test_files": ["src/forms/Y2025/tests/F1099GParity.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "student_loan_interest_worksheet": {
        "test_files": ["src/forms/Y2025/tests/F1099GParity.test.ts"],
        "expected_years": {"2024", "2025", "2026_forecast"},
    },
    "1099_nec": {
        "test_files": [
            "backend-cloudflare/test/service/taxCalculationService.test.ts"
        ],
        "expected_years": {"2025", "2026_forecast"},
    },
    "form_4137": {
        "test_files": ["src/forms/Y2025/tests/Workbook2025AdditionsParity.test.ts"],
        "expected_years": {"2025", "2026_forecast"},
    },
    "form_8801": {
        "test_files": ["src/forms/Y2025/tests/Workbook2025AdditionsParity.test.ts"],
        "expected_years": {"2025", "2026_forecast"},
    },
    "form_8919": {
        "test_files": ["src/forms/Y2025/tests/Workbook2025AdditionsParity.test.ts"],
        "expected_years": {"2025", "2026_forecast"},
    },
}


def load_json(path: Path) -> object:
    return json.loads(path.read_text())


def parse_json_list_field(raw_value: str) -> list[str]:
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def main() -> int:
    sheet_inventory = load_json(AUDIT_DIR / "sheet_inventory.json")
    assertion_rows: list[dict[str, object]] = []
    failures: list[str] = []

    for logical_area, config in PRIORITY_LOGICAL_AREAS.items():
        matches = [
            row for row in sheet_inventory if row["logical_area"] == logical_area
        ]
        observed_years = {row["workbook_label"] for row in matches}
        missing_years = sorted(config["expected_years"] - observed_years)
        missing_tests = [
            test_file
            for test_file in config["test_files"]
            if not (ROOT / test_file).exists()
        ]
        missing_ustaxes_mappings = [
            row["sheet"]
            for row in matches
            if row["coverage_status"] == "missing_ustaxes_mapping"
        ]
        unmapped_ustaxes_files = [
            row["sheet"]
            for row in matches
            if not parse_json_list_field(row["ustaxes_files"])
        ]

        status = "ok"
        issues: list[str] = []
        if missing_years:
            status = "fail"
            issues.append(f"missing workbook years: {', '.join(missing_years)}")
        if missing_tests:
            status = "fail"
            issues.append(f"missing tests: {', '.join(missing_tests)}")
        if missing_ustaxes_mappings:
            status = "fail"
            issues.append(
                "missing UsTaxes mapping on sheets: "
                + ", ".join(sorted(set(missing_ustaxes_mappings)))
            )
        if unmapped_ustaxes_files:
            status = "fail"
            issues.append(
                "empty UsTaxes file mappings on sheets: "
                + ", ".join(sorted(set(unmapped_ustaxes_files)))
            )

        assertion_rows.append(
            {
                "logical_area": logical_area,
                "status": status,
                "observed_years": sorted(observed_years),
                "sheet_count": len(matches),
                "required_test_files": config["test_files"],
                "missing_tests": missing_tests,
                "issues": issues,
            }
        )
        if issues:
            failures.extend(f"{logical_area}: {issue}" for issue in issues)

    output_path = AUDIT_DIR / "gap_assertions.json"
    output_path.write_text(json.dumps(assertion_rows, indent=2) + "\n")

    if failures:
        print("Workbook gap assertions failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("Workbook gap assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
