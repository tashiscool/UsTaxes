import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 706 - United States Estate (and Generation-Skipping Transfer) Tax Return
 *
 * Filed by the executor of the estate of a deceased U.S. citizen or resident
 * when the gross estate plus adjusted taxable gifts exceeds the filing threshold.
 *
 * 2025 Thresholds:
 * - Basic exclusion amount: $13,990,000
 * - Portability: Deceased spouse's unused exclusion (DSUE) can be transferred
 *
 * Key Schedules:
 * - Schedule A: Real Estate
 * - Schedule B: Stocks and Bonds
 * - Schedule C: Mortgages, Notes, and Cash
 * - Schedule D: Insurance on Decedent's Life
 * - Schedule E: Jointly Owned Property
 * - Schedule F: Other Miscellaneous Property
 * - Schedule G: Transfers During Decedent's Life
 * - Schedule H: Powers of Appointment
 * - Schedule I: Annuities
 * - Schedule J: Funeral and Administration Expenses
 * - Schedule K: Debts of the Decedent
 * - Schedule L: Net Losses During Administration
 * - Schedule M: Marital Deduction
 * - Schedule O: Charitable Deduction
 * - Schedule P: Credit for Foreign Death Taxes
 * - Schedule Q: Credit for Tax on Prior Transfers
 * - Schedule R: Generation-Skipping Transfer Tax
 * - Schedule U: Qualified Conservation Easement Exclusion
 */

export interface DecedentInfo {
  name: string
  ssn: string
  dateOfDeath: Date
  dateOfBirth: Date
  domicileAtDeath: string
  citizenship: 'US' | 'resident' | 'nonresident'
  occupation: string
  maritalStatus: 'married' | 'widowed' | 'single' | 'divorced'
}

export interface ExecutorInfo {
  name: string
  address: string
  ein?: string
  phone: string
  relationship: string
}

export interface EstateAsset {
  description: string
  location?: string
  dateAcquired?: Date
  fairMarketValue: number
  alternateValue?: number // Alternate valuation (6 months after death)
  scheduleType: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
}

export interface EstateDeduction {
  description: string
  amount: number
  scheduleType: 'J' | 'K' | 'L' | 'M' | 'O'
}

export interface Form706Info {
  decedent: DecedentInfo
  executor: ExecutorInfo
  assets: EstateAsset[]
  deductions: EstateDeduction[]
  // Valuation election
  useAlternateValuation: boolean
  alternateValuationDate?: Date
  // Portability
  electPortability: boolean
  deceasedSpouseUnusedExclusion?: number
  // Prior gifts
  adjustedTaxableGifts: number
  giftTaxPaid: number
  // Credits
  foreignDeathTaxCredit: number
  priorTransferCredit: number
  // GST
  hasGSTTransfers: boolean
  gstExemptionUsed?: number
}

// 2025 Estate Tax Constants
const BASIC_EXCLUSION_2025 = 13990000
const TOP_ESTATE_TAX_RATE = 0.4

