import { FilingStatus } from 'ustaxes/core/data'

/**
 * Maine 2025 Tax Parameters
 * Maine uses progressive tax rates: 5.8%, 6.75%, 7.15% (3 brackets)
 */
const parameters = {
  // Maine progressive tax brackets for 2025
  // Single and MFS
  brackets: {
    [FilingStatus.S]: [
      { min: 0, max: 26050, rate: 0.058 },
      { min: 26050, max: 61600, rate: 0.0675 },
      { min: 61600, max: Infinity, rate: 0.0715 }
    ],
    [FilingStatus.MFJ]: [
      { min: 0, max: 52100, rate: 0.058 },
      { min: 52100, max: 123250, rate: 0.0675 },
      { min: 123250, max: Infinity, rate: 0.0715 }
    ],
    [FilingStatus.MFS]: [
      { min: 0, max: 26050, rate: 0.058 },
      { min: 26050, max: 61600, rate: 0.0675 },
      { min: 61600, max: Infinity, rate: 0.0715 }
    ],
    [FilingStatus.HOH]: [
      { min: 0, max: 39150, rate: 0.058 },
      { min: 39150, max: 92450, rate: 0.0675 },
      { min: 92450, max: Infinity, rate: 0.0715 }
    ],
    [FilingStatus.W]: [
      { min: 0, max: 52100, rate: 0.058 },
      { min: 52100, max: 123250, rate: 0.0675 },
      { min: 123250, max: Infinity, rate: 0.0715 }
    ]
  },

  // Standard deduction for 2025 (tied to federal)
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 5000,
    [FilingStatus.MFJ]: 10000,
    [FilingStatus.MFS]: 5000,
    [FilingStatus.HOH]: 5000,
    [FilingStatus.W]: 5000
  },

  // Dependent exemption
  dependentExemption: 5000,

  // Maine does not tax Social Security benefits

  // Pension income deduction (for those 65+)
  pensionDeduction: {
    maxDeduction: 35000
  }
}

export default parameters
