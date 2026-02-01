/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 4255 - Recapture of Investment Credit
 *
 * Used when property for which an investment credit was claimed is disposed
 * of or ceases to be qualified property before the end of the recapture period.
 *
 * Credits subject to recapture:
 * - Rehabilitation credit (historic structures, older buildings)
 * - Energy credit (solar, wind, geothermal, fuel cells)
 * - Qualifying advanced coal project credit
 * - Qualifying gasification project credit
 * - Qualifying advanced energy project credit
 *
 * Recapture rules:
 * - Property must remain qualified for 5 years (20% recapture per year)
 * - Disposition includes sale, exchange, gift, involuntary conversion
 * - Cessation of qualified use triggers recapture
 */

export type CreditType =
  | 'rehabilitation'
  | 'energy'
  | 'coal'
  | 'gasification'
  | 'advancedEnergy'

export interface InvestmentCreditRecapture {
  propertyDescription: string
  creditType: CreditType
  datePropertyPlacedInService: Date
  datePropertyDisposedOrCeased: Date
  originalCreditClaimed: number
  originalCreditYear: number
  yearsPropertyQualified: number // Full years property was used
  dispositionType:
    | 'sale'
    | 'exchange'
    | 'gift'
    | 'involuntaryConversion'
    | 'cessation'
  amountRealized?: number // For sales
}

// Recapture percentages by year
const recapturePercentages: Record<number, number> = {
  1: 100, // Disposed in year 1: 100% recapture
  2: 80, // Disposed in year 2: 80% recapture
  3: 60, // Disposed in year 3: 60% recapture
  4: 40, // Disposed in year 4: 40% recapture
  5: 20, // Disposed in year 5: 20% recapture
  6: 0 // After year 5: no recapture
}

export default class F4255 extends F1040Attachment {
  tag: FormTag = 'f4255'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasRecaptureEvents()
  }

  hasRecaptureEvents = (): boolean => {
    return this.recaptureEvents().length > 0
  }

  recaptureEvents = (): InvestmentCreditRecapture[] => {
    return (
      (this.f1040.info.investmentCreditRecaptures as
        | InvestmentCreditRecapture[]
        | undefined) ?? []
    )
  }

  // Calculate recapture percentage based on years qualified
  recapturePercentage = (yearsQualified: number): number => {
    return recapturePercentages[yearsQualified] ?? 0
  }

  // Calculate recapture amount for a single property
  calculateRecapture = (event: InvestmentCreditRecapture): number => {
    const percentage = this.recapturePercentage(event.yearsPropertyQualified)
    return Math.round(event.originalCreditClaimed * (percentage / 100))
  }

  // Part I - Original Investment Credit

  // Get first recapture event (form typically handles one at a time)
  primaryEvent = (): InvestmentCreditRecapture | undefined => {
    return this.recaptureEvents()[0]
  }

  // Line 1: Description of property
  l1 = (): string => this.primaryEvent()?.propertyDescription ?? ''

  // Line 2: Type of credit
  l2Rehabilitation = (): boolean =>
    this.primaryEvent()?.creditType === 'rehabilitation'
  l2Energy = (): boolean => this.primaryEvent()?.creditType === 'energy'
  l2Coal = (): boolean => this.primaryEvent()?.creditType === 'coal'
  l2Gasification = (): boolean =>
    this.primaryEvent()?.creditType === 'gasification'
  l2AdvancedEnergy = (): boolean =>
    this.primaryEvent()?.creditType === 'advancedEnergy'

  // Line 3: Date property was placed in service
  l3 = (): string => {
    return (
      this.primaryEvent()?.datePropertyPlacedInService.toLocaleDateString() ??
      ''
    )
  }

  // Line 4: Date property was disposed or ceased to qualify
  l4 = (): string => {
    return (
      this.primaryEvent()?.datePropertyDisposedOrCeased.toLocaleDateString() ??
      ''
    )
  }

  // Line 5: Original credit claimed
  l5 = (): number => this.primaryEvent()?.originalCreditClaimed ?? 0

  // Line 6: Year original credit was claimed
  l6 = (): number => this.primaryEvent()?.originalCreditYear ?? 0

  // Part II - Recapture Calculation

  // Line 7: Number of full years property was qualified
  l7 = (): number => this.primaryEvent()?.yearsPropertyQualified ?? 0

  // Line 8: Recapture percentage (based on years qualified)
  l8 = (): number => {
    const event = this.primaryEvent()
    return event ? this.recapturePercentage(event.yearsPropertyQualified) : 0
  }

  // Line 9: Recapture amount (line 5 × line 8 ÷ 100)
  l9 = (): number => {
    const event = this.primaryEvent()
    if (!event) return 0
    return this.calculateRecapture(event)
  }

  // Part III - Summary of All Recapture

  // Total recapture from all properties
  l10 = (): number => {
    return this.recaptureEvents().reduce(
      (sum, event) => sum + this.calculateRecapture(event),
      0
    )
  }

  // Part IV - Recapture of Energy Credit Net Increase

  // For energy credits, special rules apply for the "net increase" amount
  l11 = (): number => {
    const energyEvents = this.recaptureEvents().filter(
      (e) => e.creditType === 'energy'
    )
    return energyEvents.reduce(
      (sum, event) => sum + this.calculateRecapture(event),
      0
    )
  }

  // Summary methods

  // Total recapture amount (goes to Schedule 2, line 1d)
  totalRecapture = (): number => this.l10()

  // Energy credit recapture (separate line on Schedule 2)
  energyCreditRecapture = (): number => this.l11()

  // Rehabilitation credit recapture
  rehabilitationCreditRecapture = (): number => {
    const rehabEvents = this.recaptureEvents().filter(
      (e) => e.creditType === 'rehabilitation'
    )
    return rehabEvents.reduce(
      (sum, event) => sum + this.calculateRecapture(event),
      0
    )
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2Rehabilitation(),
    this.l2Energy(),
    this.l2Coal(),
    this.l2Gasification(),
    this.l2AdvancedEnergy(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    // Part II
    this.l7(),
    this.l8(),
    this.l9(),
    // Part III
    this.l10(),
    // Part IV
    this.l11()
  ]
}
