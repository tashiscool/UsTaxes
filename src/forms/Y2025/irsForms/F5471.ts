import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 5471 - Information Return of U.S. Persons With Respect to Certain Foreign Corporations
 *
 * Required for U.S. persons who are officers, directors, or shareholders of certain foreign corporations.
 * Categories of filers (each with different schedule requirements):
 *
 * Category 1: U.S. shareholder of a specified foreign corporation (SFC)
 * Category 2: Officer or director with 10%+ U.S. shareholder
 * Category 3: 10%+ acquisition/disposition of foreign corp stock
 * Category 4: Control of foreign corporation (>50% vote/value)
 * Category 5: 10%+ shareholder of controlled foreign corporation (CFC)
 *
 * Schedules (implemented as part of this form):
 * - Schedule A: Stock of the Foreign Corporation
 * - Schedule B: U.S. Shareholders of Foreign Corporation
 * - Schedule C: Income Statement
 * - Schedule E: Income, War Profits, and Excess Profits Taxes
 * - Schedule F: Balance Sheet
 * - Schedule G: Other Information
 * - Schedule H: Current E&P (or Deficit)
 * - Schedule I-1: Global Intangible Low-Taxed Income (GILTI)
 * - Schedule J: Accumulated E&P of CFC
 * - Schedule P: Previously Taxed E&P
 * - Schedule Q: CFC Income by CFC Income Groups
 * - Schedule R: Distributions From a Foreign Corporation
 */

export type FilingCategory = 1 | 2 | 3 | 4 | 5

export interface ForeignCorporationInfo {
  name: string
  ein?: string
  referenceId: string
  countryOfIncorporation: string
  dateOfIncorporation: Date
  principalBusinessActivity: string
  principalBusinessCode: string
  functionalCurrency: string
  exchangeRateUsed: number
}

export interface USShareholderInfo {
  name: string
  tin: string
  percentageOwned: number
  sharesOwned: number
  sharesType: 'voting' | 'nonvoting' | 'preferred'
}

export interface ForeignCorpIncomeStatement {
  grossReceipts: number
  costOfGoodsSold: number
  grossProfit: number
  dividends: number
  interest: number
  rents: number
  royalties: number
  netGainOrLoss: number
  otherIncome: number
  totalIncome: number
  compensation: number
  rentsExpense: number
  interestExpense: number
  depreciation: number
  taxes: number
  otherDeductions: number
  totalDeductions: number
  netIncomeBeforeTax: number
  incomeTaxExpense: number
  netIncomeAfterTax: number
}

export interface ForeignCorpBalanceSheet {
  // Assets
  cashAndDeposits: number
  accountsReceivable: number
  inventories: number
  otherCurrentAssets: number
  loansToShareholders: number
  investments: number
  buildings: number
  otherAssets: number
  totalAssets: number
  // Liabilities
  accountsPayable: number
  shortTermDebt: number
  loansFromShareholders: number
  longTermDebt: number
  otherLiabilities: number
  totalLiabilities: number
  // Equity
  capitalStock: number
  paidInCapital: number
  retainedEarnings: number
  totalEquity: number
}

export interface Form5471Info {
  filingCategories: FilingCategory[]
  foreignCorporation: ForeignCorporationInfo
  usShareholders: USShareholderInfo[]
  incomeStatement: ForeignCorpIncomeStatement
  balanceSheet: ForeignCorpBalanceSheet
  // CFC-specific
  isCFC: boolean
  subpartFIncome?: number
  giltiIncome?: number
  currentEandP?: number
  accumulatedEandP?: number
  previouslyTaxedEandP?: number
  distributions?: number
}

