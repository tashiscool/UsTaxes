import { FilingStatus } from 'ustaxes/core/data'

/**
 * Kentucky 2025 Tax Parameters
 * Kentucky uses a flat 4% income tax rate (moved to flat rate in 2024)
 */
const parameters = {
  // Kentucky flat tax rate (4% for 2025)
  taxRate: 0.04,

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 3160,
    [FilingStatus.MFJ]: 6320,
    [FilingStatus.MFS]: 3160,
    [FilingStatus.HOH]: 3160,
    [FilingStatus.W]: 6320
  },

  // Personal tax credit (non-refundable)
  personalTaxCredit: {
    [FilingStatus.S]: 40,
    [FilingStatus.MFJ]: 80,
    [FilingStatus.MFS]: 40,
    [FilingStatus.HOH]: 40,
    [FilingStatus.W]: 80
  },

  // Dependent credit
  dependentCredit: 40,

  // Kentucky excludes Social Security from taxable income

  // Family Size Tax Credit (low income credit)
  // Based on modified gross income and family size
  familySizeTaxCreditThreshold: {
    1: 14580,
    2: 19720,
    3: 24860,
    4: 30000,
    5: 35140,
    6: 40280,
    7: 45420,
    8: 50560
  },

  // Pension income exclusion (up to $31,110 per person)
  pensionExclusion: 31110
}

export default parameters
