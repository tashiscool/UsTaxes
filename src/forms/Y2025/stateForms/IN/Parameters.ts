import { FilingStatus } from 'ustaxes/core/data'

/**
 * Indiana 2025 Tax Parameters
 * Indiana uses a flat income tax rate of 3.05%
 * Plus county income taxes (varies by county)
 */
const parameters = {
  // Indiana flat state tax rate for 2025
  stateRate: 0.0305,

  // County tax rates vary - using average
  // Actual county rates range from 0.5% to 2.96%
  countyRate: 0.0175,  // Average county rate
  countyNote: 'County rates vary from 0.5% to 2.96% - using average',

  // Personal exemption (applies to all)
  personalExemption: {
    amount: 1000
  },

  // Dependent exemption
  dependentExemption: {
    amount: 1500,
    // Additional exemption for disabled dependents
    disabledAmount: 1500
  },

  // Indiana Earned Income Credit (10% of federal EIC)
  earnedIncomeCreditFactor: 0.10,

  // Unified Tax Credit for the Elderly (65+)
  unifiedTaxCredit: {
    amount: 200,
    ageRequirement: 65
  },

  // College credit (20% of qualified expenses)
  collegeCreditRate: 0.20,
  collegeCreditMax: 1500,

  // Adoption credit
  adoptionCreditMax: 1000,

  // Retirement income deductions
  retirementDeduction: {
    militaryRetirement: 6250,  // Military retirement deduction
    civilServiceRetirement: 2000  // Federal civil service deduction
  }
}

export default parameters
