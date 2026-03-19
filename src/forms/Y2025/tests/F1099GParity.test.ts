import { cloneDeep } from 'lodash'
import {
  FilingStatus,
  Income1099Type,
  IraPlanType,
  PersonRole
} from 'ustaxes/core/data'
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

describe('Form 1099-G workbook parity', () => {
  it('includes unemployment compensation in Schedule 1 and federal withholding in Form 1040 payments', () => {
    const information = cloneDeep(baseInformation)
    information.w2s = [
      {
        employer: { EIN: '123456789', employerName: 'Employer Inc' },
        personRole: PersonRole.PRIMARY,
        occupation: 'Engineer',
        state: 'CO',
        income: 40000,
        medicareIncome: 40000,
        fedWithholding: 4000,
        ssWages: 40000,
        ssWithholding: 2480,
        medicareWithholding: 580,
        stateWages: 40000,
        stateWithholding: 1800
      }
    ]
    information.f1098es = [
      {
        lender: 'MOHELA',
        interest: 2500
      }
    ]
    information.f1099s = [
      {
        payer: 'Colorado Department of Labor',
        type: Income1099Type.G,
        personRole: PersonRole.PRIMARY,
        form: {
          unemploymentCompensation: 5000,
          federalIncomeTaxWithheld: 500
        }
      }
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f1099g?.isNeeded()).toBe(true)
    expect(f1040.f1099g?.unemploymentCompensation()).toBe(5000)
    expect(f1040.schedule1.isNeeded()).toBe(true)
    expect(f1040.schedule1.l7()).toBe(5000)
    expect(f1040.schedule1.l21()).toBe(2500)
    expect(f1040.l9()).toBe(45000)
    expect(f1040.l11()).toBe(42500)
    expect(f1040.l25b()).toBe(500)
    expect(f1040.l25d()).toBe(4500)
  })

  it('counts social security and IRA withholding in the workbook-aligned income flow', () => {
    const information = cloneDeep(baseInformation)
    information.w2s = [
      {
        employer: { EIN: '123456789', employerName: 'Employer Inc' },
        personRole: PersonRole.PRIMARY,
        occupation: 'Engineer',
        state: 'CO',
        income: 30000,
        medicareIncome: 30000,
        fedWithholding: 3000,
        ssWages: 30000,
        ssWithholding: 1860,
        medicareWithholding: 435,
        stateWages: 30000,
        stateWithholding: 1350
      }
    ]
    information.f1099s = [
      {
        payer: 'Social Security Administration',
        type: Income1099Type.SSA,
        personRole: PersonRole.PRIMARY,
        form: {
          netBenefits: 12000,
          federalIncomeTaxWithheld: 0
        }
      }
    ]
    information.individualRetirementArrangements = [
      {
        payer: 'Vanguard',
        personRole: PersonRole.PRIMARY,
        grossDistribution: 9000,
        taxableAmount: 9000,
        taxableAmountNotDetermined: false,
        totalDistribution: true,
        federalIncomeTaxWithheld: 900,
        planType: IraPlanType.IRA,
        contributions: 3000,
        rolloverContributions: 0,
        rothIraConversion: 0,
        recharacterizedContributions: 0,
        requiredMinimumDistributions: 0,
        lateContributions: 0,
        repayments: 0
      }
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.socialSecurityBenefitsWorksheet?.l1()).toBe(12000)
    expect(f1040.l4a()).toBe(9000)
    expect(f1040.l4b()).toBe(9000)
    expect(f1040.l25b()).toBe(900)
    expect(f1040.l25d()).toBe(3900)
    expect(f1040.l11()).toBeGreaterThan(39000)
  })
})
