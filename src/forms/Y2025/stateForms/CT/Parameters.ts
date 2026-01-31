import { FilingStatus } from 'ustaxes/core/data'

/**
 * Connecticut 2025 Tax Parameters
 * Connecticut uses progressive income tax rates (2% to 6.99%)
 */
const parameters = {
  // Connecticut tax brackets for 2025
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [10000, 50000, 100000, 200000, 250000, 500000],
      rates: [0.02, 0.045, 0.055, 0.06, 0.065, 0.069, 0.0699]
    },
    [FilingStatus.MFJ]: {
      brackets: [20000, 100000, 200000, 400000, 500000, 1000000],
      rates: [0.02, 0.045, 0.055, 0.06, 0.065, 0.069, 0.0699]
    },
    [FilingStatus.MFS]: {
      brackets: [10000, 50000, 100000, 200000, 250000, 500000],
      rates: [0.02, 0.045, 0.055, 0.06, 0.065, 0.069, 0.0699]
    },
    [FilingStatus.HOH]: {
      brackets: [16000, 80000, 160000, 320000, 400000, 800000],
      rates: [0.02, 0.045, 0.055, 0.06, 0.065, 0.069, 0.0699]
    },
    [FilingStatus.W]: {
      brackets: [20000, 100000, 200000, 400000, 500000, 1000000],
      rates: [0.02, 0.045, 0.055, 0.06, 0.065, 0.069, 0.0699]
    }
  },

  // Personal exemption (CT uses a credit instead)
  personalCredit: {
    [FilingStatus.S]: 15000,
    [FilingStatus.MFJ]: 24000,
    [FilingStatus.MFS]: 12000,
    [FilingStatus.HOH]: 19000,
    [FilingStatus.W]: 24000
  },

  // Connecticut Earned Income Tax Credit (30.5% of federal)
  earnedIncomeCreditFactor: 0.305,

  // Property Tax Credit (for homeowners/renters)
  propertyTaxCredit: {
    maxCredit: 300,
    incomeLimit: 109500  // For MFJ
  },

  // Child Tax Credit (refundable)
  childTaxCredit: {
    amountPerChild: 250,
    incomeLimit: {
      [FilingStatus.S]: 100000,
      [FilingStatus.MFJ]: 200000,
      [FilingStatus.MFS]: 100000,
      [FilingStatus.HOH]: 160000,
      [FilingStatus.W]: 200000
    }
  },

  // Social Security exemption threshold
  socialSecurityExemption: {
    incomeLimit: {
      [FilingStatus.S]: 75000,
      [FilingStatus.MFJ]: 100000,
      [FilingStatus.MFS]: 50000,
      [FilingStatus.HOH]: 75000,
      [FilingStatus.W]: 100000
    }
  }
}

export default parameters
