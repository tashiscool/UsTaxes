/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 4684 - Casualties and Thefts
 *
 * Used to report gains and losses from casualties and thefts.
 *
 * After TCJA (2018-2025):
 * - Personal casualty losses only deductible if from federally declared disasters
 * - Business/income-producing property casualties fully deductible
 *
 */

export type CasualtyType = 'disaster' | 'theft' | 'other'
export type PropertyType = 'personal' | 'business' | 'incomeProducing'

export interface CasualtyEvent {
  description: string
  dateOfEvent: Date
  federallyDeclaredDisaster?: boolean
  femaDisasterNumber?: string
  qualifiedDisasterLoss?: boolean
  disasterDesignation?: string // FEMA disaster number if applicable
  propertyType?: PropertyType
  casualtyType?: CasualtyType

  // Property details
  costBasis: number
  fmvBefore?: number
  fmvAfter?: number
  fairMarketValueBefore?: number
  fairMarketValueAfter?: number
  insuranceReimbursement: number
  repairCosts?: number
  repairCostsAcceptedAsFmvEvidence?: boolean
}

export default class F4684 extends F1040Attachment {
  tag: FormTag = 'f4684'
  sequenceIndex = 26

  isNeeded = (): boolean => {
    return this.hasCasualtyEvents()
  }

  hasCasualtyEvents = (): boolean => {
    return (this.f1040.info.casualtyEvents?.length ?? 0) > 0
  }

  events = (): CasualtyEvent[] => {
    return (this.f1040.info.casualtyEvents as CasualtyEvent[] | undefined) ?? []
  }

  personalEvents = (): CasualtyEvent[] => {
    return this.events().filter(
      (e) => (e.propertyType ?? 'personal') === 'personal'
    )
  }

  businessEvents = (): CasualtyEvent[] => {
    return this.events().filter(
      (e) => (e.propertyType ?? 'personal') !== 'personal'
    )
  }

  isFederallyDeclaredDisaster = (event: CasualtyEvent): boolean => {
    return (
      event.federallyDeclaredDisaster === true ||
      (event.casualtyType === 'disaster' &&
        (event.disasterDesignation !== undefined ||
          event.femaDisasterNumber !== undefined))
    )
  }

  isQualifiedDisasterLoss = (event: CasualtyEvent): boolean => {
    return (
      this.isFederallyDeclaredDisaster(event) &&
      event.qualifiedDisasterLoss === true
    )
  }

  private eventFmvBefore = (event: CasualtyEvent): number =>
    event.fairMarketValueBefore ?? event.fmvBefore ?? 0

  private eventFmvAfter = (event: CasualtyEvent): number =>
    event.fairMarketValueAfter ?? event.fmvAfter ?? 0

  private hasExplicitFmvEvidence = (event: CasualtyEvent): boolean =>
    event.fairMarketValueBefore !== undefined ||
    event.fairMarketValueAfter !== undefined ||
    event.fmvBefore !== undefined ||
    event.fmvAfter !== undefined

  private eventLossValue = (event: CasualtyEvent): number => {
    if (this.hasExplicitFmvEvidence(event)) {
      return Math.max(0, this.eventFmvBefore(event) - this.eventFmvAfter(event))
    }

    if (event.repairCostsAcceptedAsFmvEvidence === true) {
      return Math.max(0, event.repairCosts ?? 0)
    }

    return 0
  }

  private eventDisasterNumber = (event: CasualtyEvent): string | undefined =>
    event.femaDisasterNumber ?? event.disasterDesignation

  private perEventFloor = (event: CasualtyEvent): number =>
    this.isQualifiedDisasterLoss(event) ? 500 : 100

  private lossAfterPerEventFloor = (event: CasualtyEvent): number =>
    Math.max(0, this.calculateLoss(event) - this.perEventFloor(event))

  private federallyDeclaredPersonalEvents = (): CasualtyEvent[] =>
    this.personalEvents().filter((e) => this.isFederallyDeclaredDisaster(e))

  private nonDisasterPersonalEvents = (): CasualtyEvent[] =>
    this.personalEvents().filter((e) => !this.isFederallyDeclaredDisaster(e))

  private qualifiedPersonalLossAfterFloors = (): number =>
    this.federallyDeclaredPersonalEvents()
      .filter((event) => this.isQualifiedDisasterLoss(event))
      .reduce((sum, event) => sum + this.lossAfterPerEventFloor(event), 0)

  private ordinaryPersonalLossAfterFloors = (): number =>
    this.federallyDeclaredPersonalEvents()
      .filter((event) => !this.isQualifiedDisasterLoss(event))
      .reduce((sum, event) => sum + this.lossAfterPerEventFloor(event), 0)

  private nonDisasterPersonalLossAfterFloors = (): number =>
    this.nonDisasterPersonalEvents().reduce(
      (sum, event) => sum + this.lossAfterPerEventFloor(event),
      0
    )

  // Section A - Personal Use Property (disasters only under TCJA)

  // Calculate loss per event
  calculateLoss = (event: CasualtyEvent): number => {
    // Loss = Lesser of (cost basis) or (FMV decline) - insurance
    const fmvDecline = this.eventLossValue(event)
    const deductibleLoss = Math.min(event.costBasis, fmvDecline)
    return Math.max(0, deductibleLoss - event.insuranceReimbursement)
  }

