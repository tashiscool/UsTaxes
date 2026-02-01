import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form940Data, BusinessEntity, State } from 'ustaxes/core/data'

/**
 * Form 940 - Employer's Annual Federal Unemployment (FUTA) Tax Return
 *
 * FUTA tax funds unemployment compensation programs administered by state governments.
 * Only employers pay FUTA tax; employees do not.
 *
 * Key 2025 rates and thresholds:
 * - FUTA tax rate: 6.0% on first $7,000 of wages per employee
 * - Normal credit: 5.4% credit for state unemployment tax paid
 * - Net FUTA rate: 0.6% (after 5.4% credit) = $42 per employee max
 * - Credit reduction states: Additional tax if state is credit reduction state
 *
 * Filing requirements:
 * - Due January 31 following the tax year
 * - Must file if paid $1,500+ in wages in any quarter, or
 * - Had one or more employees for any part of a day in 20+ different weeks
 *
 * Deposit requirements:
 * - Deposit quarterly if cumulative FUTA liability > $500
 * - Q1: April 30, Q2: July 31, Q3: October 31, Q4: January 31
 */

// 2025 FUTA rates and limits
const FUTA_WAGE_LIMIT = 7000 // Per employee per year
const FUTA_RATE = 0.06 // 6.0%
const FUTA_CREDIT = 0.054 // 5.4% credit for state unemployment
const NET_FUTA_RATE = FUTA_RATE - FUTA_CREDIT // 0.6% net rate

export default class F940 extends BusinessForm {
  tag: FormTag = 'f940'
  sequenceIndex = 0

  formData: Form940Data

