import { FilingStatus } from 'ustaxes/core/data'

/**
 * Montana 2025 Tax Parameters
 * Montana uses a progressive income tax with 2 brackets (4.7%-5.9%)
 * Reduced rates effective 2025
 */
const parameters = {
  // Montana progressive tax brackets (2025)
  // Same brackets apply to all filing statuses
  taxBrackets: [
    { min: 0, max: 20500, rate: 0.047 },
    { min: 20500, max: Infinity, rate: 0.059 }
  ],

  // Standard deduction for 2025
  // Montana uses a percentage of federal AGI with limits
  standardDeduction: {
    [FilingStatus.S]: 5540,
    [FilingStatus.MFJ]: 11080,
    [FilingStatus.MFS]: 5540,
    [FilingStatus.HOH]: 8310,
    [FilingStatus.W]: 11080
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 2830,
    [FilingStatus.MFJ]: 5660,
    [FilingStatus.MFS]: 2830,
    [FilingStatus.HOH]: 2830,
    [FilingStatus.W]: 5660
  },

  // Dependent exemption
  dependentExemption: 2830,

  // Montana does not tax Social Security benefits

  // Retirement income exclusion (partial exclusion for pension income)
  retirementExclusion: {
    maxExclusion: 4640
  }
}

export default parameters
