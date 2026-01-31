import { FilingStatus } from 'ustaxes/core/data'

/**
 * Iowa 2025 Tax Parameters
 * Iowa simplified to 4 brackets in 2025: 4.4%, 4.82%, 5.7%, 5.7%
 * Iowa continues phased reduction toward flat 3.9% by 2026
 */
const parameters = {
  // Iowa tax brackets for 2025
  // Simplified 4 bracket system: 4.4%, 4.82%, 5.7%, 5.7%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [6210, 31050, 62100],
      rates: [0.044, 0.0482, 0.057, 0.057]
    },
    [FilingStatus.MFJ]: {
      brackets: [12420, 62100, 124200],
      rates: [0.044, 0.0482, 0.057, 0.057]
    },
    [FilingStatus.MFS]: {
      brackets: [6210, 31050, 62100],
      rates: [0.044, 0.0482, 0.057, 0.057]
    },
    [FilingStatus.HOH]: {
      brackets: [12420, 62100, 124200],
      rates: [0.044, 0.0482, 0.057, 0.057]
    },
    [FilingStatus.W]: {
      brackets: [12420, 62100, 124200],
      rates: [0.044, 0.0482, 0.057, 0.057]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 2210,
    [FilingStatus.MFJ]: 5450,
    [FilingStatus.MFS]: 2210,
    [FilingStatus.HOH]: 5450,
    [FilingStatus.W]: 5450
  },

  // Personal exemption credit
  personalExemptionCredit: {
    [FilingStatus.S]: 40,
    [FilingStatus.MFJ]: 80,
    [FilingStatus.MFS]: 40,
    [FilingStatus.HOH]: 40,
    [FilingStatus.W]: 80
  },

  // Dependent exemption credit (per dependent)
  dependentExemptionCredit: 40,

  // Iowa does not fully tax Social Security
  // Federal taxable SS is taxed at state level, but Iowa is phasing out SS tax
  socialSecurityExclusion: 1.0, // 100% exclusion for 2025

  // Iowa allows federal tax deduction (limited)
  federalTaxDeductionLimit: 0, // Phased out in 2023

  // Child and Dependent Care Credit (as % of federal credit)
  childDependentCareRate: 0.75,

  // Earned Income Credit (as % of federal)
  earnedIncomeCreditRate: 0.15
}

export default parameters
