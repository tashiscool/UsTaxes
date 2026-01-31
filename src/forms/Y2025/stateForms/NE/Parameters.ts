import { FilingStatus } from 'ustaxes/core/data'

/**
 * Nebraska 2025 Tax Parameters
 * Nebraska uses a progressive income tax with 4 brackets (2.46%-5.84%)
 */
const parameters = {
  // Nebraska progressive tax brackets (2025)
  // Brackets vary by filing status
  taxBrackets: {
    [FilingStatus.S]: [
      { min: 0, max: 3700, rate: 0.0246 },
      { min: 3700, max: 22170, rate: 0.0351 },
      { min: 22170, max: 35730, rate: 0.0501 },
      { min: 35730, max: Infinity, rate: 0.0584 }
    ],
    [FilingStatus.MFJ]: [
      { min: 0, max: 7390, rate: 0.0246 },
      { min: 7390, max: 44340, rate: 0.0351 },
      { min: 44340, max: 71460, rate: 0.0501 },
      { min: 71460, max: Infinity, rate: 0.0584 }
    ],
    [FilingStatus.MFS]: [
      { min: 0, max: 3700, rate: 0.0246 },
      { min: 3700, max: 22170, rate: 0.0351 },
      { min: 22170, max: 35730, rate: 0.0501 },
      { min: 35730, max: Infinity, rate: 0.0584 }
    ],
    [FilingStatus.HOH]: [
      { min: 0, max: 6620, rate: 0.0246 },
      { min: 6620, max: 33640, rate: 0.0351 },
      { min: 33640, max: 54590, rate: 0.0501 },
      { min: 54590, max: Infinity, rate: 0.0584 }
    ],
    [FilingStatus.W]: [
      { min: 0, max: 7390, rate: 0.0246 },
      { min: 7390, max: 44340, rate: 0.0351 },
      { min: 44340, max: 71460, rate: 0.0501 },
      { min: 71460, max: Infinity, rate: 0.0584 }
    ]
  },

  // Nebraska standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 7900,
    [FilingStatus.MFJ]: 15800,
    [FilingStatus.MFS]: 7900,
    [FilingStatus.HOH]: 11600,
    [FilingStatus.W]: 15800
  },

  // Personal exemption credit (not deduction)
  personalExemptionCredit: {
    [FilingStatus.S]: 157,
    [FilingStatus.MFJ]: 314,
    [FilingStatus.MFS]: 157,
    [FilingStatus.HOH]: 157,
    [FilingStatus.W]: 314
  },

  // Dependent exemption credit
  dependentExemptionCredit: 157,

  // Nebraska does not tax Social Security benefits
  // (Full exemption starting 2025)

  // Earned Income Tax Credit (percentage of federal EITC)
  eitcPercentage: 0.10
}

export default parameters
