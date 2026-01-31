import { FilingStatus } from 'ustaxes/core/data'

/**
 * Illinois 2024 Tax Parameters
 * Illinois uses a flat 4.95% income tax rate
 */
const parameters = {
  // Illinois flat tax rate (4.95%)
  taxRate: 0.0495,

  // Personal exemptions for 2024
  exemptions: {
    [FilingStatus.S]: {
      incomeLowerLimit: 2625,
      incomeUpperLimit: 250000,
      exemptionAmount: 2625
    },
    [FilingStatus.MFJ]: {
      incomeLowerLimit: 5250,
      incomeUpperLimit: 500000,
      exemptionAmount: 5250
    },
    [FilingStatus.MFS]: {
      incomeLowerLimit: 2625,
      incomeUpperLimit: 250000,
      exemptionAmount: 2625
    },
    [FilingStatus.HOH]: {
      incomeLowerLimit: 2625,
      incomeUpperLimit: 250000,
      exemptionAmount: 2625
    },
    [FilingStatus.W]: {
      incomeLowerLimit: 5250,
      incomeUpperLimit: 500000,
      exemptionAmount: 5250
    }
  },

  // Additional exemptions
  seniorExemption: 1000,
  blindExemption: 1000,
  dependentExemption: 2625,

  // Illinois Earned Income Credit (20% of federal EIC for 2024)
  earnedIncomeCreditFactor: 0.2,

  // IL EIC dependent credit
  eicDependentCredit: 2625,

  // Property tax credit rate
  propertyTaxCreditRate: 0.05,

  // K-12 education expense credit rate
  educationExpenseCreditRate: 0.25,
  educationExpenseCreditMax: 750
}

export default parameters
