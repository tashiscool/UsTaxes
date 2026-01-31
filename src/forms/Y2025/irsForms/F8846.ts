import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8846Data } from 'ustaxes/core/data'

/**
 * Form 8846 - Credit for Employer Social Security and Medicare
 *             Taxes Paid on Certain Employee Tips
 *
 * Credit for food and beverage establishments for employer portion
 * of FICA taxes paid on tips that exceed federal minimum wage.
 *
 * Credit calculation:
 * - Employer's share of SS and Medicare tax (7.65%)
 * - Only on tips received for food/beverage serving
 * - Only on "excess" tips (tips that don't bring wages up to minimum wage)
 *
 * Who qualifies:
 * - Employers operating food/beverage establishments
 * - Where tipping is customary
 * - Employees who receive tips for serving food/beverages
 *
 * This credit helps offset the employer's tax burden on employee tips
 * that don't actually increase the employer's labor costs.
 */

// 2025 parameters
const tipCreditParams = {
  employerFicaRate: 0.0765,  // 7.65% (6.2% SS + 1.45% Medicare)
  minimumWage: 7.25          // Federal minimum wage
}

export default class F8846 extends F1040Attachment {
  tag: FormTag = 'f8846'
  sequenceIndex = 98

  isNeeded = (): boolean => {
    return this.hasTipTaxCredit()
  }

  hasTipTaxCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.tippedEmployees.length > 0
  }

  creditData = (): Form8846Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Current Year Credit

  // Line 1: Tips received by employees for food/beverage serving
  l1 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.tippedEmployees.reduce((sum, e) => sum + e.totalTips, 0)
  }

  // Line 2: Tips not subject to credit (tips that brought wages to minimum)
  l2 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.tippedEmployees.reduce((sum, e) => sum + e.tipsAboveMinWage, 0)
  }

  // Line 3: Creditable tips (line 1 minus line 2)
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Multiply line 3 by employer FICA rate (7.65%)
  l4 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.tippedEmployees.reduce((sum, e) => sum + e.ssAndMedicareTax, 0)
  }

  // Line 5: Credit from partnerships, S corps, estates, trusts
  l5 = (): number => this.creditData()?.passthrough8846Credit ?? 0

  // Line 6: Add lines 4 and 5 (total credit)
  l6 = (): number => this.l4() + this.l5()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l6()

  // Number of tipped employees
  numberOfEmployees = (): number => this.creditData()?.tippedEmployees.length ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.numberOfEmployees()
  ]
}
