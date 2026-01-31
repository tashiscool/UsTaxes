import { FilingStatus } from 'ustaxes/core/data'

/**
 * Mississippi 2025 Tax Parameters
 * Mississippi uses progressive rates: 0%, 4.7% (moving to flat 4% by 2026)
 * First $10,000 is exempt
 */
const parameters = {
  // Mississippi tax brackets for 2025
  // Transitioning to flat 4% by 2026
  brackets: {
    [FilingStatus.S]: [
      { min: 0, max: 10000, rate: 0.0 },
      { min: 10000, max: Infinity, rate: 0.047 }
    ],
    [FilingStatus.MFJ]: [
      { min: 0, max: 10000, rate: 0.0 },
      { min: 10000, max: Infinity, rate: 0.047 }
    ],
    [FilingStatus.MFS]: [
      { min: 0, max: 10000, rate: 0.0 },
      { min: 10000, max: Infinity, rate: 0.047 }
    ],
    [FilingStatus.HOH]: [
      { min: 0, max: 10000, rate: 0.0 },
      { min: 10000, max: Infinity, rate: 0.047 }
    ],
    [FilingStatus.W]: [
      { min: 0, max: 10000, rate: 0.0 },
      { min: 10000, max: Infinity, rate: 0.047 }
    ]
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 2300,
    [FilingStatus.MFJ]: 4600,
    [FilingStatus.MFS]: 2300,
    [FilingStatus.HOH]: 3400,
    [FilingStatus.W]: 4600
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 6000,
    [FilingStatus.MFJ]: 12000,
    [FilingStatus.MFS]: 6000,
    [FilingStatus.HOH]: 8000,
    [FilingStatus.W]: 6000
  },

  // Dependent exemption
  dependentExemption: 1500,

  // Mississippi fully exempts Social Security benefits

  // Retirement income exemption
  retirementExemption: {
    maxExemption: 0 // MS does not tax retirement from qualified plans
  }
}

export default parameters
