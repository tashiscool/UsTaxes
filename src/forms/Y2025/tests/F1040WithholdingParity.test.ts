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
      lastName: 'Withholding',
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

describe('Form 1040 withholding parity', () => {
  it('carries other federal withholding sources into line 25c', () => {
    const information = cloneDeep(baseInformation)
    information.otherFederalWithholdingCredits = [
      { source: 'W2G', amount: 125, description: 'Casino withholding' },
      { source: '1042-S', amount: 375, description: 'Foreign withholding' }
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.l25c()).toBe(500)
    expect(f1040.l25d()).toBe(5000)
  })

  it('adds additional Medicare withholding to other line 25c sources', () => {
    const information = cloneDeep(baseInformation)
    information.otherFederalWithholdingCredits = [
      { source: '8805', amount: 250, description: 'Partnership withholding' }
    ]

    const f1040 = new F1040(information, [])
    f1040.f8959.l24 = () => 100

    expect(f1040.l25c()).toBe(350)
    expect(f1040.l25d()).toBe(4850)
  })
})
