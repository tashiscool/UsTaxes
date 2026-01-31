import { FilingStatus } from 'ustaxes/core/data'

/**
 * New Mexico 2025 Tax Parameters
 * New Mexico uses progressive income tax rates (1.7% to 5.9%)
 * 5 tax brackets
 */
const parameters = {
  // New Mexico tax brackets for 2025
  // Rates: 1.7%, 3.2%, 4.7%, 4.9%, 5.9%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [5500, 11000, 16000, 210000],
      rates: [0.017, 0.032, 0.047, 0.049, 0.059]
    },
    [FilingStatus.MFJ]: {
      brackets: [8000, 16000, 24000, 315000],
      rates: [0.017, 0.032, 0.047, 0.049, 0.059]
    },
    [FilingStatus.MFS]: {
      brackets: [4000, 8000, 12000, 157500],
      rates: [0.017, 0.032, 0.047, 0.049, 0.059]
    },
    [FilingStatus.HOH]: {
      brackets: [8000, 16000, 24000, 315000],
      rates: [0.017, 0.032, 0.047, 0.049, 0.059]
    },
    [FilingStatus.W]: {
      brackets: [8000, 16000, 24000, 315000],
      rates: [0.017, 0.032, 0.047, 0.049, 0.059]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 4000,
    [FilingStatus.MFJ]: 8000,
    [FilingStatus.MFS]: 4000,
    [FilingStatus.HOH]: 4000,
    [FilingStatus.W]: 8000
  },

  // Dependent exemption
  dependentExemption: 4000,

  // Low Income Comprehensive Tax Rebate
  lowIncomeTaxRebate: {
    [FilingStatus.S]: 450,
    [FilingStatus.MFJ]: 450,
    [FilingStatus.MFS]: 225,
    [FilingStatus.HOH]: 450,
    [FilingStatus.W]: 450
  },
  lowIncomeRebateLimit: {
    [FilingStatus.S]: 36000,
    [FilingStatus.MFJ]: 36000,
    [FilingStatus.MFS]: 18000,
    [FilingStatus.HOH]: 36000,
    [FilingStatus.W]: 36000
  },

  // New Mexico does not tax Social Security benefits

  // Child Income Tax Credit
  childTaxCredit: 175,

  // Working Families Tax Credit (percentage of federal EITC)
  workingFamiliesTaxCreditRate: 0.25
}

export default parameters
