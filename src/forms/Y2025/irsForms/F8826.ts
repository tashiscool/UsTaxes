import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8826Data } from 'ustaxes/core/data'

/**
 * Form 8826 - Disabled Access Credit
 *
 * Credit for eligible small businesses that pay or incur expenses
 * to provide access to persons with disabilities.
 *
 * Eligible small business:
 * - Gross receipts ≤ $1,000,000 for prior year, OR
 * - ≤ 30 full-time employees during prior year
 *
 * Credit calculation:
 * - 50% of eligible expenses between $250 and $10,250
 * - Maximum credit: $5,000 per year
 *
 * Eligible expenses include:
 * - Removing barriers (architectural, transportation)
 * - Providing qualified interpreters or readers
 * - Acquiring adaptive equipment
 * - Providing qualified readers/interpreters for customers
 */

// 2025 parameters
const disabledAccessParams = {
  minimumExpenditure: 250,    // First $250 not eligible
  maximumExpenditure: 10250,  // Cap on eligible expenses
  creditRate: 0.50,           // 50% of eligible amount
  maxCredit: 5000             // Maximum credit per year
}

export default class F8826 extends F1040Attachment {
  tag: FormTag = 'f8826'
  sequenceIndex = 88

  isNeeded = (): boolean => {
    return this.hasDisabledAccessCredit()
  }

  hasDisabledAccessCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.eligibleAccessExpenditures > disabledAccessParams.minimumExpenditure
  }

  creditData = (): Form8826Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Line 1: Total eligible access expenditures
  l1 = (): number => this.creditData()?.eligibleAccessExpenditures ?? 0

  // Line 2: Minimum amount (not eligible)
  l2 = (): number => disabledAccessParams.minimumExpenditure

  // Line 3: Subtract line 2 from line 1
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Maximum amount of expenditures
  l4 = (): number => disabledAccessParams.maximumExpenditure - disabledAccessParams.minimumExpenditure

  // Line 5: Enter smaller of line 3 or line 4
  l5 = (): number => Math.min(this.l3(), this.l4())

  // Line 6: Multiply line 5 by 50%
  l6 = (): number => Math.round(this.l5() * disabledAccessParams.creditRate)

  // Line 7: Disabled access credit from partnerships, S corps, etc.
  l7 = (): number => 0

  // Line 8: Add lines 6 and 7 (total credit)
  l8 = (): number => Math.min(this.l6() + this.l7(), disabledAccessParams.maxCredit)

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l8()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8()
  ]
}
