import { FilingStatus } from 'ustaxes/core/data'

/**
 * Maryland 2025 Tax Parameters
 * Maryland uses progressive income tax rates (2% to 5.75%)
 * Plus local county taxes (varies by county)
 */
const parameters = {
  // Maryland state tax brackets for 2025
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [1000, 2000, 3000, 100000, 125000, 150000, 250000],
      rates: [0.02, 0.03, 0.04, 0.0475, 0.05, 0.0525, 0.055, 0.0575]
    },
    [FilingStatus.MFJ]: {
      brackets: [1000, 2000, 3000, 150000, 175000, 225000, 300000],
      rates: [0.02, 0.03, 0.04, 0.0475, 0.05, 0.0525, 0.055, 0.0575]
    },
    [FilingStatus.MFS]: {
      brackets: [1000, 2000, 3000, 100000, 125000, 150000, 250000],
      rates: [0.02, 0.03, 0.04, 0.0475, 0.05, 0.0525, 0.055, 0.0575]
    },
    [FilingStatus.HOH]: {
      brackets: [1000, 2000, 3000, 150000, 175000, 225000, 300000],
      rates: [0.02, 0.03, 0.04, 0.0475, 0.05, 0.0525, 0.055, 0.0575]
    },
    [FilingStatus.W]: {
      brackets: [1000, 2000, 3000, 150000, 175000, 225000, 300000],
      rates: [0.02, 0.03, 0.04, 0.0475, 0.05, 0.0525, 0.055, 0.0575]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 2550,
    [FilingStatus.MFJ]: 5100,
    [FilingStatus.MFS]: 2550,
    [FilingStatus.HOH]: 5100,
    [FilingStatus.W]: 5100
  },

  // Personal exemption
  personalExemption: {
    amount: 3200,
    phaseOutStart: {
      [FilingStatus.S]: 100000,
      [FilingStatus.MFJ]: 150000,
      [FilingStatus.MFS]: 100000,
      [FilingStatus.HOH]: 125000,
      [FilingStatus.W]: 150000
    }
  },

  // Dependent exemption
  dependentExemption: 3200,

  // Maryland Earned Income Credit (45% of federal EIC, refundable)
  earnedIncomeCreditFactor: 0.45,

  // Maryland Child Tax Credit (refundable)
  childTaxCredit: {
    amount: 500,
    incomeLimit: {
      [FilingStatus.S]: 6000,
      [FilingStatus.MFJ]: 6000,
      [FilingStatus.MFS]: 6000,
      [FilingStatus.HOH]: 6000,
      [FilingStatus.W]: 6000
    }
  },

  // Local tax rates (vary by county, average ~3.0%)
  // Using Baltimore County rate as default
  localTaxRate: 0.0283,
  localTaxNote: 'MD local tax varies by county - using average rate'
}

export default parameters
