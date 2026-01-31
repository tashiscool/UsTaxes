import { FilingStatus } from 'ustaxes/core/data'

/**
 * Minnesota 2025 Tax Parameters
 * Minnesota uses progressive income tax rates (5.35% to 9.85%)
 */
const parameters = {
  // Minnesota tax brackets for 2025
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [31690, 104090, 183340],
      rates: [0.0535, 0.068, 0.0785, 0.0985]
    },
    [FilingStatus.MFJ]: {
      brackets: [46330, 184040, 321450],
      rates: [0.0535, 0.068, 0.0785, 0.0985]
    },
    [FilingStatus.MFS]: {
      brackets: [23165, 92020, 160725],
      rates: [0.0535, 0.068, 0.0785, 0.0985]
    },
    [FilingStatus.HOH]: {
      brackets: [39010, 156570, 252600],
      rates: [0.0535, 0.068, 0.0785, 0.0985]
    },
    [FilingStatus.W]: {
      brackets: [46330, 184040, 321450],
      rates: [0.0535, 0.068, 0.0785, 0.0985]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 14575,
    [FilingStatus.MFJ]: 29150,
    [FilingStatus.MFS]: 14575,
    [FilingStatus.HOH]: 21850,
    [FilingStatus.W]: 29150
  },

  // Minnesota Working Family Credit (percentage of federal EIC)
  workingFamilyCredit: {
    percentage: 0.34,  // 34% of federal EIC
    maxCredit: 2500
  },

  // K-12 Education Credit
  educationCredit: {
    maxPerChild: 1625,
    incomeLimit: 33500
  },

  // Child and Dependent Care Credit (based on federal)
  childCareCreditPercentage: 1.0,  // 100% of federal credit for low income

  // Social Security subtraction (partial exemption)
  socialSecuritySubtraction: {
    maxSubtraction: 4260,
    incomePhaseOutStart: {
      [FilingStatus.S]: 82190,
      [FilingStatus.MFJ]: 105380,
      [FilingStatus.MFS]: 52690,
      [FilingStatus.HOH]: 82190,
      [FilingStatus.W]: 105380
    }
  }
}

export default parameters
