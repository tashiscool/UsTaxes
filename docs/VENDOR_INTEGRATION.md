# Vendor Integration Guide

## Overview

UsTaxes integrates with several vendor repositories for tax logic, regulations, and test data. This document describes how to use these resources.

## Directory Structure

```
~/IdeaProjects/taxes/
├── UsTaxes/                    # Main application (this repo)
├── direct-file-easy-webui/     # Direct File web interface
└── vendor/
    ├── direct-file/            # IRS Direct File (Essential)
    ├── ecfr/                   # Treasury Regulations (Essential)
    ├── Tax-Calculator/         # PSL Tax Calculator (Essential)
    └── nice-to-have/
        ├── habutax/            # Form dependency graphs
        ├── uscode/             # IRC parser
        └── IRS-Form-Scraper/   # PDF scraper
```

---

## 1. IRS Direct File (`vendor/direct-file/`)

### What It Contains

- **Fact Graph Engine**: Scala-based tax calculation logic
- **Form Logic**: Business rules for tax forms
- **State API**: State tax integrations
- **Test Data**: Fact graph JSON files with test scenarios

### Key Directories

```
direct-file/direct-file/
├── fact-graph-scala/      # Core tax calculation engine
├── backend/               # Java Spring Boot backend
│   └── src/test/         # Test resources
├── df-client/            # React frontend
└── docs/testing/         # Test fact graphs
    └── fact-graphs/      # JSON test scenarios
```

### Test Data Format (Fact Graph JSON)

```json
{
  "/filers/#uuid/firstName": { "$type": "StringWrapper", "item": "Lisa" },
  "/filers/#uuid/lastName": { "$type": "StringWrapper", "item": "Simpson" },
  "/filers/#uuid/tin": {
    "$type": "TinWrapper",
    "item": { "area": "123", "group": "00", "serial": "4592" }
  },
  "/filingStatus": {
    "$type": "EnumWrapper",
    "item": { "value": ["marriedFilingJointly"] }
  },
  "/address": {
    "$type": "AddressWrapper",
    "item": {
      "streetAddress": "123 Sesame St",
      "city": "Springfield",
      "postalCode": "37172",
      "stateOrProvence": "TN"
    }
  }
}
```

### Integration Points

1. **Tax Logic**: Port Scala fact graph logic to TypeScript
2. **Business Rules**: Extract validation rules for e-file
3. **Test Scenarios**: Use fact graphs for integration tests

### Usage in UsTaxes

```typescript
// Import fact graph test data
import { parseFactGraph } from '@/tests/utils/factGraphParser'

const testCase = parseFactGraph(
  'vendor/direct-file/docs/testing/fact-graphs/mfj_1940_TN.json'
)
// Convert to UsTaxes format and run tests
```

---

## 2. PSL Tax-Calculator (`vendor/Tax-Calculator/`)

### What It Contains

- **Policy Parameters**: Tax rates, brackets, limits for all years
- **Calculation Functions**: Python tax computation
- **Test Data**: CPS/PUF-based test scenarios

### Key Files

```
Tax-Calculator/taxcalc/
├── policy_current_law.json    # Tax law parameters
├── calcfunctions.py           # Calculation implementations
├── records_variables.json     # Variable definitions
├── tests/                     # Test cases
│   ├── reforms.json          # Policy reform scenarios
│   └── *_expect.csv          # Expected results
└── reforms/                   # Historical policy changes
```

### Policy Parameters Format

```json
{
  "II_brk1": {
    "title": "First income tax bracket top",
    "description": "Top of first bracket for ordinary income",
    "section_1": "Individual Income",
    "section_2": "Tax Brackets",
    "value": [
      {
        "year": 2024,
        "SINGLE": 11600,
        "JOINT": 23200,
        "SEPARATE": 11600,
        "HEADHOUSEHOLD": 16550,
        "WIDOW": 23200
      },
      {
        "year": 2025,
        "SINGLE": 11925,
        "JOINT": 23850,
        "SEPARATE": 11925,
        "HEADHOUSEHOLD": 17000,
        "WIDOW": 23850
      }
    ]
  }
}
```

