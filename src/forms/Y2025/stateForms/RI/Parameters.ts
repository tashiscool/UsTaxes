import { FilingStatus } from 'ustaxes/core/data'

/**
 * Rhode Island 2025 Tax Parameters
 * Rhode Island uses progressive income tax rates (3.75% to 5.99%)
 * 3 tax brackets
 */
const parameters = {
  // Rhode Island tax brackets for 2025
  // Rates: 3.75%, 4.75%, 5.99%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [73450, 166950],
      rates: [0.0375, 0.0475, 0.0599]
    },
    [FilingStatus.MFJ]: {
      brackets: [73450, 166950],
      rates: [0.0375, 0.0475, 0.0599]
    },
    [FilingStatus.MFS]: {
      brackets: [36725, 83475],
      rates: [0.0375, 0.0475, 0.0599]
    },
    [FilingStatus.HOH]: {
      brackets: [73450, 166950],
      rates: [0.0375, 0.0475, 0.0599]
    },
    [FilingStatus.W]: {
      brackets: [73450, 166950],
      rates: [0.0375, 0.0475, 0.0599]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 10550,
    [FilingStatus.MFJ]: 21100,
    [FilingStatus.MFS]: 10550,
    [FilingStatus.HOH]: 15825,
    [FilingStatus.W]: 21100
  },

  // Personal exemption amount
  personalExemption: {
    [FilingStatus.S]: 4950,
    [FilingStatus.MFJ]: 9900, // Taxpayer + spouse
    [FilingStatus.MFS]: 4950,
    [FilingStatus.HOH]: 4950,
    [FilingStatus.W]: 4950
  },

  // Dependent exemption
  dependentExemption: 4950,

  // Rhode Island does not tax Social Security benefits

  // RI Earned Income Credit (percentage of federal EIC)
  eicPercentage: 0.16,

  // RI Child Tax Credit
  childTaxCredit: 100,

  // RI Property Tax Relief Credit max
  propertyTaxCreditMax: 400
}

export default parameters
