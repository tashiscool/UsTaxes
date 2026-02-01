/**
 * Gift Tax Data Types
 *
 * Data structures for Form 709 (Gift Tax Return) and related schedules.
 * Based on IRS Form 709 specifications.
 */

import { State, Address, PersonRole } from './index'

// =============================================================================
// Enums
// =============================================================================

/**
 * Relationship to donor
 */
export enum DoneeRelationship {
  Child = 'Child',
  Grandchild = 'Grandchild',
  Spouse = 'Spouse',
  Sibling = 'Sibling',
  Parent = 'Parent',
  Grandparent = 'Grandparent',
  NieceNephew = 'NieceNephew',
  Other = 'Other'
}

/**
 * Type of gift
 */
export enum GiftType {
  Cash = 'Cash',
  Securities = 'Securities',
  RealProperty = 'RealProperty',
  TangibleProperty = 'TangibleProperty',
  LifeInsurance = 'LifeInsurance',
  Trust = 'Trust',
  ArtAntiques = 'ArtAntiques',
  DigitalAssets = 'DigitalAssets',
  Other = 'Other'
}

/**
 * Gift tax schedule part
 */
export enum GiftSchedulePart {
  Part1_GiftTaxOnly = 'Part1', // Gifts subject only to gift tax
  Part2_DirectSkips = 'Part2', // Direct skips (both gift tax and GST)
  Part3_IndirectSkips = 'Part3' // Indirect skips and other transfers in trust
}

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Donee (gift recipient) information
 */
export interface Donee {
  /** Donee's full name */
  name: string
  /** Donee's relationship to donor */
  relationship: DoneeRelationship
  /** Donee's address */
  address?: Address
  /** Donee's SSN (optional, for tax purposes) */
  ssn?: string
  /** Trust name if gift to trust */
  trustName?: string
  /** Trust EIN if gift to trust */
  trustEIN?: string
}

/**
 * Gift entry for Schedule A
 */
export interface GiftEntry<D = Date> {
  /** Unique identifier */
  id: string
  /** Item number on schedule */
  itemNumber: number
  /** Which part of Schedule A */
  schedulePart: GiftSchedulePart
  /** Donee information */
  donee: Donee
  /** Description of the gift */
  description: string
  /** Type of gift */
  giftType: GiftType
  /** Donor's adjusted basis in the property */
  donorAdjustedBasis: number
  /** Date of gift */
  dateOfGift: D
  /** Fair market value at date of gift */
  valueAtDateOfGift: number
  /** Whether this is a split gift (50/50 with spouse) */
  isSplitGift: boolean
  /** Split gift amount (half of value if split) */
  splitGiftAmount?: number
  /** Net transfer amount */
  netTransfer: number
  /** Whether this is a charitable gift */
  isCharitableGift: boolean
  /** Whether this is a deductible gift to spouse */
  isDeductibleGiftToSpouse: boolean
  /** Section 2652(a)(3) election made */
  election2652a3?: boolean
  /** Valuation discount applied */
  valuationDiscount?: {
    discountPercentage: number
    discountedValue: number
    reason: string
  }
  /** GST exemption allocated to this gift */
  gstExemptionAllocated?: number
  /** Digital asset information if applicable */
  digitalAssetInfo?: {
    assetType: string
    acquisitionDate: D
    wallet?: string
  }
}

export type GiftEntryDateString = GiftEntry<string>

/**
 * Prior period gift for Schedule B
 */
export interface PriorPeriodGift {
  /** Calendar year or quarter */
  calendarYearOrQuarter: string
  /** IRS office where filed */
  irsOfficeWhereFiled: string
  /** Applicable credit used */
  applicableCreditUsed: number
  /** Specific exemption used (pre-1977 gifts) */
  specificExemptionUsed?: number
  /** Taxable gifts amount */
  taxableGiftsAmount: number
}

/**
 * DSUE (Deceased Spousal Unused Exclusion) source
 */
