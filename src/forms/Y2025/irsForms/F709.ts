import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import {
  calculateGiftTax,
  getApplicableCredit,
  getGiftTaxParameters,
  calculateTaxableGifts,
  GiftSchedulePart
} from 'ustaxes/core/data/giftTax'
import type {
  GiftTaxReturn,
  GiftEntry as GiftEntryType,
  PriorPeriodGift as PriorPeriodGiftType,
  DSUESource,
  GiftTaxParameters
} from 'ustaxes/core/data/giftTax'

/**
 * Form 709 - United States Gift (and Generation-Skipping Transfer) Tax Return
 *
 * Filed by individuals who make gifts exceeding the annual exclusion amount
 * or who wish to split gifts with their spouse.
 *
 * 2025 Thresholds:
 * - Annual exclusion: $19,000 per donee ($38,000 for split gifts)
 * - Lifetime exclusion: $13,990,000 (unified with estate tax)
 * - Medical/educational exclusion: Unlimited (direct payments)
 *
 * Key Schedules:
 * - Schedule A: Computation of Taxable Gifts
 * - Schedule B: Gifts from Prior Periods
 * - Schedule C: DSUE Amount and Restored Exclusion
 * - Schedule D: Computation of GST Tax
 *
 * Due Date: April 15 following the year of the gift (extended with income tax)
 */

export interface GiftInfo {
  doneeInfo: {
    name: string
    relationship: string
    address: string
    ssn?: string
  }
  description: string
  dateOfGift: Date
  fairMarketValue: number
  donorsBasis: number
  isDirectSkip: boolean  // For GST purposes
  giftSplitWithSpouse: boolean
  annualExclusionApplied: number
}

export interface PriorPeriodGift {
  year: number
  totalGifts: number
  annualExclusionsUsed: number
  taxableGifts: number
  taxPaid: number
}

export interface Form709Info {
  // Donor Information
  donorName: string
  donorSSN: string
  donorAddress: string
  donorCitizenship: 'US' | 'resident' | 'nonresident'
  // Spouse Information (for gift splitting)
  spouseName?: string
  spouseSSN?: string
  consentToSplitGifts: boolean
  // Current Year Gifts
  gifts: GiftInfo[]
  // Prior Gifts
  priorPeriodGifts: PriorPeriodGift[]
  // GST
  hasDirectSkips: boolean
  gstExemptionAllocated?: number
  priorGSTExemptionUsed?: number
}

// 2025 Gift Tax Constants
const PARAMS_2025 = getGiftTaxParameters(2025)
const ANNUAL_EXCLUSION_2025 = PARAMS_2025.annualExclusion
const LIFETIME_EXCLUSION_2025 = PARAMS_2025.basicExclusionAmount
const TOP_GIFT_TAX_RATE = PARAMS_2025.maxTaxRate

