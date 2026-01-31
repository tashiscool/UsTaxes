import { FilingStatus } from 'ustaxes/core/data'

/**
 * Oklahoma 2025 Tax Parameters
 * Oklahoma uses progressive income tax rates (0.25% to 4.75%)
 * 6 tax brackets
 */
const parameters = {
  // Oklahoma tax brackets for 2025
  // Rates: 0.25%, 0.75%, 1.75%, 2.75%, 3.75%, 4.75%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [1000, 2500, 3750, 4900, 7200],
      rates: [0.0025, 0.0075, 0.0175, 0.0275, 0.0375, 0.0475]
    },
    [FilingStatus.MFJ]: {
      brackets: [2000, 5000, 7500, 9800, 12200],
      rates: [0.0025, 0.0075, 0.0175, 0.0275, 0.0375, 0.0475]
    },
    [FilingStatus.MFS]: {
      brackets: [1000, 2500, 3750, 4900, 7200],
      rates: [0.0025, 0.0075, 0.0175, 0.0275, 0.0375, 0.0475]
    },
    [FilingStatus.HOH]: {
      brackets: [2000, 5000, 7500, 9800, 12200],
      rates: [0.0025, 0.0075, 0.0175, 0.0275, 0.0375, 0.0475]
    },
    [FilingStatus.W]: {
      brackets: [2000, 5000, 7500, 9800, 12200],
      rates: [0.0025, 0.0075, 0.0175, 0.0275, 0.0375, 0.0475]
    }
  },

  // Standard deduction for 2025 (Oklahoma uses federal amounts)
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 1000,
    [FilingStatus.MFJ]: 2000,
    [FilingStatus.MFS]: 1000,
    [FilingStatus.HOH]: 1000,
    [FilingStatus.W]: 2000
  },

  // Dependent exemption
  dependentExemption: 1000,

  // Oklahoma does not tax Social Security benefits

  // Child Tax Credit
  childTaxCredit: 100,

  // Oklahoma Earned Income Credit (percentage of federal EIC)
  eicPercentage: 0.05,

  // Retirement income exclusion (for those 65+)
  retirementExclusion: 10000
}

export default parameters
