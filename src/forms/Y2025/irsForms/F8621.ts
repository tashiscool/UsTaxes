import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8621 - Information Return by a Shareholder of a Passive Foreign Investment Company
 * or Qualified Electing Fund
 *
 * Required for U.S. persons who:
 * - Are shareholders of a Passive Foreign Investment Company (PFIC)
 * - Have made or are making certain elections (QEF, Mark-to-Market)
 * - Receive excess distributions from a PFIC
 * - Dispose of PFIC stock
 *
 * PFIC Definition:
 * A foreign corporation is a PFIC if:
 * - 75% or more of gross income is passive income, OR
 * - 50% or more of assets produce passive income
 *
 * Tax Treatment Options:
 * 1. Default (Section 1291): Excess distribution rules with interest charges
 * 2. QEF Election: Current taxation of pro rata share
 * 3. Mark-to-Market: Annual gain/loss recognition
 *
 * Due Date: Attached to income tax return
 */

export type ElectionType =
  | 'section1291'
  | 'qef'
  | 'markToMarket'
  | 'protectiveStatement'

export interface PFICInfo {
  companyName: string
  ein?: string
  address: string
  country: string
  referenceIDNumber: string
  taxYear: number
  sharesOwned: number
  shareClass: string
  dateAcquired: Date
  initialBasis: number
  currentFMV: number
  isControlledForeignCorp: boolean
}

export interface ExcessDistribution {
  totalDistribution: number
  currentYearPortion: number
  excessDistribution: number
  holdingPeriodYears: number
  allocatedAmounts: { year: number; amount: number }[]
  deferredTax: number
  interestCharge: number
}

export interface QEFIncome {
  ordinaryEarnings: number
  netCapitalGain: number
  proRataShareOrdinary: number
  proRataShareCapital: number
  previouslyIncludedAmounts: number
}

export interface MarkToMarketInfo {
  beginningFMV: number
  endingFMV: number
  unrealizedGain: number
  unrealizedLoss: number
  ordinaryGain: number
  ordinaryLoss: number
  priorUnreversedInclusions: number
}

export interface Form8621Info {
  // Shareholder Information
  shareholderName: string
  shareholderTIN: string
  shareholderAddress: string
  taxYear: number
  // PFIC Information
  pfic: PFICInfo
  // Election Type
  electionType: ElectionType
  isFirstYearElection: boolean
  electionDate?: Date
  // For Section 1291 (Excess Distribution)
  excessDistribution?: ExcessDistribution
  // For QEF Election
  qefIncome?: QEFIncome
  // For Mark-to-Market
  markToMarket?: MarkToMarketInfo
  // Disposition
  hadDisposition: boolean
  dispositionDate?: Date
  dispositionProceeds?: number
  dispositionGain?: number
}