export default class F5471 extends F1040Attachment {
  tag: FormTag = 'f5471'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForeignCorporation()
  }

  hasForeignCorporation = (): boolean => {
    return this.f5471Info() !== undefined
  }

  f5471Info = (): Form5471Info | undefined => {
    return this.f1040.info.foreignCorporations?.[0] as Form5471Info | undefined
  }

  // Filing categories
  filingCategories = (): FilingCategory[] => this.f5471Info()?.filingCategories ?? []
  isCategory = (cat: FilingCategory): boolean => this.filingCategories().includes(cat)

  // Foreign corporation info
  foreignCorp = (): ForeignCorporationInfo | undefined => this.f5471Info()?.foreignCorporation

  corpName = (): string => this.foreignCorp()?.name ?? ''
  corpEin = (): string => this.foreignCorp()?.ein ?? ''
  corpReferenceId = (): string => this.foreignCorp()?.referenceId ?? ''
  corpCountry = (): string => this.foreignCorp()?.countryOfIncorporation ?? ''
  corpFunctionalCurrency = (): string => this.foreignCorp()?.functionalCurrency ?? 'USD'
  corpExchangeRate = (): number => this.foreignCorp()?.exchangeRateUsed ?? 1

  // Schedule A: Stock Information
  usShareholders = (): USShareholderInfo[] => this.f5471Info()?.usShareholders ?? []

  totalSharesOwned = (): number => {
    return this.usShareholders().reduce((sum, s) => sum + s.sharesOwned, 0)
  }

  totalPercentageOwned = (): number => {
    return this.usShareholders().reduce((sum, s) => sum + s.percentageOwned, 0)
  }

  // Schedule C: Income Statement
  incomeStatement = (): ForeignCorpIncomeStatement | undefined => this.f5471Info()?.incomeStatement

  grossReceipts = (): number => this.incomeStatement()?.grossReceipts ?? 0
  costOfGoodsSold = (): number => this.incomeStatement()?.costOfGoodsSold ?? 0
  grossProfit = (): number => this.incomeStatement()?.grossProfit ?? 0
  totalIncome = (): number => this.incomeStatement()?.totalIncome ?? 0
  totalDeductions = (): number => this.incomeStatement()?.totalDeductions ?? 0
  netIncomeBeforeTax = (): number => this.incomeStatement()?.netIncomeBeforeTax ?? 0
  netIncomeAfterTax = (): number => this.incomeStatement()?.netIncomeAfterTax ?? 0

  // Schedule F: Balance Sheet
  balanceSheet = (): ForeignCorpBalanceSheet | undefined => this.f5471Info()?.balanceSheet

  totalAssets = (): number => this.balanceSheet()?.totalAssets ?? 0
  totalLiabilities = (): number => this.balanceSheet()?.totalLiabilities ?? 0
  totalEquity = (): number => this.balanceSheet()?.totalEquity ?? 0

  // CFC Information (Schedules H, I-1, J, P)
  isCFC = (): boolean => this.f5471Info()?.isCFC ?? false
  subpartFIncome = (): number => this.f5471Info()?.subpartFIncome ?? 0
  giltiIncome = (): number => this.f5471Info()?.giltiIncome ?? 0
  currentEandP = (): number => this.f5471Info()?.currentEandP ?? 0
  accumulatedEandP = (): number => this.f5471Info()?.accumulatedEandP ?? 0
  previouslyTaxedEandP = (): number => this.f5471Info()?.previouslyTaxedEandP ?? 0

  // Schedule R: Distributions
  distributions = (): number => this.f5471Info()?.distributions ?? 0

  // Convert to USD using exchange rate
  toUSD = (amount: number): number => {
    return Math.round(amount * this.corpExchangeRate())
  }

  fields = (): Field[] => {
    const corp = this.foreignCorp()
    const income = this.incomeStatement()
    const balance = this.balanceSheet()
    const shareholders = this.usShareholders()

    return [
      // Header
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Categories
      this.isCategory(1),
      this.isCategory(2),
      this.isCategory(3),
      this.isCategory(4),
      this.isCategory(5),
      // Foreign Corporation Info
      this.corpName(),
      this.corpEin(),
      this.corpReferenceId(),
      this.corpCountry(),
      corp?.dateOfIncorporation?.toLocaleDateString() ?? '',
      corp?.principalBusinessActivity ?? '',
      corp?.principalBusinessCode ?? '',
      this.corpFunctionalCurrency(),
      this.corpExchangeRate(),
      // Schedule A: First shareholder
      shareholders[0]?.name ?? '',
      shareholders[0]?.tin ?? '',
      shareholders[0]?.sharesOwned ?? 0,
      shareholders[0]?.percentageOwned ?? 0,
      // Schedule C: Income
      this.grossReceipts(),
      this.costOfGoodsSold(),
      this.grossProfit(),
      income?.dividends ?? 0,
      income?.interest ?? 0,
      income?.rents ?? 0,
      income?.royalties ?? 0,
      this.totalIncome(),
      this.totalDeductions(),
      this.netIncomeBeforeTax(),
      income?.incomeTaxExpense ?? 0,
      this.netIncomeAfterTax(),
      // Schedule F: Balance Sheet
      balance?.cashAndDeposits ?? 0,
      balance?.accountsReceivable ?? 0,
      balance?.inventories ?? 0,
      this.totalAssets(),
      balance?.accountsPayable ?? 0,
      balance?.shortTermDebt ?? 0,
      this.totalLiabilities(),
      balance?.capitalStock ?? 0,
      balance?.retainedEarnings ?? 0,
      this.totalEquity(),
      // CFC Information
      this.isCFC(),
      this.subpartFIncome(),
      this.giltiIncome(),
      this.currentEandP(),
      this.accumulatedEandP(),
      this.previouslyTaxedEandP(),
      this.distributions()
    ]
  }
}
