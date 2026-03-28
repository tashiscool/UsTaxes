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

  it('backs Schedule J out of AMT line 10 while still using it on Form 1040 line 16', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.w2s[0].income = 60000
    information.w2s[0].medicareIncome = 60000
    information.w2s[0].ssWages = 60000
    information.w2s[0].stateWages = 60000
    information.farmBusiness = {
      name: 'Prairie Family Farm',
      accountingMethod: 'cash',
      income: {
        salesLivestock: 0,
        salesCrops: 90000,
        cooperativeDistributions: 0,
        agriculturalPayments: 0,
        cccLoans: 0,
        cropInsurance: 0,
        customHireIncome: 0,
        otherIncome: 0
      },
      expenses: {
        carTruck: 0,
        chemicals: 0,
        conservation: 0,
        customHire: 0,
        depreciation: 0,
        employeeBenefit: 0,
        feed: 0,
        fertilizers: 0,
        freight: 0,
        fuel: 0,
        insurance: 0,
        interest: 0,
        labor: 0,
        pensionPlans: 0,
        rentLease: 0,
        repairs: 0,
        seeds: 0,
        storage: 0,
        supplies: 0,
        taxes: 0,
        utilities: 0,
        veterinary: 0,
        otherExpenses: 0
      }
    }
    information.electFarmIncomeAveraging = true
    information.priorYearTaxInfo = [
      {
        year: 2024,
        taxableIncome: 20000,
        tax: 2180,
        filingStatus: FilingStatus.S
      },
      {
        year: 2023,
        taxableIncome: 18000,
        tax: 1940,
        filingStatus: FilingStatus.S
      },
      {
        year: 2022,
        taxableIncome: 16000,
        tax: 1700,
        filingStatus: FilingStatus.S
      }
    ]

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)
    const scheduleJTax = f1040.scheduleJ?.tax()
    const baseTax = f1040.computeTaxWithoutScheduleJ()

    expect(f1040.scheduleJ?.isNeeded()).toBe(true)
    expect(scheduleJTax).toBeDefined()
    expect(baseTax).toBeDefined()
    expect(f1040.l16()).toBe(scheduleJTax)
    expect(f6251.l10()).toBe(baseTax)
    expect(f6251.l10()).not.toBe(f1040.l16())
  })

  it('requires Form 6251 when a general business credit is claimed', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.generalBusinessCredits = {
      creditComponents: {
        researchCredit: 2500
      },
      carryforwardFromPriorYears: 0,
      carrybackFromFutureYears: 0,
      currentYearCredits: 2500,
      regularTaxLiability: 10000,
      tentativeMinimumTax: 0,
      netIncomeTax: 10000,
      netRegularTaxLiability: 10000,
      allowedCredit: 2500,
      carryforwardToNextYear: 0
    }

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f1040.f3800?.isNeeded()).toBe(true)
    expect(f6251.isNeeded()).toBe(true)
  })

  it('requires Form 6251 when Form 8801 prior-year AMT credit is present', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.priorYearAmtCredit = 3000
    information.priorYearAmtCreditCarryforward = 1000
    information.priorYearAmt = {
      line6: 5000,
      exclusionItems: 500,
      foreignTaxCredit: 0
    }

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f1040.f8801?.isNeeded()).toBe(true)
    expect(f6251.isNeeded()).toBe(true)
  })

  it('pulls AMT adjustments from Schedule K-1 (Form 1041) box 12 code A', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.fiduciaryReturn = {
      beneficiaries: [
        {
          name: 'Alex Beneficiary',
          tin: '333333333',
          percentageShare: 50,
          ordinaryIncome: 0,
          deductions: 0,
          amtAdjustment: 1800
        },
        {
          name: 'Jordan Beneficiary',
          tin: '444444444',
          percentageShare: 50,
          ordinaryIncome: 0,
          deductions: 0,
          amtAdjustment: -300
        }
      ]
    }

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f1040.scheduleK1_1041?.isNeeded()).toBe(true)
    expect(f6251.l2j()).toBe(1500)
    expect((f6251.l4() ?? 0) > (f6251.l1() ?? 0)).toBe(true)
  })

  it('includes private activity bond interest from 1099-INT on line 2g', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.f1099s = [
      {
        payer: 'Municipal Bond Fund',
        type: Income1099Type.INT,
        personRole: PersonRole.PRIMARY,
        form: {
          income: 0,
          taxExemptInterest: 1800,
          privateActivityBondInterest: 425
        }
      } as never
    ]

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f6251.l2g()).toBe(425)
    expect(f6251.l4()).toBe((f6251.l1() ?? 0) + (f6251.l2a() ?? 0) + 425)
  })

  it('uses explicit advanced AMT adjustment inputs on lines 2c through 3', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.amtAdjustmentData = {
      line2cInvestmentInterestExpense: 120,
      line2dDepletion: 80,
      line2fAlternativeTaxNetOperatingLossDeduction: 500,
      line2hQualifiedSmallBusinessStock: 250,
      line2kPropertyDisposition: -300,
      line2lPost1986Depreciation: 175,
      line2mPassiveActivities: 90,
      line2nLossLimitations: -40,
      line2oCirculationCosts: 35,
      line2pLongTermContracts: 60,
      line2qMiningCosts: 45,
      line2rResearchExperimentalCosts: 55,
      line2sPre1987InstallmentSales: 70,
      line2tIntangibleDrillingCosts: 25,
      line3OtherAdjustments: 110
    }

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f6251.l2c()).toBe(120)
    expect(f6251.l2d()).toBe(80)
    expect(f6251.l2f()).toBe(500)
    expect(f6251.l2h()).toBe(250)
    expect(f6251.l2k()).toBe(-300)
    expect(f6251.l2l()).toBe(175)
    expect(f6251.l2m()).toBe(90)
    expect(f6251.l2n()).toBe(-40)
    expect(f6251.l2o()).toBe(35)
    expect(f6251.l2p()).toBe(60)
    expect(f6251.l2q()).toBe(45)
    expect(f6251.l2r()).toBe(55)
    expect(f6251.l2s()).toBe(70)
    expect(f6251.l2t()).toBe(25)
    expect(f6251.l3()).toBe(110)
    expect(f6251.l4()).toBe(
      (f6251.l1() ?? 0) +
        (f6251.l2a() ?? 0) +
        120 +
        80 +
        250 -
        300 +
        175 +
        90 -
        40 +
        35 +
        60 +
        45 +
        55 -
        500 -
        70 +
        25 +
        110
    )
  })

  it('uses the modeled foreign tax credit as an AMT foreign tax credit proxy when present', () => {
    const information = cloneDeep(baseInformation)
    information.f3921s = []
    information.w2s[0].income = 180000
    information.w2s[0].medicareIncome = 180000
    information.w2s[0].ssWages = 176100
    information.w2s[0].stateWages = 180000
    information.f1099s = [
      {
        payer: 'Global Equity Fund',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 8000,
          qualifiedDividends: 5000,
          totalCapitalGainsDistributions: 0,
          foreignTaxPaid: 600,
          foreignSourceIncome: 4000
        }
      } as never
    ]

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f1040.f1116?.isNeeded()).toBe(true)
    expect(f1040.f1116?.credit()).toBeGreaterThan(0)
    expect(f6251.l8()).toBe(Math.min(f1040.f1116?.credit() ?? 0, f6251.l7() ?? 0))
    expect(f6251.l9()).toBe((f6251.l7() ?? 0) - (f6251.l8() ?? 0))
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

  it('refigures line 10 without Schedule J when farm income averaging is elected', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 85000
    information.w2s[0].medicareIncome = 85000
    information.w2s[0].ssWages = 85000
    information.w2s[0].stateWages = 85000
    information.farmBusiness = {
      name: 'Prairie Ridge Farm',
      accountingMethod: 'cash',
      income: {
        salesLivestock: 0,
        salesCrops: 150000,
        cooperativeDistributions: 0,
        agriculturalPayments: 0,
        cccLoans: 0,
        cropInsurance: 0,
        customHireIncome: 0,
        otherIncome: 0
      },
      expenses: {
        carTruck: 0,
        chemicals: 0,
        conservation: 0,
        customHire: 0,
        depreciation: 0,
        employeeBenefit: 0,
        feed: 0,
        fertilizers: 0,
        freight: 0,
        fuel: 0,
        insurance: 0,
        interest: 0,
        labor: 0,
        pensionPlans: 0,
        rentLease: 0,
        repairs: 0,
        seeds: 0,
        storage: 0,
        supplies: 0,
        taxes: 0,
        utilities: 0,
        veterinary: 0,
        otherExpenses: 0
      }
    }
    information.electFarmIncomeAveraging = true
    information.priorYearTaxInfo = [
      {
        year: 2024,
        taxableIncome: 25000,
        tax: 2750,
        filingStatus: FilingStatus.S
      },
      {
        year: 2023,
        taxableIncome: 28000,
        tax: 3080,
        filingStatus: FilingStatus.S
      },
      {
        year: 2022,
        taxableIncome: 30000,
        tax: 3300,
        filingStatus: FilingStatus.S
      }
    ]

    const f1040 = new F1040(information, [])
    const f6251 = new F6251(f1040)

    expect(f1040.scheduleJ?.isNeeded()).toBe(true)
    expect(f1040.l16()).toBe(f1040.scheduleJ?.tax())
    expect(f1040.computeTaxWithoutScheduleJ()).toBeGreaterThan(
      f1040.scheduleJ?.tax() ?? 0
    )
    expect(f6251.l10()).toBe(f1040.computeTaxWithoutScheduleJ())
  })
})