### Integration Points

1. **Tax Parameters**: Import brackets, rates, limits
2. **Validation**: Cross-check calculations
3. **Policy Changes**: Track law changes over years

### Usage in UsTaxes

```typescript
// src/forms/Y2025/data/federal.ts
import { loadTaxCalculatorPolicy } from '@/core/vendor/taxCalculator'

const params = loadTaxCalculatorPolicy(2025)
export const TAX_BRACKETS = params.II_brk // Tax brackets
export const STANDARD_DEDUCTION = params.STD // Standard deduction
```

---

## 3. eCFR - Treasury Regulations (`vendor/ecfr/`)

### What It Contains

- **26 CFR**: Internal Revenue Code regulations
- **Treasury Interpretations**: Official guidance

### Key Files

```
ecfr/cfr/
├── title-26/          # Tax regulations
│   ├── chapter-I/     # IRS regulations
│   └── parts/         # Specific sections
└── README.md
```

### Integration Points

1. **Legal Citations**: Reference in tax explanations
2. **Rule Validation**: Verify business rules

---

## 4. Habutax (`vendor/nice-to-have/habutax/`)

### What It Contains

- **Form Dependencies**: Which forms trigger others
- **Field Mappings**: Form field relationships
- **Test Fixtures**: Complete tax return scenarios

### Key Files

```
habutax/
├── habutax/
│   └── forms/         # Form definitions
├── tests/
│   ├── ty2023/
│   │   └── fixtures/  # .habutax test files
│   └── test_*.py
└── scripts/
```

### Test Data Format (.habutax)

```ini
[1040]
filing_status = Single
last_name = Smith
occupation = Teacher
number_w-2 = 1

[w-2:0]
box_1 = 100000.0
box_2 = 16551.90
box_3 = 67961.83
box_15 = NC
box_16 = 100000.0
```

### Integration Points

1. **Form Dependencies**: Build form dependency graph
2. **Test Scenarios**: Import as integration tests
3. **Field Validation**: Cross-reference field types

---

## 5. Test Data Sources

### IRS ATS (Assurance Testing System)

Official MeF test scenarios with fake taxpayer data.

| Form | URL                                                                         |
| ---- | --------------------------------------------------------------------------- |
| 1040 | https://www.irs.gov/e-file-providers/tax-year-2024-form-1040-series-mef-ats |
| 1120 | https://www.irs.gov/e-file-providers/tax-year-2024-form-1120-mef-ats        |
| 990  | https://www.irs.gov/e-file-providers/ty2024-exempt-organizations-mef-ats    |

**Test SSN Format**: Must have `"00"` as 4th and 5th digits (e.g., `123-00-4567`)

### VITA Training (Publication 6744)

```
https://www.irs.gov/pub/irs-pdf/f6744.pdf  # Test scenarios
https://www.irs.gov/pub/irs-pdf/p4491.pdf  # Training guide
```

### Direct File Fact Graphs

```
vendor/direct-file/docs/testing/fact-graphs/
├── mfj_1940_TN.json                    # MFJ Tennessee
├── QSS-1995-MA.json                    # Qualifying surviving spouse
├── HOH_unmarried_claimed_dependent.json # Head of household
└── fg-baseline-start-credits-*.json    # Credit scenarios
```

---

## Integration Scripts

### 1. Parse Direct File Fact Graphs

```typescript
// src/tests/utils/factGraphParser.ts
import { Information } from '@/core/data'

interface FactGraphValue {
  $type: string
  item: unknown
}

export function parseFactGraph(
  json: Record<string, FactGraphValue>
): Partial<Information> {
  const info: Partial<Information> = {}

  for (const [path, value] of Object.entries(json)) {
    if (path.includes('/firstName')) {
      // Extract primary person first name
    }
    if (path.includes('/tin')) {
      // Extract SSN
    }
    // ... more mappings
  }

  return info
}
```

