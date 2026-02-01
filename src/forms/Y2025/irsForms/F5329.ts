import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { PersonRole } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 5329 - Additional Taxes on Qualified Plans (Including IRAs) and Other Tax-Favored Accounts
 *
 * Used to report:
 * - 10% early withdrawal penalty (before age 59½)
 * - 25% penalty on SIMPLE IRA early withdrawals (within 2 years)
 * - Excess contributions to IRAs, HSAs, ESAs, MSAs
 * - Required minimum distribution (RMD) failures
 */

interface F1099RForm {
  personRole?: PersonRole
  distributionCode?: string
  taxableAmount?: number
}

export default class F5329 extends F1040Attachment {
  tag: FormTag = 'f5329'
  sequenceIndex = 29

  personRole: PersonRole = PersonRole.PRIMARY

  constructor(f1040: F1040, personRole: PersonRole = PersonRole.PRIMARY) {
    super(f1040)
    this.personRole = personRole
  }

  isNeeded = (): boolean => {
    return (
      this.hasEarlyDistributions() ||
      this.hasExcessContributions() ||
      this.hasRmdFailure()
    )
  }

  hasEarlyDistributions = (): boolean => {
    const f1099rs = this.f1040.f1099rs()
    for (const f of f1099rs) {
      const form = f.form as F1099RForm
      if (
        form.personRole === this.personRole &&
        form.distributionCode === '1'
      ) {
        return true
      }
    }
    return false
  }

  hasExcessContributions = (): boolean => {
    return (
      this.excessIraContributions() > 0 ||
      this.excessHsaContributions() > 0 ||
      this.excessEsaContributions() > 0
    )
  }

  hasRmdFailure = (): boolean => {
    return this.l54() > 0
  }

  // Part I - Additional Tax on Early Distributions

  // Line 1: Early distributions included in income
  l1 = (): number => {
    let total = 0
    for (const f of this.f1040.f1099rs()) {
      const form = f.form as F1099RForm
      if (
        form.personRole === this.personRole &&
        form.distributionCode === '1'
      ) {
        total += form.taxableAmount ?? 0
      }
    }
    return total
  }

  // Line 2: Distributions excepted from additional tax
  l2 = (): number => {
    // Exceptions: death, disability, medical expenses, etc.
    // Sum all exception amounts
    const exceptions = this.f1040.info.earlyDistributionExceptions ?? []
    return exceptions.reduce(
      (sum: number, e: { amount: number }) => sum + e.amount,
      0
    )
  }

  // Line 3: Amount subject to additional tax (line 1 - line 2)
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Additional tax (line 3 × 10%)
  l4 = (): number => Math.round(this.l3() * 0.1)

  // Part II - Additional Tax on Certain Distributions from Education Accounts

  // Line 5: Distributions from Coverdell ESAs and QTPs not used for education
  l5 = (): number => 0

  // Line 6: Additional tax (line 5 × 10%)
  l6 = (): number => Math.round(this.l5() * 0.1)

  // Part III - Additional Tax on Excess Contributions to Traditional IRAs

  excessIraContributions = (): number => {
    return this.f1040.info.excessIraContributions ?? 0
  }

  // Line 17: Excess contributions for current year
  l17 = (): number => this.excessIraContributions()

  // Line 18: Prior year excess contributions still in IRA
  l18 = (): number => 0

  // Line 19: Contribution credit
  l19 = (): number => 0

  // Line 20: Distributions included in income
  l20 = (): number => 0

  // Line 21: Total excess contributions subject to tax
  l21 = (): number =>
    Math.max(0, this.l17() + this.l18() - this.l19() - this.l20())

  // Line 22: Additional tax on excess contributions (line 21 × 6%)
  l22 = (): number => Math.round(this.l21() * 0.06)

  // Part IV - Additional Tax on Excess Contributions to Roth IRAs

  // Lines 23-28 mirror Part III for Roth IRAs
  l23 = (): number => this.f1040.info.excessRothContributions ?? 0
  l24 = (): number => 0
  l25 = (): number => 0
  l26 = (): number => 0
  l27 = (): number =>
    Math.max(0, this.l23() + this.l24() - this.l25() - this.l26())
  l28 = (): number => Math.round(this.l27() * 0.06)

  // Part V - Additional Tax on Excess Contributions to Coverdell ESAs

  excessEsaContributions = (): number => {
    return this.f1040.info.excessEsaContributions ?? 0
  }

  l29 = (): number => this.excessEsaContributions()
  l30 = (): number => 0
  l31 = (): number => 0
  l32 = (): number => 0
  l33 = (): number =>
    Math.max(0, this.l29() + this.l30() - this.l31() - this.l32())
  l34 = (): number => Math.round(this.l33() * 0.06)

  // Part VI - Additional Tax on Excess Contributions to HSAs

  excessHsaContributions = (): number => {
    return this.f1040.info.excessHsaContributions ?? 0
  }

  l41 = (): number => this.excessHsaContributions()
  l42 = (): number => 0
  l43 = (): number => 0
  l44 = (): number => 0
  l45 = (): number =>
    Math.max(0, this.l41() + this.l42() - this.l43() - this.l44())
  l46 = (): number => Math.round(this.l45() * 0.06)

  // Part IX - Additional Tax on Excess Accumulation in Qualified Retirement Plans (RMD)

  // Line 54: Amount of RMD shortfall
  l54 = (): number => {
    const rmd = this.f1040.info.rmdShortfall
    if (!rmd) return 0
    return Math.max(0, rmd.requiredAmount - rmd.actualDistribution)
  }

  // Line 55: Additional tax (line 54 × 25%)
  // Note: Can be reduced to 10% if corrected timely
  l55 = (): number => Math.round(this.l54() * 0.25)

  // Total additional tax (goes to Schedule 2)
  totalAdditionalTax = (): number => {
    return sumFields([
      this.l4(), // Early distribution penalty
      this.l6(), // ESA/QTP penalty
      this.l22(), // Excess traditional IRA
      this.l28(), // Excess Roth IRA
      this.l34(), // Excess ESA
      this.l46(), // Excess HSA
      this.l55() // RMD penalty
    ])
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.personRole === PersonRole.SPOUSE,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    // Part II
    this.l5(),
    this.l6(),
    // Part III
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    // Part IV
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    // Part V
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33(),
    this.l34(),
    // Part VI
    this.l41(),
    this.l42(),
    this.l43(),
    this.l44(),
    this.l45(),
    this.l46(),
    // Part IX
    this.l54(),
    this.l55(),
    this.totalAdditionalTax()
  ]
}
