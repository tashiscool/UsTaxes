/* eslint-disable @typescript-eslint/no-unused-vars */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 3520 - Annual Return To Report Transactions With Foreign Trusts
 * and Receipt of Certain Foreign Gifts
 *
 * Required for U.S. persons who:
 * - Are treated as owner of any part of a foreign trust
 * - Received distributions from a foreign trust
 * - Received large gifts from foreign persons ($100,000+ threshold)
 * - Transferred property to a foreign trust
 *
 * Penalties:
 * - 35% of gross value for unreported transfers
 * - 35% of gross value for unreported owner status
 * - 5% per month (up to 25%) for late-filed gift reports
 *
 * Due Date: Same as income tax return (with extensions)
 */

export type TransferType = 'gratuitous' | 'sale' | 'exchange' | 'loan' | 'other'

export interface ForeignTrustInfo {
  trustName: string
  trustEIN?: string
  trustAddress: string
  trustCountry: string
  dateCreated: Date
  trusteeNames: string[]
  trusteeCountry: string
  isGrantorTrust: boolean
  hasUSBeneficiaries: boolean
}

export interface TrustTransfer {
  transferDate: Date
  transferType: TransferType
  description: string
  fairMarketValue: number
  basisInProperty: number
  isGratuitous: boolean
  wasRecognizedGain: boolean
  gainAmount: number
}

export interface TrustDistribution {
  distributionDate: Date
  description: string
  amount: number
  isAccumulationDistribution: boolean
  throwbackYears?: number[]
  throwbackTax?: number
}

export interface ForeignGift {
  donorName: string
  donorAddress: string
  donorCountry: string
  donorRelationship: string
  giftDate: Date
  giftDescription: string
  giftValue: number
  isFromForeignEstate: boolean
  isFromForeignCorporation: boolean
  isFromForeignPartnership: boolean
}

export interface Form3520Info {
  // Filer Information
  filerName: string
  filerTIN: string
  filerAddress: string
  taxYear: number
  isAmended: boolean
  // Part I: Transfers to Foreign Trusts
  foreignTrusts: ForeignTrustInfo[]
  transfers: TrustTransfer[]
  // Part II: U.S. Owner of Foreign Trust
  isUSOwner: boolean
  ownershipPercentage: number
  // Part III: Distributions from Foreign Trusts
  distributions: TrustDistribution[]
  // Part IV: Foreign Gifts
  foreignGifts: ForeignGift[]
}

// Thresholds
const FOREIGN_GIFT_THRESHOLD = 100000
const FOREIGN_INHERITANCE_THRESHOLD = 100000

