import { cloneDeep } from 'lodash'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'
import * as federal from '../data/federal'

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [
    {
      employer: { EIN: '111111111', employerName: 'w2s employer name' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'AL',
      income: 12000,
      medicareIncome: 12000,
      fedWithholding: 0,
      ssWages: 12000,
      ssWithholding: 0,
      medicareWithholding: 0,
      stateWages: 12000,
      stateWithholding: 0
    }
  ],
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
    dependents: [
      {
        firstName: 'Casey',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '333221111',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2020-03-01'),
        isBlind: false
      }
    ],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'AL' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

const buildF1040 = (overrides: Partial<ValidatedInformation> = {}): F1040 =>
  new F1040({ ...cloneDeep(baseInformation), ...overrides }, [])

describe('ScheduleEIC', () => {
  it('disallows EIC for income below threshold', async () => {
    const f1040 = buildF1040()
    const formula = federal.EIC.formulas[f1040.info.taxPayer.filingStatus]
    if (formula !== undefined && f1040.wages() < formula[0][1].lowerBound) {
      expect(f1040.scheduleEIC.allowed()).toBe(false)
      expect(f1040.scheduleEIC.credit()).toBe(0)
    }
  })

  it('rejects EIC when a qualifying child has an ITIN instead of a valid SSN', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = [
      {
        firstName: 'Casey',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '912-70-1234',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2020-03-01'),
        isBlind: false
      }
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.validSSNs()).toBe(false)
    expect(f1040.scheduleEIC.allowed()).toBe(false)
  })

  it('rejects EIC when the return carries nonresident alien information', () => {
    const information = cloneDeep(baseInformation)
    information.nonresidentAlienReturn = {
      nonresidentInfo: {
        countryOfCitizenship: 'GB',
        countryOfResidence: 'GB',
        visaType: 'H1B',
        dateEnteredUS: new Date('2025-01-15'),
        daysInUSThisYear: 120,
        claimsTaxTreaty: false,
        hasEffectivelyConnectedIncome: false,
        hasFDAPIncome: false
      },
      effectivelyConnectedIncome: {
        wages: 0,
        businessIncome: 0,
        capitalGains: 0,
        rentalIncome: 0,
        partnershipIncome: 0,
        otherIncome: 0
      },
      taxWithheld: 0,
      estimatedTaxPayments: 0
    }

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.allowedNonresidentAlien()).toBe(false)
    expect(f1040.scheduleEIC.allowed()).toBe(false)
  })

  it('detects foreign earned income exclusion and royalty-driven personal property income', () => {
    const information = cloneDeep(baseInformation)
    information.foreignEarnedIncome = {
      foreignCountry: 'CA',
      foreignAddress: '123 Rue Example',
      employerIsForeign: true,
      foreignEarnedWages: 8000,
      foreignEarnedSelfEmployment: 0,
      foreignHousingAmount: 0,
      qualifyingTest: 'physicalPresence',
      taxHomeCountry: 'CA',
      physicalPresenceDays: 365
    }
    information.f1099s = [
      {
        payer: 'Creative Royalty House',
        type: 'MISC',
        personRole: PersonRole.PRIMARY,
        form: {
          royalties: 600
        }
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.allowedFilling2555()).toBe(false)
    expect(f1040.scheduleEIC.passIncomeFromPersonalProperty()).toBe(false)
    expect(f1040.scheduleEIC.allowed()).toBe(false)
  })

  it('detects passive activity income from Schedule E K-1 data', () => {
    const information = cloneDeep(baseInformation)
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Passive Property LP',
        partnershipEin: '111111111',
        partnerOrSCorp: 'P',
        isForeign: false,
        isPassive: true,
        ordinaryBusinessIncome: 20000,
        netRentalRealEstateIncome: 0,
        otherNetRentalIncome: 0,
        royalties: 0,
        interestIncome: 0,
        guaranteedPaymentsForServices: 0,
        guaranteedPaymentsForCapital: 0,
        selfEmploymentEarningsA: 0,
        selfEmploymentEarningsB: 0,
        selfEmploymentEarningsC: 0,
        distributionsCodeAAmount: 0,
        section199AQBI: 0
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.incomeOrLossFromPassiveActivity()).toBe(true)
    expect(f1040.scheduleEIC.allowed()).toBe(false)
  })

  it('allows childless EIC when age and home tests are met', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = []
    information.taxPayer.primaryPerson.dateOfBirth = new Date('1995-06-15')

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.atLeastOneChild()).toBe(false)
    expect(f1040.scheduleEIC.over25Under65()).toBe(true)
    expect(f1040.scheduleEIC.mainHomeInsideUsBothPeople()).toBe(true)
    expect(f1040.scheduleEIC.allowed()).toBe(true)
    expect(f1040.scheduleEIC.credit()).toBeGreaterThan(0)
  })

  it('rejects childless EIC when the taxpayer is under 25 at year end', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = []
    information.taxPayer.primaryPerson.dateOfBirth = new Date('2006-03-01')

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.atLeastOneChild()).toBe(false)
    expect(f1040.scheduleEIC.over25Under65()).toBe(false)
    expect(f1040.scheduleEIC.allowed()).toBe(false)
  })

  it('rejects childless EIC when the filer lacks a main home in the United States', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = []
    information.taxPayer.primaryPerson.dateOfBirth = new Date('1990-02-02')
    information.taxPayer.primaryPerson.address = {
      address: '1 Rue Example',
      city: 'Montreal',
      foreignCountry: 'CA',
      postalCode: 'H1A 1A1'
    }
    information.stateResidencies = []

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleEIC.mainHomeInsideUsBothPeople()).toBe(false)
    expect(f1040.scheduleEIC.allowed()).toBe(false)
  })
})