export default class F709 extends F1040Attachment {
  tag: FormTag = 'f709'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasGiftInfo()
  }

  hasGiftInfo = (): boolean => {
    return this.f709Info() !== undefined
  }

  f709Info = (): Form709Info | undefined => {
    return this.f1040.info.giftTaxReturn as Form709Info | undefined
  }

  // Donor Information
  donorName = (): string => this.f709Info()?.donorName ?? ''
  donorSSN = (): string => this.f709Info()?.donorSSN ?? ''
  donorAddress = (): string => this.f709Info()?.donorAddress ?? ''

  // Spouse Information
  spouseName = (): string => this.f709Info()?.spouseName ?? ''
  spouseSSN = (): string => this.f709Info()?.spouseSSN ?? ''
  consentToSplitGifts = (): boolean => this.f709Info()?.consentToSplitGifts ?? false

  // Current Year Gifts
  gifts = (): GiftInfo[] => this.f709Info()?.gifts ?? []

  // Schedule A: Computation of Taxable Gifts

  // Part 1: Gifts subject to annual exclusion
  giftsSubjectToExclusion = (): GiftInfo[] => {
    return this.gifts().filter(g => g.annualExclusionApplied > 0)
  }

  // Total gifts before exclusions
  totalGiftsFMV = (): number => {
    return this.gifts().reduce((sum, g) => sum + g.fairMarketValue, 0)
  }

  // Total annual exclusions
  totalAnnualExclusions = (): number => {
    return this.gifts().reduce((sum, g) => sum + g.annualExclusionApplied, 0)
  }

  // Taxable gifts for current year
  currentYearTaxableGifts = (): number => {
    return Math.max(0, this.totalGiftsFMV() - this.totalAnnualExclusions())
  }

  // Schedule B: Gifts from Prior Periods
  priorPeriodGifts = (): PriorPeriodGift[] => this.f709Info()?.priorPeriodGifts ?? []

  totalPriorTaxableGifts = (): number => {
    return this.priorPeriodGifts().reduce((sum, g) => sum + g.taxableGifts, 0)
  }

  totalPriorTaxPaid = (): number => {
    return this.priorPeriodGifts().reduce((sum, g) => sum + g.taxPaid, 0)
  }

  // Total taxable gifts (current + prior)
  totalTaxableGifts = (): number => {
    return this.currentYearTaxableGifts() + this.totalPriorTaxableGifts()
  }

  // Tax Computation

  // Tentative tax on all gifts (uses graduated schedule from IRS §2001)
  tentativeTaxOnAllGifts = (): number => {
    const total = this.totalTaxableGifts()
    if (total <= 0) return 0
    return calculateGiftTax(total, 2025)
  }

  // Tax on prior gifts (recomputed at current rates)
  tentativeTaxOnPriorGifts = (): number => {
    const prior = this.totalPriorTaxableGifts()
    if (prior <= 0) return 0
    return calculateGiftTax(prior, 2025)
  }

  // Gift tax before credits
  giftTaxBeforeCredits = (): number => {
    return Math.max(0, this.tentativeTaxOnAllGifts() - this.tentativeTaxOnPriorGifts())
  }

  // Unified Credit
  lifetimeExclusion = (): number => LIFETIME_EXCLUSION_2025

  unifiedCreditUsed = (): number => {
    // Credit = tax that would be due on the exclusion amount used
    const exclusionUsed = Math.min(this.totalTaxableGifts(), this.lifetimeExclusion())
    return getApplicableCredit(exclusionUsed, 2025)
  }

  // Prior unified credit used
  priorUnifiedCreditUsed = (): number => {
    return this.totalPriorTaxPaid()
  }

  // Available unified credit
  availableUnifiedCredit = (): number => {
    const totalCredit = getApplicableCredit(this.lifetimeExclusion(), 2025)
    return Math.max(0, totalCredit - this.priorUnifiedCreditUsed())
  }

  // Credit applied to current gift tax
  creditApplied = (): number => {
    return Math.min(this.giftTaxBeforeCredits(), this.availableUnifiedCredit())
  }

  // Net gift tax due
  netGiftTax = (): number => {
    return Math.max(0, this.giftTaxBeforeCredits() - this.creditApplied())
  }

  // Schedule C/D: GST Tax

  // Direct skips (gifts to grandchildren or lower generations)
  directSkipGifts = (): GiftInfo[] => {
    return this.gifts().filter(g => g.isDirectSkip)
  }

  totalDirectSkips = (): number => {
    return this.directSkipGifts().reduce((sum, g) => sum + g.fairMarketValue, 0)
  }

  hasDirectSkips = (): boolean => this.f709Info()?.hasDirectSkips ?? false

  gstExemptionAllocated = (): number => this.f709Info()?.gstExemptionAllocated ?? 0
  priorGSTExemptionUsed = (): number => this.f709Info()?.priorGSTExemptionUsed ?? 0

  availableGSTExemption = (): number => {
    return Math.max(0, LIFETIME_EXCLUSION_2025 - this.priorGSTExemptionUsed())
  }

  // GST tax (max rate on non-exempt direct skips)
  gstTax = (): number => {
    const taxableSkips = Math.max(0, this.totalDirectSkips() - this.gstExemptionAllocated())
    return Math.round(taxableSkips * PARAMS_2025.maxTaxRate)
  }

  // Total tax due
  totalTaxDue = (): number => {
    return this.netGiftTax() + this.gstTax()
  }

  // Gift splitting calculations
  splitGiftAmount = (): number => {
    if (!this.consentToSplitGifts()) return 0
    return Math.round(this.totalGiftsFMV() / 2)
  }

  // Annual exclusion per donee
  annualExclusionPerDonee = (): number => ANNUAL_EXCLUSION_2025

  // Check if filing is required
  filingRequired = (): boolean => {
    // Filing required if any gift exceeds annual exclusion
    return this.gifts().some(g => g.fairMarketValue > ANNUAL_EXCLUSION_2025)
  }

  fields = (): Field[] => {
    const gifts = this.gifts()
    const priorGifts = this.priorPeriodGifts()

    return [
      // Part 1: General Information
      this.donorName(),
      this.donorSSN(),
      this.donorAddress(),
      this.f709Info()?.donorCitizenship ?? '',
      // Spouse/Gift Splitting
      this.consentToSplitGifts(),
      this.spouseName(),
      this.spouseSSN(),
      // Schedule A: Current Year Gifts
      gifts.length,
      this.totalGiftsFMV(),
      this.totalAnnualExclusions(),
      this.currentYearTaxableGifts(),
      // First gift details
      gifts[0]?.doneeInfo?.name ?? '',
      gifts[0]?.description ?? '',
      gifts[0]?.dateOfGift?.toLocaleDateString() ?? '',
      gifts[0]?.fairMarketValue ?? 0,
      gifts[0]?.annualExclusionApplied ?? 0,
      // Schedule B: Prior Period Gifts
      priorGifts.length,
      this.totalPriorTaxableGifts(),
      this.totalPriorTaxPaid(),
      // Tax Computation
      this.totalTaxableGifts(),
      this.tentativeTaxOnAllGifts(),
      this.tentativeTaxOnPriorGifts(),
      this.giftTaxBeforeCredits(),
      this.availableUnifiedCredit(),
      this.creditApplied(),
      this.netGiftTax(),
      // GST
      this.hasDirectSkips(),
      this.totalDirectSkips(),
      this.gstExemptionAllocated(),
      this.gstTax(),
      // Total
      this.totalTaxDue()
    ]
  }
}
