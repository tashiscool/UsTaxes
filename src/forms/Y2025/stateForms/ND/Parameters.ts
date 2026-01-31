import { FilingStatus } from 'ustaxes/core/data'

/**
 * North Dakota 2025 Tax Parameters
 * North Dakota has very low progressive tax rates (1.95%-2.5%)
 * 2 bracket system with one of the lowest state income taxes in the nation
 */
const parameters = {
  // North Dakota progressive tax brackets (2025)
  // Brackets vary by filing status
  taxBrackets: {
    [FilingStatus.S]: [
      { min: 0, max: 44725, rate: 0.0195 },
      { min: 44725, max: Infinity, rate: 0.025 }
    ],
    [FilingStatus.MFJ]: [
      { min: 0, max: 74750, rate: 0.0195 },
      { min: 74750, max: Infinity, rate: 0.025 }
    ],
    [FilingStatus.MFS]: [
      { min: 0, max: 37375, rate: 0.0195 },
      { min: 37375, max: Infinity, rate: 0.025 }
    ],
    [FilingStatus.HOH]: [
      { min: 0, max: 59850, rate: 0.0195 },
      { min: 59850, max: Infinity, rate: 0.025 }
    ],
    [FilingStatus.W]: [
      { min: 0, max: 74750, rate: 0.0195 },
      { min: 74750, max: Infinity, rate: 0.025 }
    ]
  },

  // North Dakota uses federal taxable income as starting point
  // Standard deduction already applied at federal level

  // North Dakota does not have state-specific standard deduction
  // It starts from federal taxable income

  // Personal exemption (not applicable - uses federal)
  personalExemption: {
    [FilingStatus.S]: 0,
    [FilingStatus.MFJ]: 0,
    [FilingStatus.MFS]: 0,
    [FilingStatus.HOH]: 0,
    [FilingStatus.W]: 0
  },

  // North Dakota does not tax Social Security benefits
  // when AGI is below threshold
  socialSecurityExemptionThreshold: {
    [FilingStatus.S]: 50000,
    [FilingStatus.MFJ]: 100000,
    [FilingStatus.MFS]: 50000,
    [FilingStatus.HOH]: 50000,
    [FilingStatus.W]: 100000
  }
}

export default parameters
