import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { PersonRole } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8606 - Nondeductible IRAs
 *
 * Use this form to report:
 * - Nondeductible contributions to traditional IRAs
 * - Distributions from traditional, SEP, or SIMPLE IRAs if you have basis
 * - Conversions from traditional, SEP, or SIMPLE IRAs to Roth IRAs
 * - Distributions from Roth IRAs
 *
 * This is essential for backdoor Roth IRA conversions.
 */

interface IraContribution {
  personRole?: PersonRole
  nondeductible?: boolean
  amount?: number
}

interface RothConversion {
  personRole?: PersonRole
  amount?: number
}

interface RothDistribution {
  personRole?: PersonRole
  qualified?: boolean
  amount?: number
}

interface F1099RForm {
  personRole?: PersonRole
  grossDistribution?: number
}

export default class F8606 extends F1040Attachment {
  tag: FormTag = 'f8606'
  sequenceIndex = 48

  personRole: PersonRole = PersonRole.PRIMARY

  constructor(f1040: F1040, personRole: PersonRole = PersonRole.PRIMARY) {
    super(f1040)
    this.personRole = personRole
  }

  isNeeded = (): boolean => {
    // Need if there are nondeductible IRA contributions or conversions
    return (
      this.hasNondeductibleContributions() ||
      this.hasConversions() ||
      this.hasDistributionsWithBasis()
    )
  }

  hasNondeductibleContributions = (): boolean => {
    const contributions = (this.f1040.info.iraContributions ??
      []) as IraContribution[]
    return contributions.some(
      (c) => c.personRole === this.personRole && c.nondeductible
    )
  }

  hasConversions = (): boolean => {
    const conversions = (this.f1040.info.rothConversions ??
      []) as RothConversion[]
    return conversions.some((c) => c.personRole === this.personRole)
  }

  hasDistributionsWithBasis = (): boolean => {
    if (this.l2() <= 0) return false
    for (const f of this.f1040.f1099rs()) {
      const form = f.form as F1099RForm
      if (form.personRole === this.personRole) return true
    }
    return false
  }

  // Part I - Nondeductible Contributions to Traditional IRAs and Distributions

  // Line 1: Nondeductible contributions made for current year
  l1 = (): number => {
    const contributions = (this.f1040.info.iraContributions ??
      []) as IraContribution[]
    let total = 0
    for (const c of contributions) {
      if (c.personRole === this.personRole && c.nondeductible) {
        total += c.amount ?? 0
      }
    }
    return total
  }

  // Line 2: Total basis in traditional IRAs (from prior years)
  l2 = (): number => {
    return this.f1040.info.traditionalIraBasis ?? 0
  }

  // Line 3: Add lines 1 and 2
  l3 = (): number => this.l1() + this.l2()

  // Line 4: Contributions for current year made in current year + 1 (before due date)
  l4 = (): number => 0

  // Line 5: Subtract line 4 from line 3
  l5 = (): number => this.l3() - this.l4()

  // Line 6: Value of all traditional, SEP, and SIMPLE IRAs at end of year
  l6 = (): number => {
    return this.f1040.info.iraEndOfYearValue ?? 0
  }

  // Line 7: Distributions from traditional, SEP, and SIMPLE IRAs
  l7 = (): number => {
    let total = 0
    for (const f of this.f1040.f1099rs()) {
      const form = f.form as F1099RForm
      if (form.personRole === this.personRole) {
        total += form.grossDistribution ?? 0
      }
    }
    return total
  }

  // Line 8: Outstanding rollovers
  l8 = (): number => 0

  // Line 9: Conversions to Roth IRA
  l9 = (): number => {
    const conversions = (this.f1040.info.rothConversions ??
      []) as RothConversion[]
    let total = 0
    for (const c of conversions) {
      if (c.personRole === this.personRole) {
        total += c.amount ?? 0
      }
    }
    return total
  }

  // Line 10: Add lines 6, 7, 8, and 9
  l10 = (): number => this.l6() + this.l7() + this.l8() + this.l9()

  // Line 11: Divide line 5 by line 10 (nontaxable percentage)
  l11 = (): number => {
    if (this.l10() <= 0) return 0
    return Math.min(1, this.l5() / this.l10())
  }

  // Line 12: Multiply line 8 by line 11 (nontaxable portion of rollovers)
  l12 = (): number => Math.round(this.l8() * this.l11())

  // Line 13: Multiply line 9 by line 11 (nontaxable portion of conversions)
  l13 = (): number => Math.round(this.l9() * this.l11())

  // Line 14: Add lines 12 and 13
  l14 = (): number => this.l12() + this.l13()

  // Line 15: Subtract line 14 from line 3 (basis remaining)
  l15 = (): number => Math.max(0, this.l3() - this.l14())

  // Line 15a: Taxable amount (goes to Form 1040 line 4b if applicable)
  l15a = (): number => {
    const distributions = this.l7()
    const nontaxablePortion = Math.round(distributions * this.l11())
    return Math.max(0, distributions - nontaxablePortion)
  }

  // Part II - Conversions From Traditional, SEP, or SIMPLE IRAs to Roth IRAs

  // Line 16: Amount converted (from line 9)
  l16 = (): number => this.l9()

  // Line 17: Nontaxable portion (from line 13)
  l17 = (): number => this.l13()

  // Line 18: Taxable amount of conversion (line 16 - line 17)
  l18 = (): number => Math.max(0, this.l16() - this.l17())

  // Part III - Distributions From Roth IRAs

  // Line 19: Total nonqualified distributions from Roth IRAs
  l19 = (): number => {
    const rothDistributions = (this.f1040.info.rothDistributions ??
      []) as RothDistribution[]
    let total = 0
    for (const d of rothDistributions) {
      if (d.personRole === this.personRole && !d.qualified) {
        total += d.amount ?? 0
      }
    }
    return total
  }

  // Line 20: Qualified first-time homebuyer distributions
  l20 = (): number => 0

  // Line 21: Subtract line 20 from line 19
  l21 = (): number => Math.max(0, this.l19() - this.l20())

  // Line 22: Roth IRA contributions basis
  l22 = (): number => {
    return this.f1040.info.rothIraBasis ?? 0
  }

  // Line 23: Subtract line 22 from line 21
  l23 = (): number => Math.max(0, this.l21() - this.l22())

  // Line 24: Taxable conversion amounts included in prior distributions
  l24 = (): number => 0

  // Line 25: Taxable amount from Roth distributions
  l25 = (): number => Math.max(0, this.l23() - this.l24())

  // Total taxable amount for Form 1040
  taxableAmount = (): number => this.l15a() + this.l18() + this.l25()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.personRole === PersonRole.SPOUSE,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
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
    this.l15(),
    this.l15a(),
    // Part II
    this.l16(),
    this.l17(),
    this.l18(),
    // Part III
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25()
  ]
}
