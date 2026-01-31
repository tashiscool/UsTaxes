import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8283 - Noncash Charitable Contributions
 *
 * Required for noncash contributions exceeding $500.
 *
 * Section A: Donated property with FMV of $5,000 or less per item
 * Section B: Donated property with FMV over $5,000 (requires appraisal)
 *
 * Special Rules:
 * - Vehicles: See Form 1098-C for deduction limits
 * - Art valued at $20,000+: Requires photo and appraisal summary
 * - Conservation easements: Special rules apply
 * - Publicly traded securities: FMV is market price on date of gift
 */

export type PropertyType =
  | 'publiclyTradedSecurities'
  | 'artAndAntiques'
  | 'vehicles'
  | 'clothing'
  | 'householdItems'
  | 'electronics'
  | 'realEstate'
  | 'conservationEasement'
  | 'intellectualProperty'
  | 'other'

export interface DonatedProperty {
  description: string
  propertyType: PropertyType
  doneeName: string
  doneeAddress: string
  doneeEIN?: string
  dateAcquired: Date
  howAcquired: 'purchase' | 'gift' | 'inheritance' | 'exchange' | 'other'
  dateContributed: Date
  fairMarketValue: number
  costOrBasis: number
  // For Section B only (items over $5,000)
  appraiserName?: string
  appraiserAddress?: string
  appraiserQualifications?: string
  appraisalDate?: Date
  methodOfValuation?: string
  // Additional info
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  isPartialInterest: boolean
  partialInterestDescription?: string
}

export interface VehicleDonation {
  vehicleDescription: string
  vehicleIdentificationNumber: string
  dateContributed: Date
  grossProceeds: number
  fairMarketValue: number
  deductionClaimed: number
  form1098CAttached: boolean
  certifiedUseDescription?: string
}

export interface Form8283Info {
  // Section A: Donated Property of $5,000 or Less
  sectionADonations: DonatedProperty[]
  // Section B: Donated Property Over $5,000
  sectionBDonations: DonatedProperty[]
  // Vehicle donations
  vehicleDonations: VehicleDonation[]
  // Conservation easements
  hasConservationEasement: boolean
  conservationEasementFMV?: number
}

// Deduction limits as percentage of AGI
const DEDUCTION_LIMITS = {
  publiclyTradedSecurities: 0.30,  // 30% of AGI
  longTermCapitalGainProperty: 0.30,  // 30% of AGI
  ordinaryIncomeProperty: 0.50,  // 50% of AGI
  conservationEasement: 0.50,  // 50% of AGI (special rules for farmers)
  privateFoundation: 0.30  // 30% of AGI
}

export default class F8283 extends F1040Attachment {
  tag: FormTag = 'f8283'
  sequenceIndex = 155

  isNeeded = (): boolean => {
    return this.hasNoncashContributions() && this.totalNoncashValue() > 500
  }

  hasNoncashContributions = (): boolean => {
    return this.f8283Info() !== undefined
  }

  f8283Info = (): Form8283Info | undefined => {
    return this.f1040.info.noncashContributions as Form8283Info | undefined
  }

  // Section A donations (under $5,000)
  sectionADonations = (): DonatedProperty[] => this.f8283Info()?.sectionADonations ?? []

  // Section B donations (over $5,000)
  sectionBDonations = (): DonatedProperty[] => this.f8283Info()?.sectionBDonations ?? []

  // Vehicle donations
  vehicleDonations = (): VehicleDonation[] => this.f8283Info()?.vehicleDonations ?? []

  // Total Section A value
  totalSectionAValue = (): number => {
    return this.sectionADonations().reduce((sum, d) => sum + d.fairMarketValue, 0)
  }

  // Total Section B value
  totalSectionBValue = (): number => {
    return this.sectionBDonations().reduce((sum, d) => sum + d.fairMarketValue, 0)
  }

  // Total vehicle donation value
  totalVehicleValue = (): number => {
    return this.vehicleDonations().reduce((sum, v) => sum + v.deductionClaimed, 0)
  }

  // Total noncash value
  totalNoncashValue = (): number => {
    return this.totalSectionAValue() + this.totalSectionBValue() + this.totalVehicleValue()
  }

  // Check if Section B is needed
  needsSectionB = (): boolean => {
    return this.sectionBDonations().length > 0
  }

