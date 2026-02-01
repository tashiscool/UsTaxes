/**
 * Michigan 2025 Tax Parameters
 * Michigan uses a flat income tax rate of 4.25%
 */
const parameters = {
  // Michigan flat tax rate for 2025
  taxRate: 0.0425,

  // Personal exemption
  personalExemption: {
    amount: 5600,
    // Additional exemption for 67+ or blind
    seniorBlindAmount: 3100
  },

  // Dependent exemption
  dependentExemption: 5600,

  // Michigan Earned Income Tax Credit (6% of federal EIC)
  earnedIncomeCreditFactor: 0.06,

  // Homestead Property Tax Credit (for low-income)
  homesteadCredit: {
    maxCredit: 1700,
    incomeLimit: 63000
  },

  // Home Heating Credit (for low-income)
  homeHeatingCredit: {
    maxCredit: 754,
    incomeLimit: 63000
  },

  // Retirement/pension subtraction (public pensions fully exempt)
  retirementSubtraction: {
    publicPensionExempt: true,
    privatePensionLimit: 61518 // For those born after 1945
  }
}

export default parameters
