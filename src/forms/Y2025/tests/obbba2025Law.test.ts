/* eslint-disable @typescript-eslint/no-empty-function */
import { cloneDeep } from 'lodash'
import { FilingStatus, Income1099Type, PersonRole } from 'ustaxes/core/data'
import { evaluatePiecewise } from 'ustaxes/core/util'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'
import {
  amt,
  saltCap,
  overtimeExemption,
  autoLoanInterestDeduction,
  seniorAdditionalDeduction,
  EIC,
  childTaxCredit,
  qbid
} from '../data/federal'
import F8995, { getF8995PhaseOutIncome } from '../irsForms/F8995'
import F8995A from '../irsForms/F8995A'

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

describe('2025 federal law updates', () => {
  it('uses the published 2025 AMT exemptions and phase-out thresholds', () => {
    expect(amt.exemptionAmount(FilingStatus.S)).toBe(88100)
    expect(amt.exemptionAmount(FilingStatus.MFJ)).toBe(137000)
    expect(amt.exemptionAmount(FilingStatus.MFS)).toBe(68500)
    expect(amt.phaseOutStart(FilingStatus.S)).toBe(626350)
    expect(amt.phaseOutStart(FilingStatus.MFJ)).toBe(1252700)
  })

  it('uses the 2025 SALT caps and preserves the $10,000 floor for MFS', () => {
    expect(saltCap.effectiveCap(FilingStatus.S, 100000)).toBe(40000)
    expect(saltCap.effectiveCap(FilingStatus.MFS, 100000)).toBe(20000)
    expect(saltCap.effectiveCap(FilingStatus.MFS, 1000000)).toBe(10000)
  })

  it('uses the updated 2025 EIC schedule for HOH with two children', () => {
    const formula = EIC.formulas[FilingStatus.HOH]?.[2]
    expect(formula).toBeDefined()
    if (formula === undefined) {
      throw new Error(
        'Expected HOH two-child EIC formula to be defined for 2025'
      )
    }
    expect(Math.round(evaluatePiecewise(formula, 17880))).toBe(7152)
    expect(Math.round(evaluatePiecewise(formula, 38500))).toBe(3961)
    expect(EIC.caps[FilingStatus.HOH]?.[2]).toBe(57310)
    expect(EIC.maxInvestmentIncome).toBe(11950)
  })

  it('applies the stepped overtime phase-out for 2025', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 160000
    information.w2s[0].medicareIncome = 160000
    information.w2s[0].ssWages = 160000
    information.w2s[0].stateWages = 160000
    information.overtimeIncome = { amount: 12500 }

    const f1040 = new F1040(information, [])

    expect(overtimeExemption.phaseOutStart(FilingStatus.S)).toBe(150000)
    expect(f1040.schedule1A.l2()).toBe(1000)
    expect(f1040.schedule1A.l5()).toBe(11500)
  })

  it('keeps Schedule 1-A deductions out of AGI and in the deductions section', () => {
    const baselineInfo = cloneDeep(baseInformation)
    baselineInfo.w2s[0].income = 160000
    baselineInfo.w2s[0].medicareIncome = 160000
    baselineInfo.w2s[0].ssWages = 160000
    baselineInfo.w2s[0].stateWages = 160000

    const schedule1AInfo = cloneDeep(baselineInfo)
    schedule1AInfo.overtimeIncome = { amount: 12500 }
    schedule1AInfo.tipIncome = { amount: 25000 }

    const baseline1040 = new F1040(baselineInfo, [])
    const schedule1A1040 = new F1040(schedule1AInfo, [])

    expect(schedule1A1040.l11()).toBe(baseline1040.l11())
    expect(schedule1A1040.l13b()).toBe(
      schedule1A1040.schedule1A.l5() + schedule1A1040.schedule1A.l8()
    )
    expect(schedule1A1040.l14()).toBe(
      schedule1A1040.l12() + schedule1A1040.l13b() + (schedule1A1040.l13() ?? 0)
    )
  })

  it('applies the stepped auto-loan phase-out and 2025 cap', () => {
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
    information.w2s[0].income = 200001
    information.w2s[0].medicareIncome = 200001
    information.w2s[0].ssWages = 200001
    information.w2s[0].stateWages = 200001
    information.autoLoanInterest = {
      amount: 10000,
      domesticManufacture: true,
      vehicleMake: 'Ford',
      vehicleModel: 'Mustang',
      vehicleYear: 2025
    }

    const f1040 = new F1040(information, [])

    expect(autoLoanInterestDeduction.annualCap).toBe(10000)
    expect(f1040.schedule1A.l11()).toBe(200)
    expect(f1040.schedule1A.l14()).toBe(9800)
  })

  it('applies the senior deduction phase-out using 2025 thresholds', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.primaryPerson.dateOfBirth = new Date('1959-01-01')
    information.w2s[0].income = 80000
    information.w2s[0].medicareIncome = 80000
    information.w2s[0].ssWages = 80000
    information.w2s[0].stateWages = 80000

    const f1040 = new F1040(information, [])

    expect(seniorAdditionalDeduction.phaseOutStart(FilingStatus.S)).toBe(75000)
    expect(f1040.schedule1A.l15()).toBe(1)
    expect(f1040.schedule1A.l16()).toBe(5700)
  })

  it('routes the 2025 adoption credit into refundable and nonrefundable buckets', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 200000
    information.w2s[0].medicareIncome = 200000
    information.w2s[0].ssWages = 200000
    information.w2s[0].stateWages = 200000
    information.adoptedChildren = [
      {
        name: 'Avery Payer',
        ssn: '333333333',
        birthYear: 2023,
        disabledChild: false,
        foreignChild: false,
        specialNeedsChild: true,
        qualifiedExpenses: 0,
        priorYearExpenses: 0,
        adoptionFinalized: true,
        yearAdoptionBegan: 2024
      }
    ]

    const f1040 = new F1040(information, [])
    const f8839 = f1040.f8839

    expect(f8839).toBeDefined()
    expect(f8839?.l3(0)).toBe(17280)
    expect(f8839?.refundableCredit()).toBe(5000)
    expect(f8839?.nonrefundableCredit()).toBe(12280)
    expect(f1040.l30()).toBe(5000)
    expect(f1040.schedule3.l6d()).toBe(12280)
  })

  it('uses the published 2025 child tax credit amounts without a newborn bonus', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.dependents = [
      {
        firstName: 'Casey',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '333221111',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2025-02-01'),
        isBlind: false
      },
      {
        firstName: 'Morgan',
        lastName: 'Payer',
        role: PersonRole.DEPENDENT,
        ssid: '900701234',
        relationship: 'Child',
        qualifyingInfo: { isStudent: false, numberOfMonths: 12 },
        dateOfBirth: new Date('2020-03-01'),
        isBlind: false
      }
    ]

    const f1040 = new F1040(information, [])

    expect(childTaxCredit.amountPerChild).toBe(2200)
    expect(childTaxCredit.refundableAmount).toBe(1700)
    expect(f1040.schedule8812.l4()).toBe(1)
    expect(f1040.schedule8812.l5()).toBe(2200)
    expect(f1040.schedule8812.l6()).toBe(1)
    expect(f1040.schedule8812.l7()).toBe(500)
    expect(f1040.schedule8812.l8()).toBe(2700)
  })

  it('keeps the 2025 QBI deduction at 20 percent', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 150000
    information.w2s[0].medicareIncome = 150000
    information.w2s[0].ssWages = 150000
    information.w2s[0].stateWages = 150000
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Northwind Partners',
        partnershipEin: '123456789',
        section199AQBI: 100000
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(qbid.maxRate).toBe(0.2)
    expect(getF8995PhaseOutIncome(FilingStatus.S)).toBe(197300)
    expect(getF8995PhaseOutIncome(FilingStatus.MFJ)).toBe(394600)
    expect(getF8995PhaseOutIncome(FilingStatus.W)).toBe(394600)
    expect(qbid.phaseOutStart(FilingStatus.S)).toBe(197300)
    expect(qbid.phaseOutStart(FilingStatus.MFJ)).toBe(394600)
    expect(qbid.phaseOutStart(FilingStatus.W)).toBe(394600)
    expect(f1040.f8995?.l5()).toBe(20000)
  })

  it('flows Schedule C profit into Schedule 1, Schedule SE, and Form 8995', () => {
    const information = cloneDeep(baseInformation)
    information.w2s = []
    information.businesses = [
      {
        name: 'Taylor Consulting Services',
        principalBusinessCode: '541611',
        businessDescription: 'Management Consulting',
        accountingMethod: 'cash',
        materialParticipation: true,
        startedOrAcquired: false,
        madePaymentsRequiring1099: false,
        filed1099s: false,
        personRole: PersonRole.PRIMARY,
        income: {
          grossReceipts: 140000,
          returns: 0,
          otherIncome: 0
        },
        expenses: {
          advertising: 2500,
          carAndTruck: 0,
          commissions: 0,
          contractLabor: 0,
          depletion: 0,
          depreciation: 0,
          employeeBenefits: 0,
          insurance: 3600,
          interestMortgage: 0,
          interestOther: 0,
          legal: 4000,
          office: 3000,
          pensionPlans: 0,
          rentVehicles: 0,
          rentOther: 0,
          repairs: 0,
          supplies: 1500,
          taxes: 0,
          travel: 8000,
          deductibleMeals: 2000,
          utilities: 0,
          wages: 0,
          otherExpenses: 2400
        }
      }
    ] as never

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleC?.netProfit()).toBe(113000)
    expect(f1040.schedule1.l3()).toBe(113000)
    expect(f1040.schedule1.to1040Line8()).toBe(113000)
    expect(f1040.scheduleSE.isNeeded()).toBe(true)
    expect(f1040.scheduleSE.l2()).toBe(113000)
    expect(f1040.totalQbi()).toBe(113000)
    expect(f1040.f8995).toBeDefined()
    expect(f1040.f8995?.l2()).toBe(113000)
    expect(f1040.f8995?.l5()).toBe(22600)
  })

  it('uses taxable income before QBI after Schedule 1-A deductions', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 150000
    information.w2s[0].medicareIncome = 150000
    information.w2s[0].ssWages = 150000
    information.w2s[0].stateWages = 150000
    information.overtimeIncome = { amount: 12500 }
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Northwind Partners',
        partnershipEin: '123456789',
        section199AQBI: 100000
      } as never
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.taxableIncomeBeforeQBIDeduction()).toBe(
      Math.max(0, f1040.l11() - f1040.l12() - f1040.l13b())
    )
    expect(f1040.f8995?.l11()).toBe(f1040.taxableIncomeBeforeQBIDeduction())
  })

  it('keeps Form 8995-A wage and UBIA limits separated by business entry', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995A = new F8995A(f1040)

    jest.spyOn(f8995A, 'qbiEntries').mockReturnValue([
      {
        name: 'Alpha Consulting',
        ein: '111111111',
        qbi: 100000,
        w2Wages: 10000,
        ubia: 40000,
        patronReduction: 0
      },
      {
        name: 'Bravo Services',
        ein: '222222222',
        qbi: 80000,
        w2Wages: 30000,
        ubia: 120000,
        patronReduction: 0
      },
      {
        name: 'Charlie Rentals',
        ein: '333333333',
        qbi: 60000,
        w2Wages: 50000,
        ubia: 200000,
        patronReduction: 0
      }
    ])

    expect(f8995A.l5a()).toBe(5000)
    expect(f8995A.l5b()).toBe(15000)
    expect(f8995A.l5c()).toBe(25000)
    expect(f8995A.l8a()).toBe(1000)
    expect(f8995A.l8b()).toBe(3000)
    expect(f8995A.l8c()).toBe(5000)
    expect(f8995A.l9a()).toBe(3500)
    expect(f8995A.l9b()).toBe(10500)
    expect(f8995A.l9c()).toBe(17500)
  })

  it('sources QBI wages and UBIA from business and K-1 data', () => {
    const information = cloneDeep(baseInformation)
    information.businesses = [
      {
        name: 'Taylor Consulting Services',
        principalBusinessCode: '541611',
        businessDescription: 'Management Consulting',
        accountingMethod: 'cash',
        materialParticipation: true,
        startedOrAcquired: false,
        madePaymentsRequiring1099: false,
        filed1099s: false,
        personRole: PersonRole.PRIMARY,
        qbiW2Wages: 18000,
        qbiUbia: 95000,
        income: {
          grossReceipts: 150000,
          returns: 0,
          otherIncome: 0
        },
        expenses: {
          advertising: 2500,
          carAndTruck: 0,
          commissions: 0,
          contractLabor: 0,
          depletion: 0,
          depreciation: 0,
          employeeBenefits: 0,
          insurance: 3600,
          interestMortgage: 0,
          interestOther: 0,
          legal: 4000,
          office: 3000,
          pensionPlans: 0,
          rentVehicles: 0,
          rentOther: 0,
          repairs: 0,
          supplies: 1500,
          taxes: 0,
          travel: 8000,
          deductibleMeals: 2000,
          utilities: 0,
          wages: 12000,
          otherExpenses: 2400
        }
      }
    ] as never
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Northwind Partners',
        partnershipEin: '123456789',
        partnerOrSCorp: 'P',
        isForeign: false,
        isPassive: false,
        ordinaryBusinessIncome: 0,
        interestIncome: 0,
        guaranteedPaymentsForServices: 0,
        guaranteedPaymentsForCapital: 0,
        selfEmploymentEarningsA: 0,
        selfEmploymentEarningsB: 0,
        selfEmploymentEarningsC: 0,
        distributionsCodeAAmount: 0,
        section199AQBI: 50000,
        section199AW2Wages: 12000,
        section199AUbia: 60000
      } as never
    ]

    const f1040 = new F1040(information, [])
    const entries = f1040.f8995?.qbiEntries()

    expect(entries).toBeDefined()
    expect(entries?.[0]).toMatchObject({
      name: 'Taylor Consulting Services',
      w2Wages: 18000,
      ubia: 95000,
      patronReduction: 0
    })
    expect(entries?.[1]).toMatchObject({
      name: 'Northwind Partners',
      w2Wages: 12000,
      ubia: 60000,
      patronReduction: 0
    })
  })

  it('aggregates detailed QBI deductions across more than three businesses', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995A = new F8995A(f1040)

    jest.spyOn(f8995A, 'qbiEntries').mockReturnValue([
      {
        name: 'Alpha Consulting',
        ein: '111111111',
        qbi: 100000,
        w2Wages: 100000,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Bravo Services',
        ein: '222222222',
        qbi: 80000,
        w2Wages: 80000,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Charlie Rentals',
        ein: '333333333',
        qbi: 60000,
        w2Wages: 60000,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Delta Holdings',
        ein: '444444444',
        qbi: 40000,
        w2Wages: 40000,
        ubia: 0,
        patronReduction: 0
      }
    ])
    jest.spyOn(f8995A, 'l20').mockReturnValue(f8995A.l21())
    jest.spyOn(f8995A, 'l34').mockReturnValue(0)

    expect(f8995A.l16()).toBe(56000)
    expect(f8995A.l27()).toBe(56000)
  })

  it('tracks overflow businesses for additional-statement parity', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995A = new F8995A(f1040)

    jest.spyOn(f8995A, 'qbiEntries').mockReturnValue([
      {
        name: 'Alpha Consulting',
        ein: '111111111',
        qbi: 100000,
        w2Wages: 100000,
        ubia: 10000,
        patronReduction: 0
      },
      {
        name: 'Bravo Services',
        ein: '222222222',
        qbi: 80000,
        w2Wages: 80000,
        ubia: 20000,
        patronReduction: 0
      },
      {
        name: 'Charlie Rentals',
        ein: '333333333',
        qbi: 60000,
        w2Wages: 60000,
        ubia: 30000,
        patronReduction: 1000
      },
      {
        name: 'Delta Holdings',
        ein: '444444444',
        qbi: 40000,
        w2Wages: 40000,
        ubia: 40000,
        patronReduction: 2000
      },
      {
        name: 'Echo Foods',
        ein: '555555555',
        qbi: 30000,
        w2Wages: 30000,
        ubia: 50000,
        patronReduction: 3000
      }
    ])

    expect(f8995A.visibleEntries()).toHaveLength(3)
    expect(f8995A.overflowEntries()).toHaveLength(2)
    expect(f8995A.needsAdditionalStatement()).toBe(true)
    expect(f8995A.overflowTotals()).toEqual({
      qbi: 70000,
      w2Wages: 70000,
      ubia: 90000,
      patronReduction: 5000
    })
    expect(f8995A.overflowStatementEntries()).toEqual([
      expect.objectContaining({
        name: 'Delta Holdings',
        deductionBeforePatronReduction: expect.any(Number),
        deductionAfterPatronReduction: expect.any(Number)
      }),
      expect.objectContaining({
        name: 'Echo Foods',
        deductionBeforePatronReduction: expect.any(Number),
        deductionAfterPatronReduction: expect.any(Number)
      })
    ])
    expect(f8995A.overflowStatementDeduction()).toBeGreaterThan(0)
    expect(f8995A.statementSummary()).toEqual(
      expect.objectContaining({
        requiresAttachment: true,
        visibleBusinessCount: 3,
        overflowBusinessCount: 2,
        totalBusinessCount: 5,
        thresholdStart: expect.any(Number),
        thresholdEnd: expect.any(Number),
        overflowTotals: {
          qbi: 70000,
          w2Wages: 70000,
          ubia: 90000,
          patronReduction: 5000
        }
      })
    )
  })

  it('tracks simplified-form overflow businesses for attachment parity', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995 = new F8995(f1040)

    jest.spyOn(f8995, 'qbiEntries').mockReturnValue([
      {
        name: 'Alpha',
        ein: '111111111',
        qbi: 10000,
        w2Wages: 0,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Bravo',
        ein: '222222222',
        qbi: 11000,
        w2Wages: 0,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Charlie',
        ein: '333333333',
        qbi: 12000,
        w2Wages: 0,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Delta',
        ein: '444444444',
        qbi: 13000,
        w2Wages: 0,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Echo',
        ein: '555555555',
        qbi: 14000,
        w2Wages: 0,
        ubia: 0,
        patronReduction: 0
      },
      {
        name: 'Foxtrot',
        ein: '666666666',
        qbi: 15000,
        w2Wages: 0,
        ubia: 0,
        patronReduction: 0
      }
    ])

    expect(f8995.visibleEntries()).toHaveLength(5)
    expect(f8995.overflowEntries()).toHaveLength(1)
    expect(f8995.needsAdditionalStatement()).toBe(true)
    expect(f8995.overflowStatementEntries()).toEqual([
      expect.objectContaining({
        name: 'Foxtrot',
        qbi: 15000
      })
    ])
    expect(f8995.overflowStatementQbiTotal()).toBe(15000)
  })

  it('subtracts patron reductions from the detailed QBI component', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995A = new F8995A(f1040)

    jest.spyOn(f8995A, 'qbiEntries').mockReturnValue([
      {
        name: 'Coop Alpha',
        ein: '111111111',
        qbi: 100000,
        w2Wages: 100000,
        ubia: 0,
        patronReduction: 1500
      },
      {
        name: 'Coop Bravo',
        ein: '222222222',
        qbi: 50000,
        w2Wages: 50000,
        ubia: 0,
        patronReduction: 500
      }
    ])
    jest.spyOn(f8995A, 'l20').mockReturnValue(f8995A.l21())
    jest.spyOn(f8995A, 'l34').mockReturnValue(0)

    expect(f8995A.l13a()).toBe(20000)
    expect(f8995A.l14a()).toBe(1500)
    expect(f8995A.l15a()).toBe(18500)
    expect(f8995A.l13b()).toBe(10000)
    expect(f8995A.l14b()).toBe(500)
    expect(f8995A.l15b()).toBe(9500)
    expect(f8995A.l16()).toBe(28000)
    expect(f8995A.l27()).toBe(28000)
  })

  it('reduces SSTB QBI inputs inside the 2025 phaseout band', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995A = new F8995A(f1040)

    jest.spyOn(f8995A, 'qbiEntries').mockReturnValue([
      {
        name: 'SSTB Alpha',
        ein: '111111111',
        qbi: 100000,
        w2Wages: 10000,
        ubia: 0,
        patronReduction: 1000,
        isSSTB: true
      },
      {
        name: 'Non-SSTB Bravo',
        ein: '222222222',
        qbi: 100000,
        w2Wages: 10000,
        ubia: 0,
        patronReduction: 0,
        isSSTB: false
      }
    ])
    jest
      .spyOn(f8995A, 'l20')
      .mockReturnValue(f8995A.l21() + f8995A.l23() / 2)
    jest.spyOn(f8995A, 'l34').mockReturnValue(0)

    expect(f8995A.l24()).toBe(0.5)
    expect(f8995A.sstbApplicablePercentage()).toBe(0.5)
    expect(f8995A.l2a()).toBe(50000)
    expect(f8995A.l4a()).toBe(5000)
    expect(f8995A.l14a()).toBe(500)
    expect(f8995A.l15a()).toBe(5750)
    expect(f8995A.l2b()).toBe(100000)
    expect(f8995A.l15b()).toBe(12500)
    expect(f8995A.l16()).toBe(18250)
    expect(f8995A.statementSummary()).toEqual(
      expect.objectContaining({
        applicablePercentage: 0.5,
        sstbApplicablePercentage: 0.5,
        sstbCount: 1
      })
    )
  })

  it('eliminates SSTB deductions once taxable income exceeds the 2025 phaseout range', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const f8995A = new F8995A(f1040)

    jest.spyOn(f8995A, 'qbiEntries').mockReturnValue([
      {
        name: 'SSTB Alpha',
        ein: '111111111',
        qbi: 100000,
        w2Wages: 10000,
        ubia: 0,
        patronReduction: 0,
        isSSTB: true
      }
    ])
    jest
      .spyOn(f8995A, 'l20')
      .mockReturnValue(f8995A.l21() + f8995A.l23() + 1)
    jest.spyOn(f8995A, 'l34').mockReturnValue(0)

    expect(f8995A.l24()).toBe(1)
    expect(f8995A.sstbApplicablePercentage()).toBe(0)
    expect(f8995A.l2a()).toBe(0)
    expect(f8995A.l15a()).toBe(0)
    expect(f8995A.l16()).toBe(0)
  })

  it('applies prior-year QBI loss carryforwards and REIT/PTP components', () => {
    const information = cloneDeep(baseInformation)
    information.f1099s = [
      {
        payer: 'Northwind REIT Fund',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 1200,
          qualifiedDividends: 600,
          totalCapitalGainsDistributions: 0,
          section199ADividends: 1500
        }
      } as never
    ]
    information.qbiDeductionData = {
      priorYearQualifiedBusinessLossCarryforward: 5000,
      ptpIncome: 2000,
      ptpLossCarryforward: 500,
      dpadReduction: 300
    }
    information.scheduleK1Form1065s = [
      {
        partnershipName: 'Public Partnership LP',
        partnershipEin: '555555555',
        partnerOrSCorp: 'P',
        isForeign: false,
        isPassive: false,
        ordinaryBusinessIncome: 0,
        interestIncome: 0,
        guaranteedPaymentsForServices: 0,
        guaranteedPaymentsForCapital: 0,
        selfEmploymentEarningsA: 0,
        selfEmploymentEarningsB: 0,
        selfEmploymentEarningsC: 0,
        distributionsCodeAAmount: 0,
        section199AQBI: 0,
        isPubliclyTradedPartnership: true,
        ptpSection199AIncome: 3000,
        ptpSection199ALossCarryforward: 200
      } as never
    ]

    const f1040 = new F1040(information, [])
    const f8995 = f1040.f8995

    expect(f8995).toBeDefined()
    expect(f8995?.l3()).toBe(-5000)
    expect(f8995?.l6()).toBe(1500)
    expect(f8995?.l7()).toBe(4300)
    expect(f8995?.l8()).toBe(5800)
    expect(f8995?.l9()).toBe(1160)

    const f8995a = new F8995A(f1040)
    expect(f8995a.l28()).toBe(6500)
    expect(f8995a.l29()).toBe(-700)
    expect(f8995a.l31()).toBe(1160)
    expect(f8995a.l38()).toBe(300)
    expect(f8995a.statementSummary()).toEqual(
      expect.objectContaining({
        requiresAttachment: true,
        reitDividends: 1500,
        ptpIncome: 5000,
        ptpLossCarryforward: 700,
        dpadReduction: 300,
        applicablePercentage: 0,
        sstbApplicablePercentage: 1
      })
    )
  })

  it('treats qualified disaster losses differently from other casualty losses in 2025', () => {
    const information = cloneDeep(baseInformation)
    information.casualtyEvents = [
      {
        description: 'Qualified wildfire loss',
        propertyDescription: 'Primary residence contents',
        dateOfEvent: new Date('2025-08-01'),
        federallyDeclaredDisaster: true,
        femaDisasterNumber: 'DR-1234',
        qualifiedDisasterLoss: true,
        costBasis: 1000,
        insuranceReimbursement: 0,
        fairMarketValueBefore: 1000,
        fairMarketValueAfter: 0
      },
      {
        description: 'Ordinary federal disaster loss',
        propertyDescription: 'Garage contents',
        dateOfEvent: new Date('2025-09-01'),
        federallyDeclaredDisaster: true,
        femaDisasterNumber: 'DR-5678',
        qualifiedDisasterLoss: false,
        costBasis: 1000,
        insuranceReimbursement: 0,
        fairMarketValueBefore: 1000,
        fairMarketValueAfter: 0
      }
    ] as never

    const f1040 = new F1040(information, [])

    expect(f1040.f4684?.l11()).toBe(600)
    expect(f1040.f4684?.l12()).toBe(1400)
    expect(f1040.f4684?.l15()).toBe(10000)
    expect(f1040.f4684?.personalCasualtyLossDeduction()).toBe(500)
  })
})
