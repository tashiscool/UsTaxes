import { FilingStatus } from 'ustaxes/core/data'

/**
 * Idaho 2025 Tax Parameters
 * Idaho moved to a flat 5.695% income tax rate in 2023
 */
const parameters = {
  // Idaho flat tax rate (5.695% for 2025)
  taxRate: 0.05695,

  // Standard deduction for 2025
  // Idaho conforms to federal standard deduction
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption credit
  personalExemptionCredit: {
    [FilingStatus.S]: 69,
    [FilingStatus.MFJ]: 138,
    [FilingStatus.MFS]: 69,
    [FilingStatus.HOH]: 69,
    [FilingStatus.W]: 138
  },

  // Dependent exemption credit (per dependent)
  dependentExemptionCredit: 69,

  // Idaho Grocery Credit (refundable)
  groceryCredit: {
    base: 120, // Per person
    age65Plus: 140 // Per person 65 or older
  },

  // Idaho child tax credit
  childTaxCredit: 205,

  // Idaho does not tax Social Security benefits
  socialSecurityExclusion: true,

  // Idaho retirement benefits deduction
  retirementBenefitsDeduction: {
    // Retirement benefits from civil service, military, state/local government
    maxDeduction: 45504
  }
}

export default parameters
