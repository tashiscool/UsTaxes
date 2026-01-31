import { FilingStatus } from 'ustaxes/core/data'

/**
 * Vermont 2025 Tax Parameters
 * Vermont uses progressive income tax rates (3.35% to 8.75%)
 * 4 tax brackets
 */
const parameters = {
  // Vermont tax brackets for 2025
  // Rates: 3.35%, 6.60%, 7.60%, 8.75%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [45400, 110050, 229550],
      rates: [0.0335, 0.066, 0.076, 0.0875]
    },
    [FilingStatus.MFJ]: {
      brackets: [75850, 183400, 279450],
      rates: [0.0335, 0.066, 0.076, 0.0875]
    },
    [FilingStatus.MFS]: {
      brackets: [37925, 91700, 139725],
      rates: [0.0335, 0.066, 0.076, 0.0875]
    },
    [FilingStatus.HOH]: {
      brackets: [60600, 156600, 254450],
      rates: [0.0335, 0.066, 0.076, 0.0875]
    },
    [FilingStatus.W]: {
      brackets: [75850, 183400, 279450],
      rates: [0.0335, 0.066, 0.076, 0.0875]
    }
  },

  // Standard deduction for 2025 (Vermont uses federal amounts)
  standardDeduction: {
    [FilingStatus.S]: 14600,
    [FilingStatus.MFJ]: 29200,
    [FilingStatus.MFS]: 14600,
    [FilingStatus.HOH]: 21900,
    [FilingStatus.W]: 29200
  },

  // Personal exemption amount
  personalExemption: {
    [FilingStatus.S]: 4850,
    [FilingStatus.MFJ]: 9700, // Taxpayer + spouse
    [FilingStatus.MFS]: 4850,
    [FilingStatus.HOH]: 4850,
    [FilingStatus.W]: 4850
  },

  // Dependent exemption
  dependentExemption: 4850,

  // Vermont does not tax Social Security benefits

  // VT Earned Income Credit (percentage of federal EIC)
  eicPercentage: 0.38,

  // VT Child and Dependent Care Credit (percentage of federal)
  childCarePercentage: 0.50,

  // VT Renter Rebate max
  renterRebateMax: 3000
}

export default parameters
