import { FilingStatus } from 'ustaxes/core/data'

/**
 * Arizona 2024 Tax Parameters
 * Arizona uses a flat 2.5% income tax rate as of 2023
 * Standard deduction amounts for 2024
 */
const parameters = {
  // Arizona flat tax rate (2.5% as of 2023)
  taxRate: 0.025,

  // Standard deduction amounts for 2024
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemptions (Arizona still has these)
  personalExemption: {
    [FilingStatus.S]: 2300,
    [FilingStatus.MFJ]: 4600,
    [FilingStatus.MFS]: 2300,
    [FilingStatus.HOH]: 2300,
    [FilingStatus.W]: 4600
  },

  // Dependent exemption per dependent
  dependentExemption: 2300,

  // Age 65+ additional exemption
  seniorExemption: 2100,

  // Blind exemption
  blindExemption: 1500
}

export default parameters
