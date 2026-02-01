/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule M (Form 990) - Noncash Contributions
 *
 * Reports noncash contributions received by the organization:
 * - Art and collectibles
 * - Clothing and household items
 * - Cars, boats, planes
 * - Real estate
 * - Securities
 * - Intellectual property
 * - Other noncash contributions
 *
 * Required when organization receives significant noncash contributions.
 */

export interface NoncashContributionType {
  typeCode: string
  typeName: string
  numberOfContributions: number
  revenueReported: number
  methodOfDeterminingRevenue: string
}

export interface Schedule990MData {
  // Types of noncash contributions
  contributions: {
    // Art and similar assets
    artworkAntiques: NoncashContributionType
    historicalTreasures: NoncashContributionType
    // Qualified conservation
    qualifiedConservation: NoncashContributionType
    // Art for exempt purpose
    artForExemptPurpose: NoncashContributionType
    // Clothing and household
    clothingAndHousehold: NoncashContributionType
    // Cars and vehicles
    carsAndVehicles: NoncashContributionType
    boatsAndPlanes: NoncashContributionType
    // Real estate
    realEstate: NoncashContributionType
    // Securities
    publiclyTradedSecurities: NoncashContributionType
    closelyHeldStock: NoncashContributionType
    partnershipInterests: NoncashContributionType
    // Intellectual property
    intellectualProperty: NoncashContributionType
    // Food inventory
    foodInventory: NoncashContributionType
    // Drugs and medical supplies
    drugsAndMedical: NoncashContributionType
    // Scientific equipment
    scientificEquipment: NoncashContributionType
    // Other
    otherNoncash: NoncashContributionType
  }
  // Questions
  receivedArtOver25000: boolean
  receivedArtNotRelatedToExempt: boolean
  methodsForDisposal: string
}

export default class Schedule990M extends F1040Attachment {
  tag: FormTag = 'f990sm'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasNoncashData()
  }

  hasNoncashData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990MData = (): Schedule990MData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Contribution type getters
  getContributionType = (
    typeKey: string
  ): NoncashContributionType | undefined => {
    const contributions = this.schedule990MData()?.contributions
    if (!contributions) return undefined
    return contributions[typeKey as keyof typeof contributions]
  }

  // Total noncash contributions
  totalNoncashContributions = (): number => {
    const contributions = this.schedule990MData()?.contributions
    if (!contributions) return 0

    let total = 0
    for (const key of Object.keys(contributions)) {
      const contrib = contributions[key as keyof typeof contributions]
      if (contrib) {
        total += contrib.revenueReported
      }
    }
    return total
  }

  // Total number of contributions
  totalNumberOfContributions = (): number => {
    const contributions = this.schedule990MData()?.contributions
    if (!contributions) return 0

    let total = 0
    for (const key of Object.keys(contributions)) {
      const contrib = contributions[key as keyof typeof contributions]
      if (contrib) {
        total += contrib.numberOfContributions
      }
    }
    return total
  }

  // Art contributions
  artContributions = (): number => {
    const contributions = this.schedule990MData()?.contributions
    if (!contributions) return 0
    return (
      (contributions.artworkAntiques.revenueReported ?? 0) +
      (contributions.historicalTreasures.revenueReported ?? 0)
    )
  }

  // Vehicle contributions
  vehicleContributions = (): number => {
    const contributions = this.schedule990MData()?.contributions
    if (!contributions) return 0
    return (
      (contributions.carsAndVehicles.revenueReported ?? 0) +
      (contributions.boatsAndPlanes.revenueReported ?? 0)
    )
  }

  // Securities contributions
  securitiesContributions = (): number => {
    const contributions = this.schedule990MData()?.contributions
    if (!contributions) return 0
    return (
      (contributions.publiclyTradedSecurities.revenueReported ?? 0) +
      (contributions.closelyHeldStock.revenueReported ?? 0) +
      (contributions.partnershipInterests.revenueReported ?? 0)
    )
  }

  fields = (): Field[] => {
    const data = this.schedule990MData()
    const contributions = data?.contributions

    return [
      // Art and collectibles
      contributions?.artworkAntiques.numberOfContributions ?? 0,
      contributions?.artworkAntiques.revenueReported ?? 0,
      contributions?.historicalTreasures.numberOfContributions ?? 0,
      contributions?.historicalTreasures.revenueReported ?? 0,
      // Conservation
      contributions?.qualifiedConservation.numberOfContributions ?? 0,
      contributions?.qualifiedConservation.revenueReported ?? 0,
      // Clothing
      contributions?.clothingAndHousehold.numberOfContributions ?? 0,
      contributions?.clothingAndHousehold.revenueReported ?? 0,
      // Vehicles
      contributions?.carsAndVehicles.numberOfContributions ?? 0,
      contributions?.carsAndVehicles.revenueReported ?? 0,
      contributions?.boatsAndPlanes.numberOfContributions ?? 0,
      contributions?.boatsAndPlanes.revenueReported ?? 0,
      // Real estate
      contributions?.realEstate.numberOfContributions ?? 0,
      contributions?.realEstate.revenueReported ?? 0,
      // Securities
      contributions?.publiclyTradedSecurities.numberOfContributions ?? 0,
      contributions?.publiclyTradedSecurities.revenueReported ?? 0,
      contributions?.closelyHeldStock.numberOfContributions ?? 0,
      contributions?.closelyHeldStock.revenueReported ?? 0,
      contributions?.partnershipInterests.numberOfContributions ?? 0,
      contributions?.partnershipInterests.revenueReported ?? 0,
      // Intellectual property
      contributions?.intellectualProperty.numberOfContributions ?? 0,
      contributions?.intellectualProperty.revenueReported ?? 0,
      // Food and medical
      contributions?.foodInventory.numberOfContributions ?? 0,
      contributions?.foodInventory.revenueReported ?? 0,
      contributions?.drugsAndMedical.numberOfContributions ?? 0,
      contributions?.drugsAndMedical.revenueReported ?? 0,
      // Scientific equipment
      contributions?.scientificEquipment.numberOfContributions ?? 0,
      contributions?.scientificEquipment.revenueReported ?? 0,
      // Other
      contributions?.otherNoncash.numberOfContributions ?? 0,
      contributions?.otherNoncash.revenueReported ?? 0,
      // Questions
      data?.receivedArtOver25000 ?? false,
      data?.receivedArtNotRelatedToExempt ?? false,
      data?.methodsForDisposal ?? '',
      // Totals
      this.totalNumberOfContributions(),
      this.totalNoncashContributions(),
      this.artContributions(),
      this.vehicleContributions(),
      this.securitiesContributions()
    ]
  }
}