export interface DSUESource<D = Date> {
  /** Deceased spouse's name */
  deceasedSpouseName: string
  /** Deceased spouse's SSN */
  deceasedSpouseSSN: string
  /** Date of death */
  dateOfDeath: D
  /** DSUE amount */
  dsueAmount: number
  /** Whether this is the last deceased spouse */
  isLastDeceasedSpouse: boolean
  /** Year of death */
  yearOfDeath: number
}

export type DSUESourceDateString = DSUESource<string>

/**
 * Consenting spouse information for Part III
 */
export interface ConsentingSpouse {
  /** Spouse's full name */
  name: string
  /** Spouse's SSN */
  ssn: string
  /** Whether consent is given */
  consentGiven: boolean
  /** Date of consent */
  consentDate?: Date
}

/**
 * GST (Generation-Skipping Transfer) exemption allocation
 */
export interface GSTExemptionAllocation {
  /** Gift item ID this allocation applies to */
  giftItemId: string
  /** GST exemption amount allocated */
  exemptionAllocated: number
  /** Inclusion ratio after allocation */
  inclusionRatio: number
  /** Applicable rate (inclusion ratio × max rate) */
  applicableRate: number
}

/**
 * Complete gift tax return data
 */
export interface GiftTaxReturn<D = Date> {
  /** Tax year */
  taxYear: number

  // Part I - General Information
  /** Donor information */
  donor: {
    firstName: string
    lastName: string
    ssn: string
    address: Address
    legalResidence: State
    citizenship: string
    dateOfDeath?: D
  }

  /** Whether this is an amended return */
  isAmendedReturn: boolean

  /** Whether extension was filed */
  extensionFiled: boolean

  /** Whether Form 709 was previously filed */
  previouslyFiled709: boolean

  /** Whether address changed since last filing */
  addressChanged?: boolean

  /** Whether gifts are being split with spouse */
  giftsBySpouses: boolean

  /** Whether DSUE amount is being applied */
  dsueApplied: boolean

  /** Whether digital assets are included */
  digitalAssetIncluded: boolean

  // Schedule A - Gifts
  /** Gift entries */
  gifts: GiftEntry<D>[]

  // Part III - Spouse Consent
  /** Consenting spouse information */
  consentingSpouse?: ConsentingSpouse

  // Schedule B - Prior Period Gifts
  /** Prior period gifts */
  priorPeriodGifts: PriorPeriodGift[]

  // Schedule C - DSUE
  /** DSUE sources */
  dsueSources: DSUESource<D>[]

  /** Restored exclusion amount */
  restoredExclusionAmount?: number

  // Schedule D - GST
  /** GST exemption allocations */
  gstAllocations: GSTExemptionAllocation[]

  /** GST exemption used in prior periods */
  priorGSTExemptionUsed: number

  // Payment
  /** Extension payment made */
  extensionPaymentAmount?: number

  /** Payment with return */
  paymentWithReturn?: number
}

export type GiftTaxReturnDateString = GiftTaxReturn<string>

// =============================================================================
// Tax Calculation Parameters
// =============================================================================

/**
 * Gift tax parameters by year
 */
export interface GiftTaxParameters {
  /** Tax year */
  year: number
  /** Annual exclusion per donee */
  annualExclusion: number
  /** Basic exclusion amount (lifetime gift tax exemption) */
  basicExclusionAmount: number
  /** Maximum GST exemption */
  maxGSTExemption: number
  /** Maximum tax rate */
  maxTaxRate: number
}

/**
 * Gift tax parameters for 2025
 */
export const GIFT_TAX_PARAMETERS_2025: GiftTaxParameters = {
  year: 2025,
  annualExclusion: 19000,
  basicExclusionAmount: 13990000,
  maxGSTExemption: 13990000,
  maxTaxRate: 0.4
}

/**
 * Gift tax brackets (2025)
 * Unified with estate tax under IRC §2001
 */