### 2. Parse Habutax Fixtures

```typescript
// src/tests/utils/habutaxParser.ts
import { Information, IncomeW2 } from '@/core/data'
import * as ini from 'ini'

export function parseHabutax(content: string): Partial<Information> {
  const parsed = ini.parse(content)
  const info: Partial<Information> = {}

  // Parse [1040] section
  if (parsed['1040']) {
    info.taxPayer = {
      filingStatus: mapFilingStatus(parsed['1040'].filing_status),
      primaryPerson: {
        firstName: parsed['1040'].first_name,
        lastName: parsed['1040'].last_name
        // ...
      }
    }
  }

  // Parse [w-2:N] sections
  info.w2s = []
  for (let i = 0; parsed[`w-2:${i}`]; i++) {
    const w2 = parsed[`w-2:${i}`]
    info.w2s.push({
      income: w2.box_1,
      fedWithholding: w2.box_2
      // ...
    })
  }

  return info
}
```

### 3. Import Tax-Calculator Parameters

```typescript
// src/core/vendor/taxCalculator.ts
import policy from 'vendor/Tax-Calculator/taxcalc/policy_current_law.json'

export function getTaxBrackets(year: number, filingStatus: FilingStatus) {
  const statusMap = {
    [FilingStatus.S]: 'SINGLE',
    [FilingStatus.MFJ]: 'JOINT',
    [FilingStatus.MFS]: 'SEPARATE',
    [FilingStatus.HOH]: 'HEADHOUSEHOLD',
    [FilingStatus.W]: 'WIDOW'
  }

  const brackets = []
  for (let i = 1; i <= 7; i++) {
    const param = policy[`II_brk${i}`]
    const yearData = param.value.find((v) => v.year === year)
    if (yearData) {
      brackets.push(yearData[statusMap[filingStatus]])
    }
  }

  return brackets
}
```

---

## Test Data Directory Structure

Create this structure in UsTaxes:

```
src/tests/
├── fixtures/
│   ├── direct-file/           # Converted fact graphs
│   │   ├── mfj-tennessee.json
│   │   ├── single-california.json
│   │   └── hoh-massachusetts.json
│   ├── habutax/               # Converted habutax fixtures
│   │   ├── simple-w2.json
│   │   ├── itemized-deductions.json
│   │   └── self-employment.json
│   ├── ats-scenarios/         # IRS ATS test cases
│   │   ├── 1040-scenario-1.json
│   │   └── 1040-scenario-2.json
│   └── synthetic/             # Generated test data
│       ├── edge-cases/
│       └── stress-tests/
├── utils/
│   ├── factGraphParser.ts
│   ├── habutaxParser.ts
│   └── testDataGenerator.ts
└── integration/
    ├── directFileTests.ts
    └── taxCalculatorTests.ts
```

---

## Running Integration Tests

```bash
# Run tests against direct-file scenarios
npm run test:integration -- --grep "direct-file"

# Run tests against habutax fixtures
npm run test:integration -- --grep "habutax"

# Validate against Tax-Calculator
npm run test:validation
```

---

## Keeping Vendor Repos Updated

```bash
# Update all vendor repos
cd ~/IdeaProjects/taxes/vendor

# Direct File
cd direct-file && git pull origin main && cd ..

# Tax-Calculator
cd Tax-Calculator && git pull origin master && cd ..

# eCFR
cd ecfr && git pull origin main && cd ..

# Habutax
cd nice-to-have/habutax && git pull origin main && cd ../..
```

---

## Next Steps

1. [ ] Create fact graph parser for Direct File JSON
2. [ ] Create habutax INI parser
3. [ ] Import Tax-Calculator policy parameters
4. [ ] Set up integration test suite
5. [ ] Download and parse IRS ATS scenarios
6. [ ] Create synthetic test data generator

---

_Last Updated: January 2025_