export default class F3520 extends F1040Attachment {
  tag: FormTag = 'f3520'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm3520Info() && this.meetsReportingThreshold()
  }

  hasForm3520Info = (): boolean => {
    return this.f3520Info() !== undefined
  }

  f3520Info = (): Form3520Info | undefined => {
    return this.f1040.info.foreignTrustReport as Form3520Info | undefined
  }

  meetsReportingThreshold = (): boolean => {
    const info = this.f3520Info()
    if (!info) return false
    // Report if any transfers, distributions, or gifts over threshold
    return (
      info.transfers.length > 0 ||
      info.distributions.length > 0 ||
      info.isUSOwner ||
      this.totalForeignGifts() >= FOREIGN_GIFT_THRESHOLD
    )
  }

  // Part I: Transfers to Foreign Trusts

  foreignTrusts = (): ForeignTrustInfo[] =>
    this.f3520Info()?.foreignTrusts ?? []
  numberOfTrusts = (): number => this.foreignTrusts().length

  transfers = (): TrustTransfer[] => this.f3520Info()?.transfers ?? []
  numberOfTransfers = (): number => this.transfers().length

  totalTransferValue = (): number => {
    return this.transfers().reduce((sum, t) => sum + t.fairMarketValue, 0)
  }

  gratuitousTransfers = (): TrustTransfer[] => {
    return this.transfers().filter((t) => t.isGratuitous)
  }

  totalGratuitousValue = (): number => {
    return this.gratuitousTransfers().reduce(
      (sum, t) => sum + t.fairMarketValue,
      0
    )
  }

  // Part II: U.S. Owner Information

  isUSOwner = (): boolean => this.f3520Info()?.isUSOwner ?? false
  ownershipPercentage = (): number => this.f3520Info()?.ownershipPercentage ?? 0

  // Part III: Distributions

  distributions = (): TrustDistribution[] =>
    this.f3520Info()?.distributions ?? []
  numberOfDistributions = (): number => this.distributions().length

  totalDistributions = (): number => {
    return this.distributions().reduce((sum, d) => sum + d.amount, 0)
  }

  accumulationDistributions = (): TrustDistribution[] => {
    return this.distributions().filter((d) => d.isAccumulationDistribution)
  }

  totalAccumulationDistributions = (): number => {
    return this.accumulationDistributions().reduce(
      (sum, d) => sum + d.amount,
      0
    )
  }

  totalThrowbackTax = (): number => {
    return this.accumulationDistributions().reduce(
      (sum, d) => sum + (d.throwbackTax ?? 0),
      0
    )
  }

  // Part IV: Foreign Gifts

  foreignGifts = (): ForeignGift[] => this.f3520Info()?.foreignGifts ?? []
  numberOfGifts = (): number => this.foreignGifts().length

  totalForeignGifts = (): number => {
    return this.foreignGifts().reduce((sum, g) => sum + g.giftValue, 0)
  }

  giftsFromIndividuals = (): ForeignGift[] => {
    return this.foreignGifts().filter(
      (g) =>
        !g.isFromForeignCorporation &&
        !g.isFromForeignPartnership &&
        !g.isFromForeignEstate
    )
  }

  giftsFromEstates = (): ForeignGift[] => {
    return this.foreignGifts().filter((g) => g.isFromForeignEstate)
  }

  giftsFromEntities = (): ForeignGift[] => {
    return this.foreignGifts().filter(
      (g) => g.isFromForeignCorporation || g.isFromForeignPartnership
    )
  }

  // Countries involved
  countriesWithTrusts = (): string[] => {
    const countries = new Set<string>(
      this.foreignTrusts().map((t) => t.trustCountry)
    )
    return Array.from(countries)
  }

  countriesWithGifts = (): string[] => {
    const countries = new Set<string>(
      this.foreignGifts().map((g) => g.donorCountry)
    )
    return Array.from(countries)
  }

  fields = (): Field[] => {
    const info = this.f3520Info()
    const trusts = this.foreignTrusts()
    const transfers = this.transfers()
    const distributions = this.distributions()
    const gifts = this.foreignGifts()

    return [
      // Header
      info?.filerName ?? '',
      info?.filerTIN ?? '',
      info?.filerAddress ?? '',
      info?.taxYear ?? 2025,
      info?.isAmended ?? false,
      // Part I: Transfers
      this.numberOfTrusts(),
      this.numberOfTransfers(),
      this.totalTransferValue(),
      this.totalGratuitousValue(),
      // First trust
      trusts[0]?.trustName ?? '',
      trusts[0]?.trustCountry ?? '',
      trusts[0]?.isGrantorTrust ?? false,
      // First transfer
      transfers[0]?.transferDate?.toLocaleDateString() ?? '',
      transfers[0]?.description ?? '',
      transfers[0]?.fairMarketValue ?? 0,
      transfers[0]?.transferType ?? '',
      // Part II: Owner
      this.isUSOwner(),
      this.ownershipPercentage(),
      // Part III: Distributions
      this.numberOfDistributions(),
      this.totalDistributions(),
      this.totalAccumulationDistributions(),
      this.totalThrowbackTax(),
      // First distribution
      distributions[0]?.distributionDate?.toLocaleDateString() ?? '',
      distributions[0]?.amount ?? 0,
      distributions[0]?.isAccumulationDistribution ?? false,
      // Part IV: Foreign Gifts
      this.numberOfGifts(),
      this.totalForeignGifts(),
      this.giftsFromIndividuals().length,
      this.giftsFromEstates().length,
      this.giftsFromEntities().length,
      // First gift
      gifts[0]?.donorName ?? '',
      gifts[0]?.donorCountry ?? '',
      gifts[0]?.giftValue ?? 0,
      gifts[0]?.giftDescription ?? '',
      // Countries
      this.countriesWithTrusts().join(', '),
      this.countriesWithGifts().join(', ')
    ]
  }
}