export const GIFT_TAX_BRACKETS_2025 = [
  { min: 0, max: 10000, rate: 0.18 },
  { min: 10000, max: 20000, rate: 0.2 },
  { min: 20000, max: 40000, rate: 0.22 },
  { min: 40000, max: 60000, rate: 0.24 },
  { min: 60000, max: 80000, rate: 0.26 },
  { min: 80000, max: 100000, rate: 0.28 },
  { min: 100000, max: 150000, rate: 0.3 },
  { min: 150000, max: 250000, rate: 0.32 },
  { min: 250000, max: 500000, rate: 0.34 },
  { min: 500000, max: 750000, rate: 0.37 },
  { min: 750000, max: 1000000, rate: 0.39 },
  { min: 1000000, max: Infinity, rate: 0.4 }
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate gift tax using unified tax table
 */
export function calculateGiftTax(taxableAmount: number, year = 2025): number {
  const brackets = GIFT_TAX_BRACKETS_2025
  let tax = 0
  let remaining = taxableAmount

  for (const bracket of brackets) {
    if (remaining <= 0) break

    const taxableInBracket = Math.min(remaining, bracket.max - bracket.min)

    if (taxableInBracket > 0) {
      tax += taxableInBracket * bracket.rate
      remaining -= taxableInBracket
    }
  }

  return Math.round(tax)
}

/**
 * Get applicable credit amount (unified credit)
 */
export function getApplicableCredit(
  exclusionAmount: number,
  year = 2025
): number {
  // The applicable credit is the tax that would be due on the exclusion amount
  return calculateGiftTax(exclusionAmount, year)
}

/**
 * Get gift tax parameters for a year
 */
export function getGiftTaxParameters(year: number): GiftTaxParameters {
  // For now, only 2025 is implemented
  if (year === 2025) {
    return GIFT_TAX_PARAMETERS_2025
  }

  // Default to 2025 parameters (would need to add historical data)
  return {
    ...GIFT_TAX_PARAMETERS_2025,
    year
  }
}

/**
 * Calculate total annual exclusions for gifts
 */
export function calculateTotalAnnualExclusions(
  gifts: GiftEntry[],
  year = 2025
): number {
  const params = getGiftTaxParameters(year)

  // Group gifts by donee
  const doneeGifts = new Map<string, number>()

  for (const gift of gifts) {
    const doneeKey = gift.donee.ssn || gift.donee.name
    const currentTotal = doneeGifts.get(doneeKey) || 0
    doneeGifts.set(doneeKey, currentTotal + gift.netTransfer)
  }

  // Calculate exclusions (up to annual limit per donee)
  let totalExclusions = 0

  doneeGifts.forEach((total) => {
    totalExclusions += Math.min(total, params.annualExclusion)
  })

  return totalExclusions
}

/**
 * Calculate taxable gifts
 */
export function calculateTaxableGifts(
  gifts: GiftEntry[],
  year = 2025
): {
  totalGifts: number
  totalExclusions: number
  maritalDeduction: number
  charitableDeduction: number
  taxableGifts: number
} {
  const totalGifts = gifts.reduce((sum, g) => sum + g.netTransfer, 0)
  const totalExclusions = calculateTotalAnnualExclusions(gifts, year)

  // Marital deduction (unlimited for gifts to spouse)
  const maritalDeduction = gifts
    .filter((g) => g.isDeductibleGiftToSpouse)
    .reduce((sum, g) => sum + g.netTransfer, 0)

  // Charitable deduction
  const charitableDeduction = gifts
    .filter((g) => g.isCharitableGift)
    .reduce((sum, g) => sum + g.netTransfer, 0)

  const taxableGifts = Math.max(
    0,
    totalGifts - totalExclusions - maritalDeduction - charitableDeduction
  )

  return {
    totalGifts,
    totalExclusions,
    maritalDeduction,
    charitableDeduction,
    taxableGifts
  }
}
