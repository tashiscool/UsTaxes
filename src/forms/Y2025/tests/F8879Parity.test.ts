import { cloneDeep } from 'lodash'

import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [
    {
      employer: { EIN: '123456789', employerName: 'Employer Inc' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'CA',
      income: 50000,
      medicareIncome: 50000,
      fedWithholding: 4500,
      ssWages: 50000,
      ssWithholding: 3100,
      medicareWithholding: 725,
      stateWages: 50000,
      stateWithholding: 1800
    }
  ],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: '123 Main St',
        aptNo: '',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001'
      },
      firstName: 'Taylor',
      lastName: 'Signer',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '111223333',
      dateOfBirth: new Date('1988-01-01'),
      isBlind: false
    },
    spouse: undefined,
    dependents: [],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'CA' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

describe('Form 8879 parity', () => {
  it('derives e-file signature data and current-return totals from form8879 inputs', () => {
    const information = cloneDeep(baseInformation)
    information.form8879 = {
      form8879Consent: true,
      agreed8879: true,
      taxpayerPIN: '12345',
      signatureTimestamp: '2025-04-15T12:00:00.000Z',
      eroFirmName: 'TaxFlow Self-Service'
    }

    const f1040 = new F1040(information, [])
    const f8879 = f1040.f8879

    expect(f8879?.isNeeded()).toBe(true)
    expect(f8879?.taxpayerName()).toBe('Taylor Signer')
    expect(f8879?.taxpayerSSN()).toBe('111223333')
    expect(f8879?.taxpayerPIN()).toBe('12345')
    expect(f8879?.adjustedGrossIncome()).toBe(f1040.l11())
    expect(f8879?.totalTax()).toBe(f1040.l24())
    expect(f8879?.federalIncomeTaxWithheld()).toBe(f1040.l25d())
    expect(f8879?.refundAmount()).toBe(f1040.l34())
    expect(f8879?.amountOwed()).toBe(f1040.l37())
    expect(f8879?.isValid()).toBe(true)
  })
})
