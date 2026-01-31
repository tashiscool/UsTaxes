import { FilingStatus } from 'ustaxes/core/data'

/**
 * California 2024 Tax Parameters
 * California uses progressive income tax rates (1% to 12.3%)
 * Plus 1% mental health services tax on income over $1M
 */
const parameters = {
  // California tax brackets for 2024
  // Rates: 1%, 2%, 4%, 6%, 8%, 9.3%, 10.3%, 11.3%, 12.3%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [10412, 24684, 38959, 54081, 68350, 349137, 418961, 698271],
      rates: [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123]
    },
    [FilingStatus.MFJ]: {
      brackets: [20824, 49368, 77918, 108162, 136700, 698274, 837922, 1396542],
      rates: [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123]
    },
    [FilingStatus.MFS]: {
      brackets: [10412, 24684, 38959, 54081, 68350, 349137, 418961, 698271],
      rates: [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123]
    },
    [FilingStatus.HOH]: {
      brackets: [20839, 49371, 63644, 78765, 93037, 474824, 569790, 949649],
      rates: [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123]
    },
    [FilingStatus.W]: {
      brackets: [20824, 49368, 77918, 108162, 136700, 698274, 837922, 1396542],
      rates: [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123]
    }
  },

  // Mental health services tax (1% on income over $1M)
  mentalHealthTaxRate: 0.01,
  mentalHealthTaxThreshold: 1000000,

  // Standard deduction for 2024
  standardDeduction: {
    [FilingStatus.S]: 5540,
    [FilingStatus.MFJ]: 11080,
    [FilingStatus.MFS]: 5540,
    [FilingStatus.HOH]: 11080,
    [FilingStatus.W]: 11080
  },

  // Personal exemption credit
  exemptionCredit: {
    [FilingStatus.S]: 144,
    [FilingStatus.MFJ]: 288,
    [FilingStatus.MFS]: 144,
    [FilingStatus.HOH]: 144,
    [FilingStatus.W]: 288
  },

  // Dependent exemption credit
  dependentExemptionCredit: 446,

  // CA Earned Income Tax Credit parameters
  eicMaxIncome: {
    noChildren: 32490,
    withChildren: 32490
  },

  // Young Child Tax Credit
  youngChildTaxCredit: 1117,

  // Renter's credit
  rentersCredit: {
    [FilingStatus.S]: 60,
    [FilingStatus.MFJ]: 120,
    [FilingStatus.MFS]: 60,
    [FilingStatus.HOH]: 60,
    [FilingStatus.W]: 120
  },
  rentersIncomeLimit: {
    [FilingStatus.S]: 50746,
    [FilingStatus.MFJ]: 101492,
    [FilingStatus.MFS]: 50746,
    [FilingStatus.HOH]: 101492,
    [FilingStatus.W]: 101492
  }
}

export default parameters
