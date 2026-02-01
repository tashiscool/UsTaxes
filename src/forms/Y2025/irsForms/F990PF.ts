/* eslint-disable @typescript-eslint/no-unused-vars */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 990-PF - Return of Private Foundation
 *
 * Filed by private foundations exempt under Section 501(c)(3)
 * regardless of financial status.
 *
 * Private Foundation Types:
 * - Non-operating: Makes grants but doesn't run its own programs
 * - Operating: Actively conducts charitable activities
 * - Pass-through: Distributes contributions within 2.5 months
 *
 * Key Requirements:
 * - Must distribute 5% of assets annually (minimum distribution)
 * - Subject to excise taxes on investment income
 * - Self-dealing rules with disqualified persons
 * - Restrictions on excess business holdings
 * - Restrictions on jeopardizing investments
 *
 * Due Date: 15th day of 5th month after fiscal year end
 */

export type FoundationType =
  | 'nonOperating'
  | 'operating'
  | 'passThrough'
  | 'privateOperating'
export type FoundationStatus =
  | 'section4940a1'
  | 'section4940a3'
  | 'section4940e'
  | 'other'

export interface FoundationInfo {
  name: string
  ein: string
  address: string
  city: string
  state: string
  zip: string
  website?: string
  foundationType: FoundationType
  foundationStatus: FoundationStatus
  exemptionDate: Date
  yearOfFormation: number
}

export interface FoundationRevenue {
  contributions: number
  interestOnSavings: number
  dividends: number
  grossRents: number
  netRentalIncome: number
  netGainFromSaleOfAssets: number
  capitalGainNetIncome: number
  grossSalesOfInventory: number
  otherIncome: number
}

export interface FoundationExpenses {
  compensation: number
  legalFees: number
  accountingFees: number
  otherProfessionalFees: number
  interest: number
  taxes: number
  depreciation: number
  occupancy: number
  travel: number
  conferences: number
  printing: number
  otherExpenses: number
}

export interface CharitableDistributions {
  domesticOrganizations: number
  domesticIndividuals: number
  foreignOrganizations: number
  foreignIndividuals: number
  programRelatedInvestments: number
  amountSetAsideForCharity: number
}

export interface InvestmentAssets {
  cashAndEquivalents: number
  savingsAndTemporary: number
  accountsReceivable: number
  pledgesReceivable: number
  grantsReceivable: number
  loansReceivable: number
  otherNotesLoans: number
  inventories: number
  prepaidExpenses: number
  publiclyTradedSecurities: number
  otherSecurities: number
  corporateStock: number
  corporateBonds: number
  landBuildingsEquipment: number
  investmentsInLand: number
  mortgageLoans: number
  otherInvestments: number
  otherAssets: number
}

export interface Form990PFInfo {
  foundation: FoundationInfo
  fiscalYearStart: Date
  fiscalYearEnd: Date
  isFinalReturn: boolean
  isAmendedReturn: boolean
  // Part I: Analysis of Revenue and Expenses
  revenue: FoundationRevenue
  expenses: FoundationExpenses
  // Part II: Balance Sheets
  assetsBeginning: number
  assetsEnding: number
  liabilitiesBeginning: number
  liabilitiesEnding: number
  investmentAssets: InvestmentAssets
  // Part IX: Charitable Distributions
  distributions: CharitableDistributions
  // Part X: Minimum Investment Return (5% test)
  averageMonthlyFMV: number
  cashDeemedCharitable: number
  acquisitionIndebtedness: number
  // Part XI: Distributable Amount
  priorYearDistributions: number
  // Excise Tax
  netInvestmentIncome: number
  exciseTaxRate: number
}

// 2025 Excise Tax Rates
const STANDARD_EXCISE_RATE = 0.0139 // 1.39%
const REDUCED_EXCISE_RATE = 0.01 // 1.0% for qualifying foundations

