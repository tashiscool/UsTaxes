import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8932Data } from 'ustaxes/core/data'

/**
 * Form 8932 - Credit for Employer Differential Wage Payments
 *
 * Credit for eligible small employers who pay differential wages
 * to employees called to active military duty.
 *
 * Credit calculation:
 * - 20% of eligible differential wage payments
 * - Maximum of $20,000 per employee per year
 * - Maximum credit: $4,000 per employee per year
 *
 * Eligible small employer:
 * - Employed average of fewer than 50 employees on business days during tax year
 * - Under common control rules (IRC Section 414)
 *
 * Differential wage payments:
 * - Payments made to an employee while on active duty for 30+ days
 * - Represents all or portion of wages the employee would have received
 * - Must be in addition to any military pay
 *
 * Eligible employees:
 * - Employed 91+ days by employer before active duty call
 * - Called to active duty for period of 30+ consecutive days
 */

// 2025 parameters
const differentialWageParams = {
  creditRate: 0.20,              // 20% of wages
  maxWagesPerEmployee: 20000,    // Maximum qualifying wages
  maxCreditPerEmployee: 4000,    // Maximum credit per employee
  maxEmployees: 50,              // Must have <50 employees
  minEmploymentDays: 91,         // Minimum days employed before call
  minActiveDutyDays: 30          // Minimum consecutive days on active duty
}

export default class F8932 extends F1040Attachment {
  tag: FormTag = 'f8932'
  sequenceIndex = 163

  isNeeded = (): boolean => {
    return this.hasDifferentialWageCredit()
  }

  hasDifferentialWageCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.qualifiedEmployees.length > 0
  }

  creditData = (): Form8932Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Current Year Credit

  // Line 1: Total eligible differential wage payments
  l1 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce((sum, e) =>
      sum + Math.min(e.differentialWagesPaid, differentialWageParams.maxWagesPerEmployee), 0)
  }

  // Line 2: Multiply line 1 by 20%
  l2 = (): number => Math.round(this.l1() * differentialWageParams.creditRate)

  // Line 3: Credit from partnerships, S corps, etc.
  l3 = (): number => this.creditData()?.passthrough8932Credit ?? 0

  // Line 4: Add lines 2 and 3 (total credit)
  l4 = (): number => this.l2() + this.l3()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l4()

  // Number of qualified employees
  qualifiedEmployeeCount = (): number => this.creditData()?.qualifiedEmployees.length ?? 0

  // Total duty days for all employees
  totalDutyDays = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.qualifiedEmployees.reduce((sum, e) => sum + e.militaryDutyDays, 0)
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.qualifiedEmployeeCount(),
    this.totalDutyDays()
  ]
}
