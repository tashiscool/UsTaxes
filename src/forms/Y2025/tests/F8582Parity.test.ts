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
  w2s: [],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: '0001 Main St',
        aptNo: '',
        city: 'Little Rock',
        state: 'AR',
        zip: '72201'
      },
      firstName: 'Taylor',
      lastName: 'Payer',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '111111111',
      dateOfBirth: new Date('1970-01-01'),
      isBlind: false
    },
    spouse: undefined,
    dependents: [],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'AL' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

describe('Form 8582 workbook parity improvements', () => {
  it('uses the full Schedule E-style passive K-1 amount instead of only ordinary income', () => {
    const information = cloneDeep(baseInformation)
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Passive Property LP',
        partnershipEin: '111111111',
        partnerOrSCorp: 'P',
        isForeign: false,
        isPassive: true,
        ordinaryBusinessIncome: 100,
        netRentalRealEstateIncome: -500,
        otherNetRentalIncome: 0,
        royalties: 50,
        interestIncome: 0,
        guaranteedPaymentsForServices: 25,
        guaranteedPaymentsForCapital: 0,
        selfEmploymentEarningsA: 0,
        selfEmploymentEarningsB: 0,
        selfEmploymentEarningsC: 0,
        distributionsCodeAAmount: 0,
        section199AQBI: 0,
        priorYearUnallowedLoss: 400
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f8582?.otherPassiveIncome()).toBe(0)
    expect(f1040.f8582?.otherPassiveLoss()).toBe(-325)
    expect(f1040.f8582?.l2b()).toBe(325)
    expect(f1040.f8582?.l2c()).toBe(400)
    expect(f1040.f8582?.isNeeded()).toBe(true)
  })

  it('includes prior-year rental carryovers even when there is no current-year rental loss', () => {
    const information = cloneDeep(baseInformation)
    information.realEstate = [
      {
        address: {
          address: '123 Carryover Lane',
          aptNo: '',
          city: 'Denver',
          state: 'CO',
          zip: '80203'
        },
        rentalDays: 365,
        personalUseDays: 0,
        rentReceived: 12000,
        propertyType: 'singleFamily',
        qualifiedJointVenture: false,
        expenses: {
          mortgage: 5000,
          taxes: 1000
        },
        priorYearPassiveLossCarryover: 3600
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f8582?.l1a()).toBe(6000)
    expect(f1040.f8582?.l1b()).toBe(0)
    expect(f1040.f8582?.l1c()).toBe(3600)
    expect(f1040.f8582?.isNeeded()).toBe(true)
  })

  it('blocks the special allowance when there is no active participation', () => {
    const information = cloneDeep(baseInformation)
    information.realEstate = [
      {
        address: {
          address: '555 Passive Way',
          aptNo: '',
          city: 'Austin',
          state: 'TX',
          zip: '78701'
        },
        rentalDays: 365,
        personalUseDays: 0,
        rentReceived: 12000,
        propertyType: 'singleFamily',
        qualifiedJointVenture: false,
        expenses: {
          mortgage: 10000,
          taxes: 4500,
          repairs: 2500
        },
        activeParticipation: false
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f8582?.hasActiveParticipation()).toBe(false)
    expect(f1040.f8582?.qualifiesForSpecialAllowance()).toBe(false)
    expect(f1040.f8582?.l9()).toBe(0)
    expect(f1040.f8582?.l11()).toBe(0)
  })

  it('blocks the special allowance for MFS filers who did not live apart all year', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.filingStatus = FilingStatus.MFS
    information.realEstate = [
      {
        address: {
          address: '901 Duplex Dr',
          aptNo: '',
          city: 'Phoenix',
          state: 'AZ',
          zip: '85001'
        },
        rentalDays: 365,
        personalUseDays: 0,
        rentReceived: 10000,
        propertyType: 'singleFamily',
        qualifiedJointVenture: false,
        expenses: {
          mortgage: 9000,
          taxes: 3500
        },
        activeParticipation: true
      } as never
    ]
    information.scheduleEPage2 = {
      activeParticipationRentalRealEstate: true,
      mfsLivedApartAllYear: false
    }

    const f1040 = new F1040(information, [])

    expect(f1040.f8582?.hasActiveParticipation()).toBe(true)
    expect(f1040.f8582?.marriedFilingSeparatelyLivedApartAllYear()).toBe(false)
    expect(f1040.f8582?.qualifiesForSpecialAllowance()).toBe(false)
    expect(f1040.f8582?.l9()).toBe(0)
    expect(f1040.f8582?.l11()).toBe(0)
  })
})
