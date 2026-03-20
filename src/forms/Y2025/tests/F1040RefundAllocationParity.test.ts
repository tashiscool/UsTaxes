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
      fedWithholding: 6000,
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
      lastName: 'Refund',
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

describe('Form 1040 refund allocation parity', () => {
  it('splits overpayment between line 35a and line 36', () => {
    const information = cloneDeep(baseInformation)
    information.appliedToNextYearEstimatedTax = 500

    const f1040 = new F1040(information, [])

    expect(f1040.l34()).toBeGreaterThan(500)
    expect(f1040.l36()).toBe(500)
    expect(f1040.l35a()).toBe(f1040.l34() - 500)
  })

  it('allows the full overpayment to be applied to next year estimated tax', () => {
    const baseline = new F1040(cloneDeep(baseInformation), [])
    const information = cloneDeep(baseInformation)
    information.appliedToNextYearEstimatedTax = baseline.l34()

    const f1040 = new F1040(information, [])

    expect(f1040.l35a()).toBe(0)
    expect(f1040.l36()).toBe(baseline.l34())
  })

  it('clamps an excessive next-year estimated-tax allocation to line 34', () => {
    const information = cloneDeep(baseInformation)
    information.appliedToNextYearEstimatedTax = 999999

    const f1040 = new F1040(information, [])

    expect(f1040.l35a()).toBe(0)
    expect(f1040.l36()).toBe(f1040.l34())
  })
})
