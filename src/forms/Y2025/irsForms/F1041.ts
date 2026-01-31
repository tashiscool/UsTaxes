import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1041 - U.S. Income Tax Return for Estates and Trusts
 *
 * Filed by fiduciaries of:
 * - Decedent's estates
 * - Simple trusts (required to distribute all income)
 * - Complex trusts (may accumulate income)
 * - Grantor trusts (income taxed to grantor)
 * - Bankruptcy estates
 * - Pooled income funds
 *
 * Key Schedules:
 * - Schedule A: Charitable Deduction
 * - Schedule B: Income Distribution Deduction
 * - Schedule G: Tax Computation and Payments
 * - Schedule I: Alternative Minimum Tax
 * - Schedule J: Accumulation Distribution
 * - Schedule K-1 (1041): Beneficiary's Share
 *
 * Filing Threshold: Gross income of $600+ or any taxable income
 * Due Date: April 15 for calendar year (15th of 4th month for fiscal year)
 */

export type EntityType = 'decedentEstate' | 'simpleTrust' | 'complexTrust' | 'grantorTrust' | 'bankruptcyEstate' | 'pooledIncomeFund' | 'qsst' | 'esbt'

export interface FiduciaryInfo {
  name: string
  title: string
  address: string
  ein: string
  phone: string
}

export interface BeneficiaryInfo {
  name: string
  tin: string
  address: string
  percentageShare: number
  isContingent: boolean
  // K-1 allocations
  ordinaryIncome: number
  qualifiedDividends: number
  capitalGains: number
  otherIncome: number
  deductions: number
  credits: number
}

export interface TrustIncome {
  interest: number
  ordinaryDividends: number
  qualifiedDividends: number
  businessIncome: number
  capitalGainShortTerm: number
  capitalGainLongTerm: number
  rents: number
  royalties: number
  farmIncome: number
  otherIncome: number
}

export interface TrustDeductions {
  interestExpense: number
  taxes: number
  fiduciaryFees: number
  charitableDeduction: number
  attorneyFees: number
  accountantFees: number
  otherDeductions: number
}

export interface Form1041Info {
  // Entity Information
  entityType: EntityType
  entityName: string
  ein: string
  dateCreated: Date
  isFinalReturn: boolean
  // Fiduciary
  fiduciary: FiduciaryInfo
  // Beneficiaries
  beneficiaries: BeneficiaryInfo[]
  // Income
  income: TrustIncome
  // Deductions
  deductions: TrustDeductions
  // Distributions
  requiredDistributions: number
  otherDistributions: number
  // Tax elections
  section645Election: boolean  // Treat revocable trust as part of estate
  section663bElection: boolean  // 65-day rule for distributions
  // Tax payments
  estimatedTaxPayments: number
  withholding: number
}

// 2025 Trust Tax Brackets (compressed vs individual)
const TRUST_BRACKETS_2025 = [
  { limit: 3150, rate: 0.10 },
  { limit: 11450, rate: 0.24 },
  { limit: 15650, rate: 0.35 },
  { limit: Infinity, rate: 0.37 }
]

const EXEMPTION_AMOUNTS = {
  decedentEstate: 600,
  simpleTrust: 300,
  complexTrust: 100,
  grantorTrust: 0,
  bankruptcyEstate: 0,
  pooledIncomeFund: 0,
  qsst: 300,
  esbt: 100
}

