/**
 * IRS ATS (Assurance Testing System) Scenario Tests
 *
 * This module exports ATS test scenarios for MeF (Modernized e-File) compliance testing.
 * These scenarios are based on official IRS test cases for Tax Year 2025.
 *
 * Form 1040 Series Scenarios:
 * - Scenario 1: Tara Black (Single, Multiple W-2s, Schedule H, Form 5695)
 * - Scenario 2: John & Judy Jones (MFJ, Deceased spouse, Schedule C, Schedule A, Form 8283)
 * - Scenario 3: Lynette Heather (Single, 1099-R, Schedule F/SE/D/E, Farm income)
 * - Scenario 4: Sarah Smith (Single, Form 8835 Solar, Form 8936 Clean Vehicle, Form 3800)
 * - Scenario 5: Bobby Barker (HOH, Blind, 2 dependents, Form 2441, Form 8863, EIC)
 * - Scenario 6: Juan Torres (1040-SS, Puerto Rico, Schedule C, Schedule SE)
 * - Scenario 7: Charlie Boone (Single, Form 4868 Extension only)
 * - Scenario 8: Carter Lewis (MFS, 1099-R pension/rollover, SSA-1099)
 * - Scenarios 9, 10, 11: DO NOT EXIST (IRS skips these numbers)
 * - Scenario 12: Sam Gardenia (Single, Schedule C, Schedule SE, Form 7206, Form 7217)
 * - Scenario 13: William & Nancy Birch (MFJ, Form 8911, Form 6251 AMT, Schedule 3)
 *
 * Form 1040-NR Series Scenarios (Nonresident Aliens):
 * - Scenario NR-1: Lucas LeBlanc (MFS, 2 W-2s, Schedule C, Schedule SE Form 4361, Form 5329)
 * - Scenario NR-2: Genesis DeSilva (MFS, Schedule NEC 30% tax, Schedule OI, Schedule E Partnership)
 * - Scenario NR-3: Jace Alfaro (Single, Schedule A Itemized, Form 8283, Form 8888)
 * - Scenario NR-4: Isaac Hill (QSS, W-2, IRA, Form 5329, Form 8835 Solar, Form 8936, Form 3800)
 * - Scenario NR-12: John Harrier (MFS, Schedule P Partnership transfer, Schedule D, Form 8949)
 *
 * @see https://www.irs.gov/e-file-providers/tax-year-2025-form-1040-series-and-extensions-modernized-e-file-mef-assurance-testing-system-ats-information
 */

// Export scenario data types
export interface ATSTaxpayer {
  firstName: string
  lastName: string
  ssn: string
  ssnAtsReference: string
  address: {
    street?: string
    address?: string
    city: string
    state: string
    zip: string
  }
  foreignAddress?: {
    country: string
    province?: string
    postalCode: string
  }
  dateOfBirth: Date
  occupation: string
  digitalAssets: boolean
  isNonresidentAlien?: boolean
}

export interface ATSW2 {
  employeeName: string
  employeeSsn: string
  employerName: string
  employerEin: string
  employerAddress: {
    street: string
    city: string
    state: string
    zip: string
  }
  box1Wages: number
  box2FederalWithholding: number
  box3SsWages: number
  box4SsTax: number
  box5MedicareWages: number
  box6MedicareTax: number
  box15State: string
  box16StateWages: number
  box17StateTax: number
}

export interface ATS1099R {
  payerName: string
  payerTin: string
  box1GrossDistribution: number
  box2aTaxableAmount: number
  box4FederalWithholding: number
  box7DistributionCode: string
  isIra: boolean
  isRollover?: boolean
}

export interface ATSSSA1099 {
  recipientName: string
  recipientSsn: string
  box3BenefitsPaid: number
  box5NetBenefits: number
  box6FederalWithholding: number
}

export interface ATSScheduleC {
  principalBusiness: string
  businessCode: string
  line1GrossReceipts: number
  line28TotalExpenses: number
  line31NetProfit: number
  accountingMethod: 'cash' | 'accrual'
}

export interface ATSScheduleNEC {
  otherIncomeType: string
  otherIncomeAmount: number
  total30pct: number
  tax30pct: number
  line15TotalNecTax: number
}

export interface ATSForm1040Data {
  primarySsn: string
  primaryFirstName: string
  primaryLastName: string
  filingStatus: number
  totalIncome: number
  agi: number
  taxableIncome: number
  totalTax: number
  totalPayments: number
  refund: number
  amountOwed: number
}

export interface ATSForm1040NRData extends ATSForm1040Data {
  formType: '1040-NR'
  isNonresidentAlien: true
  line23aNecTax?: number
}

