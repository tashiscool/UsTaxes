import { FilingStatus } from 'ustaxes/core/data'

/**
 * Colorado 2025 Tax Parameters
 * Colorado uses a flat 4.4% income tax rate
 * Colorado starts with federal taxable income (after standard/itemized deductions)
 */
const parameters = {
  // Colorado flat tax rate (4.4% for 2025)
  taxRate: 0.044,

  // Colorado subtractions from federal taxable income
  // Social Security subtraction (full exclusion for 65+)
  socialSecuritySubtraction: {
    ageThreshold: 65,
    maxSubtraction: {
      [FilingStatus.S]: Infinity, // Full exclusion if 65+
      [FilingStatus.MFJ]: Infinity,
      [FilingStatus.MFS]: Infinity,
      [FilingStatus.HOH]: Infinity,
      [FilingStatus.W]: Infinity
    }
  },

  // Pension/annuity subtraction for 55-64 (up to $20,000)
  pensionSubtraction: {
    ageMin: 55,
    ageMax: 64,
    maxAmount: 20000
  },

  // Pension/annuity subtraction for 65+ (up to $24,000)
  seniorPensionSubtraction: {
    ageThreshold: 65,
    maxAmount: 24000
  },

  // Colorado Child Tax Credit (refundable)
  // 10% of federal CTC for those with income up to certain limits
  childTaxCredit: {
    percentage: 0.1,
    incomeLimit: {
      [FilingStatus.S]: 75000,
      [FilingStatus.MFJ]: 85000,
      [FilingStatus.MFS]: 42500,
      [FilingStatus.HOH]: 80000,
      [FilingStatus.W]: 85000
    }
  },

  // Colorado Earned Income Tax Credit (refundable)
  // Percentage of federal EIC
  earnedIncomeCreditFactor: 0.25,

  // Child Care Expenses Credit (20% of federal)
  childCarePercentage: 0.2
}

export default parameters