export default class F1041 extends F1040Attachment {
  tag: FormTag = 'f1041'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasFiduciaryInfo()
  }

  hasFiduciaryInfo = (): boolean => {
    return this.f1041Info() !== undefined
  }

  f1041Info = (): Form1041Info | undefined => {
    return this.f1040.info.fiduciaryReturn as Form1041Info | undefined
  }

  // Entity Information
  entityType = (): EntityType => this.f1041Info()?.entityType ?? 'complexTrust'
  entityName = (): string => this.f1041Info()?.entityName ?? ''
  ein = (): string => this.f1041Info()?.ein ?? ''

  isSimpleTrust = (): boolean => this.entityType() === 'simpleTrust'
  isComplexTrust = (): boolean => this.entityType() === 'complexTrust'
  isDecedentEstate = (): boolean => this.entityType() === 'decedentEstate'
  isGrantorTrust = (): boolean => this.entityType() === 'grantorTrust'

  // Fiduciary
  fiduciary = (): FiduciaryInfo | undefined => this.f1041Info()?.fiduciary
  fiduciaryName = (): string => this.fiduciary()?.name ?? ''

  // Beneficiaries
  beneficiaries = (): BeneficiaryInfo[] => this.f1041Info()?.beneficiaries ?? []
  numberOfBeneficiaries = (): number => this.beneficiaries().length

  // Income Calculation

  // Line 1: Interest income
  l1 = (): number => this.f1041Info()?.income.interest ?? 0

  // Line 2a: Ordinary dividends
  l2a = (): number => this.f1041Info()?.income.ordinaryDividends ?? 0

  // Line 2b: Qualified dividends
  l2b = (): number => this.f1041Info()?.income.qualifiedDividends ?? 0

  // Line 3: Business income
  l3 = (): number => this.f1041Info()?.income.businessIncome ?? 0

  // Line 4: Capital gains
  l4 = (): number => {
    const income = this.f1041Info()?.income
    return (income?.capitalGainShortTerm ?? 0) + (income?.capitalGainLongTerm ?? 0)
  }

  // Line 5: Rents, royalties, partnerships, etc.
  l5 = (): number => {
    const income = this.f1041Info()?.income
    return (income?.rents ?? 0) + (income?.royalties ?? 0)
  }

  // Line 6: Farm income
  l6 = (): number => this.f1041Info()?.income.farmIncome ?? 0

  // Line 7: Ordinary gain or loss
  l7 = (): number => 0  // From Form 4797

  // Line 8: Other income
  l8 = (): number => this.f1041Info()?.income.otherIncome ?? 0

  // Line 9: Total income
  l9 = (): number => {
    return sumFields([
      this.l1(), this.l2a(), this.l3(), this.l4(),
      this.l5(), this.l6(), this.l7(), this.l8()
    ])
  }

  // Deductions

  // Line 10: Interest expense
  l10 = (): number => this.f1041Info()?.deductions.interestExpense ?? 0

  // Line 11: Taxes
  l11 = (): number => this.f1041Info()?.deductions.taxes ?? 0

  // Line 12: Fiduciary fees
  l12 = (): number => this.f1041Info()?.deductions.fiduciaryFees ?? 0

  // Line 13: Charitable deduction
  l13 = (): number => this.f1041Info()?.deductions.charitableDeduction ?? 0

  // Line 14: Attorney, accountant, and return preparer fees
  l14 = (): number => {
    const ded = this.f1041Info()?.deductions
    return (ded?.attorneyFees ?? 0) + (ded?.accountantFees ?? 0)
  }

  // Line 15: Other deductions
  l15 = (): number => this.f1041Info()?.deductions.otherDeductions ?? 0

  // Line 16: Total deductions
  l16 = (): number => {
    return sumFields([
      this.l10(), this.l11(), this.l12(), this.l13(), this.l14(), this.l15()
    ])
  }

  // Line 17: Adjusted total income
  l17 = (): number => Math.max(0, this.l9() - this.l16())

  // Line 18: Income distribution deduction (Schedule B)
  l18 = (): number => {
    // For simple trusts, all income must be distributed
    if (this.isSimpleTrust()) {
      return this.l17()
    }
    // For complex trusts, distributions made
    const required = this.f1041Info()?.requiredDistributions ?? 0
    const other = this.f1041Info()?.otherDistributions ?? 0
    return Math.min(this.l17(), required + other)
  }

  // Line 19: Estate tax deduction
  l19 = (): number => 0  // IRD items

  // Line 20: Exemption
  l20 = (): number => {
    return EXEMPTION_AMOUNTS[this.entityType()] ?? 100
  }

  // Line 21: Total deductions (lines 18-20)
  l21 = (): number => this.l18() + this.l19() + this.l20()

  // Line 22: Taxable income
  l22 = (): number => Math.max(0, this.l17() - this.l21())

  // Tax Computation (Schedule G)

  // Calculate tax using trust brackets
  calculateTax = (): number => {
    const taxableIncome = this.l22()
    let tax = 0
    let previousLimit = 0

    for (const bracket of TRUST_BRACKETS_2025) {
      const taxableInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit
      if (taxableInBracket > 0) {
        tax += taxableInBracket * bracket.rate
      }
      previousLimit = bracket.limit
      if (taxableIncome <= bracket.limit) break
    }

    return Math.round(tax)
  }

  // Line 23: Tax
  l23 = (): number => this.calculateTax()

  // Line 24: Credits
  l24 = (): number => 0

  // Line 25: Tax minus credits
  l25 = (): number => Math.max(0, this.l23() - this.l24())

  // Line 26: Net investment income tax (3.8%)
  l26 = (): number => {
    // NIIT applies to trusts at $15,200 threshold (2025)
    const threshold = 15200
    if (this.l22() > threshold) {
      const niitBase = this.l22() - threshold
      return Math.round(niitBase * 0.038)
    }
    return 0
  }

  // Line 27: Total tax
  l27 = (): number => this.l25() + this.l26()

  // Payments

  // Line 28: Estimated tax payments
  l28 = (): number => this.f1041Info()?.estimatedTaxPayments ?? 0

  // Line 29: Withholding
  l29 = (): number => this.f1041Info()?.withholding ?? 0

  // Line 30: Total payments
  l30 = (): number => this.l28() + this.l29()

  // Line 31: Amount owed
  l31 = (): number => Math.max(0, this.l27() - this.l30())

  // Line 32: Overpayment
  l32 = (): number => Math.max(0, this.l30() - this.l27())

  // K-1 Generation
  generateK1s = (): BeneficiaryInfo[] => {
    const totalDistribution = this.l18()
    return this.beneficiaries().map(b => ({
      ...b,
      ordinaryIncome: Math.round(totalDistribution * b.percentageShare / 100)
    }))
  }

  fields = (): Field[] => {
    const fid = this.fiduciary()
    const bens = this.beneficiaries()

    return [
      // Entity Information
      this.entityName(),
      this.ein(),
      this.f1041Info()?.dateCreated?.toLocaleDateString() ?? '',
      this.isDecedentEstate(),
      this.isSimpleTrust(),
      this.isComplexTrust(),
      this.isGrantorTrust(),
      this.f1041Info()?.isFinalReturn ?? false,
      // Fiduciary
      this.fiduciaryName(),
      fid?.address ?? '',
      fid?.phone ?? '',
      // Income
      this.l1(),
      this.l2a(),
      this.l2b(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l8(),
      this.l9(),
      // Deductions
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      // Taxable Income
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21(),
      this.l22(),
      // Tax
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26(),
      this.l27(),
      // Payments
      this.l28(),
      this.l29(),
      this.l30(),
      this.l31(),
      this.l32(),
      // Beneficiaries
      this.numberOfBeneficiaries(),
      bens[0]?.name ?? '',
      bens[0]?.tin ?? '',
      bens[0]?.percentageShare ?? 0
    ]
  }
}
