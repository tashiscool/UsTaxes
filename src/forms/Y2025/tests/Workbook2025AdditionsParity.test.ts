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
      employer: { EIN: '111111111', employerName: 'Employer Inc' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'CO',
      income: 100000,
      medicareIncome: 100000,
      fedWithholding: 0,
      ssWages: 100000,
      ssWithholding: 0,
      medicareWithholding: 0,
      stateWages: 100000,
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
        city: 'Denver',
        state: 'CO',
        zip: '80202'
      },
      firstName: 'Morgan',
      lastName: 'Workbook',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '400014444',
      dateOfBirth: new Date('1978-02-14'),
      isBlind: false
    },
    spouse: undefined,
    dependents: [],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'CO' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

describe('Workbook 2025 additions parity', () => {
  it('computes Form 4137 tax for unreported tip income', () => {
    const information = cloneDeep(baseInformation)
    information.unreportedTipIncome = 10000

    const f1040 = new F1040(information, [])

    expect(f1040.f4137?.isNeeded()).toBe(true)
    expect(f1040.f4137?.l10()).toBe(10000)
    expect(f1040.f4137?.l11()).toBe(620)
    expect(f1040.f4137?.l12()).toBe(145)
    expect(f1040.f4137?.l13()).toBe(765)
  })

  it('computes Form 8919 tax with the remaining social-security wage base', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 170000
    information.w2s[0].medicareIncome = 170000
    information.w2s[0].ssWages = 170000
    information.w2s[0].stateWages = 170000
    information.uncollectedSSTaxWages = [
      {
        employerName: 'Misclassified Employer LLC',
        employerEIN: '222222222',
        wagesReceived: 20000,
        reasonCode: 'A'
      }
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f8919?.isNeeded()).toBe(true)
    expect(f1040.f8919?.l9()).toBe(6100)
    expect(f1040.f8919?.l10()).toBe(6100)
    expect(f1040.f8919?.l11()).toBe(378.2)
    expect(f1040.f8919?.l12()).toBe(290)
    expect(f1040.f8919?.l13()).toBe(668.2)
    expect(f1040.f8919?.l14()).toBe(668.2)
  })

  it('computes Form 8801 credit and carryforward from prior-year AMT inputs', () => {
    const information = cloneDeep(baseInformation)
    information.priorYearAmtCredit = 5000
    information.priorYearAmtCreditCarryforward = 1000
    information.priorYearAmt = {
      line6: 4000,
      exclusionItems: 500,
      foreignTaxCredit: 0
    }

    const f1040 = new F1040(information, [])

    expect(f1040.f8801?.isNeeded()).toBe(true)
    expect(f1040.f8801?.l4()).toBe(3500)
    expect(f1040.f8801?.l7()).toBe(6000)
    expect(f1040.f8801?.credit()).toBe(6000)
    expect(f1040.f8801?.carryforward()).toBe(0)
    expect(f1040.schedule3.l6a()).toBe(6000)
  })

  it('routes Forms 4137 and 8919 plus W-2 box 12 uncollected tax through Schedule 2', () => {
    const information = cloneDeep(baseInformation)
    information.unreportedTipIncome = 10000
    information.uncollectedSSTaxWages = [
      {
        employerName: 'Misclassified Employer LLC',
        employerEIN: '222222222',
        wagesReceived: 20000,
        reasonCode: 'A'
      }
    ]
    information.w2s[0].box12 = {
      A: 100,
      B: 40,
      M: 25,
      N: 10
    }

    const f1040 = new F1040(information, [])

    expect(f1040.schedule2.l5()).toBe(765)
    expect(f1040.schedule2.l6()).toBe(1530)
    expect(f1040.schedule2.l7()).toBe(2295)
    expect(f1040.schedule2.l13()).toBe(175)
    expect(f1040.schedule2.l21()).toBe(2470)
    expect(f1040.l23()).toBe(2470)
  })
})
