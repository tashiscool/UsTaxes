import { FilingStatus } from 'ustaxes/core/data'

/**
 * Louisiana 2025 Tax Parameters
 * Louisiana uses progressive income tax rates (1.85% to 4.25%)
 * 3 tax brackets
 * Note: Federal income tax is deductible on Louisiana returns
 */
const parameters = {
  // Louisiana tax brackets for 2025
  // Rates: 1.85%, 3.5%, 4.25%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [12500, 50000],
      rates: [0.0185, 0.035, 0.0425]
    },
    [FilingStatus.MFJ]: {
      brackets: [25000, 100000],
      rates: [0.0185, 0.035, 0.0425]
    },
    [FilingStatus.MFS]: {
      brackets: [12500, 50000],
      rates: [0.0185, 0.035, 0.0425]
    },
    [FilingStatus.HOH]: {
      brackets: [12500, 50000],
      rates: [0.0185, 0.035, 0.0425]
    },
    [FilingStatus.W]: {
      brackets: [25000, 100000],
      rates: [0.0185, 0.035, 0.0425]
    }
  },

  // Louisiana does not have a standard deduction
  // Instead uses personal exemptions and federal tax deduction

  // Personal exemption for 2025
  personalExemption: {
    [FilingStatus.S]: 4500,
    [FilingStatus.MFJ]: 9000,
    [FilingStatus.MFS]: 4500,
    [FilingStatus.HOH]: 9000,
    [FilingStatus.W]: 9000
  },

  // Dependent exemption
  dependentExemption: 1000,

  // Combined personal exemption credit
  // (alternative to exemption for those who itemize)
  exemptionCredit: {
    [FilingStatus.S]: 75,
    [FilingStatus.MFJ]: 150,
    [FilingStatus.MFS]: 75,
    [FilingStatus.HOH]: 150,
    [FilingStatus.W]: 150
  },

  // Credit per dependent
  dependentCredit: 25,

  // Louisiana excludes Social Security from taxable income

  // Louisiana Earned Income Credit (5% of federal EIC)
  earnedIncomeCreditRate: 0.05,

  // Child Care Credit (percentage of federal credit, varies by income)
  childCareCreditPercentages: [
    { agiLimit: 25000, rate: 0.50 },
    { agiLimit: 35000, rate: 0.40 },
    { agiLimit: 60000, rate: 0.30 },
    { agiLimit: Infinity, rate: 0.10 }
  ],

  // School readiness credit (for child care at quality-rated facilities)
  schoolReadinessCreditMultiplier: 2.0
}

export default parameters
