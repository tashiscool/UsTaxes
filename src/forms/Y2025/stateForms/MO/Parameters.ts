import { FilingStatus } from 'ustaxes/core/data'

/**
 * Missouri 2025 Tax Parameters
 * Missouri is transitioning to a flat tax (4.7%-4.8% for 2025)
 * Will be fully flat at 4.7% by 2027
 */
const parameters = {
  // Missouri tax brackets for 2025
  // Essentially flat with two brackets (phasing to single rate)
  brackets: {
    [FilingStatus.S]: [
      { min: 0, max: 1207, rate: 0.0 },
      { min: 1207, max: 2414, rate: 0.047 },
      { min: 2414, max: Infinity, rate: 0.048 }
    ],
    [FilingStatus.MFJ]: [
      { min: 0, max: 1207, rate: 0.0 },
      { min: 1207, max: 2414, rate: 0.047 },
      { min: 2414, max: Infinity, rate: 0.048 }
    ],
    [FilingStatus.MFS]: [
      { min: 0, max: 1207, rate: 0.0 },
      { min: 1207, max: 2414, rate: 0.047 },
      { min: 2414, max: Infinity, rate: 0.048 }
    ],
    [FilingStatus.HOH]: [
      { min: 0, max: 1207, rate: 0.0 },
      { min: 1207, max: 2414, rate: 0.047 },
      { min: 2414, max: Infinity, rate: 0.048 }
    ],
    [FilingStatus.W]: [
      { min: 0, max: 1207, rate: 0.0 },
      { min: 1207, max: 2414, rate: 0.047 },
      { min: 2414, max: Infinity, rate: 0.048 }
    ]
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption (Missouri uses federal)
  personalExemption: {
    [FilingStatus.S]: 0,
    [FilingStatus.MFJ]: 0,
    [FilingStatus.MFS]: 0,
    [FilingStatus.HOH]: 0,
    [FilingStatus.W]: 0
  },

  // Dependent exemption
  dependentExemption: 1200,

  // Missouri fully exempts Social Security benefits

  // Public pension exemption
  publicPensionExemption: {
    maxExemption: 36318
  }
}

export default parameters
