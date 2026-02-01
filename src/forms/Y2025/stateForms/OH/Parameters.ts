import { FilingStatus } from 'ustaxes/core/data'

/**
 * Ohio 2025 Tax Parameters
 * Ohio uses progressive income tax rates (0% to 3.5%)
 * Note: Ohio eliminated lowest bracket - income up to $26,050 is exempt
 */
const parameters = {
  // Ohio tax brackets for 2025 (same for all filing statuses)
  taxBrackets: {
    brackets: [26050, 100000],
    rates: [0, 0.0275, 0.035]
  },

  // Ohio no longer has personal exemptions as of recent years
  // Ohio uses federal AGI as starting point

  // Ohio Earned Income Credit (30% of federal EIC)
  earnedIncomeCreditFactor: 0.3,

  // Retirement income credit (limited)
  retirementIncomeCredit: {
    maxCredit: 200,
    incomeLimit: 100000
  },

  // Senior citizen credit (65+)
  seniorCitizenCredit: 50,

  // Child care credit (for low income)
  childCareCreditPercentage: 0.25,
  childCareIncomeLimit: 40000,

  // Business income deduction (first $250,000 at 0%)
  businessIncomeDeduction: 250000,

  // Ohio school district taxes are separate and vary by district
  schoolDistrictNote: 'Ohio school district taxes vary - not calculated here'
}

export default parameters
