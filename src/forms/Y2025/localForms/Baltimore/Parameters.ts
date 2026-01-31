/**
 * Baltimore 2025 City Tax Parameters
 *
 * Baltimore City imposes a local income tax in addition to Maryland state tax.
 * The Baltimore City tax is part of the Maryland local income tax system.
 *
 * Key features:
 * - Residents pay 3.2% local income tax
 * - Non-residents who work in Baltimore pay a reduced rate
 * - Tax is calculated on Maryland taxable income
 * - Collected through Maryland state return
 */
const parameters = {
  // Tax rates for 2025
  taxRates: {
    // Baltimore City resident rate - highest in Maryland
    resident: 0.032, // 3.2%
    // Non-resident rate for those who work in Baltimore
    nonResident: 0.0175 // 1.75%
  },

  // Maryland local income tax structure
  // Baltimore is part of the Maryland local income tax system
  marylandLocalTaxSystem: {
    // Local tax is calculated on Maryland taxable income
    basedOn: 'maryland_taxable_income',
    // Collected on MD state return, remitted to localities
    collectedWith: 'MD_502',
    // Baltimore City code
    countyCode: '03', // Baltimore City is considered a "county" for tax purposes
    subdivisionCode: 'BC'
  },

  // Types of income subject to Baltimore tax
  taxableIncome: {
    // Same as Maryland taxable income
    wages: true,
    salaries: true,
    businessIncome: true,
    capitalGains: true,
    interest: true,
    dividends: true,
    retirement: true, // Partially taxable
    socialSecurity: false, // Exempt in MD
    unemployment: true
  },

  // Exemptions and adjustments
  exemptions: {
    // Standard deduction (follows Maryland)
    standardDeduction: {
      single: 2550,
      marriedFilingJointly: 5100,
      marriedFilingSeparately: 2550,
      headOfHousehold: 2550
    },
    // Personal exemption (follows Maryland)
    personalExemption: {
      baseAmount: 3200,
      incomeThreshold: 100000,
      phaseoutRate: 0.05
    },
    // Military income partially exempt
    militaryExempt: true
  },

  // Credits
  credits: {
    // Maryland provides earned income credit
    earnedIncomeCredit: {
      statePercentage: 0.45, // 45% of federal EITC
      refundablePercentage: 0.50 // 50% is refundable
    },
    // Poverty level credit
    povertyLevelCredit: {
      incomeThreshold: 16000,
      creditAmount: 0
    },
    // Credit for taxes paid to other localities
    otherLocalityCredit: {
      available: true,
      maxCreditRate: 0.032 // Limited to Baltimore rate
    }
  },

  // Withholding
  withholding: {
    // Employers withhold based on Form MW507
    employerWithholdingRequired: true,
    // Combined with Maryland state withholding
    combinedWithStateWithholding: true,
    // Local tax shown separately on W-2 Box 19
    separateW2Reporting: true
  },

  // Form information
  formInfo: {
    // Local tax calculated on MD Form 502
    formNumber: 'MD-502',
    formName: 'Maryland Resident Income Tax Return',
    nonResidentForm: 'MD-505',
    // Baltimore-specific schedule
    localTaxSchedule: 'Schedule 502SU'
  },

  // Administration
  administration: {
    // Comptroller of Maryland handles collection
    collectingAgency: 'Comptroller of Maryland',
    // Remitted to Baltimore City
    distributedTo: 'Baltimore City',
    // Electronic filing available through Maryland
    electronicFilingAvailable: true
  },

  // Special provisions
  specialProvisions: {
    // Part-year resident allocation required
    partYearAllocation: true,
    // Non-resident allocation based on MD income
    nonResidentAllocation: 'maryland_source_income',
    // Reciprocity with DC, PA, VA, WV
    reciprocityStates: ['DC', 'PA', 'VA', 'WV']
  }
}

export default parameters
