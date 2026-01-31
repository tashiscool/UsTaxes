import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8824 - Like-Kind Exchanges (Section 1031)
 *
 * Used to report like-kind exchanges of business or investment property.
 * Allows deferral of gain when exchanging similar property.
 *
 * Key rules:
 * - Only business/investment property qualifies (not personal)
 * - Must be "like-kind" (real property for real property)
 * - 45-day identification period
 * - 180-day exchange completion period
 * - Boot (cash/non-like-kind property) is taxable
 */

export interface LikeKindExchange {
  // Relinquished property (given up)
  relinquishedDescription: string
  relinquishedDateAcquired: Date
  relinquishedDateTransferred: Date
  relinquishedFmv: number
  relinquishedAdjustedBasis: number
  relinquishedMortgage: number

  // Replacement property (received)
  replacementDescription: string
  replacementDateIdentified: Date
  replacementDateReceived: Date
  replacementFmv: number
  replacementMortgage: number

  // Boot
  cashReceived: number
  cashPaid: number
  otherPropertyReceived: number
  otherPropertyGiven: number

  // Related party
  isRelatedParty: boolean
  relatedPartyName?: string
  relatedPartyRelationship?: string
}

export default class F8824 extends F1040Attachment {
  tag: FormTag = 'f8824'
  sequenceIndex = 62

  isNeeded = (): boolean => {
    return this.hasLikeKindExchanges()
  }

  hasLikeKindExchanges = (): boolean => {
    return (this.f1040.info.likeKindExchanges?.length ?? 0) > 0
  }

  exchange = (): LikeKindExchange | undefined => {
    const exchanges = this.f1040.info.likeKindExchanges as LikeKindExchange[] | undefined
    return exchanges?.[0]
  }

  // Part I - Information on the Like-Kind Exchange

  // Line 1: Description of relinquished property
  l1 = (): string => this.exchange()?.relinquishedDescription ?? ''

  // Line 2: Description of replacement property
  l2 = (): string => this.exchange()?.replacementDescription ?? ''

  // Line 3: Date relinquished property was transferred
  l3 = (): Date | undefined => this.exchange()?.relinquishedDateTransferred

  // Line 4: Date replacement property was identified
  l4 = (): Date | undefined => this.exchange()?.replacementDateIdentified

  // Line 5: Date replacement property was received
  l5 = (): Date | undefined => this.exchange()?.replacementDateReceived

  // Line 6: Related party exchange?
  l6 = (): boolean => this.exchange()?.isRelatedParty ?? false

  // Line 7: Related party name
  l7 = (): string => this.exchange()?.relatedPartyName ?? ''

  // Part II - Related Party Exchange Information (lines 8-10)

  // Part III - Realized Gain or Loss, Recognized Gain, and Basis

  // Line 12: FMV of like-kind property received
  l12 = (): number => this.exchange()?.replacementFmv ?? 0

  // Line 13: Adjusted basis of like-kind property given up
  l13 = (): number => this.exchange()?.relinquishedAdjustedBasis ?? 0

  // Line 14: Gain or loss (line 12 - line 13)
  l14 = (): number => this.l12() - this.l13()

  // Line 15: Cash received plus FMV of other (non-like-kind) property received
  l15 = (): number => {
    const ex = this.exchange()
    return (ex?.cashReceived ?? 0) + (ex?.otherPropertyReceived ?? 0)
  }

  // Line 16: FMV of other property given up
  l16 = (): number => this.exchange()?.otherPropertyGiven ?? 0

  // Line 17: Net boot received (line 15 - line 16)
  l17 = (): number => Math.max(0, this.l15() - this.l16())

  // Line 18: Add lines 14 and 17
  l18 = (): number => this.l14() + this.l17()

  // Line 19: Adjusted basis of relinquished property
  l19 = (): number => this.exchange()?.relinquishedAdjustedBasis ?? 0

  // Line 20: Realized gain (line 18 - line 19)
  l20 = (): number => Math.max(0, this.l18() - this.l19())

  // Line 21: Mortgage on relinquished property
  l21 = (): number => this.exchange()?.relinquishedMortgage ?? 0

  // Line 22: Mortgage on replacement property
  l22 = (): number => this.exchange()?.replacementMortgage ?? 0

  // Line 23: Net mortgage relief (line 21 - line 22)
  l23 = (): number => Math.max(0, this.l21() - this.l22())

  // Line 24: Add lines 17 and 23 (total boot)
  l24 = (): number => this.l17() + this.l23()

  // Line 25: Recognized gain (smaller of line 20 or line 24)
  l25 = (): number => {
    const realizedGain = this.l20()
    const totalBoot = this.l24()
    return Math.min(realizedGain, totalBoot)
  }

  // Line 26: Recognized loss (if applicable)
  l26 = (): number => {
    // Like-kind exchange losses are generally not recognized
    return 0
  }

  // Line 27: Deferred gain or loss (line 20 - line 25)
  l27 = (): number => Math.max(0, this.l20() - this.l25())

  // Line 28: Basis of like-kind property received
  l28 = (): number => {
    // Basis = FMV of replacement - Deferred gain
    return this.l12() - this.l27()
  }

  // Amounts for other forms
  recognizedGain = (): number => this.l25()
  deferredGain = (): number => this.l27()
  basisOfNewProperty = (): number => this.l28()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3()?.toLocaleDateString() ?? '',
    this.l4()?.toLocaleDateString() ?? '',
    this.l5()?.toLocaleDateString() ?? '',
    this.l6(),
    this.l7(),
    // Part III
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28()
  ]
}
