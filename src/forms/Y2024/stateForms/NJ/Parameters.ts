import { FilingStatus } from 'ustaxes/core/data'

/**
 * New Jersey 2024 Tax Parameters
 * New Jersey uses progressive income tax rates (1.4% to 10.75%)
 */
const parameters = {
  // New Jersey tax brackets for 2024
  // Rates: 1.4%, 1.75%, 2.45%, 3.5%, 5.525%, 6.37%, 8.97%, 10.75%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [20000, 35000, 40000, 75000, 500000, 1000000, 5000000],
      rates: [0.014, 0.0175, 0.035, 0.05525, 0.0637, 0.0897, 0.1075]
    },
    [FilingStatus.MFJ]: {
      brackets: [20000, 50000, 70000, 80000, 150000, 500000, 1000000, 5000000],
      rates: [0.014, 0.0175, 0.0245, 0.035, 0.05525, 0.0637, 0.0897, 0.1075]
    },
    [FilingStatus.MFS]: {
      brackets: [20000, 35000, 40000, 75000, 500000, 1000000, 5000000],
      rates: [0.014, 0.0175, 0.035, 0.05525, 0.0637, 0.0897, 0.1075]
    },
    [FilingStatus.HOH]: {
      brackets: [20000, 50000, 70000, 80000, 150000, 500000, 1000000, 5000000],
      rates: [0.014, 0.0175, 0.0245, 0.035, 0.05525, 0.0637, 0.0897, 0.1075]
    },
    [FilingStatus.W]: {
      brackets: [20000, 50000, 70000, 80000, 150000, 500000, 1000000, 5000000],
      rates: [0.014, 0.0175, 0.0245, 0.035, 0.05525, 0.0637, 0.0897, 0.1075]
    }
  },

  // Personal exemptions for 2024
  personalExemption: {
    [FilingStatus.S]: 1000,
    [FilingStatus.MFJ]: 2000,
    [FilingStatus.MFS]: 1000,
    [FilingStatus.HOH]: 1000,
    [FilingStatus.W]: 1000
  },

  // Dependent exemption
  dependentExemption: 1500,

  // Senior/disabled/blind exemption (65+ or blind)
  seniorBlindExemption: 1000,

  // NJ Earned Income Tax Credit (40% of federal EIC)
  eicPercentage: 0.4,

  // Child and Dependent Care Credit (percentage of federal)
  childCarePercentage: 0.5,

  // Property tax deduction/credit
  propertyTaxDeductionMax: 15000,
  propertyTaxCreditMax: 50,
  propertyTaxCreditIncomeLimit: {
    [FilingStatus.S]: 150000,
    [FilingStatus.MFJ]: 150000,
    [FilingStatus.MFS]: 75000,
    [FilingStatus.HOH]: 150000,
    [FilingStatus.W]: 150000
  },

  // Pension exclusion (for 62+ or disabled)
  pensionExclusionMax: {
    [FilingStatus.S]: 100000,
    [FilingStatus.MFJ]: 150000,
    [FilingStatus.MFS]: 75000,
    [FilingStatus.HOH]: 100000,
    [FilingStatus.W]: 100000
  },
  pensionExclusionIncomeLimit: {
    [FilingStatus.S]: 100000,
    [FilingStatus.MFJ]: 150000,
    [FilingStatus.MFS]: 75000,
    [FilingStatus.HOH]: 100000,
    [FilingStatus.W]: 100000
  }
}

export default parameters