export default class F8621 extends F1040Attachment {
  tag: FormTag = 'f8621'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm8621Info()
  }

  hasForm8621Info = (): boolean => {
    return this.f8621Info() !== undefined
  }

  f8621Info = (): Form8621Info | undefined => {
    return this.f1040.info.pficReport as Form8621Info | undefined
  }

  // PFIC Information
  pficInfo = (): PFICInfo | undefined => this.f8621Info()?.pfic
  pficName = (): string => this.pficInfo()?.companyName ?? ''
  pficCountry = (): string => this.pficInfo()?.country ?? ''
  sharesOwned = (): number => this.pficInfo()?.sharesOwned ?? 0
  currentFMV = (): number => this.pficInfo()?.currentFMV ?? 0

  // Election Type
  electionType = (): ElectionType =>
    this.f8621Info()?.electionType ?? 'section1291'
  isQEFElection = (): boolean => this.electionType() === 'qef'
  isMarkToMarket = (): boolean => this.electionType() === 'markToMarket'
  isSection1291 = (): boolean => this.electionType() === 'section1291'

  // Section 1291 - Excess Distribution
  excessDistribution = (): ExcessDistribution | undefined =>
    this.f8621Info()?.excessDistribution

  totalExcessDistribution = (): number =>
    this.excessDistribution()?.excessDistribution ?? 0
  deferredTax = (): number => this.excessDistribution()?.deferredTax ?? 0
  interestCharge = (): number => this.excessDistribution()?.interestCharge ?? 0
  totalSection1291Tax = (): number => this.deferredTax() + this.interestCharge()

  // QEF Election
  qefIncome = (): QEFIncome | undefined => this.f8621Info()?.qefIncome

  qefOrdinaryIncome = (): number => this.qefIncome()?.proRataShareOrdinary ?? 0
  qefCapitalGain = (): number => this.qefIncome()?.proRataShareCapital ?? 0
  totalQEFIncome = (): number =>
    this.qefOrdinaryIncome() + this.qefCapitalGain()

  // Mark-to-Market
  markToMarketInfo = (): MarkToMarketInfo | undefined =>
    this.f8621Info()?.markToMarket

  mtmUnrealizedGain = (): number => this.markToMarketInfo()?.unrealizedGain ?? 0
  mtmUnrealizedLoss = (): number => this.markToMarketInfo()?.unrealizedLoss ?? 0
  mtmOrdinaryGain = (): number => this.markToMarketInfo()?.ordinaryGain ?? 0
  mtmOrdinaryLoss = (): number => this.markToMarketInfo()?.ordinaryLoss ?? 0

  // Disposition
  hadDisposition = (): boolean => this.f8621Info()?.hadDisposition ?? false
  dispositionProceeds = (): number => this.f8621Info()?.dispositionProceeds ?? 0
  dispositionGain = (): number => this.f8621Info()?.dispositionGain ?? 0

  // Total taxable amount based on election type
  totalTaxableAmount = (): number => {
    if (this.isQEFElection()) {
      return this.totalQEFIncome()
    } else if (this.isMarkToMarket()) {
      return this.mtmOrdinaryGain()
    } else {
      return this.totalExcessDistribution()
    }
  }

  fields = (): Field[] => {
    const info = this.f8621Info()
    const pfic = this.pficInfo()
    const excess = this.excessDistribution()
    const qef = this.qefIncome()
    const mtm = this.markToMarketInfo()

    return [
      // Shareholder Information
      info?.shareholderName ?? '',
      info?.shareholderTIN ?? '',
      info?.shareholderAddress ?? '',
      info?.taxYear ?? 2025,
      // PFIC Information
      this.pficName(),
      pfic?.ein ?? '',
      pfic?.address ?? '',
      this.pficCountry(),
      pfic?.referenceIDNumber ?? '',
      this.sharesOwned(),
      pfic?.shareClass ?? '',
      pfic?.dateAcquired.toLocaleDateString() ?? '',
      pfic?.initialBasis ?? 0,
      this.currentFMV(),
      pfic?.isControlledForeignCorp ?? false,
      // Election Type
      this.isSection1291(),
      this.isQEFElection(),
      this.isMarkToMarket(),
      info?.isFirstYearElection ?? false,
      // Section 1291 - Excess Distribution
      excess?.totalDistribution ?? 0,
      excess?.currentYearPortion ?? 0,
      this.totalExcessDistribution(),
      excess?.holdingPeriodYears ?? 0,
      this.deferredTax(),
      this.interestCharge(),
      this.totalSection1291Tax(),
      // QEF Election
      qef?.ordinaryEarnings ?? 0,
      qef?.netCapitalGain ?? 0,
      this.qefOrdinaryIncome(),
      this.qefCapitalGain(),
      this.totalQEFIncome(),
      qef?.previouslyIncludedAmounts ?? 0,
      // Mark-to-Market
      mtm?.beginningFMV ?? 0,
      mtm?.endingFMV ?? 0,
      this.mtmUnrealizedGain(),
      this.mtmUnrealizedLoss(),
      this.mtmOrdinaryGain(),
      this.mtmOrdinaryLoss(),
      mtm?.priorUnreversedInclusions ?? 0,
      // Disposition
      this.hadDisposition(),
      info?.dispositionDate?.toLocaleDateString() ?? '',
      this.dispositionProceeds(),
      this.dispositionGain(),
      // Summary
      this.totalTaxableAmount()
    ]
  }
}
