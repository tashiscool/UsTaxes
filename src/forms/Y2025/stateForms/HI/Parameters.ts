import { FilingStatus } from 'ustaxes/core/data'

/**
 * Hawaii 2025 Tax Parameters
 * Hawaii uses progressive income tax rates (1.4% to 11%)
 * Hawaii has one of the highest state income tax rates in the US
 */
const parameters = {
  // Hawaii tax brackets for 2025
  // 12 brackets: 1.4%, 3.2%, 5.5%, 6.4%, 6.8%, 7.2%, 7.6%, 7.9%, 8.25%, 9%, 10%, 11%
  taxBrackets: {
    [FilingStatus.S]: {
      brackets: [
        2400, 4800, 9600, 14400, 19200, 24000, 36000, 48000, 150000, 175000,
        200000
      ],
      rates: [
        0.014, 0.032, 0.055, 0.064, 0.068, 0.072, 0.076, 0.079, 0.0825, 0.09,
        0.1, 0.11
      ]
    },
    [FilingStatus.MFJ]: {
      brackets: [
        4800, 9600, 19200, 28800, 38400, 48000, 72000, 96000, 300000, 350000,
        400000
      ],
      rates: [
        0.014, 0.032, 0.055, 0.064, 0.068, 0.072, 0.076, 0.079, 0.0825, 0.09,
        0.1, 0.11
      ]
    },
    [FilingStatus.MFS]: {
      brackets: [
        2400, 4800, 9600, 14400, 19200, 24000, 36000, 48000, 150000, 175000,
        200000
      ],
      rates: [
        0.014, 0.032, 0.055, 0.064, 0.068, 0.072, 0.076, 0.079, 0.0825, 0.09,
        0.1, 0.11
      ]
    },
    [FilingStatus.HOH]: {
      brackets: [
        3600, 7200, 14400, 21600, 28800, 36000, 54000, 72000, 225000, 262500,
        300000
      ],
      rates: [
        0.014, 0.032, 0.055, 0.064, 0.068, 0.072, 0.076, 0.079, 0.0825, 0.09,
        0.1, 0.11
      ]
    },
    [FilingStatus.W]: {
      brackets: [
        4800, 9600, 19200, 28800, 38400, 48000, 72000, 96000, 300000, 350000,
        400000
      ],
      rates: [
        0.014, 0.032, 0.055, 0.064, 0.068, 0.072, 0.076, 0.079, 0.0825, 0.09,
        0.1, 0.11
      ]
    }
  },

  // Standard deduction for 2025
  standardDeduction: {
    [FilingStatus.S]: 2200,
    [FilingStatus.MFJ]: 4400,
    [FilingStatus.MFS]: 2200,
    [FilingStatus.HOH]: 3212,
    [FilingStatus.W]: 4400
  },

  // Personal exemption
  personalExemption: {
    [FilingStatus.S]: 1144,
    [FilingStatus.MFJ]: 2288,
    [FilingStatus.MFS]: 1144,
    [FilingStatus.HOH]: 1144,
    [FilingStatus.W]: 2288
  },

  // Dependent exemption
  dependentExemption: 1144,

  // Low income tax credit
  lowIncomeExemption: {
    [FilingStatus.S]: 3212,
    [FilingStatus.MFJ]: 4400,
    [FilingStatus.MFS]: 2200,
    [FilingStatus.HOH]: 3712,
    [FilingStatus.W]: 4400
  },

  // Food/Excise Tax Credit (refundable)
  foodExciseTaxCredit: {
    [FilingStatus.S]: 110,
    [FilingStatus.MFJ]: 110,
    [FilingStatus.MFS]: 55,
    [FilingStatus.HOH]: 110,
    [FilingStatus.W]: 110
  },
  foodExciseTaxCreditDependent: 110
}

export default parameters
