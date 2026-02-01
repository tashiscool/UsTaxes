/* eslint-disable @typescript-eslint/no-unused-vars */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 4720 - Return of Certain Excise Taxes Under Chapters 41 and 42
 *
 * Used by private foundations and certain other organizations to report
 * and pay excise taxes on:
 * - Self-dealing transactions
 * - Failure to distribute income
 * - Excess business holdings
 * - Jeopardizing investments
 * - Taxable expenditures
 * - Political expenditures
 * - Excess lobbying expenditures
 *
 * Also used by organization managers and disqualified persons who
 * participated in prohibited transactions.
 */

export interface SelfDealingTransaction {
  description: string
  dateOfTransaction: Date
  amountInvolved: number
  correctionMade: boolean
  correctionDate?: Date
  selfDealerName: string
  selfDealerRelationship: string
}

export interface ExcessBusinessHolding {
  businessName: string
  formOfBusiness: 'corp' | 'partnership' | 'proprietorship' | 'other'
  percentOwned: number
  excessPercent: number
  fmvOfExcessHoldings: number
}

export interface JeopardizingInvestment {
  description: string
  dateOfInvestment: Date
  amount: number
  correctionMade: boolean
}

export interface TaxableExpenditure {
  expenditureType:
    | 'lobbying'
    | 'electioneering'
    | 'grants'
    | 'noncharitable'
    | 'other'
  description: string
  amount: number
  payeeName: string
}

export interface F4720Data {
  // Organization information
  organizationName: string
  ein: string
  taxYear: number
  isPrivateFoundation: boolean
  // Part I: Self-dealing
  selfDealingTransactions: SelfDealingTransaction[]
  // Part II: Failure to distribute income
  undistributedIncome: number
  minimumDistributionRequired: number
  actualDistributions: number
  // Part III: Excess business holdings
  excessBusinessHoldings: ExcessBusinessHolding[]
  // Part IV: Jeopardizing investments
  jeopardizingInvestments: JeopardizingInvestment[]
  // Part V: Taxable expenditures
  taxableExpenditures: TaxableExpenditure[]
  // Part VI: Political expenditures (501(c)(3))
  politicalExpenditures: number
  // Part VII: Excess lobbying (501(h) election)
  excessLobbyingExpenditures: number
}

// Excise tax rates
const SELF_DEALING_TAX_RATE_FOUNDATION = 0.1 // 10% initial tax on foundation
const SELF_DEALING_TAX_RATE_MANAGER = 0.05 // 5% on manager if knowing participation
const UNDISTRIBUTED_INCOME_TAX_RATE = 0.3 // 30% initial tax
const EXCESS_HOLDINGS_TAX_RATE = 0.1 // 10% initial tax
const JEOPARDIZING_TAX_RATE = 0.1 // 10% initial tax
const TAXABLE_EXPENDITURE_TAX_RATE = 0.2 // 20% initial tax
const POLITICAL_EXPENDITURE_TAX_RATE = 0.1 // 10% initial tax
const EXCESS_LOBBYING_TAX_RATE = 0.25 // 25% tax

