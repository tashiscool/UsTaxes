import { FilingStatus } from 'ustaxes/core/data'

/**
 * South Carolina 2025 Tax Parameters
 * South Carolina uses progressive income tax rates (0% to 6.4%)
 * Note: SC is phasing down to a flat 3.99% by 2027
 */
const parameters = {
  // South Carolina tax brackets for 2025
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [3460, 17330],
      rates: [0, 0.03, 0.064]
    },
    [FilingStatus.MFJ]: {
      brackets: [3460, 17330],
      rates: [0, 0.03, 0.064]
    },
    [FilingStatus.MFS]: {
      brackets: [3460, 17330],
      rates: [0, 0.03, 0.064]
    },
    [FilingStatus.HOH]: {
      brackets: [3460, 17330],
      rates: [0, 0.03, 0.064]
    },
    [FilingStatus.W]: {
      brackets: [3460, 17330],
      rates: [0, 0.03, 0.064]
    }
  },

  // Standard deduction (same as federal for SC)
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption
  personalExemption: {
    amount: 2800
  },

  // Dependent exemption
  dependentExemption: 2800,

  // SC Two-Wage Earner Credit (for MFJ)
  twoWageEarnerCredit: {
    percentage: 0.01,
    maxCredit: 420
  },

  // Retirement income deduction (65+)
  retirementDeduction: {
    maxAmount: 10000,
    ageRequirement: 65
  },

  // Child/Dependent Care Credit (7% of federal credit)
  childCareCreditFactor: 0.07
}

export default parameters
