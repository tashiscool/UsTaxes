import { commonTests } from '.'
import { cloneDeep } from 'lodash'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import Schedule8812 from '../irsForms/Schedule8812'
import F1040 from '../irsForms/F1040'

const withSchedule8812 = async (
  f: (f1040: F1040, s8812: Schedule8812) => void
): Promise<void> =>
  await commonTests.withValid1040(
    (f1040: F1040): void => {
      if (f1040.schedule8812.isNeeded()) {
        f(f1040, f1040.schedule8812)
      }
    },
    // Add filter to info property so we're only testing in the domain
    // we care about.
    (info) => info.taxPayer.dependents.length > 0
  )

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
      income: 6000,
      medicareIncome: 6000,
      fedWithholding: 0,
      ssWages: 6000,
      ssWithholding: 372,
      medicareWithholding: 87,
      stateWages: 6000,
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
    dependents: [],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'AL' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

describe('Schedule 8812', () => {
  it('should be attached with qualifiying dependents', async () => {
    await commonTests.withValid1040((f1040) => {
      // If there are qualifying dependents, we must have a schedule 8812
      if (f1040.qualifyingDependents.qualifyingChildren().length > 0) {
        expect(f1040.schedule8812).not.toBe(undefined)
      }
    })
  })

  it('should not produce line 5 with no dependents', async () => {
    await withSchedule8812((f1040, s8812) => {
      // If Schedule A is attached, the deduction should be greater than the standard deduction
      if (s8812.l4() === 0) {
        expect(s8812.l5()).toEqual(0)
      }
    })
  })

  it('should show a multiple of 1000 at l10', async () => {
    await withSchedule8812((f1040, s8812) => {
      expect(s8812.l10() % 1000).toEqual(0)
    })
  })

  it('counts only qualifying other dependents and children without a valid child-credit SSN on line 6', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = [
      {
        firstName: 'Ava',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '333221111',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2020-02-01'),
        isBlind: false
      },
      {
        firstName: 'Blake',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '900701234',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2021-03-01'),
        isBlind: false
      },
      {
        firstName: 'Casey',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '444221111',
        relationship: 'Parent',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2006-06-01'),
        isBlind: false
      },
      {
        firstName: 'Drew',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '555221111',
        relationship: 'Friend',
        dateOfBirth: new Date('2000-06-01'),
        isBlind: false
      } as never
    ]

    const f1040 = new F1040(information, [])
    const s8812 = f1040.schedule8812

    expect(s8812.l4()).toBe(1)
    expect(s8812.l6()).toBe(2)
    expect(s8812.l7()).toBe(1000)
  })

  it('uses Part II-B when three qualifying children have higher payroll-tax based credit', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = [
      {
        firstName: 'Ava',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '333221111',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2020-02-01'),
        isBlind: false
      },
      {
        firstName: 'Blake',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '444221111',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2021-03-01'),
        isBlind: false
      },
      {
        firstName: 'Casey',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '555221111',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2022-04-01'),
        isBlind: false
      }
    ]

    const f1040 = new F1040(information, [])
    const s8812 = f1040.schedule8812

    f1040.l27 = () => 0
    f1040.schedule2.l13 = () => 2000

    expect(s8812.part2a().toLine27).toBeUndefined()
    expect(s8812.part2b().allowed).toBe(true)
    expect(s8812.part2b().toLine27).toBe(2459)
    expect(s8812.l27()).toBe(2459)
  })
})
