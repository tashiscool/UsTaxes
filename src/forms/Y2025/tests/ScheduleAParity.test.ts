import { cloneDeep } from 'lodash'

import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: {
    medicalAndDental: 0,
    stateAndLocalTaxes: 5000,
    isSalesTax: false,
    stateAndLocalRealEstateTaxes: 3000,
    stateAndLocalPropertyTaxes: 0,
    otherTaxes: 400,
    otherTaxesDescription: 'Generation-skipping tax',
    interest8a: 10000,
    interest8b: 0,
    interest8c: 0,
    interest8d: 0,
    investmentInterest: 0,
    charityCashCheck: 1000,
    charityOther: 0,
    casualtyLosses: 0,
    otherDeductions: 600
  },
  w2s: [
    {
      employer: { EIN: '123456789', employerName: 'Employer Inc' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'CA',
      income: 20000,
      medicareIncome: 20000,
      fedWithholding: 1500,
      ssWages: 20000,
      ssWithholding: 1240,
      medicareWithholding: 290,
      stateWages: 20000,
      stateWithholding: 700
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
      lastName: 'Itemizer',
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
  casualtyEvents: [
    {
      description: 'Wildfire loss',
      dateOfEvent: new Date('2025-08-01'),
      federallyDeclaredDisaster: true,
      qualifiedDisasterLoss: false,
      propertyType: 'personal',
      casualtyType: 'disaster',
      costBasis: 15000,
      fmvBefore: 12000,
      fmvAfter: 2000,
      insuranceReimbursement: 0
    }
  ]
}

describe('Schedule A parity', () => {
  it('pulls casualty losses from Form 4684, preserves Schedule A line 6 other taxes, and carries other deductions on line 16', () => {
    const information = cloneDeep(baseInformation)
    const f1040 = new F1040(information, [])

    expect(f1040.f4684?.personalCasualtyLossDeduction()).toBe(7900)
    expect(f1040.scheduleA.l6()).toBe(400)
    expect(f1040.scheduleA.l6OtherTaxesTypeAndAmount1()).toBe(
      'Generation-skipping tax'
    )
    expect(f1040.scheduleA.l15()).toBe(7900)
    expect(f1040.scheduleA.l16()).toBe(600)
    expect(f1040.scheduleA.l16Other1()).toBe('Other deductions')
    expect(f1040.scheduleA.l17()).toBe(27900)
  })

  it('falls back to imported casualty totals when no Form 4684 events are present', () => {
    const information = cloneDeep(baseInformation)
    information.casualtyEvents = []
    information.itemizedDeductions = {
      ...information.itemizedDeductions!,
      casualtyLosses: 250
    }

    const f1040 = new F1040(information, [])

    expect(f1040.f4684?.isNeeded()).toBe(false)
    expect(f1040.scheduleA.l15()).toBe(250)
  })
})
