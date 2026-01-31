import { FilingStatus } from 'ustaxes/core/data'

/**
 * Arkansas 2025 Tax Parameters
 * Arkansas uses progressive income tax rates (0.9% to 4.4%)
 * Top rate reduced from 4.7% to 4.4% for 2025
 */
const parameters = {
  // Arkansas tax brackets for 2025
  // Income over $24,300 (net income) is taxed at graduated rates
  // The rates apply to net income (after standard deduction)
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [5099, 10099, 14299, 24299, 87000],
      rates: [0.009, 0.019, 0.029, 0.039, 0.044]
    },
    [FilingStatus.MFJ]: {
      brackets: [5099, 10099, 14299, 24299, 87000],
      rates: [0.009, 0.019, 0.029, 0.039, 0.044]
    },
    [FilingStatus.MFS]: {
      brackets: [5099, 10099, 14299, 24299, 87000],
      rates: [0.009, 0.019, 0.029, 0.039, 0.044]
    },
    [FilingStatus.HOH]: {
      brackets: [5099, 10099, 14299, 24299, 87000],
      rates: [0.009, 0.019, 0.029, 0.039, 0.044]
    },
    [FilingStatus.W]: {
      brackets: [5099, 10099, 14299, 24299, 87000],
      rates: [0.009, 0.019, 0.029, 0.039, 0.044]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 2340,
    [FilingStatus.MFJ]: 4680,
    [FilingStatus.MFS]: 2340,
    [FilingStatus.HOH]: 2340,
    [FilingStatus.W]: 4680
  },

  // Personal tax credits (Arkansas uses credits, not exemptions)
  personalCredit: {
    [FilingStatus.S]: 29,
    [FilingStatus.MFJ]: 58, // Taxpayer + spouse
    [FilingStatus.MFS]: 29,
    [FilingStatus.HOH]: 29,
    [FilingStatus.W]: 29
  },

  // Dependent credit
  dependentCredit: 29,

  // Low income tax credit threshold
  lowIncomeTaxTable: {
    [FilingStatus.S]: 26000,
    [FilingStatus.MFJ]: 32000,
    [FilingStatus.MFS]: 16000,
    [FilingStatus.HOH]: 26000,
    [FilingStatus.W]: 32000
  }
}

export default parameters
