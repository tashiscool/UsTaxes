import { FilingStatus } from 'ustaxes/core/data'

/**
 * District of Columbia 2025 Tax Parameters
 * DC uses progressive income tax rates (4% to 10.75%)
 */
const parameters = {
  // DC tax brackets for 2025
  // Rates: 4%, 6%, 6.5%, 8.5%, 9.25%, 9.75%, 10.75%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [10000, 40000, 60000, 250000, 500000, 1000000],
      rates: [0.04, 0.06, 0.065, 0.085, 0.0925, 0.0975, 0.1075]
    },
    [FilingStatus.MFJ]: {
      brackets: [10000, 40000, 60000, 250000, 500000, 1000000],
      rates: [0.04, 0.06, 0.065, 0.085, 0.0925, 0.0975, 0.1075]
    },
    [FilingStatus.MFS]: {
      brackets: [10000, 40000, 60000, 250000, 500000, 1000000],
      rates: [0.04, 0.06, 0.065, 0.085, 0.0925, 0.0975, 0.1075]
    },
    [FilingStatus.HOH]: {
      brackets: [10000, 40000, 60000, 250000, 500000, 1000000],
      rates: [0.04, 0.06, 0.065, 0.085, 0.0925, 0.0975, 0.1075]
    },
    [FilingStatus.W]: {
      brackets: [10000, 40000, 60000, 250000, 500000, 1000000],
      rates: [0.04, 0.06, 0.065, 0.085, 0.0925, 0.0975, 0.1075]
    }
  },

  // Standard deduction for 2025
  // DC conforms to federal standard deduction amounts
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption for 2025
  personalExemption: {
    [FilingStatus.S]: 4400,
    [FilingStatus.MFJ]: 8800, // Taxpayer + spouse
    [FilingStatus.MFS]: 4400,
    [FilingStatus.HOH]: 4400,
    [FilingStatus.W]: 4400
  },

  // Dependent exemption
  dependentExemption: 4400,

  // DC Earned Income Tax Credit (40% of federal)
  eicPercentage: 0.40,

  // DC does not tax Social Security benefits

  // Low income credit threshold
  lowIncomeThreshold: {
    [FilingStatus.S]: 30000,
    [FilingStatus.MFJ]: 50000,
    [FilingStatus.MFS]: 25000,
    [FilingStatus.HOH]: 40000,
    [FilingStatus.W]: 50000
  }
}

export default parameters
