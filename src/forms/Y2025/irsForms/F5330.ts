import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 5330 - Return of Excise Taxes Related to Employee Benefit Plans
 *
 * Used to report and pay excise taxes on:
 *
 * Part I: Tax on Excess Contributions to Cash or Deferred Arrangements (401k)
 * Part II: Tax on Excess Aggregate Contributions
 * Part III: Tax on Excess Contributions to Traditional IRAs (10%)
 * Part IV: Tax on Prohibited Transactions (15%/100%)
 * Part V: Tax on Minimum Funding Deficiency (5%/100%)
 * Part VI: Tax on Reversion of Qualified Plan Assets (20%/50%)
 * Part VII: Tax on Nondeductible Employer Contributions (10%)
 * Part VIII: Tax on Failure to Provide Required Notices (100/day)
 * Part IX: Tax on Disqualified Benefits for Plans with Significant Underfunding
 * Part X: Tax on Accumulation Distribution of Charitable Remainder Trust
 * Part XI: Tax on Prohibited Tax Shelter Transactions (100%/200%)
 *
 * Due date: Generally last day of 7th month after end of tax year
 * Can request extension
 */

export interface ExcessContribution401k {
  taxYear: number
  excessAmount: number
  correctedByDeadline: boolean
  taxRate: number  // 10%
  exciseTax: number
}

export interface ProhibitedTransaction {
  description: string
  dateOfTransaction: Date
  amountInvolved: number
  disqualifiedPerson: string
  wasTransactionCorrected: boolean
  correctionDate?: Date
  initialTaxRate: number  // 15%
  additionalTaxRate: number  // 100% if not corrected
  exciseTax: number
}

export interface MinimumFundingDeficiency {
  planName: string
  planNumber: string
  taxYear: number
  deficiencyAmount: number
  wasCorrected: boolean
  correctionDate?: Date
  initialTaxRate: number  // 5%
  additionalTaxRate: number  // 100% if not corrected
  exciseTax: number
}

export interface PlanAssetReversion {
  planName: string
  reversionDate: Date
  reversionAmount: number
  transferredToReplacement: boolean
  usedForHealthBenefits: boolean
  taxRate: number  // 20% or 50%
  exciseTax: number
}

export interface NondeductibleContribution {
  taxYear: number
  totalContributions: number
  deductibleLimit: number
  excessAmount: number
  taxRate: number  // 10%
  exciseTax: number
}

export interface Form5330Info {
  // Plan identification
  planName: string
  planNumber: string
  planSponsorName: string
  planSponsorEin: string
  // Excise taxes by category
  excessContributions401k?: ExcessContribution401k[]
  prohibitedTransactions?: ProhibitedTransaction[]
  minimumFundingDeficiencies?: MinimumFundingDeficiency[]
  planAssetReversions?: PlanAssetReversion[]
  nondeductibleContributions?: NondeductibleContribution[]
  // Summary
  totalTaxDue: number
  // Amendment/Final
  isAmendedReturn: boolean
  isFinalReturn: boolean
}