export default class F990PF extends F1040Attachment {
  tag: FormTag = 'f990pf'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm990PFInfo()
  }

  hasForm990PFInfo = (): boolean => {
    return this.f990PFInfo() !== undefined
  }

  f990PFInfo = (): Form990PFInfo | undefined => {
    return this.f1040.info.privateFoundationReturn as Form990PFInfo | undefined
  }

  // Foundation Info
  foundation = (): FoundationInfo | undefined => this.f990PFInfo()?.foundation
  foundationName = (): string => this.foundation()?.name ?? ''
  ein = (): string => this.foundation()?.ein ?? ''
  foundationType = (): FoundationType =>
    this.foundation()?.foundationType ?? 'nonOperating'
  isOperating = (): boolean =>
    this.foundationType() === 'operating' ||
    this.foundationType() === 'privateOperating'

  // Part I: Revenue
  revenue = (): FoundationRevenue | undefined => this.f990PFInfo()?.revenue

  totalRevenue = (): number => {
    const rev = this.revenue()
    if (!rev) return 0
    return sumFields([
      rev.contributions,
      rev.interestOnSavings,
      rev.dividends,
      rev.netRentalIncome,
      rev.capitalGainNetIncome,
      rev.otherIncome
    ])
  }

  // Part I: Expenses
  expenses = (): FoundationExpenses | undefined => this.f990PFInfo()?.expenses

  totalExpenses = (): number => {
    const exp = this.expenses()
    if (!exp) return 0
    return sumFields([
      exp.compensation,
      exp.legalFees,
      exp.accountingFees,
      exp.otherProfessionalFees,
      exp.interest,
      exp.taxes,
      exp.depreciation,
      exp.occupancy,
      exp.travel,
      exp.printing,
      exp.otherExpenses
    ])
  }

  excessRevenueOverExpenses = (): number =>
    this.totalRevenue() - this.totalExpenses()

  // Part II: Balance Sheet
  totalAssets = (): number => this.f990PFInfo()?.assetsEnding ?? 0
  totalLiabilities = (): number => this.f990PFInfo()?.liabilitiesEnding ?? 0
  netAssets = (): number => this.totalAssets() - this.totalLiabilities()

  // Part IX: Charitable Distributions
  distributions = (): CharitableDistributions | undefined =>
    this.f990PFInfo()?.distributions

  totalCharitableDistributions = (): number => {
    const dist = this.distributions()
    if (!dist) return 0
    return sumFields([
      dist.domesticOrganizations,
      dist.domesticIndividuals,
      dist.foreignOrganizations,
      dist.foreignIndividuals,
      dist.programRelatedInvestments,
      dist.amountSetAsideForCharity
    ])
  }

  // Part X: Minimum Investment Return (5% test)
  averageAssets = (): number => this.f990PFInfo()?.averageMonthlyFMV ?? 0

  minimumInvestmentReturn = (): number => {
    return Math.round(this.averageAssets() * 0.05)
  }

  // Part XI: Distributable Amount
  distributableAmount = (): number => {
    const minReturn = this.minimumInvestmentReturn()
    const exciseTax = this.exciseTax()
    return Math.max(0, minReturn - exciseTax)
  }

  // Part XII: Qualifying Distributions
  qualifyingDistributions = (): number => this.totalCharitableDistributions()

  meetsDistributionRequirement = (): boolean => {
    return this.qualifyingDistributions() >= this.distributableAmount()
  }

  // Excise Tax on Investment Income
  netInvestmentIncome = (): number =>
    this.f990PFInfo()?.netInvestmentIncome ?? 0

  exciseTaxRate = (): number =>
    this.f990PFInfo()?.exciseTaxRate ?? STANDARD_EXCISE_RATE

  exciseTax = (): number => {
    return Math.round(this.netInvestmentIncome() * this.exciseTaxRate())
  }

  fields = (): Field[] => {
    const info = this.f990PFInfo()
    const found = this.foundation()
    const rev = this.revenue()
    const exp = this.expenses()
    const dist = this.distributions()

    return [
      // Foundation Info
      this.foundationName(),
      this.ein(),
      found?.address ?? '',
      `${found?.city ?? ''}, ${found?.state ?? ''} ${found?.zip ?? ''}`,
      found?.website ?? '',
      this.foundationType(),
      this.isOperating(),
      found?.yearOfFormation ?? 0,
      // Dates
      info?.fiscalYearStart.toLocaleDateString() ?? '',
      info?.fiscalYearEnd.toLocaleDateString() ?? '',
      info?.isFinalReturn ?? false,
      info?.isAmendedReturn ?? false,
      // Part I: Revenue
      rev?.contributions ?? 0,
      rev?.interestOnSavings ?? 0,
      rev?.dividends ?? 0,
      rev?.netRentalIncome ?? 0,
      rev?.capitalGainNetIncome ?? 0,
      rev?.otherIncome ?? 0,
      this.totalRevenue(),
      // Part I: Expenses
      exp?.compensation ?? 0,
      exp?.legalFees ?? 0,
      exp?.accountingFees ?? 0,
      exp?.taxes ?? 0,
      exp?.depreciation ?? 0,
      exp?.occupancy ?? 0,
      exp?.otherExpenses ?? 0,
      this.totalExpenses(),
      this.excessRevenueOverExpenses(),
      // Part II: Balance Sheet
      info?.assetsBeginning ?? 0,
      this.totalAssets(),
      info?.liabilitiesBeginning ?? 0,
      this.totalLiabilities(),
      this.netAssets(),
      // Part IX: Distributions
      dist?.domesticOrganizations ?? 0,
      dist?.domesticIndividuals ?? 0,
      dist?.foreignOrganizations ?? 0,
      dist?.programRelatedInvestments ?? 0,
      this.totalCharitableDistributions(),
      // Part X: Minimum Investment Return
      this.averageAssets(),
      this.minimumInvestmentReturn(),
      // Part XI: Distributable Amount
      this.distributableAmount(),
      // Part XII: Qualifying Distributions
      this.qualifyingDistributions(),
      this.meetsDistributionRequirement(),
      // Excise Tax
      this.netInvestmentIncome(),
      this.exciseTaxRate(),
      this.exciseTax()
    ]
  }
}
