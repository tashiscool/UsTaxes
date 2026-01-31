import { FilingStatus } from 'ustaxes/core/data'

/**
 * Wisconsin 2025 Tax Parameters
 * Wisconsin uses progressive income tax rates (3.54% to 7.65%)
 */
const parameters = {
  // Wisconsin tax brackets for 2025
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [14320, 28640, 315310],
      rates: [0.0354, 0.0465, 0.0530, 0.0765]
    },
    [FilingStatus.MFJ]: {
      brackets: [19090, 38190, 420420],
      rates: [0.0354, 0.0465, 0.0530, 0.0765]
    },
    [FilingStatus.MFS]: {
      brackets: [9550, 19095, 210210],
      rates: [0.0354, 0.0465, 0.0530, 0.0765]
    },
    [FilingStatus.HOH]: {
      brackets: [14320, 28640, 315310],
      rates: [0.0354, 0.0465, 0.0530, 0.0765]
    },
    [FilingStatus.W]: {
      brackets: [19090, 38190, 420420],
      rates: [0.0354, 0.0465, 0.0530, 0.0765]
    }
  },

  // Standard deduction (Wisconsin uses its own amounts)
  standardDeduction: {
    [FilingStatus.S]: 12760,
    [FilingStatus.MFJ]: 23620,
    [FilingStatus.MFS]: 11090,
    [FilingStatus.HOH]: 16120,
    [FilingStatus.W]: 23620
  },

  // Standard deduction phase-out (reduced at higher incomes)
  standardDeductionPhaseOut: {
    startAgi: {
      [FilingStatus.S]: 18850,
      [FilingStatus.MFJ]: 28580,
      [FilingStatus.MFS]: 14290,
      [FilingStatus.HOH]: 18850,
      [FilingStatus.W]: 28580
    },
    reductionRate: 0.12  // Deduction reduced by 12% of AGI over threshold
  },

  // Personal exemption (Wisconsin eliminated personal exemptions)
  personalExemption: 0,

  // Wisconsin Earned Income Credit (percentage of federal)
  earnedIncomeCredit: {
    oneChild: 0.04,
    twoChildren: 0.11,
    threeOrMoreChildren: 0.34
  },

  // Homestead Credit (for low-income homeowners/renters)
  homesteadCredit: {
    maxCredit: 1168,
    incomeLimit: 24680
  },

  // School property tax credit
  schoolPropertyTaxCredit: {
    maxCredit: 1168
  },

  // Child/Dependent Care Credit (50% of federal credit)
  childCareCreditFactor: 0.50,

  // Retirement income deduction (limited)
  retirementSubtraction: {
    maxAmount: 5000
  }
}

export default parameters
