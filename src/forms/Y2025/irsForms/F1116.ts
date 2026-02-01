import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 1116 - Foreign Tax Credit (Individual, Estate, or Trust)
 *
 * Used to claim a credit for income taxes paid to a foreign country or U.S. possession.
 * This is an alternative to deducting foreign taxes on Schedule A.
 *
 * Categories of income:
 * - Section 951A (GILTI)
 * - Foreign branch income
 * - Passive category income (most common for individuals)
 * - General category income
 * - Section 901(j) income
 * - Certain income re-sourced by treaty
 * - Lump-sum distributions
 */

export type ForeignTaxCreditCategory =
  | 'passive'
  | 'general'
  | 'section951A'
  | 'foreignBranch'
  | 'section901j'
  | 'treatyResourced'
  | 'lumpSum'

interface DivForm {
  foreignTaxPaid?: number
  foreignSourceIncome?: number
  totalOrdinaryDividends?: number
}

interface IntForm {
  foreignTaxPaid?: number
  foreignSourceIncome?: number
  income?: number
}

export default class F1116 extends F1040Attachment {
  tag: FormTag = 'f1116'
  sequenceIndex = 16

  // Default to passive category (most common for individual investors)
  category: ForeignTaxCreditCategory = 'passive'

  constructor(f1040: F1040, category: ForeignTaxCreditCategory = 'passive') {
    super(f1040)
    this.category = category
  }

  isNeeded = (): boolean => {
    // Need this form if there are foreign taxes paid
    return this.totalForeignTaxesPaid() > 0
  }

  // Get foreign taxes from 1099-DIV and 1099-INT
  totalForeignTaxesPaid = (): number => {
    let from1099Div = 0
    for (const f of this.f1040.f1099Divs()) {
      const form = f.form as DivForm
      from1099Div += form.foreignTaxPaid ?? 0
    }

    let from1099Int = 0
    for (const f of this.f1040.f1099Ints()) {
      const form = f.form as IntForm
      from1099Int += form.foreignTaxPaid ?? 0
    }

    return from1099Div + from1099Int
  }

  // Get foreign source income from 1099-DIV and 1099-INT
  totalForeignSourceIncome = (): number => {
    let from1099Div = 0
    for (const f of this.f1040.f1099Divs()) {
      const form = f.form as DivForm
      from1099Div +=
        form.foreignSourceIncome ?? form.totalOrdinaryDividends ?? 0
    }

    let from1099Int = 0
    for (const f of this.f1040.f1099Ints()) {
      const form = f.form as IntForm
      from1099Int += form.foreignSourceIncome ?? form.income ?? 0
    }

    return from1099Div + from1099Int
  }

  // Part I - Taxable Income or Loss From Sources Outside the United States

  // Line 1a: Gross income from sources within country shown above
  l1a = (): number => this.totalForeignSourceIncome()

  // Line 2: Deductions and losses (simplified - using standard allocation)
  l2 = (): number => 0

  // Line 3a-3f: Pro rata share of deductions
  l3a = (): number => 0 // Certain itemized deductions
  l3b = (): number => 0 // Other deductions
  l3c = (): number => 0 // State and local taxes
  l3d = (): number => 0 // Gross income from all sources
  l3e = (): number => 0 // Gross foreign source income
  l3f = (): number => 0 // Multiply line 3c by result of 3e/3d

  // Line 4: Pro rata share of interest expense
  l4 = (): number => 0

  // Line 5: Losses from foreign sources
  l5 = (): number => 0

  // Line 6: Add lines 2, 3f, 4, and 5
  l6 = (): number => sumFields([this.l2(), this.l3f(), this.l4(), this.l5()])

  // Line 7: Subtract line 6 from line 1a (foreign source taxable income)
  l7 = (): number => Math.max(0, this.l1a() - this.l6())

  // Part II - Foreign Taxes Paid or Accrued

  // Line 8: Taxes withheld at source on dividends
  l8 = (): number => this.totalForeignTaxesPaid()

  // Line 9-16: Other foreign taxes (simplified)
  l9 = (): number => 0
  l10 = (): number => 0
  l11 = (): number => 0
  l12 = (): number => 0
  l13 = (): number => 0
  l14 = (): number => 0
  l15 = (): number => 0
  l16 = (): number => 0

  // Line 17: Add lines 8 through 16
  l17 = (): number =>
    sumFields([
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16()
    ])

  // Line 18: Reduction in foreign taxes (simplified)
  l18 = (): number => 0

  // Line 19: Taxes reclassified (simplified)
  l19 = (): number => 0

  // Line 20: Total foreign taxes (line 17 - 18 + 19)
  l20 = (): number => this.l17() - this.l18() + this.l19()

  // Part III - Figuring the Credit

  // Line 21: Enter amount from line 7 (foreign source taxable income)
  l21 = (): number => this.l7()

  // Line 22: Adjustments to line 21 (simplified)
  l22 = (): number => 0

  // Line 23: Combine lines 21 and 22
  l23 = (): number => this.l21() + this.l22()

  // Line 24: Enter amount from Form 1040 line 15 (taxable income)
  l24 = (): number => this.f1040.l15()

  // Line 25: Divide line 23 by line 24 (foreign income ratio)
  l25 = (): number => {
    if (this.l24() <= 0) return 0
    return Math.min(1, this.l23() / this.l24())
  }

  // Line 26: Enter amount from Form 1040 line 16 (tax before credits)
  l26 = (): number => this.f1040.l16() ?? 0

  // Line 27: Multiply line 26 by line 25 (tentative foreign tax credit limit)
  l27 = (): number => Math.round(this.l26() * this.l25())

  // Line 28: Reduction of credit for international boycott
  l28 = (): number => 0

  // Line 29: Subtract line 28 from line 27
  l29 = (): number => this.l27() - this.l28()

  // Line 30: Enter amount from line 20 (foreign taxes paid)
  l30 = (): number => this.l20()

  // Line 31: Reduction for foreign tax credit splitting
  l31 = (): number => 0

  // Line 32: Combine lines 30 and 31
  l32 = (): number => this.l30() - this.l31()

  // Line 33: Foreign tax credit (smaller of line 29 or 32)
  l33 = (): number => Math.min(this.l29(), this.l32())

  // Credit to Schedule 3, Line 1
  credit = (): number => this.l33()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.category,
    // Part I
    this.l1a(),
    this.l2(),
    this.l3a(),
    this.l3b(),
    this.l3c(),
    this.l3d(),
    this.l3e(),
    this.l3f(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    // Part II
    this.l8(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    // Part III
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33()
  ]
}