// Tax Year 2025 Constants
export const TAX_YEAR_2025 = {
  standardDeduction: {
    single: 15000,
    mfj: 30000,
    mfs: 15000,
    hoh: 22500,
    qss: 30000
  },
  additionalDeduction: {
    blindOrOver65Single: 1950,
    blindOrOver65Married: 1550
  },
  taxBrackets: {
    singleMfs: [
      { threshold: 11600, rate: 0.1 },
      { threshold: 47150, rate: 0.12 },
      { threshold: 100525, rate: 0.22 },
      { threshold: 191950, rate: 0.24 },
      { threshold: 243725, rate: 0.32 },
      { threshold: 609350, rate: 0.35 },
      { threshold: Infinity, rate: 0.37 }
    ],
    hoh: [
      { threshold: 16550, rate: 0.1 },
      { threshold: 63100, rate: 0.12 },
      { threshold: 100500, rate: 0.22 },
      { threshold: 191950, rate: 0.24 },
      { threshold: 243725, rate: 0.32 },
      { threshold: 609350, rate: 0.35 },
      { threshold: Infinity, rate: 0.37 }
    ]
  },
  ssWageBase: 176100,
  ssTaxRate: 0.062,
  medicareTaxRate: 0.0145,
  additionalMedicareTaxRate: 0.009,
  additionalMedicareThreshold: 200000,
  selfEmploymentTaxRate: {
    socialSecurity: 0.124,
    medicare: 0.029,
    netEarningsMultiplier: 0.9235
  },
  necTaxRates: {
    rate10pct: 0.1,
    rate15pct: 0.15,
    rate30pct: 0.3
  },
  rmdPenaltyRate: 0.25 // SECURE 2.0 Act reduced rate
}

// Helper function to calculate tax
export function calculateTax(
  taxableIncome: number,
  filingStatus: 'single' | 'mfs' | 'hoh' | 'mfj' | 'qss'
): number {
  const brackets =
    filingStatus === 'hoh'
      ? TAX_YEAR_2025.taxBrackets.hoh
      : TAX_YEAR_2025.taxBrackets.singleMfs

  let tax = 0
  let previousThreshold = 0

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.threshold) {
      tax += (taxableIncome - previousThreshold) * bracket.rate
      break
    } else {
      tax += (bracket.threshold - previousThreshold) * bracket.rate
      previousThreshold = bracket.threshold
    }
  }

  return Math.round(tax)
}

// Helper function to calculate Social Security taxable amount
export function calculateTaxableSocialSecurity(
  totalBenefits: number,
  otherIncome: number,
  filingStatus: 'single' | 'mfs' | 'hoh' | 'mfj',
  livedWithSpouse = false
): number {
  const halfBenefits = totalBenefits / 2
  const provisionalIncome = halfBenefits + otherIncome

  // MFS living with spouse: 85% taxable if any provisional income
  if (filingStatus === 'mfs' && livedWithSpouse) {
    return provisionalIncome > 0 ? totalBenefits * 0.85 : 0
  }

  // Base amounts for other filing statuses
  const baseAmount = filingStatus === 'mfj' ? 32000 : 25000
  const additionalAmount = filingStatus === 'mfj' ? 44000 : 34000

  if (provisionalIncome <= baseAmount) {
    return 0
  } else if (provisionalIncome <= additionalAmount) {
    return Math.min(halfBenefits, (provisionalIncome - baseAmount) * 0.5)
  } else {
    const amount1 = Math.min(
      halfBenefits,
      (additionalAmount - baseAmount) * 0.5
    )
    const amount2 = (provisionalIncome - additionalAmount) * 0.85
    return Math.min(totalBenefits * 0.85, amount1 + amount2)
  }
}

/**
 * ATS Test Modules:
 *
 * 1. Integration Tests (./integration/)
 *    - atsIntegration.test.ts: Full calculation engine tests against ATS scenarios
 *
 * 2. Scenario Tests (./scenarios/)
 *    - Individual scenario data files (scenario1.test.ts, etc.)
 *
 * 3. XML Serialization Tests (./xml/)
 *    - xmlSerialization.test.ts: Tests XML generation for ATS scenarios
 *    - schemaValidation.test.ts: Tests XML against IRS MeF schemas
 *
 * 4. Business Entity Tests (./business/)
 *    - partnership.test.ts: Form 1065 (Partnership) ATS scenarios
 *    - scorp.test.ts: Form 1120-S (S Corporation) ATS scenarios
 *    - ccorp.test.ts: Form 1120 (C Corporation) ATS scenarios
 *
 * 5. End-to-End Tests (./e2e/)
 *    - atsSubmission.test.ts: Simulated e-file submission workflow
 *
 * 6. State E-File Tests (./state/)
 *    - stateEfile.test.ts: State tax return calculations and e-file
 */

// Re-export utility functions from integration module
export {
  atsScenarioToInformation,
  compareResults
} from './utils/scenarioToInformation'
export type {
  ATSScenarioInput,
  ATSExpectedOutput
} from './utils/scenarioToInformation'
