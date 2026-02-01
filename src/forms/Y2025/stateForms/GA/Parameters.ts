import { FilingStatus } from 'ustaxes/core/data'

/**
 * Georgia 2025 Tax Parameters
 * Georgia uses a flat 5.39% income tax rate (transitioning to flat rate)
 * Note: GA moved to flat tax starting 2024, rate decreases each year
 */
const parameters = {
  // Georgia flat tax rate (5.39% for 2025)
  // Will decrease 0.1% per year until reaching 4.99%
  taxRate: 0.0539,

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 12000,
    [FilingStatus.MFJ]: 24000,
    [FilingStatus.MFS]: 12000,
    [FilingStatus.HOH]: 18000,
    [FilingStatus.W]: 24000
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 2700,
    [FilingStatus.MFJ]: 7400, // Taxpayer + spouse
    [FilingStatus.MFS]: 2700,
    [FilingStatus.HOH]: 2700,
    [FilingStatus.W]: 2700
  },

  // Dependent exemption
  dependentExemption: 3000,

  // Retirement income exclusion (65+)
  // Up to $65,000 per person for those 62-64
  // Up to $65,000 per person for those 65+
  retirementExclusion: {
    age62To64: 35000,
    age65Plus: 65000
  },

  // Georgia does not tax Social Security benefits

  // Low Income Credit
  lowIncomeCredit: {
    [FilingStatus.S]: 26,
    [FilingStatus.MFJ]: 52,
    [FilingStatus.MFS]: 26,
    [FilingStatus.HOH]: 26,
    [FilingStatus.W]: 26
  },
  lowIncomeIncomeLimit: {
    [FilingStatus.S]: 20000,
    [FilingStatus.MFJ]: 30000,
    [FilingStatus.MFS]: 15000,
    [FilingStatus.HOH]: 25000,
    [FilingStatus.W]: 30000
  }
}

export default parameters
