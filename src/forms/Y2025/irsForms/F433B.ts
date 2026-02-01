import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 433-B - Collection Information Statement for Businesses
 *
 * Used by the IRS to evaluate a business's ability to pay when:
 * - Requesting an installment agreement
 * - Submitting an Offer in Compromise
 * - Requesting currently not collectible status
 *
 * Applies to:
 * - Sole proprietorships (with Form 433-A)
 * - Partnerships
 * - Corporations
 * - LLCs
 *
 * Collects detailed business financial information.
 */

export type BusinessEntityType =
  | 'soleProprietor'
  | 'partnership'
  | 'corporation'
  | 'llc'
  | 'other'

export interface BusinessInfo {
  businessName: string
  businessAddress: string
  businessCity: string
  businessState: string
  businessZip: string
  ein: string
  businessPhone: string
  businessType: string
  entityType: BusinessEntityType
  dateEstablished: Date
  numberOfEmployees: number
  averageGrossPayroll: number
  accountingMethod: 'cash' | 'accrual'
  fiscalYearEnd: string
}

export interface BusinessBankAccount {
  bankName: string
  bankAddress: string
  accountType: 'checking' | 'savings' | 'payroll' | 'other'
  accountNumber: string
  currentBalance: number
}

export interface BusinessAccountsReceivable {
  debtorName: string
  amount: number
  ageInDays: number
  status: 'current' | 'past30' | 'past60' | 'past90' | 'uncollectible'
}

export interface BusinessAsset {
  description: string
  dateAcquired: Date
  currentMarketValue: number
  currentLoanBalance: number
  monthlyPayment: number
  lenderName: string
  equity: number
}

export interface BusinessMonthlyIncome {
  grossReceipts: number
  grossRentalIncome: number
  interestIncome: number
  dividendIncome: number
  otherIncome: number
}

export interface BusinessMonthlyExpenses {
  materialsSuppies: number
  inventory: number
  grossWages: number
  rent: number
  utilities: number
  vehicleGasOilRepair: number
  vehicleLease: number
  insurance: number
  currentTaxes: number
  otherExpenses: number
}

export interface BusinessCollectionInfo {
  businessInfo: BusinessInfo
  bankAccounts: BusinessBankAccount[]
  accountsReceivable: BusinessAccountsReceivable[]
  businessAssets: BusinessAsset[]
  monthlyIncome: BusinessMonthlyIncome
  monthlyExpenses: BusinessMonthlyExpenses
  totalAssetsValue: number
  totalLiabilities: number
  taxDebtOwed: number
}