export default class F4720 extends F1040Attachment {
  tag: FormTag = 'f4720'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasExciseTaxData()
  }

  hasExciseTaxData = (): boolean => {
    const privateFoundation = this.f1040.info.privateFoundationReturn
    return privateFoundation !== undefined
  }

  f4720Data = (): F4720Data | undefined => {
    return undefined // Would be populated from foundation data
  }

  // Part I: Self-dealing tax
  selfDealingTransactions = (): SelfDealingTransaction[] => {
    return this.f4720Data()?.selfDealingTransactions ?? []
  }

  totalSelfDealingAmounts = (): number => {
    return this.selfDealingTransactions().reduce(
      (sum, t) => sum + t.amountInvolved,
      0
    )
  }

  selfDealingTaxOnFoundation = (): number => {
    return Math.round(
      this.totalSelfDealingAmounts() * SELF_DEALING_TAX_RATE_FOUNDATION
    )
  }

  // Part II: Undistributed income tax
  undistributedIncome = (): number => {
    const data = this.f4720Data()
    if (!data) return 0
    const shortfall =
      data.minimumDistributionRequired - data.actualDistributions
    return Math.max(0, shortfall)
  }

  undistributedIncomeTax = (): number => {
    return Math.round(
      this.undistributedIncome() * UNDISTRIBUTED_INCOME_TAX_RATE
    )
  }

  // Part III: Excess business holdings tax
  excessBusinessHoldings = (): ExcessBusinessHolding[] => {
    return this.f4720Data()?.excessBusinessHoldings ?? []
  }

  totalExcessHoldingsValue = (): number => {
    return this.excessBusinessHoldings().reduce(
      (sum, h) => sum + h.fmvOfExcessHoldings,
      0
    )
  }

  excessHoldingsTax = (): number => {
    return Math.round(
      this.totalExcessHoldingsValue() * EXCESS_HOLDINGS_TAX_RATE
    )
  }

  // Part IV: Jeopardizing investments tax
  jeopardizingInvestments = (): JeopardizingInvestment[] => {
    return this.f4720Data()?.jeopardizingInvestments ?? []
  }

  totalJeopardizingAmount = (): number => {
    return this.jeopardizingInvestments().reduce((sum, i) => sum + i.amount, 0)
  }

  jeopardizingInvestmentsTax = (): number => {
    return Math.round(this.totalJeopardizingAmount() * JEOPARDIZING_TAX_RATE)
  }

  // Part V: Taxable expenditures tax
  taxableExpenditures = (): TaxableExpenditure[] => {
    return this.f4720Data()?.taxableExpenditures ?? []
  }

  totalTaxableExpenditures = (): number => {
    return this.taxableExpenditures().reduce((sum, e) => sum + e.amount, 0)
  }

  taxableExpendituresTax = (): number => {
    return Math.round(
      this.totalTaxableExpenditures() * TAXABLE_EXPENDITURE_TAX_RATE
    )
  }

  // Part VI: Political expenditures tax
  politicalExpenditures = (): number =>
    this.f4720Data()?.politicalExpenditures ?? 0

  politicalExpendituresTax = (): number => {
    return Math.round(
      this.politicalExpenditures() * POLITICAL_EXPENDITURE_TAX_RATE
    )
  }

  // Part VII: Excess lobbying tax
  excessLobbyingExpenditures = (): number =>
    this.f4720Data()?.excessLobbyingExpenditures ?? 0

  excessLobbyingTax = (): number => {
    return Math.round(
      this.excessLobbyingExpenditures() * EXCESS_LOBBYING_TAX_RATE
    )
  }

  // Total tax
  totalExciseTax = (): number => {
    return sumFields([
      this.selfDealingTaxOnFoundation(),
      this.undistributedIncomeTax(),
      this.excessHoldingsTax(),
      this.jeopardizingInvestmentsTax(),
      this.taxableExpendituresTax(),
      this.politicalExpendituresTax(),
      this.excessLobbyingTax()
    ])
  }

  fields = (): Field[] => {
    const data = this.f4720Data()
    const selfDealing = this.selfDealingTransactions()
    const holdings = this.excessBusinessHoldings()
    const investments = this.jeopardizingInvestments()
    const expenditures = this.taxableExpenditures()

    return [
      // Header
      data?.organizationName ?? '',
      data?.ein ?? '',
      data?.taxYear ?? 0,
      data?.isPrivateFoundation ?? false,
      // Part I: Self-dealing
      selfDealing[0]?.description ?? '',
      selfDealing[0]?.amountInvolved ?? 0,
      selfDealing[0]?.selfDealerName ?? '',
      selfDealing[0]?.correctionMade ?? false,
      this.totalSelfDealingAmounts(),
      this.selfDealingTaxOnFoundation(),
      // Part II: Undistributed income
      data?.minimumDistributionRequired ?? 0,
      data?.actualDistributions ?? 0,
      this.undistributedIncome(),
      this.undistributedIncomeTax(),
      // Part III: Excess business holdings
      holdings[0]?.businessName ?? '',
      holdings[0]?.percentOwned ?? 0,
      holdings[0]?.excessPercent ?? 0,
      holdings[0]?.fmvOfExcessHoldings ?? 0,
      this.totalExcessHoldingsValue(),
      this.excessHoldingsTax(),
      // Part IV: Jeopardizing investments
      investments[0]?.description ?? '',
      investments[0]?.amount ?? 0,
      investments[0]?.correctionMade ?? false,
      this.totalJeopardizingAmount(),
      this.jeopardizingInvestmentsTax(),
      // Part V: Taxable expenditures
      expenditures[0]?.description ?? '',
      expenditures[0]?.amount ?? 0,
      expenditures[0]?.payeeName ?? '',
      this.totalTaxableExpenditures(),
      this.taxableExpendituresTax(),
      // Part VI: Political expenditures
      this.politicalExpenditures(),
      this.politicalExpendituresTax(),
      // Part VII: Excess lobbying
      this.excessLobbyingExpenditures(),
      this.excessLobbyingTax(),
      // Total
      this.totalExciseTax()
    ]
  }
}
