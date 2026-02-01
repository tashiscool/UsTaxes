import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8845Data } from 'ustaxes/core/data'

/**
 * Form 8845 - Indian Employment Credit
 *
 * Credit for employers who employ enrolled members of Indian tribes
 * or their spouses who live on or near an Indian reservation.
 *
 * Credit calculation:
 * - 20% of excess qualified wages and health insurance costs
 * - "Excess" = amounts over prior year amounts
 * - Maximum qualified amounts: $20,000 per employee per year
 *
 * Requirements:
 * - Employee must be enrolled member of Indian tribe (or spouse)
 * - Work and residence must be on or near a reservation
 * - Cannot include relatives of employer or 5%+ owners
 *
 * Qualified wages include:
 * - Wages and salaries
 * - Health insurance costs paid by employer
 */

// 2025 parameters
const indianEmploymentParams = {
  maxAmountPerEmployee: 20000,
  creditRate: 0.2
}

export default class F8845 extends F1040Attachment {
  tag: FormTag = 'f8845'
  sequenceIndex = 112

  isNeeded = (): boolean => {
    return this.hasIndianEmploymentCredit()
  }

  hasIndianEmploymentCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.qualifiedEmployees.length > 0
  }

  creditData = (): Form8845Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Current Year Credit

  // Line 1: Total qualified wages and health insurance costs
  l1 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce(
      (sum, e) =>
        sum +
        Math.min(
          e.totalQualifiedAmount,
          indianEmploymentParams.maxAmountPerEmployee
        ),
      0
    )
  }

  // Line 2: Prior year amounts for same employees
  l2 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce(
      (sum, e) => sum + e.priorYearAmount,
      0
    )
  }

  // Line 3: Incremental increase (line 1 minus line 2)
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Multiply line 3 by 20%
  l4 = (): number => Math.round(this.l3() * indianEmploymentParams.creditRate)

  // Line 5: Indian employment credit from partnerships, S corps, etc.
  l5 = (): number => this.creditData()?.passthrough8845Credit ?? 0

  // Line 6: Add lines 4 and 5 (total credit)
  l6 = (): number => this.l4() + this.l5()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l6()

  // Number of qualified employees
  qualifiedEmployeeCount = (): number =>
    this.creditData()?.qualifiedEmployees.length ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.qualifiedEmployeeCount()
  ]
}
