import { cloneDeep } from 'lodash'
import { FilingStatus, Income1099Type, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'
import { computeOrdinaryTax } from '../irsForms/TaxTable'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [
    {
      employer: { EIN: '123456789', employerName: 'Workbook Employer' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Analyst',
      state: 'CA',
      income: 40000,
      medicareIncome: 40000,
      fedWithholding: 4000,
      ssWages: 40000,
      ssWithholding: 2480,
      medicareWithholding: 580,
      stateWages: 40000,
      stateWithholding: 1600
    }
  ],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: '123 Workbook Ln',
        aptNo: '',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001'
      },
      firstName: 'Casey',
      lastName: 'Interest',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '400015555',
      dateOfBirth: new Date('1985-07-04'),
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
  individualRetirementArrangements: []
}

describe('Interest and dividend workbook parity', () => {
  it('routes 1099-INT and 1099-DIV workbook fields through Schedule B, Schedule D, and Form 1040', () => {
    const information = cloneDeep(baseInformation)
    information.f1099s = [
      {
        payer: 'Chase Bank',
        type: Income1099Type.INT,
        personRole: PersonRole.PRIMARY,
        form: {
          income: 1200,
          taxExemptInterest: 250,
          foreignTaxPaid: 10
        }
      },
      {
        payer: 'TreasuryDirect',
        type: Income1099Type.INT,
        personRole: PersonRole.PRIMARY,
        form: {
          income: 300
        }
      },
      {
        payer: 'Vanguard',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 2000,
          qualifiedDividends: 1500,
          totalCapitalGainsDistributions: 500,
          exemptInterestDividends: 125,
          foreignTaxPaid: 75,
          section199ADividends: 200
        }
      }
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleB.isNeeded()).toBe(true)
    expect(f1040.scheduleB.l1Fields()).toHaveLength(2)
    expect(f1040.scheduleB.l5Fields()).toHaveLength(1)
    expect(f1040.scheduleB.l2()).toBe(1500)
    expect(f1040.scheduleB.l6()).toBe(2000)
    expect(f1040.l2a()).toBe(375)
    expect(f1040.l2b()).toBe(1500)
    expect(f1040.l3a()).toBe(1500)
    expect(f1040.l3b()).toBe(2000)
    expect(f1040.scheduleD.isNeeded()).toBe(false)
    expect(f1040.scheduleD.l13()).toBe(500)
    expect(f1040.l7()).toBe(500)
  })

  it('uses the qualified dividend and capital gain worksheet when dividends stay in the 0% band', () => {
    const information = cloneDeep(baseInformation)
    information.w2s[0].income = 45000
    information.w2s[0].medicareIncome = 45000
    information.w2s[0].ssWages = 45000
    information.w2s[0].stateWages = 45000
    information.f1099s = [
      {
        payer: 'Vanguard',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 5000,
          qualifiedDividends: 5000,
          totalCapitalGainsDistributions: 0
        }
      }
    ]

    const f1040 = new F1040(information, [])
    const ordinaryTaxableIncome = Math.max(0, (f1040.l15() ?? 0) - 5000)

    expect(f1040.totalQualifiedDividends()).toBe(5000)
    expect(f1040.standardDeduction()).toBe(15750)
    expect(f1040.l15()).toBe(34250)
    expect(f1040.l16()).toBe(
      computeOrdinaryTax(FilingStatus.S, ordinaryTaxableIncome)
    )
  })

  it('creates an additional Schedule B copy when payer counts exceed workbook capacity', () => {
    const information = cloneDeep(baseInformation)
    information.f1099s = [
      ...Array.from({ length: 16 }, (_, index) => ({
        payer: `Interest Payer ${index + 1}`,
        type: Income1099Type.INT as const,
        personRole: PersonRole.PRIMARY,
        form: {
          income: 100 + index
        }
      })),
      ...Array.from({ length: 16 }, (_, index) => ({
        payer: `Dividend Payer ${index + 1}`,
        type: Income1099Type.DIV as const,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 50 + index,
          qualifiedDividends: 25 + index,
          totalCapitalGainsDistributions: 0
        }
      }))
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleB.copies()).toHaveLength(1)
    expect(f1040.scheduleB.to1040l2b()).toBe(
      Array.from({ length: 16 }, (_, index) => 100 + index).reduce(
        (sum, amount) => sum + amount,
        0
      )
    )
    expect(f1040.scheduleB.to1040l3b()).toBe(
      Array.from({ length: 16 }, (_, index) => 50 + index).reduce(
        (sum, amount) => sum + amount,
        0
      )
    )
  })
})
