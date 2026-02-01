# IRS ATS Scenario Test Implementation Guide

This guide provides all the context needed to implement IRS ATS (Assurance Testing System) scenario tests for MeF (Modernized e-File) compliance in UsTaxes.

## Overview

ATS scenarios are official IRS test cases used to validate e-file submissions. Each scenario represents a complete tax return with specific features (forms, schedules, credits, etc.) that must be tested for MeF compliance.

### Location
- **Test files**: `src/tests/ats/scenarios/`
- **Test fixtures**: `src/tests/ats/fixtures/`
- **MeF Service**: `src/efile/mef/`

## Scenarios Implemented

### Form 1040 Series

| Scenario | File | Taxpayer | SSN (ATS) | Filing Status | Key Features |
|----------|------|----------|-----------|---------------|--------------|
| 1 | `scenario1.test.ts` | Tara Black | 400-00-1032 | Single | Multiple W-2s, Schedule H, Form 5695 |
| 2 | `scenario2.test.ts` | John & Judy Jones | 400-00-1038 | MFJ | Deceased spouse, Schedule C (statutory), Schedule A, Form 8283 |
| 3 | `scenario3.test.ts` | Lynette Heather | 400-00-1035 | Single | 1099-R, Schedule F/SE/D/E, Farm income |
| 4 | `scenario4.test.ts` | Sarah Smith | 400-00-1037 | Single | Form 8835 (Solar), Form 8936 (Clean Vehicle), Form 3800 |
| 5 | `scenario5.test.ts` | Bobby Barker | 400-00-1039 | HOH | Blind, 2 dependents, Form 2441, Form 8863, EIC, Form 8862, Schedule 8812 |
| 6 | `scenario6.test.ts` | Juan Torres | 400-00-1041 | 1040-SS | Puerto Rico, Schedule C, Schedule SE |
| 7 | `scenario7.test.ts` | Charlie Boone | 400-00-1042 | Single | Form 4868 Extension only |
| 8 | `scenario8.test.ts` | Carter Lewis | 400-00-1039 | MFS | 1099-R pension/rollover, SSA-1099, Social Security taxation |
| 12 | `scenario12.test.ts` | Sam Gardenia | 400-00-1212 | Single | Schedule C, Schedule SE, Form 7206, Form 7217 |
| 13 | `scenario13.test.ts` | William & Nancy Birch | 400-00-1313 | MFJ | Form 8911 (EV refueling credit), Form 6251 (AMT), Schedule 3 |

**Note:** Scenarios 9, 10, and 11 do not exist - the IRS intentionally skips these numbers.

### Form 1040-NR Series (Nonresident Aliens)

| Scenario | File | Taxpayer | SSN (ATS) | Filing Status | Key Features |
|----------|------|----------|-----------|---------------|--------------|
| NR-1 | `scenarioNR1.test.ts` | Lucas LeBlanc | 123-00-1111 | MFS (1040-NR) | 2 W-2s, Schedule C, Schedule SE (Form 4361), Form 5329, Foreign address |
| NR-2 | `scenarioNR2.test.ts` | Genesis DeSilva | 123-00-3333 | MFS (1040-NR) | Schedule NEC (30% flat tax), Schedule OI, Schedule E (Partnership), Paid preparer |
| NR-3 | `scenarioNR3.test.ts` | Jace Alfaro | 123-00-4444 | Single (1040-NR) | Schedule A (Itemized), Form 8283 (Vehicle donation), Form 8888 (Refund allocation) |
| NR-4 | `scenarioNR4.test.ts` | Isaac Hill | 123-00-5555 | QSS (1040-NR) | W-2, IRA distribution, Form 5329, Form 8835 (Solar), Form 8936 (Clean Vehicle), Form 3800 |
| NR-12 | `scenarioNR12.test.ts` | John Harrier | 123-00-1112 | MFS (1040-NR) | Schedule P (Partnership interest transfer), Schedule D, Form 8949 |

## Test File Structure

Each test file follows this pattern:

