import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule N (Form 990) - Liquidation, Termination, Dissolution, or Significant Disposition of Assets
 *
 * Reports significant changes to the organization:
 * - Liquidation
 * - Termination
 * - Dissolution
 * - Significant disposition of net assets
 *
 * Required when organization undergoes significant changes or dispositions.
 */

export interface AssetDisposition {
  descriptionOfAssets: string
  dateOfDistribution: Date
  fairMarketValue: number
  methodOfDeterminingFMV: string
  einOfRecipient: string
  nameOfRecipient: string
  addressOfRecipient: string
  ircStatusOfRecipient: string
}

export interface Schedule990NData {
  // Part I: Liquidation, termination, dissolution
  isLiquidating: boolean
  isTerminating: boolean
  isDissolving: boolean
  liquidationDate?: Date
  // Part II: Sale, exchange, disposition of assets
  hadSignificantDisposition: boolean
  dispositionPercent: number
  assetDispositions: AssetDisposition[]
  // Part III: Procedures
  distributedToExemptOrg: boolean
  distributedToNonexemptOrg: boolean
  usedAssetValuationMethod: boolean
  valuationMethodDescription: string
  boardApprovedTransaction: boolean
  // Part IV: Use of assets
  assetsUsedForExemptPurpose: boolean
  stateFilingsMade: boolean
  stateFilingsList: string
}

export default class Schedule990N extends F1040Attachment {
  tag: FormTag = 'f990sn'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasLiquidationData()
  }

  hasLiquidationData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990NData = (): Schedule990NData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Part I: Status
  isLiquidating = (): boolean => this.schedule990NData()?.isLiquidating ?? false
  isTerminating = (): boolean => this.schedule990NData()?.isTerminating ?? false
  isDissolving = (): boolean => this.schedule990NData()?.isDissolving ?? false

  hasStatusChange = (): boolean => {
    return this.isLiquidating() || this.isTerminating() || this.isDissolving()
  }

  // Part II: Asset dispositions
  hadSignificantDisposition = (): boolean => {
    return this.schedule990NData()?.hadSignificantDisposition ?? false
  }

  assetDispositions = (): AssetDisposition[] => {
    return this.schedule990NData()?.assetDispositions ?? []
  }

  totalAssetsDisposed = (): number => {
    return this.assetDispositions().reduce(
      (sum, d) => sum + d.fairMarketValue,
      0
    )
  }

  dispositionPercent = (): number => {
    return this.schedule990NData()?.dispositionPercent ?? 0
  }

  // Part III: Recipients
  numberOfRecipients = (): number => {
    return this.assetDispositions().length
  }

  distributedToExemptOrg = (): boolean => {
    return this.schedule990NData()?.distributedToExemptOrg ?? false
  }

  distributedToNonexemptOrg = (): boolean => {
    return this.schedule990NData()?.distributedToNonexemptOrg ?? false
  }

  // Part IV: Compliance
  boardApprovedTransaction = (): boolean => {
    return this.schedule990NData()?.boardApprovedTransaction ?? false
  }

  stateFilingsMade = (): boolean => {
    return this.schedule990NData()?.stateFilingsMade ?? false
  }

  fields = (): Field[] => {
    const data = this.schedule990NData()
    const dispositions = this.assetDispositions()

    return [
      // Part I: Status
      this.isLiquidating(),
      this.isTerminating(),
      this.isDissolving(),
      this.hasStatusChange(),
      data?.liquidationDate?.toLocaleDateString() ?? '',
      // Part II: Dispositions
      this.hadSignificantDisposition(),
      this.dispositionPercent(),
      // First disposition
      dispositions[0]?.descriptionOfAssets ?? '',
      dispositions[0]?.dateOfDistribution?.toLocaleDateString() ?? '',
      dispositions[0]?.fairMarketValue ?? 0,
      dispositions[0]?.methodOfDeterminingFMV ?? '',
      dispositions[0]?.nameOfRecipient ?? '',
      dispositions[0]?.einOfRecipient ?? '',
      dispositions[0]?.addressOfRecipient ?? '',
      dispositions[0]?.ircStatusOfRecipient ?? '',
      // Second disposition
      dispositions[1]?.descriptionOfAssets ?? '',
      dispositions[1]?.fairMarketValue ?? 0,
      dispositions[1]?.nameOfRecipient ?? '',
      // Third disposition
      dispositions[2]?.descriptionOfAssets ?? '',
      dispositions[2]?.fairMarketValue ?? 0,
      // Totals
      this.numberOfRecipients(),
      this.totalAssetsDisposed(),
      // Part III: Procedures
      this.distributedToExemptOrg(),
      this.distributedToNonexemptOrg(),
      data?.usedAssetValuationMethod ?? false,
      data?.valuationMethodDescription ?? '',
      this.boardApprovedTransaction(),
      // Part IV: State filings
      data?.assetsUsedForExemptPurpose ?? false,
      this.stateFilingsMade(),
      data?.stateFilingsList ?? ''
    ]
  }
}
