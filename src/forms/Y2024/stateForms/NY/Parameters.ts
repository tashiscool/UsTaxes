import { FilingStatus } from 'ustaxes/core/data'

/**
 * New York 2024 Tax Parameters
 * New York uses progressive income tax rates
 */
const parameters = {
  // New York tax brackets for 2024
  // Rates: 4%, 4.5%, 5.25%, 5.5%, 6%, 6.85%, 9.65%, 10.3%, 10.9%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [8500, 11700, 13900, 80650, 215400, 1077550, 5000000, 25000000],
      rates: [0.04, 0.045, 0.0525, 0.055, 0.06, 0.0685, 0.0965, 0.103, 0.109]
    },
    [FilingStatus.MFJ]: {
      brackets: [
        17150, 23600, 27900, 161550, 323200, 2155350, 5000000, 25000000
      ],
      rates: [0.04, 0.045, 0.0525, 0.055, 0.06, 0.0685, 0.0965, 0.103, 0.109]
    },
    [FilingStatus.MFS]: {
      brackets: [8500, 11700, 13900, 80650, 215400, 1077550, 5000000, 25000000],
      rates: [0.04, 0.045, 0.0525, 0.055, 0.06, 0.0685, 0.0965, 0.103, 0.109]
    },
    [FilingStatus.HOH]: {
      brackets: [
        12800, 17650, 20900, 107650, 269300, 1616450, 5000000, 25000000
      ],
      rates: [0.04, 0.045, 0.0525, 0.055, 0.06, 0.0685, 0.0965, 0.103, 0.109]
    },
    [FilingStatus.W]: {
      brackets: [
        17150, 23600, 27900, 161550, 323200, 2155350, 5000000, 25000000
      ],
      rates: [0.04, 0.045, 0.0525, 0.055, 0.06, 0.0685, 0.0965, 0.103, 0.109]
    }
  },

  // Standard deduction for 2024
  standardDeduction: {
    [FilingStatus.S]: 8000,
    [FilingStatus.MFJ]: 16050,
    [FilingStatus.MFS]: 8000,
    [FilingStatus.HOH]: 11200,
    [FilingStatus.W]: 16050
  },

  // Dependent exemption
  dependentExemption: 1000,

  // NY Earned Income Credit (percentage of federal EIC)
  eicPercentage: 0.3,

  // NY Child and Dependent Care Credit rate
  childCareRate: 0.2,

  // College tuition credit max
  collegeTuitionCreditMax: 400,

  // Empire State Child Credit
  empireStateChildCredit: 330
}

export default parameters
