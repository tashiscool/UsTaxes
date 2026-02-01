import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8881Data } from 'ustaxes/core/data'

/**
 * Form 8881 - Credit for Small Employer Pension Plan Startup Costs
 * and Auto-Enrollment
 *
 * Credit for eligible small employers who establish new retirement
 * plans (including SEP, SIMPLE IRA, and qualified plans).
 *
 * Startup Costs Credit:
 * - 50% of qualified startup costs (or 100% for employers with ≤50 employees)
 * - Up to $5,000 per year
 * - Available for first 3 years of the plan
 *
 * Auto-Enrollment Credit:
 * - $500 per year for plans with auto-enrollment
 * - Available for first 3 years of the plan
 *
 * Eligible small employer:
 * - 100 or fewer employees with $5,000+ compensation in prior year
 * - Did not have a qualified plan in prior 3 years
 *
 * SECURE 2.0 Act (2022) enhancements:
 * - Increased credit for small employers
 * - Extended to 3 years
 */

// 2025 parameters
const pensionStartupParams = {
  maxStartupCostCredit: 5000, // Per year
  startupCreditRate: 0.5, // 50% (100% for very small employers)
  smallEmployerRate: 1.0, // 100% for ≤50 employees
  maxAutoEnrollmentCredit: 500, // Per year
  maxEmployees: 100, // Maximum for eligibility
  verySmallThreshold: 50, // Threshold for higher rate
  yearsAvailable: 3 // Credit available for 3 years
}

export default class F8881 extends F1040Attachment {
  tag: FormTag = 'f8881'
  sequenceIndex = 131

  isNeeded = (): boolean => {
    return this.hasPensionStartupCredit()
  }

  hasPensionStartupCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.qualifiedStartupCosts > 0 ||
        data.autoEnrollmentCredit > 0 ||
        (data.passthrough8881Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8881Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Startup Costs Credit

  // Line 1: Qualified startup costs paid or incurred
  l1 = (): number => this.creditData()?.qualifiedStartupCosts ?? 0

  // Line 2: Credit rate (50% or 100% depending on number of employees)
  l2 = (): number => {
    const data = this.creditData()
    if (!data) return pensionStartupParams.startupCreditRate
    return data.numberOfNonHighlyCompensatedEmployees <=
      pensionStartupParams.verySmallThreshold
      ? pensionStartupParams.smallEmployerRate
      : pensionStartupParams.startupCreditRate
  }

  // Line 3: Multiply line 1 by line 2
  l3 = (): number => Math.round(this.l1() * this.l2())

  // Line 4: Maximum startup costs credit
  l4 = (): number => pensionStartupParams.maxStartupCostCredit

  // Line 5: Enter smaller of line 3 or line 4
  l5 = (): number => Math.min(this.l3(), this.l4())

  // Part II - Auto-Enrollment Credit

  // Line 6: Auto-enrollment credit (if applicable)
  l6 = (): number =>
    Math.min(
      this.creditData()?.autoEnrollmentCredit ?? 0,
      pensionStartupParams.maxAutoEnrollmentCredit
    )

  // Part III - Total Credit

  // Line 7: Add lines 5 and 6
  l7 = (): number => this.l5() + this.l6()

  // Line 8: Credit from partnerships, S corps, etc.
  l8 = (): number => this.creditData()?.passthrough8881Credit ?? 0

  // Line 9: Add lines 7 and 8 (total credit)
  l9 = (): number => this.l7() + this.l8()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l9()

  // Number of non-highly compensated employees
  numberOfEmployees = (): number =>
    this.creditData()?.numberOfNonHighlyCompensatedEmployees ?? 0

  // Year of credit (1, 2, or 3)
  yearOfCredit = (): number => this.creditData()?.yearsOfCredit ?? 1

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    // Part II
    this.l6(),
    // Part III
    this.l7(),
    this.l8(),
    this.l9(),
    this.numberOfEmployees(),
    this.yearOfCredit()
  ]
}
