import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8994Data } from 'ustaxes/core/data'

/**
 * Form 8994 - Employer Credit for Paid Family and Medical Leave
 *
 * Credit for employers who provide paid family and medical leave
 * to qualifying employees.
 *
 * Requirements:
 * - Written leave policy
 * - At least 2 weeks of paid family and medical leave annually
 * - Pay at least 50% of wages during leave
 * - Available to all qualifying employees
 *
 * Credit rates:
 * - 12.5% of wages paid during leave if paid at 50% of normal wages
 * - Up to 25% if paid at 100% of normal wages
 * - Additional 0.25% for each percentage point above 50%
 *
 * Maximum leave wages that qualify: 12 weeks per employee per year
 */

export default class F8994 extends F1040Attachment {
  tag: FormTag = 'f8994'
  sequenceIndex = 994

  isNeeded = (): boolean => {
    return this.hasFamilyLeaveCredit()
  }

  hasFamilyLeaveCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.qualifiedEmployees.length > 0
  }

  creditData = (): Form8994Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Paid Family and Medical Leave Credit

  // Line 1: Total family and medical leave wages paid
  l1 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce((sum, e) => sum + e.wagesForLeave, 0)
  }

  // Line 2: Credit rate (12.5% to 25% based on wage replacement rate)
  averageCreditRate = (): number => {
    const data = this.creditData()
    if (!data || data.qualifiedEmployees.length === 0) return 0.125
    const totalRate = data.qualifiedEmployees.reduce((sum, e) => sum + e.creditRate, 0)
    return totalRate / data.qualifiedEmployees.length
  }

  // Line 3: Multiply line 1 by credit rate
  l3 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce((sum, e) => sum + e.credit, 0)
  }

  // Line 4: Credit from partnerships, S corps, etc.
  l4 = (): number => 0

  // Line 5: Add lines 3 and 4
  l5 = (): number => this.l3() + this.l4()

  // Part II - Not applicable for most filers

  // Total credit
  totalCredit = (): number => this.creditData()?.totalCredit ?? this.l5()

  // Credit for Form 3800
  credit = (): number => this.totalCredit()

  // Number of employees with qualified leave
  qualifiedEmployeeCount = (): number => {
    return this.creditData()?.qualifiedEmployees.length ?? 0
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1(),
    this.averageCreditRate(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.qualifiedEmployeeCount()
  ]
}
