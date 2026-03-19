/* eslint @typescript-eslint/no-empty-function: "off" */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { FilingStatus, Income1099Type, PersonRole } from 'ustaxes/core/data'
import F1040 from '../irsForms/F1040'
import F6251 from '../irsForms/F6251'
import { cloneDeep } from 'lodash'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import federalBrackets, { amt } from '../data/federal'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [
    {
      name: 'Stock Option',
      personRole: PersonRole.PRIMARY,
      exercisePricePerShare: 1,
      fmv: 101,
      numShares: 1000
    }
  ],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [
    {
      employer: { EIN: '111111111', employerName: 'w2s employer name' },
      personRole: PersonRole.PRIMARY,
      occupation: 'w2s-occupation',
      state: 'AL',
      income: 100000,
      medicareIncome: 0,
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
        address: '0001',
        aptNo: '',
        city: 'AR city',
        state: 'AR',
        zip: '1234567'
      },
      firstName: 'payer-first-name',
      lastName: 'payer-last-name',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '111111111',
      dateOfBirth: new Date('01/01/1970'),
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

describe('AMT', () => {
  it('stock options should trigger AMT', () => {
    const information = cloneDeep(baseInformation)
    const income = baseInformation.w2s[0].income
    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)
    expect(f6251.isNeeded()).toEqual(true)
    expect(Math.round(f6251.l1() ?? 0)).toEqual(
      income -
        federalBrackets.ordinary.status[FilingStatus.S].deductions[0].amount
    )
    expect(Math.round(f6251.l7() ?? 0)).toEqual(
      (income +
        100000 -
        (amt.exemption(FilingStatus.S, income + 100000) ?? 0)) *
        0.26
    )
    expect(Math.round(f6251.l10())).toEqual(Math.round(f1040.l16() ?? 0))
    expect(Math.round(f6251.l11())).toEqual(
      Math.round(f6251.l9() - f6251.l10())
    )
  })

  it('small stock options should NOT trigger AMT', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s[0].exercisePricePerShare = 100

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)
    expect(f6251.isNeeded()).toEqual(false)
    expect(Math.round(f6251.l11())).toEqual(0)
  })

  it('does not require Part III when there are no qualified dividends or capital gains', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f1040.l7()).toBe(0)
    expect(f1040.l3a()).toBe(0)
    expect(f6251.requiresPartIII()).toBe(false)
  })

  it('uses 2025 capital gain thresholds and AMT breakpoint math in Part III', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.filingStatus = FilingStatus.MFJ
    information.taxPayer.spouse = {
      firstName: 'Jordan',
      lastName: 'Payer',
      isTaxpayerDependent: false,
      role: PersonRole.SPOUSE,
      ssid: '222222222',
      dateOfBirth: new Date('1972-01-01'),
      isBlind: false
    }
    information.w2s[0].income = 450000
    information.w2s[0].medicareIncome = 450000
    information.w2s[0].ssWages = 176100
    information.w2s[0].stateWages = 450000
    information.f1099s = [
      {
        payer: 'Northwind Income Fund',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 12000,
          qualifiedDividends: 12000,
          totalCapitalGainsDistributions: 0,
          section199ADividends: 0
        }
      } as never
    ]

    const f1040 = new F1040(information, [])
    void f1040.l16()
    const f6251 = new F6251(f1040)
    const p3 = f6251.part3()

    expect(f6251.requiresPartIII()).toBe(true)
    expect(p3.l19).toBe(federalBrackets.longTermCapGains.status[FilingStatus.MFJ].brackets[0])
    expect(p3.l25).toBe(federalBrackets.longTermCapGains.status[FilingStatus.MFJ].brackets[1])
    expect((p3.l17 ?? 0) > amt.cap(FilingStatus.MFJ)).toBe(true)
    expect(p3.l18).toBe((p3.l17 ?? 0) * 0.28 - amt.cap(FilingStatus.MFJ) * 0.02)
    expect(p3.l39).toBe((p3.l12 ?? 0) * 0.28 - amt.cap(FilingStatus.MFJ) * 0.02)
  })

  it('uses the Schedule D tax worksheet lines when Form 4952 keeps preferential gains in play', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.w2s[0].income = 220000
    information.w2s[0].medicareIncome = 220000
    information.w2s[0].ssWages = 176100
    information.w2s[0].stateWages = 220000
    information.f1099s = [
      {
        payer: 'Growth Fund',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 15000,
          qualifiedDividends: 15000,
          totalCapitalGainsDistributions: 0,
          section199ADividends: 0
        }
      } as never,
      {
        payer: 'Long Term Broker',
        type: Income1099Type.B,
        personRole: PersonRole.PRIMARY,
        form: {
          shortTermProceeds: 0,
          shortTermCostBasis: 0,
          longTermProceeds: 60000,
          longTermCostBasis: 10000
        }
      } as never
    ]
    information.investmentInterestExpense = 5000
    information.capitalGainsElectedAsInvestmentIncome = 20000

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)
    const worksheet = f1040.scheduleD.taxWorksheet
    const scheduleD = f1040.scheduleD
    const f4952 = f1040.f4952
    const taxableIncome = f1040.l15()
    const qdiv = f1040.l3a() ?? 0
    const l3 = f4952?.l4g() ?? 0
    const l4 = f4952?.l4e() ?? 0
    const l5 = Math.max(0, l3 - l4)
    const l6 = Math.max(0, qdiv - l5)
    const l7 = Math.min(scheduleD.l15(), scheduleD.l16())
    const l8 = Math.min(l3, l4)
    const l9 = Math.max(0, l7 - l8)
    const expectedL10 = l6 + l9
    const l11 = (scheduleD.l18() ?? 0) + (scheduleD.l19() ?? 0)
    const l12 = Math.min(l9, l11)
    const expectedL13 = expectedL10 - l12
    const expectedL14 = Math.max(0, taxableIncome - expectedL13)
    const expectedL18 = Math.max(0, taxableIncome - expectedL10)
    const expectedL20 = Math.min(expectedL14, 197300)
    const expectedL21 = Math.max(expectedL18, expectedL20)
    const p3 = f6251.part3()

    expect(worksheet.isNeeded()).toBe(true)
    expect(worksheet.l10()).toBe(expectedL10)
    expect(worksheet.l13()).toBe(expectedL13)
    expect(worksheet.l14()).toBe(expectedL14)
    expect(worksheet.l21()).toBe(expectedL21)
    expect(p3.l13).toBe(expectedL13)
    expect(p3.l20).toBe(expectedL14)
    expect(p3.l27).toBe(expectedL21)
  })
})