export default class F433B extends F1040Attachment {
  tag: FormTag = 'f433b'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasBusinessCollectionInfo()
  }

  hasBusinessCollectionInfo = (): boolean => {
    return this.collectionInfo() !== undefined
  }

  collectionInfo = (): BusinessCollectionInfo | undefined => {
    return this.f1040.info.businessCollectionStatement as
      | BusinessCollectionInfo
      | undefined
  }

  // Section 1: Business Information
  businessInfo = (): BusinessInfo | undefined => {
    return this.collectionInfo()?.businessInfo
  }

  businessName = (): string => this.businessInfo()?.businessName ?? ''
  ein = (): string => this.businessInfo()?.ein ?? ''
  businessType = (): string => this.businessInfo()?.businessType ?? ''
  entityType = (): BusinessEntityType =>
    this.businessInfo()?.entityType ?? 'soleProprietor'
  numberOfEmployees = (): number => this.businessInfo()?.numberOfEmployees ?? 0

  // Section 2: Bank Accounts
  bankAccounts = (): BusinessBankAccount[] => {
    return this.collectionInfo()?.bankAccounts ?? []
  }

  totalBankBalance = (): number => {
    return this.bankAccounts().reduce((sum, a) => sum + a.currentBalance, 0)
  }

  // Section 3: Accounts Receivable
  accountsReceivable = (): BusinessAccountsReceivable[] => {
    return this.collectionInfo()?.accountsReceivable ?? []
  }

  totalReceivables = (): number => {
    return this.accountsReceivable()
      .filter((ar) => ar.status !== 'uncollectible')
      .reduce((sum, ar) => sum + ar.amount, 0)
  }

  // Section 4: Business Assets
  businessAssets = (): BusinessAsset[] => {
    return this.collectionInfo()?.businessAssets ?? []
  }

  totalAssetValue = (): number => {
    return this.businessAssets().reduce(
      (sum, a) => sum + a.currentMarketValue,
      0
    )
  }

  totalAssetEquity = (): number => {
    return this.businessAssets().reduce((sum, a) => sum + a.equity, 0)
  }

  // Section 5: Monthly Income
  monthlyIncome = (): BusinessMonthlyIncome | undefined => {
    return this.collectionInfo()?.monthlyIncome
  }

  totalMonthlyIncome = (): number => {
    const income = this.monthlyIncome()
    if (!income) return 0
    return sumFields([
      income.grossReceipts,
      income.grossRentalIncome,
      income.interestIncome,
      income.dividendIncome,
      income.otherIncome
    ])
  }

  // Section 6: Monthly Expenses
  monthlyExpenses = (): BusinessMonthlyExpenses | undefined => {
    return this.collectionInfo()?.monthlyExpenses
  }

  totalMonthlyExpenses = (): number => {
    const expenses = this.monthlyExpenses()
    if (!expenses) return 0
    return sumFields([
      expenses.materialsSuppies,
      expenses.inventory,
      expenses.grossWages,
      expenses.rent,
      expenses.utilities,
      expenses.vehicleGasOilRepair,
      expenses.vehicleLease,
      expenses.insurance,
      expenses.currentTaxes,
      expenses.otherExpenses
    ])
  }

  // Summary calculations
  monthlyNetIncome = (): number => {
    return Math.max(0, this.totalMonthlyIncome() - this.totalMonthlyExpenses())
  }

  totalAssets = (): number => {
    return (
      this.collectionInfo()?.totalAssetsValue ??
      this.totalBankBalance() + this.totalReceivables() + this.totalAssetValue()
    )
  }

  totalLiabilities = (): number => {
    return this.collectionInfo()?.totalLiabilities ?? 0
  }

  netWorth = (): number => {
    return this.totalAssets() - this.totalLiabilities()
  }

  taxDebtOwed = (): number => {
    return this.collectionInfo()?.taxDebtOwed ?? 0
  }

  fields = (): Field[] => {
    const biz = this.businessInfo()
    const income = this.monthlyIncome()
    const expenses = this.monthlyExpenses()
    const accounts = this.bankAccounts()
    const ar = this.accountsReceivable()
    const assets = this.businessAssets()

    return [
      // Section 1: Business Info
      this.businessName(),
      biz?.businessAddress ?? '',
      `${biz?.businessCity ?? ''}, ${biz?.businessState ?? ''} ${
        biz?.businessZip ?? ''
      }`,
      this.ein(),
      biz?.businessPhone ?? '',
      this.businessType(),
      this.entityType(),
      biz?.dateEstablished.toLocaleDateString() ?? '',
      this.numberOfEmployees(),
      biz?.averageGrossPayroll ?? 0,
      biz?.accountingMethod ?? '',
      // Section 2: Bank Accounts
      accounts[0]?.bankName ?? '',
      accounts[0]?.accountType ?? '',
      accounts[0]?.currentBalance ?? 0,
      accounts[1]?.bankName ?? '',
      accounts[1]?.accountType ?? '',
      accounts[1]?.currentBalance ?? 0,
      this.totalBankBalance(),
      // Section 3: Accounts Receivable
      this.totalReceivables(),
      ar
        .filter((a) => a.status === 'current')
        .reduce((s, a) => s + a.amount, 0),
      ar.filter((a) => a.status === 'past30').reduce((s, a) => s + a.amount, 0),
      ar.filter((a) => a.status === 'past60').reduce((s, a) => s + a.amount, 0),
      ar.filter((a) => a.status === 'past90').reduce((s, a) => s + a.amount, 0),
      // Section 4: Assets
      assets[0]?.description ?? '',
      assets[0]?.currentMarketValue ?? 0,
      assets[0]?.currentLoanBalance ?? 0,
      assets[0]?.equity ?? 0,
      this.totalAssetEquity(),
      // Section 5: Monthly Income
      income?.grossReceipts ?? 0,
      income?.grossRentalIncome ?? 0,
      income?.interestIncome ?? 0,
      income?.otherIncome ?? 0,
      this.totalMonthlyIncome(),
      // Section 6: Monthly Expenses
      expenses?.materialsSuppies ?? 0,
      expenses?.inventory ?? 0,
      expenses?.grossWages ?? 0,
      expenses?.rent ?? 0,
      expenses?.utilities ?? 0,
      expenses?.vehicleGasOilRepair ?? 0,
      expenses?.insurance ?? 0,
      expenses?.currentTaxes ?? 0,
      expenses?.otherExpenses ?? 0,
      this.totalMonthlyExpenses(),
      // Summary
      this.totalAssets(),
      this.totalLiabilities(),
      this.netWorth(),
      this.monthlyNetIncome()
    ]
  }
}
