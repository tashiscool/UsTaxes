import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8810 - Corporate Passive Activity Loss and Credit Limitations
 *
 * Used by personal service corporations (PSCs) and closely held corporations
 * to calculate the passive activity loss and credit limitations.
 *
 * Applies to:
 * - Personal Service Corporations (PSCs) - owned by employee-owners
 * - Closely Held Corporations - 5 or fewer individuals own >50% of stock
 *
 * Key rules:
 * - PSCs: Passive losses can only offset passive income
 * - Closely Held: Passive losses can offset active income but not portfolio income
 * - Similar to Form 8582 for individuals
 *
 * Note: This form is typically used by corporations, not individuals.
 * Including for completeness as it appears in the passive activity category.
 */

export type CorporationType = 'psc' | 'closelyHeld'

export interface CorporatePassiveActivity {
  activityName: string
  activityType: 'rental' | 'trade' | 'other'
  grossIncome: number
  deductions: number
  netIncome: number  // Can be negative (loss)
  priorYearUnallowed: number
  materiallyParticipates: boolean
}

export interface CorporatePassiveInfo {
  corporationType: CorporationType
  ein: string
  fiscalYearEnd: string
  passiveActivities: CorporatePassiveActivity[]
  netActiveIncome: number
  portfolioIncome: number
}

export default class F8810 extends F1040Attachment {
  tag: FormTag = 'f8810'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCorporatePassiveActivities()
  }

  hasCorporatePassiveActivities = (): boolean => {
    const info = this.corporatePassiveInfo()
    return info !== undefined && info.passiveActivities.length > 0
  }

  corporatePassiveInfo = (): CorporatePassiveInfo | undefined => {
    return this.f1040.info.corporatePassiveInfo as CorporatePassiveInfo | undefined
  }

  activities = (): CorporatePassiveActivity[] => {
    return this.corporatePassiveInfo()?.passiveActivities ?? []
  }

  isPsc = (): boolean => {
    return this.corporatePassiveInfo()?.corporationType === 'psc'
  }

  isCloselyHeld = (): boolean => {
    return this.corporatePassiveInfo()?.corporationType === 'closelyHeld'
  }

  // Part I - Passive Activity Loss

  // Total passive income
  totalPassiveIncome = (): number => {
    return this.activities()
      .filter(a => a.netIncome > 0)
      .reduce((sum, a) => sum + a.netIncome, 0)
  }

  // Total passive losses (current year)
  totalPassiveLosses = (): number => {
    return this.activities()
      .filter(a => a.netIncome < 0)
      .reduce((sum, a) => sum + Math.abs(a.netIncome), 0)
  }

  // Prior year unallowed losses
  priorYearUnallowed = (): number => {
    return this.activities()
      .reduce((sum, a) => sum + a.priorYearUnallowed, 0)
  }

  // Line 1a: Current year passive income
  l1a = (): number => this.totalPassiveIncome()

  // Line 1b: Prior year unallowed losses
  l1b = (): number => this.priorYearUnallowed()

  // Line 1c: Current year passive losses
  l1c = (): number => this.totalPassiveLosses()

  // Line 1d: Combine lines 1a, 1b, and 1c
  l1d = (): number => this.l1a() - this.l1b() - this.l1c()

  // Line 2: Net passive loss (if line 1d is negative)
  l2 = (): number => this.l1d() < 0 ? Math.abs(this.l1d()) : 0

  // Part II - Closely Held Corporation Special Rules

  // Line 3: Net active income (for closely held corporations)
  l3 = (): number => {
    if (!this.isCloselyHeld()) return 0
    return this.corporatePassiveInfo()?.netActiveIncome ?? 0
  }

  // Line 4: Enter smaller of line 2 or line 3
  l4 = (): number => {
    if (!this.isCloselyHeld()) return 0
    return Math.min(this.l2(), this.l3())
  }

  // Line 5: Passive loss allowed against active income (for closely held)
  l5 = (): number => this.l4()

  // Part III - Total Allowed and Disallowed

  // Line 6: Allowed passive activity loss
  l6 = (): number => {
    if (this.isPsc()) {
      // PSCs can only offset passive income with passive losses
      return Math.min(this.totalPassiveLosses() + this.priorYearUnallowed(), this.l1a())
    } else {
      // Closely held can also offset active income
      return Math.min(this.totalPassiveLosses() + this.priorYearUnallowed(), this.l1a() + this.l3())
    }
  }

  // Line 7: Disallowed passive activity loss (to carry forward)
  l7 = (): number => {
    const totalLosses = this.totalPassiveLosses() + this.priorYearUnallowed()
    return Math.max(0, totalLosses - this.l6())
  }

  // Part IV - Passive Activity Credit

  // Line 8: Passive activity credits (current and prior year)
  l8 = (): number => {
    // Would need to track passive credits separately
    return 0
  }

  // Line 9: Tax attributable to passive income
  l9 = (): number => {
    // Simplified calculation
    return Math.round(this.l1a() * 0.21)  // Corporate tax rate
  }

  // Line 10: Allowed passive credits (smaller of line 8 or line 9)
  l10 = (): number => Math.min(this.l8(), this.l9())

  // Line 11: Disallowed passive credits (to carry forward)
  l11 = (): number => Math.max(0, this.l8() - this.l10())

  // Summary methods

  // Allowed loss deduction
  allowedLoss = (): number => this.l6()

  // Disallowed loss carryforward
  disallowedLoss = (): number => this.l7()

  // Allowed credit
  allowedCredit = (): number => this.l10()

  // Disallowed credit carryforward
  disallowedCredit = (): number => this.l11()

  fields = (): Field[] => {
    const info = this.corporatePassiveInfo()

    return [
      this.f1040.namesString(),
      info?.ein ?? '',
      // Corporation type
      this.isPsc(),
      this.isCloselyHeld(),
      // Part I
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l2(),
      // Part II
      this.l3(),
      this.l4(),
      this.l5(),
      // Part III
      this.l6(),
      this.l7(),
      // Part IV
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11()
    ]
  }
}
