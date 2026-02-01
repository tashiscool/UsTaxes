import { FilingStatus } from 'ustaxes/core/data'

/**
 * Utah 2025 Tax Parameters
 * Utah uses a flat 4.65% income tax rate
 */
const parameters = {
  // Utah flat tax rate (4.65% for 2025)
  taxRate: 0.0465,

  // Utah does not have a standard deduction
  // Instead, it uses a taxpayer tax credit based on federal deduction

  // Personal exemption amount (state exemption)
  personalExemption: {
    [FilingStatus.S]: 0,
    [FilingStatus.MFJ]: 0,
    [FilingStatus.MFS]: 0,
    [FilingStatus.HOH]: 0,
    [FilingStatus.W]: 0
  },

  // Dependent exemption
  dependentExemption: 0,

  // Utah Taxpayer Tax Credit
  // 6% of the sum of federal standard/itemized deduction + personal exemption amount
  taxpayerCreditRate: 0.06,

  // Utah personal exemption amounts for credit calculation
  utahPersonalExemption: {
    [FilingStatus.S]: 1950,
    [FilingStatus.MFJ]: 3900,
    [FilingStatus.MFS]: 1950,
    [FilingStatus.HOH]: 1950,
    [FilingStatus.W]: 1950
  },

  // Utah dependent exemption for credit calculation
  utahDependentExemption: 1950,

  // Utah does not tax Social Security benefits

  // Retirement income credit (up to $450 per person age 65+)
  retirementCreditMax: 450,

  // UT Earned Income Credit (percentage of federal EIC)
  eicPercentage: 0.2
}

export default parameters
