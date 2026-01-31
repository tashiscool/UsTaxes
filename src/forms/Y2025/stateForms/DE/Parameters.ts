import { FilingStatus } from 'ustaxes/core/data'

/**
 * Delaware 2025 Tax Parameters
 * Delaware uses progressive income tax rates (0% to 6.6%)
 * Delaware has no sales tax
 */
const parameters = {
  // Delaware tax brackets for 2025
  // Rates: 0% (under $2,000), 2.2%, 3.9%, 4.8%, 5.2%, 5.55%, 6.6%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [2000, 5000, 10000, 20000, 25000, 60000],
      rates: [0, 0.022, 0.039, 0.048, 0.052, 0.0555, 0.066]
    },
    [FilingStatus.MFJ]: {
      brackets: [2000, 5000, 10000, 20000, 25000, 60000],
      rates: [0, 0.022, 0.039, 0.048, 0.052, 0.0555, 0.066]
    },
    [FilingStatus.MFS]: {
      brackets: [2000, 5000, 10000, 20000, 25000, 60000],
      rates: [0, 0.022, 0.039, 0.048, 0.052, 0.0555, 0.066]
    },
    [FilingStatus.HOH]: {
      brackets: [2000, 5000, 10000, 20000, 25000, 60000],
      rates: [0, 0.022, 0.039, 0.048, 0.052, 0.0555, 0.066]
    },
    [FilingStatus.W]: {
      brackets: [2000, 5000, 10000, 20000, 25000, 60000],
      rates: [0, 0.022, 0.039, 0.048, 0.052, 0.0555, 0.066]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 3250,
    [FilingStatus.MFJ]: 6500,
    [FilingStatus.MFS]: 3250,
    [FilingStatus.HOH]: 3250,
    [FilingStatus.W]: 6500
  },

  // Personal credit (Delaware uses tax credits)
  personalCredit: {
    [FilingStatus.S]: 110,
    [FilingStatus.MFJ]: 220, // Taxpayer + spouse
    [FilingStatus.MFS]: 110,
    [FilingStatus.HOH]: 110,
    [FilingStatus.W]: 110
  },

  // Dependent credit
  dependentCredit: 110,

  // Delaware does not tax Social Security benefits

  // Pension exclusion for those 60+
  pensionExclusion: {
    age60Plus: 12500
  },

  // Delaware Earned Income Tax Credit (20% of federal)
  eicPercentage: 0.20,

  // Child care credit (50% of federal, max $500)
  childCareRate: 0.50,
  childCareCreditMax: 500
}

export default parameters
