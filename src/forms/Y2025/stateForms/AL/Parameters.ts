import { FilingStatus } from 'ustaxes/core/data'

/**
 * Alabama 2025 Tax Parameters
 * Progressive tax rate 2%-5%
 * Federal income tax is deductible
 */
const parameters = {
  // Tax brackets for 2025
  taxBrackets: {
    [FilingStatus.S]: [
      { amount: 500, rate: 0.02 },
      { amount: 2500, rate: 0.04 },
      { amount: Infinity, rate: 0.05 }
    ],
    [FilingStatus.MFJ]: [
      { amount: 1000, rate: 0.02 },
      { amount: 5000, rate: 0.04 },
      { amount: Infinity, rate: 0.05 }
    ],
    [FilingStatus.MFS]: [
      { amount: 500, rate: 0.02 },
      { amount: 2500, rate: 0.04 },
      { amount: Infinity, rate: 0.05 }
    ],
    [FilingStatus.HOH]: [
      { amount: 500, rate: 0.02 },
      { amount: 2500, rate: 0.04 },
      { amount: Infinity, rate: 0.05 }
    ],
    [FilingStatus.W]: [
      { amount: 1000, rate: 0.02 },
      { amount: 5000, rate: 0.04 },
      { amount: Infinity, rate: 0.05 }
    ]
  },

  // Standard deduction
  standardDeduction: {
    [FilingStatus.S]: 2500,
    [FilingStatus.MFJ]: 7500,
    [FilingStatus.MFS]: 3750,
    [FilingStatus.HOH]: 4700,
    [FilingStatus.W]: 7500
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 1500,
    [FilingStatus.MFJ]: 3000,
    [FilingStatus.MFS]: 1500,
    [FilingStatus.HOH]: 3000,
    [FilingStatus.W]: 3000
  },

  // Dependent exemption
  dependentExemption: 1000,

  // Max federal tax deduction
  maxFederalTaxDeduction: Infinity
}

export default parameters
