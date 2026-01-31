import { FilingStatus } from 'ustaxes/core/data'

/**
 * NYC 2025 Tax Parameters
 * NYC imposes a progressive income tax on residents in addition to NY State tax
 * Tax rates range from 3.078% to 3.876%
 */
const parameters = {
  // NYC tax brackets for 2025
  // Rates: 3.078%, 3.762%, 3.819%, 3.876%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [12000, 25000, 50000],
      rates: [0.03078, 0.03762, 0.03819, 0.03876]
    },
    [FilingStatus.MFJ]: {
      brackets: [21600, 45000, 90000],
      rates: [0.03078, 0.03762, 0.03819, 0.03876]
    },
    [FilingStatus.MFS]: {
      brackets: [12000, 25000, 50000],
      rates: [0.03078, 0.03762, 0.03819, 0.03876]
    },
    [FilingStatus.HOH]: {
      brackets: [14400, 30000, 60000],
      rates: [0.03078, 0.03762, 0.03819, 0.03876]
    },
    [FilingStatus.W]: {
      brackets: [21600, 45000, 90000],
      rates: [0.03078, 0.03762, 0.03819, 0.03876]
    }
  },

  // NYC School Tax Credit
  // Credit for NYC residents based on income
  schoolTaxCredit: {
    [FilingStatus.S]: {
      maxCredit: 63,
      incomeThreshold: 250000,
      reducedCredit: 0
    },
    [FilingStatus.MFJ]: {
      maxCredit: 125,
      incomeThreshold: 250000,
      reducedCredit: 0
    },
    [FilingStatus.MFS]: {
      maxCredit: 63,
      incomeThreshold: 250000,
      reducedCredit: 0
    },
    [FilingStatus.HOH]: {
      maxCredit: 63,
      incomeThreshold: 250000,
      reducedCredit: 0
    },
    [FilingStatus.W]: {
      maxCredit: 125,
      incomeThreshold: 250000,
      reducedCredit: 0
    }
  },

  // NYC Household Credit
  // Available to residents with income below thresholds
  householdCredit: {
    [FilingStatus.S]: {
      incomeThreshold: 30000,
      baseCredit: 15,
      perDependentCredit: 15,
      maxDependents: 3
    },
    [FilingStatus.MFJ]: {
      incomeThreshold: 55000,
      baseCredit: 30,
      perDependentCredit: 30,
      maxDependents: 3
    },
    [FilingStatus.MFS]: {
      incomeThreshold: 30000,
      baseCredit: 15,
      perDependentCredit: 15,
      maxDependents: 3
    },
    [FilingStatus.HOH]: {
      incomeThreshold: 50000,
      baseCredit: 30,
      perDependentCredit: 30,
      maxDependents: 3
    },
    [FilingStatus.W]: {
      incomeThreshold: 55000,
      baseCredit: 30,
      perDependentCredit: 30,
      maxDependents: 3
    }
  },

  // NYC Unincorporated Business Tax (UBT) - for self-employed
  ubtRate: 0.04,
  ubtExemption: 95000,

  // NYC Enhanced Real Property Tax Credit (for renters)
  rentCredit: {
    maxCredit: 500,
    incomeThreshold: 200000
  }
}

export default parameters
