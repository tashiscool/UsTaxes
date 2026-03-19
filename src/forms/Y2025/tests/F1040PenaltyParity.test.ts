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
      income: 60000,
      medicareIncome: 60000,
      fedWithholding: 0,
      ssWages: 60000,
      ssWithholding: 3720,
      medicareWithholding: 870,
      stateWages: 60000,
      stateWithholding: 0
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
      lastName: 'Penalty',
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
  individualRetirementArrangements: [],
  priorYearTax: 5000
}

describe('Form 1040 penalty parity', () => {
  it('routes the Form 2210 underpayment penalty to line 38', () => {
    const information = cloneDeep(baseInformation)
    const f1040 = new F1040(information, [])

    expect(f1040.f2210?.isNeeded()).toBe(true)
    expect(f1040.f2210?.penalty()).toBeGreaterThan(0)
    expect(f1040.l38()).toBe(f1040.f2210?.penalty())
  })
})
