import { FilingStatus } from 'ustaxes/core/data'

/**
 * Oregon 2025 Tax Parameters
 * Oregon uses progressive income tax rates (4.75% to 9.9%)
 * 4 tax brackets
 * Note: Oregon has no sales tax
 */
const parameters = {
  // Oregon tax brackets for 2025
  // Rates: 4.75%, 6.75%, 8.75%, 9.9%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [4300, 10750, 125000],
      rates: [0.0475, 0.0675, 0.0875, 0.099]
    },
    [FilingStatus.MFJ]: {
      brackets: [8600, 21500, 250000],
      rates: [0.0475, 0.0675, 0.0875, 0.099]
    },
    [FilingStatus.MFS]: {
      brackets: [4300, 10750, 125000],
      rates: [0.0475, 0.0675, 0.0875, 0.099]
    },
    [FilingStatus.HOH]: {
      brackets: [8600, 21500, 250000],
      rates: [0.0475, 0.0675, 0.0875, 0.099]
    },
    [FilingStatus.W]: {
      brackets: [8600, 21500, 250000],
      rates: [0.0475, 0.0675, 0.0875, 0.099]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 2745,
    [FilingStatus.MFJ]: 5495,
    [FilingStatus.MFS]: 2745,
    [FilingStatus.HOH]: 4420,
    [FilingStatus.W]: 5495
  },

  // Personal exemption credit
  personalExemptionCredit: {
    [FilingStatus.S]: 236,
    [FilingStatus.MFJ]: 472,
    [FilingStatus.MFS]: 236,
    [FilingStatus.HOH]: 236,
    [FilingStatus.W]: 472
  },

  // Dependent exemption credit
  dependentExemptionCredit: 236,

  // Oregon does not tax Social Security benefits

  // Oregon Earned Income Credit (percentage of federal EIC)
  eicPercentage: 0.12,

  // Oregon Kicker (surplus refund) - set to 0 when not applicable
  kickerPercentage: 0,

  // Working Family Household and Dependent Care Credit
  dependentCareCredit: {
    maxCredit: 600,
    perChild: 300
  },

  // Retirement income credit (for those 62+)
  retirementIncomeCredit: {
    maxCredit: 7500,
    incomeLimit: 22500
  },

  // Federal tax subtraction limit
  federalTaxSubtractionLimit: {
    [FilingStatus.S]: 7500,
    [FilingStatus.MFJ]: 7500,
    [FilingStatus.MFS]: 3750,
    [FilingStatus.HOH]: 7500,
    [FilingStatus.W]: 7500
  }
}

export default parameters
