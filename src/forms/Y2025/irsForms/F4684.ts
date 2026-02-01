import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
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
 * OBBBA 2025: May restore some personal casualty loss deductions
 */

export type CasualtyType = 'disaster' | 'theft' | 'other'
export type PropertyType = 'personal' | 'business' | 'incomeProducing'

export interface CasualtyEvent {
  description: string
  dateOfEvent: Date
  disasterDesignation?: string // FEMA disaster number if applicable
  propertyType: PropertyType
  casualtyType: CasualtyType

  // Property details
  costBasis: number
  fmvBefore: number
  fmvAfter: number
  insuranceReimbursement: number
  repairCosts: number
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
    return this.events().filter((e) => e.propertyType === 'personal')
  }

  businessEvents = (): CasualtyEvent[] => {
    return this.events().filter((e) => e.propertyType !== 'personal')
  }

  isFederallyDeclaredDisaster = (event: CasualtyEvent): boolean => {
    return (
      event.casualtyType === 'disaster' &&
      event.disasterDesignation !== undefined
    )
  }

  // Section A - Personal Use Property (disasters only under TCJA)

  // Calculate loss per event
  calculateLoss = (event: CasualtyEvent): number => {
    // Loss = Lesser of (cost basis) or (FMV decline) - insurance
    const fmvDecline = Math.max(0, event.fmvBefore - event.fmvAfter)
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
    return this.personalEvents()[eventIndex]?.fmvBefore ?? 0
  }

  // Line 6: FMV after
  l6 = (eventIndex: number): number => {
    return this.personalEvents()[eventIndex]?.fmvAfter ?? 0
  }

  // Line 7: Subtract line 6 from line 5
  l7 = (eventIndex: number): number => {
    return Math.max(0, this.l5(eventIndex) - this.l6(eventIndex))
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
    return this.personalEvents()
      .filter((e) => this.isFederallyDeclaredDisaster(e))
      .reduce((sum, _, i) => sum + this.l9(i), 0)
  }

  // Line 11: $100 floor per casualty event
  l11 = (): number => {
    const disasterEvents = this.personalEvents().filter((e) =>
      this.isFederallyDeclaredDisaster(e)
    )
    return disasterEvents.length * 100
  }

  // Line 12: Subtract line 11 from line 10
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Total personal casualty gains
  l13 = (): number => {
    return this.personalEvents().reduce((sum, _, i) => sum + this.l4(i), 0)
  }

  // Line 14: If losses exceed gains
  l14 = (): number => {
    if (this.l12() > this.l13()) {
      return this.l12() - this.l13()
    }
    return 0
  }

  // Line 15: 10% of AGI floor
  l15 = (): number => Math.round(this.f1040.l11() * 0.1)

  // Line 16: Subtract line 15 from line 14 (deductible personal loss)
  l16 = (): number => Math.max(0, this.l14() - this.l15())

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
        event.description ?? '',
        event.dateOfEvent.toLocaleDateString() ?? '',
        event.disasterDesignation ?? '',
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
