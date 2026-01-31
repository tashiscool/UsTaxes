import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8801 - Credit for Prior Year Minimum Tax - Individuals, Estates, and Trusts
 *
 * If you paid AMT in a prior year on deferral items (like ISO stock exercises),
 * you may be able to claim a credit in the current year against your regular tax.
 *
 * The credit is the lesser of:
 * 1. Your prior year AMT credit carryforward
 * 2. Your current year regular tax minus tentative minimum tax
 */

export default class F8801 extends F1040Attachment {
  tag: FormTag = 'f8801'
  sequenceIndex = 74

  isNeeded = (): boolean => {
    // Need if there's AMT credit from prior years
    return this.priorYearAmtCredit() > 0
  }

  // Prior year AMT credit carryforward
  priorYearAmtCredit = (): number => {
    return this.f1040.info.priorYearAmtCredit ?? 0
  }

  // Part I - Net Minimum Tax on Exclusion Items

  // Line 1: Prior year Form 6251 line 6 (AMT after exemption)
  l1 = (): number => {
    return this.f1040.info.priorYearAmt?.line6 ?? 0
  }

  // Line 2: Exclusion items from prior year
  l2 = (): number => {
    return this.f1040.info.priorYearAmt?.exclusionItems ?? 0
  }

  // Line 3: Prior year minimum tax foreign tax credit
  l3 = (): number => {
    return this.f1040.info.priorYearAmt?.foreignTaxCredit ?? 0
  }

  // Line 4: Net minimum tax on exclusion items (simplified)
  l4 = (): number => Math.max(0, this.l1() - this.l2() - this.l3())

  // Part II - Minimum Tax Credit and Carryforward

  // Line 5: Minimum tax credit from prior year
  l5 = (): number => this.priorYearAmtCredit()

  // Line 6: Carryforward from prior years
  l6 = (): number => {
    return this.f1040.info.priorYearAmtCreditCarryforward ?? 0
  }

  // Line 7: Total available credit (line 5 + line 6)
  l7 = (): number => this.l5() + this.l6()

  // Line 8: Current year regular tax before credits
  l8 = (): number => this.f1040.l16() ?? 0

  // Line 9: Current year tentative minimum tax (Form 6251 line 9)
  l9 = (): number => this.f1040.f6251.l9()

  // Line 10: Subtract line 9 from line 8
  l10 = (): number => Math.max(0, this.l8() - this.l9())

  // Line 11: Other nonrefundable credits
  l11 = (): number => {
    return sumFields([
      this.f1040.schedule3.l1(),
      this.f1040.schedule3.l2(),
      this.f1040.schedule3.l3(),
      this.f1040.schedule3.l4(),
      this.f1040.schedule3.l6l()
    ])
  }

  // Line 12: Subtract line 11 from line 10
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Minimum tax credit for current year (smaller of line 7 or 12)
  l13 = (): number => Math.min(this.l7(), this.l12())

  // Line 14: Credit carryforward to next year (line 7 - line 13)
  l14 = (): number => Math.max(0, this.l7() - this.l13())

  // Credit to Schedule 3, Line 6b
  credit = (): number => this.l13()

  // Carryforward to next year
  carryforward = (): number => this.l14()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    // Part II
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14()
  ]
}