  constructor(data: Form940Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  // =========================================================================
  // Part 1 - Tell us about your return
  // =========================================================================

  // Line 1a: Single-state employer
  isSingleState = (): boolean => this.formData.statesWhereWagesPaid.length === 1

  singleStateCode = (): State | undefined => {
    if (this.isSingleState()) {
      return this.formData.statesWhereWagesPaid[0]
    }
    return undefined
  }

  // Line 1b: Multi-state employer
  isMultiState = (): boolean => this.formData.statesWhereWagesPaid.length > 1

  // Line 2: Paid wages only in credit reduction state(s)
  isPaidOnlyInCreditReductionStates = (): boolean => {
    const creditReductionStates = this.getCreditReductionStates()
    return this.formData.statesWhereWagesPaid.every((s) =>
      creditReductionStates.includes(s)
    )
  }

  /**
   * Credit reduction states for 2025
   * States that have not repaid federal unemployment loans
   * (This list should be updated annually based on DOL announcements)
   */
  getCreditReductionStates = (): State[] => {
    // As of 2025, typically no credit reduction states, but can vary
    // Would need to check DOL announcements for actual list
    return []
  }

  // =========================================================================
  // Part 2 - Determine your FUTA tax before adjustments
  // =========================================================================

  // Line 3: Total payments to all employees
  l3 = (): number => this.formData.totalPayments

  // Line 4: Payments exempt from FUTA tax
  l4 = (): number => this.formData.exemptPayments

  // Line 5: Total of payments made to each employee in excess of $7,000
  l5 = (): number => this.formData.paymentsOverFUTALimit

  // Line 6: Subtotal (line 4 + line 5)
  l6 = (): number => this.l4() + this.l5()

  // Line 7: Total taxable FUTA wages (line 3 - line 6)
  l7 = (): number => Math.max(0, this.l3() - this.l6())

  // Line 8: FUTA tax before adjustments (line 7 × 0.006)
  l8 = (): number => Math.round(this.l7() * NET_FUTA_RATE * 100) / 100

  // =========================================================================
  // Part 3 - Determine your adjustments
  // =========================================================================

  // Line 9: If ALL wages were excluded from state unemployment tax
  l9 = (): number => {
    if (this.formData.allWagesExemptFromSUTA) {
      // Pay full 6% instead of 0.6%
      return Math.round(this.l7() * FUTA_CREDIT * 100) / 100
    }
    return 0
  }

  // Line 10: If SOME wages were excluded from state unemployment tax
  // or paid in credit reduction state
  l10 = (): number => {
    // Would need Schedule A (Form 940) for detailed calculation
    return this.formData.creditReductionAmount
  }

  // Line 11: If credit reduction applies (Schedule A)
  l11 = (): number => 0 // From Schedule A

  // =========================================================================
  // Part 4 - Determine your FUTA tax and balance due or overpayment
  // =========================================================================

  // Line 12: Total FUTA tax after adjustments (line 8 + 9 + 10 + 11)
  l12 = (): number => this.l8() + this.l9() + this.l10() + this.l11()

  // Line 13: FUTA tax deposited for the year
  l13 = (): number => this.formData.depositsForYear

  // Line 14: Balance due (if line 12 > line 13)
  l14 = (): number => Math.max(0, this.l12() - this.l13())

  // Line 15: Overpayment (if line 13 > line 12)
  l15 = (): number => Math.max(0, this.l13() - this.l12())

  // =========================================================================
  // Part 5 - Report your FUTA tax liability by quarter
  // =========================================================================

  // Only complete if annual FUTA liability > $500

  needsQuarterlyBreakdown = (): boolean => this.l12() > 500

  // Quarterly liabilities
  q1Liability = (): number => 0 // Would need quarterly breakdown
  q2Liability = (): number => 0
  q3Liability = (): number => 0
  q4Liability = (): number => 0

  // Line 17: Total tax liability for year (should equal line 12)
  l17 = (): number => {
    return (
      this.q1Liability() +
      this.q2Liability() +
      this.q3Liability() +
      this.q4Liability()
    )
  }

  // =========================================================================
  // Part 6 - May we speak with your third-party designee?
  // =========================================================================

  hasThirdPartyDesignee = (): boolean => false

  // =========================================================================
  // Part 7 - Sign here (for business representative)
  // =========================================================================

  // (Signature fields handled elsewhere)

  // =========================================================================
  // Schedule A (Form 940) - Multi-State Employer and Credit Reduction
  // =========================================================================

  // Required if employer paid wages in more than one state or in a credit reduction state

  needsScheduleA = (): boolean => {
    return this.isMultiState() || this.getCreditReductionStates().length > 0
  }

  statesWhereWagesPaid = (): State[] => this.formData.statesWhereWagesPaid

  // Calculate credit reduction for each state
  calculateCreditReduction = (state: State, wages: number): number => {
    const creditReductionStates = this.getCreditReductionStates()
    if (!creditReductionStates.includes(state)) {
      return 0
    }
    // Credit reduction rate varies by state and year
    // Would need lookup table for specific rates
    return 0
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  taxYear = (): number => this.formData.taxYear

  isAmended = (): boolean => this.formData.isAmended
  isFinal = (): boolean => this.formData.isFinal
  isSuccessor = (): boolean => this.formData.isSuccessor

  // Maximum FUTA tax per employee
  maxFutaPerEmployee = (): number => FUTA_WAGE_LIMIT * NET_FUTA_RATE // $42

  // Count of employees subject to FUTA
  employeeCount = (): number => this.formData.employees?.length ?? 0

  // Total taxable FUTA wages
  totalTaxableWages = (): number => this.l7()

  // Total FUTA tax
  totalTax = (): number => this.l12()

  // Balance due or overpayment
  balanceDue = (): number => this.l14()
  overpayment = (): number => this.l15()

  // Due date for filing
  filingDueDate = (): string => `January 31, ${this.taxYear() + 1}`

  // Quarterly deposit due dates
  q1DepositDue = (): string => `April 30, ${this.taxYear()}`
  q2DepositDue = (): string => `July 31, ${this.taxYear()}`
  q3DepositDue = (): string => `October 31, ${this.taxYear()}`
  q4DepositDue = (): string => `January 31, ${this.taxYear() + 1}`

  // =========================================================================
  // PDF Fields
  // =========================================================================

  fields = (): Field[] => [
    // Header
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.taxYear(),
    // Type of return
    this.isAmended(),
    this.isFinal(),
    this.isSuccessor(),
    // Part 1
    this.isSingleState(),
    this.singleStateCode() ?? '',
    this.isMultiState(),
    // Part 2
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    // Part 3
    this.l9(),
    this.l10(),
    this.l11(),
    // Part 4
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    // Part 5
    this.needsQuarterlyBreakdown(),
    this.q1Liability(),
    this.q2Liability(),
    this.q3Liability(),
    this.q4Liability(),
    this.l17(),
    // Schedules
    this.needsScheduleA()
  ]
}
