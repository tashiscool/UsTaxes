import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8582-CR - Passive Activity Credit Limitations
 *
 * Companion form to Form 8582. Used to figure the amount of passive
 * activity credits that are allowed for the current year.
 *
 * Passive activity credits include:
 * - Low-income housing credit (Form 8586)
 * - Rehabilitation credit (Form 3468)
 * - Foreign tax credit from passive activities (Form 1116)
 * - Other business credits from passive activities (Form 3800)
 *
 * 2025 Rules:
 * - Credits from passive activities can only offset tax from passive income
 * - Similar to Form 8582, but for credits instead of losses
 * - Special allowance for rental real estate with active participation
 * - Disallowed credits carry forward
 */

export interface PassiveActivityCredit {
  activityName: string
  activityType: 'rentalRealEstate' | 'otherRental' | 'otherPassive'
  creditType:
    | 'lowIncomeHousing'
    | 'rehabilitation'
    | 'foreignTax'
    | 'otherBusiness'
  currentYearCredit: number
  priorYearUnallowed: number
  activeParticipation: boolean // For $25,000 special allowance
}

export default class F8582CR extends F1040Attachment {
  tag: FormTag = 'f8582cr'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasPassiveActivityCredits()
  }

  hasPassiveActivityCredits = (): boolean => {
    return this.passiveActivityCredits().length > 0
  }

  passiveActivityCredits = (): PassiveActivityCredit[] => {
    return (
      (this.f1040.info.passiveActivityCredits as
        | PassiveActivityCredit[]
        | undefined) ?? []
    )
  }

  // Part I - Passive Activity Credits

  // Credits from rental real estate with active participation (special allowance)
  rentalRealEstateCredits = (): PassiveActivityCredit[] => {
    return this.passiveActivityCredits().filter(
      (c) => c.activityType === 'rentalRealEstate' && c.activeParticipation
    )
  }

  // All other passive activity credits
  otherPassiveCredits = (): PassiveActivityCredit[] => {
    return this.passiveActivityCredits().filter(
      (c) => c.activityType !== 'rentalRealEstate' || !c.activeParticipation
    )
  }

  // Line 1a: Credits from Worksheet 1 (rental real estate with active participation)
  l1a = (): number => {
    return this.rentalRealEstateCredits().reduce(
      (sum, c) => sum + c.currentYearCredit + c.priorYearUnallowed,
      0
    )
  }

  // Line 1b: Credits from Worksheet 2 (all other passive activities)
  l1b = (): number => {
    return this.otherPassiveCredits().reduce(
      (sum, c) => sum + c.currentYearCredit + c.priorYearUnallowed,
      0
    )
  }

  // Line 1c: Add lines 1a and 1b
  l1c = (): number => this.l1a() + this.l1b()

  // Line 2: Tax attributable to net passive income
  l2 = (): number => {
    // This would come from Form 8582 passive income
    const f8582 = this.f1040.f8582 as
      | { netPassiveIncome?: () => number }
      | undefined
    const passiveIncome = f8582?.netPassiveIncome?.() ?? 0
    // Calculate tax on passive income (simplified)
    return Math.round(passiveIncome * 0.22) // Approximate marginal rate
  }

  // Line 3: Enter the smaller of line 1c or line 2
  l3 = (): number => Math.min(this.l1c(), this.l2())

  // Part II - Special Allowance for Rental Real Estate

  // Line 4: Enter amount from line 1a
  l4 = (): number => this.l1a()

  // Line 5: Enter amount from line 3
  l5 = (): number => this.l3()

  // Line 6: Subtract line 5 from line 4
  l6 = (): number => Math.max(0, this.l4() - this.l5())

  // Line 7: Modified AGI (from Form 8582)
  l7 = (): number => {
    const f8582 = this.f1040.f8582 as { modifiedAgi?: () => number } | undefined
    return f8582?.modifiedAgi?.() ?? this.f1040.l11()
  }

  // Line 8: $150,000 threshold
  l8 = (): number => 150000

  // Line 9: Subtract line 7 from line 8
  l9 = (): number => Math.max(0, this.l8() - this.l7())

  // Line 10: Multiply line 9 by 50%
  l10 = (): number => Math.round(this.l9() * 0.5)

  // Line 11: Enter the smaller of line 6 or line 10
  l11 = (): number => Math.min(this.l6(), this.l10())

  // Line 12: Enter amount from Form 8582 line 10 (special allowance used for losses)
  l12 = (): number => {
    const f8582 = this.f1040.f8582 as
      | { specialAllowanceUsed?: () => number }
      | undefined
    return f8582?.specialAllowanceUsed?.() ?? 0
  }

  // Line 13: Subtract line 12 from line 10
  l13 = (): number => Math.max(0, this.l10() - this.l12())

  // Line 14: Enter smaller of line 11 or line 13
  l14 = (): number => Math.min(this.l11(), this.l13())

  // Part III - Passive Activity Credit Allowed

  // Line 35: Enter credits from line 3
  l35 = (): number => this.l3()

  // Line 36: Enter special allowance from line 14
  l36 = (): number => this.l14()

  // Line 37: Add lines 35 and 36 (total allowed credit)
  l37 = (): number => this.l35() + this.l36()

  // Summary methods

  // Total allowed passive activity credits
  allowedCredit = (): number => this.l37()

  // Disallowed credits to carry forward
  disallowedCarryforward = (): number => Math.max(0, this.l1c() - this.l37())

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l2(),
    this.l3(),
    // Part II
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    // Part III
    this.l35(),
    this.l36(),
    this.l37()
  ]
}