export default class F5330 extends F1040Attachment {
  tag: FormTag = 'f5330'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF5330Info()
  }

  hasF5330Info = (): boolean => {
    return this.f5330Info() !== undefined
  }

  f5330Info = (): Form5330Info | undefined => {
    return this.f1040.info.retirementPlanExciseTaxes as Form5330Info | undefined
  }

  // Plan Identification
  planName = (): string => this.f5330Info()?.planName ?? ''
  planNumber = (): string => this.f5330Info()?.planNumber ?? '001'
  planSponsorName = (): string => this.f5330Info()?.planSponsorName ?? ''
  planSponsorEin = (): string => this.f5330Info()?.planSponsorEin ?? ''

  // Part I: Excess 401(k) Contributions
  excessContributions401k = (): ExcessContribution401k[] => {
    return this.f5330Info()?.excessContributions401k ?? []
  }

  totalExcess401kTax = (): number => {
    return this.excessContributions401k().reduce((sum, e) => sum + e.exciseTax, 0)
  }

  hasExcessContributions401k = (): boolean => this.excessContributions401k().length > 0

  // Part IV: Prohibited Transactions
  prohibitedTransactions = (): ProhibitedTransaction[] => {
    return this.f5330Info()?.prohibitedTransactions ?? []
  }

  totalProhibitedTransactionTax = (): number => {
    return this.prohibitedTransactions().reduce((sum, t) => sum + t.exciseTax, 0)
  }

  hasProhibitedTransactions = (): boolean => this.prohibitedTransactions().length > 0

  // Part V: Minimum Funding Deficiency
  minimumFundingDeficiencies = (): MinimumFundingDeficiency[] => {
    return this.f5330Info()?.minimumFundingDeficiencies ?? []
  }

  totalMinimumFundingTax = (): number => {
    return this.minimumFundingDeficiencies().reduce((sum, d) => sum + d.exciseTax, 0)
  }

  hasMinimumFundingDeficiency = (): boolean => this.minimumFundingDeficiencies().length > 0

  // Part VI: Plan Asset Reversions
  planAssetReversions = (): PlanAssetReversion[] => {
    return this.f5330Info()?.planAssetReversions ?? []
  }

  totalReversionTax = (): number => {
    return this.planAssetReversions().reduce((sum, r) => sum + r.exciseTax, 0)
  }

  hasAssetReversions = (): boolean => this.planAssetReversions().length > 0

  // Part VII: Nondeductible Contributions
  nondeductibleContributions = (): NondeductibleContribution[] => {
    return this.f5330Info()?.nondeductibleContributions ?? []
  }

  totalNondeductibleContributionTax = (): number => {
    return this.nondeductibleContributions().reduce((sum, c) => sum + c.exciseTax, 0)
  }

  hasNondeductibleContributions = (): boolean => this.nondeductibleContributions().length > 0

  // Total Tax Calculation
  totalExciseTax = (): number => {
    return this.f5330Info()?.totalTaxDue ?? sumFields([
      this.totalExcess401kTax(),
      this.totalProhibitedTransactionTax(),
      this.totalMinimumFundingTax(),
      this.totalReversionTax(),
      this.totalNondeductibleContributionTax()
    ])
  }

  // Return Status
  isAmendedReturn = (): boolean => this.f5330Info()?.isAmendedReturn ?? false
  isFinalReturn = (): boolean => this.f5330Info()?.isFinalReturn ?? false

  fields = (): Field[] => {
    const excess401k = this.excessContributions401k()
    const prohibited = this.prohibitedTransactions()
    const funding = this.minimumFundingDeficiencies()
    const reversions = this.planAssetReversions()
    const nonded = this.nondeductibleContributions()

    return [
      // Plan Identification
      this.planName(),
      this.planNumber(),
      this.planSponsorName(),
      this.planSponsorEin(),
      this.isAmendedReturn(),
      this.isFinalReturn(),
      // Part I: Excess 401(k) Contributions
      this.hasExcessContributions401k(),
      excess401k[0]?.excessAmount ?? 0,
      excess401k[0]?.exciseTax ?? 0,
      this.totalExcess401kTax(),
      // Part IV: Prohibited Transactions
      this.hasProhibitedTransactions(),
      prohibited[0]?.description ?? '',
      prohibited[0]?.amountInvolved ?? 0,
      prohibited[0]?.wasTransactionCorrected ?? false,
      prohibited[0]?.exciseTax ?? 0,
      this.totalProhibitedTransactionTax(),
      // Part V: Minimum Funding Deficiency
      this.hasMinimumFundingDeficiency(),
      funding[0]?.deficiencyAmount ?? 0,
      funding[0]?.wasCorrected ?? false,
      funding[0]?.exciseTax ?? 0,
      this.totalMinimumFundingTax(),
      // Part VI: Asset Reversions
      this.hasAssetReversions(),
      reversions[0]?.reversionAmount ?? 0,
      reversions[0]?.taxRate ?? 0,
      reversions[0]?.exciseTax ?? 0,
      this.totalReversionTax(),
      // Part VII: Nondeductible Contributions
      this.hasNondeductibleContributions(),
      nonded[0]?.excessAmount ?? 0,
      nonded[0]?.exciseTax ?? 0,
      this.totalNondeductibleContributionTax(),
      // Total
      this.totalExciseTax()
    ]
  }
}
