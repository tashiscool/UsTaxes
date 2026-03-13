/* eslint-disable @typescript-eslint/no-empty-function */
import { cloneDeep } from 'lodash'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
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
import { getF8995PhaseOutIncome } from '../irsForms/F8995'

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
