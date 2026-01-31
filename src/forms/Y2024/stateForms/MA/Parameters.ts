import { FilingStatus } from 'ustaxes/core/data'

/**
 * Massachusetts 2024 Tax Parameters
 * Massachusetts uses a flat 5% income tax rate (with 4% surtax on income over $1M)
 */
const parameters = {
  // Massachusetts flat tax rate (5%)
  taxRate: 0.05,

  // Millionaire's tax (additional 4% on income over $1M)
  millionaireTaxRate: 0.04,
  millionaireTaxThreshold: 1000000,

  // Personal exemptions for 2024
  personalExemption: {
    [FilingStatus.S]: 4400,
    [FilingStatus.MFJ]: 8800,
    [FilingStatus.MFS]: 4400,
    [FilingStatus.HOH]: 6800,
    [FilingStatus.W]: 4400
  },

  // Dependent exemption per dependent
  dependentExemption: 1000,

  // Age 65+ additional exemption
  seniorExemption: 700,

  // Blind exemption
  blindExemption: 2200,

  // No-tax status income thresholds
  noTaxStatus: {
    [FilingStatus.S]: 8000,
    [FilingStatus.MFJ]: 16400,
    [FilingStatus.MFS]: 8000,
    [FilingStatus.HOH]: 14400,
    [FilingStatus.W]: 8000
  },

  // Rental deduction cap
  rentalDeductionCap: 4000,

  // Commuter deduction
  commuterDeductionCap: 750
}

export default parameters
