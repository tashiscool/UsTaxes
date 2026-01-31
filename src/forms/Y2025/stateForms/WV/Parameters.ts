import { FilingStatus } from 'ustaxes/core/data'

/**
 * West Virginia 2025 Tax Parameters
 * West Virginia uses progressive income tax rates (2.36% to 5.12%)
 * Note: WV has been reducing rates in recent years
 *
 * 2025 Tax Brackets (5 brackets, same for all filing statuses):
 * - $0 - $10,000: 2.36%
 * - $10,000 - $25,000: 3.15%
 * - $25,000 - $40,000: 3.54%
 * - $40,000 - $60,000: 4.72%
 * - Over $60,000: 5.12%
 */
const parameters = {
  // West Virginia tax brackets for 2025
  // WV uses the same brackets for all filing statuses
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [10000, 25000, 40000, 60000],
      rates: [0.0236, 0.0315, 0.0354, 0.0472, 0.0512]
    },
    [FilingStatus.MFJ]: {
      brackets: [10000, 25000, 40000, 60000],
      rates: [0.0236, 0.0315, 0.0354, 0.0472, 0.0512]
    },
    [FilingStatus.MFS]: {
      brackets: [10000, 25000, 40000, 60000],
      rates: [0.0236, 0.0315, 0.0354, 0.0472, 0.0512]
    },
    [FilingStatus.HOH]: {
      brackets: [10000, 25000, 40000, 60000],
      rates: [0.0236, 0.0315, 0.0354, 0.0472, 0.0512]
    },
    [FilingStatus.W]: {
      brackets: [10000, 25000, 40000, 60000],
      rates: [0.0236, 0.0315, 0.0354, 0.0472, 0.0512]
    }
  },

  // Personal exemption for 2025
  // WV allows $2,000 per person
  personalExemption: {
    [FilingStatus.S]: 2000,
    [FilingStatus.MFJ]: 4000, // Taxpayer + spouse
    [FilingStatus.MFS]: 2000,
    [FilingStatus.HOH]: 2000,
    [FilingStatus.W]: 2000
  },

  // Dependent exemption
  dependentExemption: 2000,

  // Senior exemption (65+)
  seniorExemption: 0, // WV does not have a separate senior exemption

  // WV does not have a standard deduction - it uses federal AGI adjustments
  // but allows deductions for certain items

  // Low Income Exclusion (for income under certain thresholds)
  lowIncomeExclusion: {
    [FilingStatus.S]: 10000,
    [FilingStatus.MFJ]: 10000,
    [FilingStatus.MFS]: 5000,
    [FilingStatus.HOH]: 10000,
    [FilingStatus.W]: 10000
  },

  // Social Security benefit exclusion
  // WV excludes Social Security benefits from taxation
  socialSecurityExclusion: true,

  // West Virginia Senior Citizen Tax Credit
  // Available for taxpayers 65 and older with income under limits
  seniorCitizensCredit: {
    maxCredit: 500,
    incomeLimit: {
      [FilingStatus.S]: 50000,
      [FilingStatus.MFJ]: 50000,
      [FilingStatus.MFS]: 25000,
      [FilingStatus.HOH]: 50000,
      [FilingStatus.W]: 50000
    }
  },

  // Family Tax Credit
  // Available for low-income families
  familyTaxCredit: {
    maxCredit: 250,
    incomeLimit: {
      [FilingStatus.S]: 30000,
      [FilingStatus.MFJ]: 50000,
      [FilingStatus.MFS]: 25000,
      [FilingStatus.HOH]: 40000,
      [FilingStatus.W]: 50000
    }
  }
}

export default parameters