export default class F706 extends F1040Attachment {
  tag: FormTag = 'f706'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasEstateInfo()
  }

  hasEstateInfo = (): boolean => {
    return this.f706Info() !== undefined
  }

  f706Info = (): Form706Info | undefined => {
    return this.f1040.info.estateTaxReturn as Form706Info | undefined
  }

  // Decedent Information
  decedent = (): DecedentInfo | undefined => this.f706Info()?.decedent
  decedentName = (): string => this.decedent()?.name ?? ''
  decedentSSN = (): string => this.decedent()?.ssn ?? ''
  dateOfDeath = (): string =>
    this.decedent()?.dateOfDeath.toLocaleDateString() ?? ''

  // Executor Information
  executor = (): ExecutorInfo | undefined => this.f706Info()?.executor
  executorName = (): string => this.executor()?.name ?? ''

  // Schedule A: Real Estate
  realEstateAssets = (): EstateAsset[] => {
    return this.f706Info()?.assets.filter((a) => a.scheduleType === 'A') ?? []
  }
  totalRealEstate = (): number => {
    return this.realEstateAssets().reduce(
      (sum, a) => sum + a.fairMarketValue,
      0
    )
  }

  // Schedule B: Stocks and Bonds
  stocksAndBonds = (): EstateAsset[] => {
    return this.f706Info()?.assets.filter((a) => a.scheduleType === 'B') ?? []
  }
  totalStocksAndBonds = (): number => {
    return this.stocksAndBonds().reduce((sum, a) => sum + a.fairMarketValue, 0)
  }

  // Schedule C: Mortgages, Notes, Cash
  mortgagesNotesCash = (): EstateAsset[] => {
    return this.f706Info()?.assets.filter((a) => a.scheduleType === 'C') ?? []
  }
  totalMortgagesNotesCash = (): number => {
    return this.mortgagesNotesCash().reduce(
      (sum, a) => sum + a.fairMarketValue,
      0
    )
  }

  // Schedule D: Life Insurance
  lifeInsurance = (): EstateAsset[] => {
    return this.f706Info()?.assets.filter((a) => a.scheduleType === 'D') ?? []
  }
  totalLifeInsurance = (): number => {
    return this.lifeInsurance().reduce((sum, a) => sum + a.fairMarketValue, 0)
  }

  // Schedule E: Jointly Owned Property
  jointlyOwnedProperty = (): EstateAsset[] => {
    return this.f706Info()?.assets.filter((a) => a.scheduleType === 'E') ?? []
  }
  totalJointlyOwned = (): number => {
    return this.jointlyOwnedProperty().reduce(
      (sum, a) => sum + a.fairMarketValue,
      0
    )
  }

  // Schedule F: Other Property
  otherProperty = (): EstateAsset[] => {
    return this.f706Info()?.assets.filter((a) => a.scheduleType === 'F') ?? []
  }
  totalOtherProperty = (): number => {
    return this.otherProperty().reduce((sum, a) => sum + a.fairMarketValue, 0)
  }

  // Gross Estate
  grossEstate = (): number => {
    return sumFields([
      this.totalRealEstate(),
      this.totalStocksAndBonds(),
      this.totalMortgagesNotesCash(),
      this.totalLifeInsurance(),
      this.totalJointlyOwned(),
      this.totalOtherProperty()
    ])
  }

  // Deductions
  funeralExpenses = (): number => {
    return (
      this.f706Info()
        ?.deductions.filter((d) => d.scheduleType === 'J')
        .reduce((sum, d) => sum + d.amount, 0) ?? 0
    )
  }

  debts = (): number => {
    return (
      this.f706Info()
        ?.deductions.filter((d) => d.scheduleType === 'K')
        .reduce((sum, d) => sum + d.amount, 0) ?? 0
    )
  }

  maritalDeduction = (): number => {
    return (
      this.f706Info()
        ?.deductions.filter((d) => d.scheduleType === 'M')
        .reduce((sum, d) => sum + d.amount, 0) ?? 0
    )
  }

  charitableDeduction = (): number => {
    return (
      this.f706Info()
        ?.deductions.filter((d) => d.scheduleType === 'O')
        .reduce((sum, d) => sum + d.amount, 0) ?? 0
    )
  }

  totalDeductions = (): number => {
    return (
      this.f706Info()?.deductions.reduce((sum, d) => sum + d.amount, 0) ?? 0
    )
  }

  // Taxable Estate
  taxableEstate = (): number => {
    return Math.max(0, this.grossEstate() - this.totalDeductions())
  }

  // Add adjusted taxable gifts
  adjustedTaxableGifts = (): number =>
    this.f706Info()?.adjustedTaxableGifts ?? 0

  // Tax Base
  taxBase = (): number => {
    return this.taxableEstate() + this.adjustedTaxableGifts()
  }

  // Tentative Tax (simplified - actual uses graduated rates)
  tentativeTax = (): number => {
    const base = this.taxBase()
    if (base <= 0) return 0
    // Simplified: 40% on amounts over exclusion
    return Math.round(base * TOP_ESTATE_TAX_RATE)
  }

  // Unified Credit
  basicExclusion = (): number => BASIC_EXCLUSION_2025

  dsueAmount = (): number => {
    if (this.f706Info()?.electPortability) {
      return this.f706Info()?.deceasedSpouseUnusedExclusion ?? 0
    }
    return 0
  }

  applicableExclusion = (): number => {
    return this.basicExclusion() + this.dsueAmount()
  }

  unifiedCredit = (): number => {
    return Math.round(this.applicableExclusion() * TOP_ESTATE_TAX_RATE)
  }

  // Credits
  foreignDeathTaxCredit = (): number =>
    this.f706Info()?.foreignDeathTaxCredit ?? 0
  priorTransferCredit = (): number => this.f706Info()?.priorTransferCredit ?? 0
  giftTaxPaid = (): number => this.f706Info()?.giftTaxPaid ?? 0

  totalCredits = (): number => {
    return sumFields([
      this.unifiedCredit(),
      this.foreignDeathTaxCredit(),
      this.priorTransferCredit(),
      this.giftTaxPaid()
    ])
  }

  // Net Estate Tax
  netEstateTax = (): number => {
    return Math.max(0, this.tentativeTax() - this.totalCredits())
  }

  // GST Tax
  hasGSTTransfers = (): boolean => this.f706Info()?.hasGSTTransfers ?? false
  gstExemptionUsed = (): number => this.f706Info()?.gstExemptionUsed ?? 0

  // Filing requirement check
  requiresFiling = (): boolean => {
    return (
      this.grossEstate() + this.adjustedTaxableGifts() > BASIC_EXCLUSION_2025
    )
  }

  fields = (): Field[] => {
    const dec = this.decedent()
    const exec = this.executor()

    return [
      // Part 1: Decedent and Executor
      this.decedentName(),
      this.decedentSSN(),
      dec?.domicileAtDeath ?? '',
      this.dateOfDeath(),
      dec?.dateOfBirth.toLocaleDateString() ?? '',
      this.executorName(),
      exec?.address ?? '',
      exec?.phone ?? '',
      // Part 2: Tax Computation
      this.grossEstate(),
      this.totalDeductions(),
      this.taxableEstate(),
      this.adjustedTaxableGifts(),
      this.taxBase(),
      this.tentativeTax(),
      this.unifiedCredit(),
      this.foreignDeathTaxCredit(),
      this.priorTransferCredit(),
      this.giftTaxPaid(),
      this.totalCredits(),
      this.netEstateTax(),
      // Schedule totals
      this.totalRealEstate(),
      this.totalStocksAndBonds(),
      this.totalMortgagesNotesCash(),
      this.totalLifeInsurance(),
      this.totalJointlyOwned(),
      this.totalOtherProperty(),
      // Deduction totals
      this.funeralExpenses(),
      this.debts(),
      this.maritalDeduction(),
      this.charitableDeduction(),
      // Portability
      this.f706Info()?.electPortability ?? false,
      this.dsueAmount(),
      // GST
      this.hasGSTTransfers(),
      this.gstExemptionUsed()
    ]
  }
}
