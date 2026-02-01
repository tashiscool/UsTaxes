import F1040Attachment from './F1040Attachment'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8880 - Credit for Qualified Retirement Savings Contributions (Saver's Credit)
 *
 * This credit helps low-to-moderate income workers save for retirement.
 * Credit rates: 50%, 20%, or 10% based on AGI
 * Maximum contribution eligible: $2,000 per person ($4,000 MFJ)
 * Maximum credit: $1,000 per person ($2,000 MFJ)
 */

// 2025 AGI limits from IRS Notice 2024-80
const saversCredit = {
  // Maximum contribution eligible for credit per person
  maxContribution: 2000,

  // AGI limits for 50% credit rate
  fiftyPercentLimit: {
    [FilingStatus.MFJ]: 47500,
    [FilingStatus.HOH]: 35625,
    [FilingStatus.S]: 23750,
    [FilingStatus.MFS]: 23750,
    [FilingStatus.W]: 47500
  },

  // AGI limits for 20% credit rate
  twentyPercentLimit: {
    [FilingStatus.MFJ]: 51000,
    [FilingStatus.HOH]: 38250,
    [FilingStatus.S]: 25500,
    [FilingStatus.MFS]: 25500,
    [FilingStatus.W]: 51000
  },

  // AGI limits for 10% credit rate (max income)
  tenPercentLimit: {
    [FilingStatus.MFJ]: 79000,
    [FilingStatus.HOH]: 59250,
    [FilingStatus.S]: 39500,
    [FilingStatus.MFS]: 39500,
    [FilingStatus.W]: 79000
  }
}

export default class F8880 extends F1040Attachment {
  tag: FormTag = 'f8880'
  sequenceIndex = 54

  isNeeded = (): boolean => {
    // Need this form if there are qualifying retirement contributions
    // and AGI is within limits
    return this.eligible() && this.l12() > 0
  }

  eligible = (): boolean => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const agi = this.f1040.l11()
    const limit = saversCredit.tenPercentLimit[fs]

    // Must be 18+, not a full-time student, and not claimed as dependent
    // These checks are simplified - in practice need more verification
    const notDependent =
      !this.f1040.info.taxPayer.primaryPerson.isTaxpayerDependent

    return agi <= limit && notDependent
  }

  // Get credit rate multiplier based on AGI
  creditRate = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const agi = this.f1040.l11()

    if (agi <= saversCredit.fiftyPercentLimit[fs]) {
      return 0.5
    } else if (agi <= saversCredit.twentyPercentLimit[fs]) {
      return 0.2
    } else if (agi <= saversCredit.tenPercentLimit[fs]) {
      return 0.1
    }
    return 0
  }

  // Line 1: Traditional and Roth IRA contributions (you)
  // Get from Form 5498 or self-reported
  l1a = (): number => {
    const contributions = this.f1040.info.iraContributions ?? []
    return contributions
      .filter((c) => c.personRole === PersonRole.PRIMARY)
      .reduce(
        (sum, c) => sum + c.traditionalContributions + c.rothContributions,
        0
      )
  }

  // Line 1b: Traditional and Roth IRA contributions (spouse)
  l1b = (): number => {
    if (this.f1040.info.taxPayer.filingStatus !== FilingStatus.MFJ) return 0
    const contributions = this.f1040.info.iraContributions ?? []
    return contributions
      .filter((c) => c.personRole === PersonRole.SPOUSE)
      .reduce(
        (sum, c) => sum + c.traditionalContributions + c.rothContributions,
        0
      )
  }

  // Line 2a: Elective deferrals from W-2 box 12 (you)
  // Codes D, E, F, G, S, AA, BB, EE
  l2a = (): number => {
    return this.f1040
      .validW2s()
      .filter((w2) => w2.personRole === PersonRole.PRIMARY)
      .reduce((sum, w2) => {
        // Sum box 12 codes for retirement contributions
        // W2Box12Info is an object with code keys, not an array
        const box12 = w2.box12 ?? {}
        const retirementTotal =
          (box12.D ?? 0) +
          (box12.E ?? 0) +
          (box12.F ?? 0) +
          (box12.G ?? 0) +
          (box12.S ?? 0) +
          (box12.AA ?? 0) +
          (box12.BB ?? 0) +
          (box12.EE ?? 0)
        return sum + retirementTotal
      }, 0)
  }

  // Line 2b: Elective deferrals (spouse)
  l2b = (): number => {
    if (this.f1040.info.taxPayer.filingStatus !== FilingStatus.MFJ) return 0
    return this.f1040
      .validW2s()
      .filter((w2) => w2.personRole === PersonRole.SPOUSE)
      .reduce((sum, w2) => {
        const box12 = w2.box12 ?? {}
        const retirementTotal =
          (box12.D ?? 0) +
          (box12.E ?? 0) +
          (box12.F ?? 0) +
          (box12.G ?? 0) +
          (box12.S ?? 0) +
          (box12.AA ?? 0) +
          (box12.BB ?? 0) +
          (box12.EE ?? 0)
        return sum + retirementTotal
      }, 0)
  }

  // Line 3a: Add lines 1a and 2a (you)
  l3a = (): number => this.l1a() + this.l2a()

  // Line 3b: Add lines 1b and 2b (spouse)
  l3b = (): number => this.l1b() + this.l2b()

  // Line 4: Certain distributions received after 2021 and before the due date
  // From Form 1099-R (simplified - uses current year distributions)
  l4a = (): number => {
    return this.f1040
      .f1099rs()
      .filter((f) => f.personRole === PersonRole.PRIMARY)
      .reduce((sum, f) => sum + f.form.grossDistribution, 0)
  }

  l4b = (): number => {
    if (this.f1040.info.taxPayer.filingStatus !== FilingStatus.MFJ) return 0
    return this.f1040
      .f1099rs()
      .filter((f) => f.personRole === PersonRole.SPOUSE)
      .reduce((sum, f) => sum + f.form.grossDistribution, 0)
  }

  // Line 5a: Subtract line 4a from line 3a (you)
  l5a = (): number => Math.max(0, this.l3a() - this.l4a())

  // Line 5b: Subtract line 4b from line 3b (spouse)
  l5b = (): number => Math.max(0, this.l3b() - this.l4b())

  // Line 6a: Enter the smaller of line 5a or $2,000 (you)
  l6a = (): number => Math.min(this.l5a(), saversCredit.maxContribution)

  // Line 6b: Enter the smaller of line 5b or $2,000 (spouse)
  l6b = (): number => Math.min(this.l5b(), saversCredit.maxContribution)

  // Line 7: Add lines 6a and 6b
  l7 = (): number => this.l6a() + this.l6b()

  // Line 8: Enter the amount from Form 1040, line 11 (AGI)
  l8 = (): number => this.f1040.l11()

  // Line 9: Enter applicable decimal amount from table
  l9 = (): number => this.creditRate()

  // Line 10: Multiply line 7 by line 9
  l10 = (): number => Math.round(this.l7() * this.l9())

  // Line 11: Credit limit based on tax liability (Credit Limit Worksheet)
  l11 = (): number => {
    const taxLiability = this.f1040.l18()

    // Subtract other nonrefundable credits
    const otherCredits = sumFields([
      this.f1040.schedule3.l1(),
      this.f1040.schedule3.l2(),
      this.f1040.schedule3.l3(),
      // Don't include Saver's Credit (this form)
      this.f1040.schedule3.l6l()
    ])

    return Math.max(0, taxLiability - otherCredits)
  }

  // Line 12: Credit (smaller of line 10 or line 11)
  l12 = (): number => {
    if (!this.eligible()) return 0
    return Math.min(this.l10(), this.l11())
  }

  // This goes to Schedule 3, Line 4
  credit = (): number => this.l12()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1a(),
    this.l1b(),
    this.l2a(),
    this.l2b(),
    this.l3a(),
    this.l3b(),
    this.l4a(),
    this.l4b(),
    this.l5a(),
    this.l5b(),
    this.l6a(),
    this.l6b(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12()
  ]
}