```typescript
/**
 * IRS ATS Test Scenario X - [Taxpayer Name]
 *
 * Test Scenario Reference: IRS ATS Test Scenario X
 * Primary Taxpayer: [Name]
 * Filing Status: [Status]
 *
 * Key Features Tested:
 * - [List of forms/schedules/features]
 *
 * Tax Year: 2025
 */

import { FilingStatus, PersonRole } from 'ustaxes/core/data'

// =============================================================================
// Test Data Fixtures
// =============================================================================

const taxpayerData = {
  firstName: '...',
  lastName: '...',
  ssn: '400011XXX', // Valid format for testing (ATS uses 400-00-XXXX)
  address: { ... },
  dateOfBirth: new Date(YYYY, M, D),
}

// =============================================================================
// Tests
// =============================================================================

describe('ATS Scenario X - [Taxpayer Name]', () => {
  describe('Taxpayer Information', () => {
    // Tests for taxpayer data
  })

  describe('Income Sources', () => {
    // Tests for W-2, 1099, etc.
  })

  describe('Tax Calculation', () => {
    // Tests for Form 1040 calculations
  })

  describe('Business Rules', () => {
    // Tests for IRS business rules
  })

  describe('Integration', () => {
    // Tests for complete data flow
  })
})
```

## Key Tax Values for 2025

### Standard Deductions
| Filing Status | Standard | Blind/65+ Additional |
|--------------|----------|---------------------|
| Single | $15,000 | $1,950 |
| MFJ | $30,000 | $1,550 each |
| MFS | $15,000 | $1,550 |
| HOH | $22,500 | $1,950 |

### Tax Brackets (Single/MFS)
- 10%: $0 - $11,600
- 12%: $11,601 - $47,150
- 22%: $47,151 - $100,525
- 24%: $100,526 - $191,950
- 32%: $191,951 - $243,725
- 35%: $243,726 - $609,350
- 37%: $609,351+

### Tax Brackets (HOH)
- 10%: $0 - $16,550
- 12%: $16,551 - $63,100
- 22%: $63,101 - $100,500
- 24%: $100,501 - $191,950

### Self-Employment Tax Rates
- Social Security: 12.4% (on 92.35% of net earnings)
- Medicare: 2.9% (on 92.35% of net earnings)
- Additional Medicare: 0.9% (over $200,000)
- SS Wage Base 2025: $176,100

### Credit Limits
- Child Tax Credit: $2,000 per child
- ACTC: 15% of earned income over $2,500
- Dependent Care: 20-35% of up to $3,000 (1 child) or $6,000 (2+ children)
- EIC (2 children): Max ~$7,012, phaseout starts $22,200

## Filing Status Codes
- 1 = Single
- 2 = Married Filing Jointly
- 3 = Married Filing Separately
- 4 = Head of Household
- 5 = Qualifying Surviving Spouse

## Common Distribution Codes (1099-R Box 7)
- 1 = Early distribution, no exception
- 2 = Early distribution, exception applies
- 7 = Normal distribution
- G = Direct rollover to qualified plan/IRA
- H = Direct rollover from 401(k) to Roth IRA

## SSN Pattern for ATS
- ATS uses `400-00-XXXX` format (invalid for real validation)
- Tests use `400-01-XXXX` format (passes validation logic)

## Running Tests

```bash
# Run all ATS scenario tests
npm test -- src/tests/ats

# Run specific scenario
npm test -- src/tests/ats/scenarios/scenario8.test.ts

# Run with verbose output
npm test -- src/tests/ats --verbose
```

## Tips for New Scenarios

1. **Start with the PDF**: Read the entire scenario document first
2. **Create fixtures bottom-up**: Start with income sources, then forms, finally 1040
3. **Use whole numbers**: IRS rounds to whole dollars except where specified
4. **Test calculations**: Verify line math flows correctly between forms
5. **Check business rules**: MFS can't claim EIC, HOH needs qualifying person, etc.
6. **Include flow tests**: Ensure data flows correctly from source forms to 1040

## Source

- IRS ATS Scenarios: https://www.irs.gov/e-file-providers/tax-year-2025-form-1040-series-and-extensions-modernized-e-file-mef-assurance-testing-system-ats-information
- MeF Program Information: https://www.irs.gov/e-file-providers/modernized-e-file-mef-program-information