  // Line 1: Description of properties
  // Line 2: Cost or adjusted basis
  l2 = (eventIndex: number): number => {
    return this.personalEvents()[eventIndex]?.costBasis ?? 0
  }

  // Line 3: Insurance reimbursement
  l3 = (eventIndex: number): number => {
    return this.personalEvents()[eventIndex]?.insuranceReimbursement ?? 0
  }

  // Line 4: Gain if line 3 > line 2
  l4 = (eventIndex: number): number => {
    return Math.max(0, this.l3(eventIndex) - this.l2(eventIndex))
  }

  // Line 5: FMV before
  l5 = (eventIndex: number): number => {
    const event = this.personalEvents()[eventIndex]
    return event === undefined ? 0 : this.eventFmvBefore(event)
  }

  // Line 6: FMV after
  l6 = (eventIndex: number): number => {
    const event = this.personalEvents()[eventIndex]
    return event === undefined ? 0 : this.eventFmvAfter(event)
  }

  // Line 7: Subtract line 6 from line 5
  l7 = (eventIndex: number): number => {
    const event = this.personalEvents()[eventIndex]
    return event === undefined ? 0 : this.eventLossValue(event)
  }

  // Line 8: Enter smaller of line 2 or line 7
  l8 = (eventIndex: number): number => {
    return Math.min(this.l2(eventIndex), this.l7(eventIndex))
  }

  // Line 9: Subtract line 3 from line 8 (loss before limitations)
  l9 = (eventIndex: number): number => {
    return Math.max(0, this.l8(eventIndex) - this.l3(eventIndex))
  }

  // Line 10: Total personal casualty losses
  l10 = (): number => {
    return this.federallyDeclaredPersonalEvents().reduce(
      (sum, event) => sum + this.calculateLoss(event),
      0
    )
  }

  // Line 11: $100 floor per casualty event
  l11 = (): number => {
    return this.federallyDeclaredPersonalEvents().reduce(
      (sum, event) => sum + this.perEventFloor(event),
      0
    )
  }

  // Line 12: Subtract line 11 from line 10
  l12 = (): number =>
    this.federallyDeclaredPersonalEvents().reduce(
      (sum, event) => sum + this.lossAfterPerEventFloor(event),
      0
    )

  // Line 13: Total personal casualty gains
  l13 = (): number => {
    return this.personalEvents().reduce((sum, _, i) => sum + this.l4(i), 0)
  }

  // Line 14: If losses exceed gains
  l14 = (): number => {
    const nondisasterLosses = this.nonDisasterPersonalLossAfterFloors()
    return this.l12() + Math.min(nondisasterLosses, this.l13())
  }

  // Line 15: 10% of AGI floor
  l15 = (): number => Math.round(this.f1040.l11() * 0.1)

  // Line 16: Subtract line 15 from line 14 (deductible personal loss)
  l16 = (): number => {
    const totalGains = this.l13()
    const nondisasterLosses = this.nonDisasterPersonalLossAfterFloors()
    const remainingGainsAfterNondisasterLosses = Math.max(
      0,
      totalGains - nondisasterLosses
    )
    const ordinaryLosses = this.ordinaryPersonalLossAfterFloors()
    const qualifiedLosses = this.qualifiedPersonalLossAfterFloors()

    const ordinaryLossesAfterGains = Math.max(
      0,
      ordinaryLosses - remainingGainsAfterNondisasterLosses
    )
    const remainingGains = Math.max(
      0,
      remainingGainsAfterNondisasterLosses - ordinaryLosses
    )
    const qualifiedLossesAfterGains = Math.max(
      0,
      qualifiedLosses - remainingGains
    )

    return (
      qualifiedLossesAfterGains +
      Math.max(0, ordinaryLossesAfterGains - this.l15())
    )
  }

  // Section B - Business and Income-Producing Property

  // Line 19: Total business casualty losses
  l19 = (): number => {
    return this.businessEvents().reduce((sum, event) => {
      return sum + this.calculateLoss(event)
    }, 0)
  }

  // Line 20: Total business casualty gains
  l20 = (): number => {
    return this.businessEvents().reduce((sum, event) => {
      const gain = event.insuranceReimbursement - event.costBasis
      return sum + Math.max(0, gain)
    }, 0)
  }

  // Line 21: Net business casualty loss (if loss exceeds gain)
  l21 = (): number => {
    return Math.max(0, this.l19() - this.l20())
  }

  // Line 22: Net business casualty gain (if gain exceeds loss)
  l22 = (): number => {
    return Math.max(0, this.l20() - this.l19())
  }

  // Amounts for other forms
  personalCasualtyLossDeduction = (): number => this.l16()
  businessCasualtyLoss = (): number => this.l21()
  businessCasualtyGain = (): number => this.l22()

  fields = (): Field[] => {
    const fields: Field[] = [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid
    ]

    // Add fields for up to 4 personal events
    for (let i = 0; i < 4; i++) {
      const event = this.personalEvents()[i]
      fields.push(
        event?.description ?? '',
        event?.dateOfEvent?.toLocaleDateString() ?? '',
        this.eventDisasterNumber(event ?? ({} as CasualtyEvent)) ?? '',
        this.l2(i),
        this.l3(i),
        this.l4(i),
        this.l5(i),
        this.l6(i),
        this.l7(i),
        this.l8(i),
        this.l9(i)
      )
    }

    fields.push(
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l19(),
      this.l20(),
      this.l21(),
      this.l22()
    )

    return fields
  }
}
