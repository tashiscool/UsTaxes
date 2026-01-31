import { FilingStatus } from 'ustaxes/core/data'

/**
 * Virginia 2025 Tax Parameters
 * Virginia uses progressive income tax rates (2% to 5.75%)
 * Form 760 - Resident Individual Income Tax Return
 *
 * Note: Virginia also has local taxes (BPOL, local income tax in some areas)
 * that are not calculated here as they vary by locality.
 */
const parameters = {
  // Virginia tax brackets for 2025
  // Rates: 2%, 3%, 5%, 5.75%
  // Same brackets for all filing statuses
  taxBrackets: {
    brackets: [3000, 5000, 17000],
    rates: [0.02, 0.03, 0.05, 0.0575]
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 8000,
    [FilingStatus.MFJ]: 16000,
    [FilingStatus.MFS]: 8000,
    [FilingStatus.HOH]: 8000,
    [FilingStatus.W]: 16000
  },

  // Personal exemption for 2025 ($930 per person)
  personalExemption: 930,

  // Dependent exemption ($930 per dependent)
  dependentExemption: 930,

  // Age deduction for taxpayers 65 and older
  // Full deduction if AGI <= threshold, phases out above
  ageDeduction: {
    // Birth year determines eligibility (born before Jan 2, 1960 for 2025)
    maxDeduction: {
      [FilingStatus.S]: 12000,
      [FilingStatus.MFJ]: 12000, // Per qualifying person
      [FilingStatus.MFS]: 12000,
      [FilingStatus.HOH]: 12000,
      [FilingStatus.W]: 12000
    },
    // AGI threshold for full deduction
    incomeThreshold: {
      [FilingStatus.S]: 50000,
      [FilingStatus.MFJ]: 75000,
      [FilingStatus.MFS]: 37500,
      [FilingStatus.HOH]: 50000,
      [FilingStatus.W]: 75000
    },
    // Deduction reduced $1 for every $1 over threshold
    phaseOutRate: 1.0
  },

  // Virginia Earned Income Credit (20% of federal EIC for 2025)
  // Refundable
  earnedIncomeCreditFactor: 0.20,

  // Low Income Individuals Credit
  // $300 for single/$600 for MFJ if FAGI <= threshold
  lowIncomeCredit: {
    [FilingStatus.S]: 300,
    [FilingStatus.MFJ]: 600,
    [FilingStatus.MFS]: 300,
    [FilingStatus.HOH]: 300,
    [FilingStatus.W]: 600
  },
  lowIncomeCreditThreshold: {
    [FilingStatus.S]: 11950,
    [FilingStatus.MFJ]: 23900,
    [FilingStatus.MFS]: 11950,
    [FilingStatus.HOH]: 11950,
    [FilingStatus.W]: 23900
  },

  // Spouse Tax Adjustment (for MFS when both have income)
  spouseTaxAdjustmentMax: 259,

  // Credit for taxes paid to other states (limited to VA tax on that income)

  // Virginia 529 Plan deduction (per account)
  plan529DeductionMax: 4000,

  // Military basic pay subtraction (deduct from FAGI)
  // Up to $15,000 for active duty
  militaryPaySubtraction: 15000,

  // Social Security subtraction
  // Virginia allows subtraction of taxable SS benefits based on age/income
  socialSecuritySubtraction: {
    // Full subtraction allowed for 65+ with income below threshold
    incomeThreshold: {
      [FilingStatus.S]: 75000,
      [FilingStatus.MFJ]: 75000,
      [FilingStatus.MFS]: 37500,
      [FilingStatus.HOH]: 75000,
      [FilingStatus.W]: 75000
    }
  },

  // Elective Pass-Through Entity Tax (PTET)
  // Entity pays tax, owners receive refundable credit
  // Extended to January 1, 2027
  ptetEnabled: true,

  // Local income tax note
  // Some VA localities (like Fairfax) have additional local income taxes
  localTaxNote: 'Some VA localities impose additional local income tax - not calculated here'
}

export default parameters