  // Get donations by property type
  donationsByType = (type: PropertyType): DonatedProperty[] => {
    return [
      ...this.sectionADonations().filter(d => d.propertyType === type),
      ...this.sectionBDonations().filter(d => d.propertyType === type)
    ]
  }

  // Securities donations (no appraisal needed)
  securitiesDonations = (): DonatedProperty[] => {
    return this.donationsByType('publiclyTradedSecurities')
  }

  // Art and collectibles (special rules)
  artDonations = (): DonatedProperty[] => {
    return this.donationsByType('artAndAntiques')
  }

  // Conservation easements
  hasConservationEasement = (): boolean => {
    return this.f8283Info()?.hasConservationEasement ?? false
  }

  conservationEasementValue = (): number => {
    return this.f8283Info()?.conservationEasementFMV ?? 0
  }

  // Carryover calculation (simplified)
  // If donations exceed AGI limits, excess can be carried forward 5 years
  calculateCarryover = (): number => {
    const agi = this.f1040.l11()
    const limit = agi * 0.30  // Simplified - actual calculation more complex
    const excess = Math.max(0, this.totalNoncashValue() - limit)
    return excess
  }

  fields = (): Field[] => {
    const info = this.f8283Info()
    const sectionA = this.sectionADonations()
    const sectionB = this.sectionBDonations()
    const vehicles = this.vehicleDonations()

    return [
      // Section A: Donated Property of $5,000 or Less
      // Row 1
      sectionA[0]?.doneeName ?? '',
      sectionA[0]?.doneeAddress ?? '',
      sectionA[0]?.description ?? '',
      sectionA[0]?.dateContributed?.toLocaleDateString() ?? '',
      sectionA[0]?.dateAcquired?.toLocaleDateString() ?? '',
      sectionA[0]?.howAcquired ?? '',
      sectionA[0]?.costOrBasis ?? 0,
      sectionA[0]?.fairMarketValue ?? 0,
      sectionA[0]?.condition ?? '',
      // Row 2
      sectionA[1]?.doneeName ?? '',
      sectionA[1]?.description ?? '',
      sectionA[1]?.fairMarketValue ?? 0,
      // Row 3
      sectionA[2]?.doneeName ?? '',
      sectionA[2]?.description ?? '',
      sectionA[2]?.fairMarketValue ?? 0,
      // Row 4
      sectionA[3]?.doneeName ?? '',
      sectionA[3]?.description ?? '',
      sectionA[3]?.fairMarketValue ?? 0,
      // Row 5
      sectionA[4]?.doneeName ?? '',
      sectionA[4]?.description ?? '',
      sectionA[4]?.fairMarketValue ?? 0,
      // Section A Total
      this.totalSectionAValue(),

      // Section B: Donated Property Over $5,000
      this.needsSectionB(),
      // Part I: Information on Donated Property
      sectionB[0]?.doneeName ?? '',
      sectionB[0]?.doneeAddress ?? '',
      sectionB[0]?.doneeEIN ?? '',
      sectionB[0]?.description ?? '',
      sectionB[0]?.propertyType ?? '',
      sectionB[0]?.dateAcquired?.toLocaleDateString() ?? '',
      sectionB[0]?.howAcquired ?? '',
      sectionB[0]?.dateContributed?.toLocaleDateString() ?? '',
      sectionB[0]?.costOrBasis ?? 0,
      sectionB[0]?.fairMarketValue ?? 0,
      // Part II: Taxpayer (Donor) Statement
      sectionB[0]?.methodOfValuation ?? '',
      // Part III: Declaration of Appraiser
      sectionB[0]?.appraiserName ?? '',
      sectionB[0]?.appraiserAddress ?? '',
      sectionB[0]?.appraisalDate?.toLocaleDateString() ?? '',
      // Section B Total
      this.totalSectionBValue(),

      // Vehicle Donations
      vehicles.length > 0,
      vehicles[0]?.vehicleDescription ?? '',
      vehicles[0]?.vehicleIdentificationNumber ?? '',
      vehicles[0]?.dateContributed?.toLocaleDateString() ?? '',
      vehicles[0]?.grossProceeds ?? 0,
      vehicles[0]?.deductionClaimed ?? 0,
      vehicles[0]?.form1098CAttached ?? false,
      this.totalVehicleValue(),

      // Conservation Easement
      this.hasConservationEasement(),
      this.conservationEasementValue(),

      // Totals
      this.totalNoncashValue(),
      this.calculateCarryover()
    ]
  }
}
