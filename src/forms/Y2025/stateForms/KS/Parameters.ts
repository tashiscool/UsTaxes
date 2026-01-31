import { FilingStatus } from 'ustaxes/core/data'

/**
 * Kansas 2025 Tax Parameters
 * Kansas uses progressive income tax rates (3.1% to 5.7%)
 * 3 tax brackets
 */
const parameters = {
  // Kansas tax brackets for 2025
  // Rates: 3.1%, 5.25%, 5.7%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [15000, 30000],
      rates: [0.031, 0.0525, 0.057]
    },
    [FilingStatus.MFJ]: {
      brackets: [30000, 60000],
      rates: [0.031, 0.0525, 0.057]
    },
    [FilingStatus.MFS]: {
      brackets: [15000, 30000],
      rates: [0.031, 0.0525, 0.057]
    },
    [FilingStatus.HOH]: {
      brackets: [15000, 30000],
      rates: [0.031, 0.0525, 0.057]
    },
    [FilingStatus.W]: {
      brackets: [30000, 60000],
      rates: [0.031, 0.0525, 0.057]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 3500,
    [FilingStatus.MFJ]: 8000,
    [FilingStatus.MFS]: 4000,
    [FilingStatus.HOH]: 6000,
    [FilingStatus.W]: 8000
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 2250,
    [FilingStatus.MFJ]: 4500,
    [FilingStatus.MFS]: 2250,
    [FilingStatus.HOH]: 2250,
    [FilingStatus.W]: 4500
  },

  // Dependent exemption
  dependentExemption: 2250,

  // Kansas does not tax Social Security benefits

  // Food sales tax credit (low income credit)
  foodSalesTaxCredit: {
    [FilingStatus.S]: 125,
    [FilingStatus.MFJ]: 250,
    [FilingStatus.MFS]: 125,
    [FilingStatus.HOH]: 125,
    [FilingStatus.W]: 250
  },
  foodSalesTaxCreditIncomeLimit: {
    [FilingStatus.S]: 30615,
    [FilingStatus.MFJ]: 30615,
    [FilingStatus.MFS]: 30615,
    [FilingStatus.HOH]: 30615,
    [FilingStatus.W]: 30615
  },
  foodSalesTaxCreditPerDependent: 125
}

export default parameters
