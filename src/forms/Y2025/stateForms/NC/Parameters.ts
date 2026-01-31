import { FilingStatus } from 'ustaxes/core/data'

/**
 * North Carolina 2025 Tax Parameters
 * North Carolina uses a flat 4.5% income tax rate (reduced from 4.75% in 2024)
 */
const parameters = {
  // North Carolina flat tax rate (4.5% for 2025)
  taxRate: 0.045,

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 12750,
    [FilingStatus.MFJ]: 25500,
    [FilingStatus.MFS]: 12750,
    [FilingStatus.HOH]: 19125,
    [FilingStatus.W]: 25500
  },

  // Child deduction (per qualifying child)
  childDeduction: {
    amount: 2500,
    incomeLimit: {
      [FilingStatus.S]: 40000,
      [FilingStatus.MFJ]: 60000,
      [FilingStatus.MFS]: 30000,
      [FilingStatus.HOH]: 50000,
      [FilingStatus.W]: 60000
    },
    phaseOutRate: 0.05  // Reduced $1 for each $2,000 over limit
  },

  // NC does not allow itemized deductions - uses fixed standard deduction

  // Retirement income deduction (Bailey Settlement)
  // Government retirees with service before 8/12/1989 get full exclusion
  baileySettlement: true,

  // NC Earned Income Tax Credit (not currently available - placeholder)
  earnedIncomeCreditFactor: 0,

  // Tax credits
  creditForChildrenWithDisabilities: 2500
}

export default parameters
