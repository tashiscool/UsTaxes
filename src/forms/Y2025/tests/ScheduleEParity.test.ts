import { cloneDeep } from 'lodash'
import { FilingStatus, Income1099Type, PersonRole } from 'ustaxes/core/data'
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

describe('Schedule E parity improvements', () => {
  it('flows 1099-MISC royalties and royalty expenses through Schedule E', () => {
    const information = cloneDeep(baseInformation)
    information.f1099s = [
      {
        payer: 'Creative Royalty House',
        type: Income1099Type.MISC,
        personRole: PersonRole.PRIMARY,
        form: {
          royalties: 3200
        }
      } as never
    ]
    information.scheduleEPage2 = {
      royaltyExpenses: 700
    }

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleE.isNeeded()).toBe(true)
    expect(f1040.scheduleE.l4()).toEqual([3200, undefined, undefined])
    expect(f1040.scheduleE.royaltyExpenses()).toBe(700)
    expect(f1040.scheduleE.l20()).toEqual([700, undefined, undefined])
    expect(f1040.scheduleE.l24()).toBe(2500)
    expect(f1040.scheduleE.l25()).toBe(0)
    expect(f1040.scheduleE.l41()).toBe(2500)
  })

  it('includes page 2 trust, REMIC, and farm rental branches in the total', () => {
    const information = cloneDeep(baseInformation)
    information.scheduleEPage2 = {
      estateTrustIncomeLoss: 900,
      remicIncomeLoss: -150,
      farmRentalIncomeLoss: 400
    }

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleE.isNeeded()).toBe(true)
    expect(f1040.scheduleE.l37()).toBe(900)
    expect(f1040.scheduleE.l39()).toBe(-150)
    expect(f1040.scheduleE.l40()).toBe(400)
    expect(f1040.scheduleE.page2NetIncomeLoss()).toBe(1150)
    expect(f1040.scheduleE.l41()).toBe(1150)
  })

  it('includes passive and nonpassive K-1 rental, royalty, and guaranteed payment totals', () => {
    const information = cloneDeep(baseInformation)
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Passive Property LP',
        partnershipEin: '111111111',
        partnerOrSCorp: 'P',
        isForeign: false,
        isPassive: true,
        ordinaryBusinessIncome: 100,
        netRentalRealEstateIncome: 800,
        otherNetRentalIncome: -100,
        royalties: 50,
        interestIncome: 0,
        guaranteedPaymentsForServices: 200,
        guaranteedPaymentsForCapital: 0,
        selfEmploymentEarningsA: 0,
        selfEmploymentEarningsB: 0,
        selfEmploymentEarningsC: 0,
        distributionsCodeAAmount: 0,
        section199AQBI: 0
      } as never,
      {
        partnershipName: 'Active Operations LLC',
        partnershipEin: '222222222',
        partnerOrSCorp: 'P',
        isForeign: false,
        isPassive: false,
        ordinaryBusinessIncome: -300,
        netRentalRealEstateIncome: 0,
        otherNetRentalIncome: 900,
        royalties: 40,
        interestIncome: 0,
        guaranteedPaymentsForServices: 60,
        guaranteedPaymentsForCapital: 0,
        selfEmploymentEarningsA: 0,
        selfEmploymentEarningsB: 0,
        selfEmploymentEarningsC: 0,
        distributionsCodeAAmount: 0,
        section199AQBI: 0
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleE.l29ah()).toBe(1050)
    expect(f1040.scheduleE.l29ak()).toBe(700)
    expect(f1040.scheduleE.l29bg()).toBe(0)
    expect(f1040.scheduleE.l29bi()).toBe(0)
    expect(f1040.scheduleE.l32()).toBe(1750)
    expect(f1040.scheduleE.l41()).toBe(1750)
  })

  it('treats qualified rental real estate as QBI only when explicitly marked', () => {
    const information = cloneDeep(baseInformation)
    information.realEstate = [
      {
        address: {
          address: '123 Qualified Rental Ave',
          aptNo: '',
          city: 'Denver',
          state: 'CO',
          zip: '80203'
        },
        rentalDays: 365,
        personalUseDays: 0,
        rentReceived: 28800,
        propertyType: 'singleFamily',
        qualifiedJointVenture: false,
        expenses: {
          advertising: 200,
          auto: 350,
          cleaning: 600,
          insurance: 1800,
          management: 2880,
          mortgage: 8400,
          repairs: 2500,
          supplies: 400,
          taxes: 3200,
          depreciation: 7273,
          other: 500
        },
        qualifiesForQbi: true,
        qbiBusinessName: 'Denver Rental Enterprise',
        qbiW2Wages: 0,
        qbiUbia: 160000
      } as never
    ]

    const f1040 = new F1040(information, [])
    const entries = f1040.f8995?.qbiEntries()

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Denver Rental Enterprise',
          qbi: 697,
          w2Wages: 0,
          ubia: 160000
        })
      ])
    )
  })

  it('includes other rental expenses and does not double count profitable rentals as losses', () => {
    const information = cloneDeep(baseInformation)
    information.realEstate = [
      {
        address: {
          address: '456 Rental Lane',
          aptNo: '',
          city: 'Denver',
          state: 'CO',
          zip: '80203'
        },
        rentalDays: 365,
        personalUseDays: 0,
        rentReceived: 28800,
        propertyType: 'singleFamily',
        qualifiedJointVenture: false,
        expenses: {
          advertising: 200,
          auto: 350,
          cleaning: 600,
          commissions: 0,
          insurance: 1800,
          legal: 0,
          management: 2880,
          mortgage: 8400,
          repairs: 2500,
          supplies: 400,
          taxes: 3200,
          utilities: 0,
          depreciation: 7273,
          other: 500
        }
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleE.l23e()).toBe(28103)
    expect(f1040.scheduleE.l24()).toBe(697)
    expect(f1040.scheduleE.l25()).toBe(0)
    expect(f1040.scheduleE.l26()).toBe(697)
    expect(f1040.scheduleE.l41()).toBe(697)
  })
})
