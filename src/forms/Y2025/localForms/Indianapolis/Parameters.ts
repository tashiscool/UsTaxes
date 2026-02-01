/**
 * Indianapolis/Marion County 2025 Tax Parameters
 *
 * Indianapolis (coextensive with Marion County) imposes a county
 * income tax as part of Indiana's local income tax system.
 *
 * Key features:
 * - Combined county rate of 2.02%
 * - Applies to all Indiana-source income for residents
 * - Based on Indiana adjusted gross income
 * - Collected through Indiana state return
 */
const parameters = {
  // Tax rate for 2025
  // Marion County combined rate
  taxRate: 0.0202, // 2.02%

  // Rate breakdown (informational)
  rateBreakdown: {
    // County option income tax (COIT)
    countyOptionTax: 0.0, // Replaced by CEDIT
    // County economic development income tax (CEDIT)
    ceditRate: 0.0035,
    // County adjusted gross income tax (CAGIT)
    cagitRate: 0.0167,
    // Total
    combinedRate: 0.0202
  },

  // Indiana local income tax structure
  indianaLocalTaxSystem: {
    // County code
    countyCode: '49', // Marion County
    // Tax type
    taxType: 'CAGIT/CEDIT',
    // Collected on IN state return
    collectedWith: 'IT-40',
    // Based on Indiana AGI
    basedOn: 'indiana_adjusted_gross_income'
  },

  // Types of income subject to county tax
  taxableIncome: {
    // Same as Indiana adjusted gross income
    wages: true,
    salaries: true,
    businessIncome: true,
    capitalGains: true,
    interest: true,
    dividends: true,
    retirement: true,
    socialSecurity: false, // Exempt in IN
    unemployment: true
  },

  // Exemptions
  exemptions: {
    // Indiana personal exemptions (reflected in state return)
    personalExemption: 1000,
    dependentExemption: 1500,
    // Age 65+ additional exemption
    seniorExemption: 1000,
    // Blind exemption
    blindExemption: 1000
  },

  // Credits
  credits: {
    // Indiana provides unified tax credit
    unifiedTaxCredit: {
      single: 1000,
      joint: 2000
    },
    // Earned income credit
    earnedIncomeCredit: {
      statePercentage: 0.1, // 10% of federal EITC
      refundable: true
    },
    // Credit for taxes paid to other IN counties
    otherCountyCredit: {
      available: false, // No credit - you pay based on residence
      maxCreditRate: 0
    }
  },

  // Withholding
  withholding: {
    // Employers withhold county tax
    employerWithholdingRequired: true,
    // Based on Form WH-4
    stateWithholdingForm: 'WH-4',
    // County tax included in state withholding
    combinedWithStateWithholding: true
  },

  // Form information
  formInfo: {
    // County tax calculated on IN Form IT-40
    formNumber: 'IT-40',
    formName: 'Indiana Individual Income Tax Return',
    // County schedule
    countySchedule: 'Schedule CT-40',
    filingDeadline: 'April 15',
    extensionDeadline: 'October 15'
  },

  // Administration
  administration: {
    // Indiana Department of Revenue handles collection
    collectingAgency: 'Indiana Department of Revenue',
    // Distributed to Marion County
    distributedTo: 'Marion County',
    // Electronic filing available
    electronicFilingAvailable: true
  },

  // Special provisions
  specialProvisions: {
    // Non-resident - no county tax unless IN source income
    nonResidentRules: 'indiana_source_only',
    // Part-year resident proration
    partYearProration: true,
    // Military exemption
    militaryExempt: true,
    // Reciprocity states (residents of these states exempt from IN withholding)
    reciprocityStates: ['KY', 'MI', 'OH', 'PA', 'WI']
  },

  // Neighboring counties for reference
  neighboringCounties: {
    Hamilton: { rate: 0.01, north: true },
    Hendricks: { rate: 0.0175, west: true },
    Johnson: { rate: 0.0125, south: true },
    Morgan: { rate: 0.0252, southwest: true },
    Hancock: { rate: 0.015, east: true },
    Shelby: { rate: 0.0125, southeast: true },
    Boone: { rate: 0.015, northwest: true }
  }
}

export default parameters
