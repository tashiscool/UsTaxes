/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars */
import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'
import { CURRENT_YEAR } from '../data/federal'

/**
 * Form 1040-ES - Estimated Tax for Individuals
 *
 * Used by individuals who expect to owe at least $1,000 in tax after
 * subtracting withholding and refundable credits.
 *
 * Quarterly payment schedule:
 * - 1st payment: April 15
 * - 2nd payment: June 15
 * - 3rd payment: September 15
 * - 4th payment: January 15 (of following year)
 *
 * Safe Harbor Rules:
 * - Pay at least 90% of current year's tax liability, OR
 * - Pay 100% of prior year's tax (110% if AGI > $150,000)
 */

export type QuarterNumber = 1 | 2 | 3 | 4

export interface EstimatedTaxPayment {
  quarter: QuarterNumber
  dueDate: Date
  amount: number
  datePaid?: Date
  confirmationNumber?: string
}

export interface F1040ESData {
  // Prior year information (for safe harbor calculation)
  priorYearTax: number
  priorYearAGI: number

  // Current year estimates
  estimatedAGI: number
  estimatedDeductions: number
  estimatedTaxableIncome: number
  estimatedTax: number
  estimatedCredits: number
  estimatedSelfEmploymentTax: number
  estimatedOtherTaxes: number // AMT, household employment tax, etc.

  // Withholding and payments
  expectedWithholding: number
  priorYearOverpaymentApplied: number

  // Quarterly payments
  payments: EstimatedTaxPayment[]
}

// Quarterly due dates for 2025 tax year
const QUARTERLY_DUE_DATES: { [key in QuarterNumber]: Date } = {
  1: new Date(2025, 3, 15), // April 15, 2025
  2: new Date(2025, 5, 15), // June 15, 2025
  3: new Date(2025, 8, 15), // September 15, 2025
  4: new Date(2026, 0, 15) // January 15, 2026
}

// High income threshold for 110% safe harbor rule
const HIGH_INCOME_THRESHOLD = 150000
const HIGH_INCOME_THRESHOLD_MFS = 75000

export default class F1040ES extends F1040Attachment {
  tag: FormTag = 'f1040es'
  sequenceIndex = 0 // Payment voucher - filed separately

  isNeeded = (): boolean => {
    // Form is needed if estimated tax payments are required
    return this.estimatedTaxRequired() > 0
  }

  f1040ESData = (): F1040ESData | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return (this.f1040.info as any).estimatedTaxData as F1040ESData | undefined
  }

  // Check if taxpayer is subject to 110% safe harbor rule (high income)
  requiresHigherSafeHarbor = (): boolean => {
    const priorYearAGI = this.f1040ESData()?.priorYearAGI ?? 0
    const threshold =
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS
        ? HIGH_INCOME_THRESHOLD_MFS
        : HIGH_INCOME_THRESHOLD
    return priorYearAGI > threshold
  }

  // Safe harbor percentage (100% or 110% of prior year tax)
  safeHarborPercentage = (): number => {
    return this.requiresHigherSafeHarbor() ? 1.1 : 1.0
  }

  // ============================================================================
  // Estimated Tax Worksheet
  // ============================================================================

  // Line 1: Estimated tax for the year (expected adjusted gross income)
  l1 = (): number => {
    const data = this.f1040ESData()
    if (data?.estimatedAGI !== undefined) {
      return data.estimatedAGI
    }
    // Use current return's AGI as estimate
    return this.f1040.l11()
  }

  // Line 2a: Estimated deductions (itemized or standard)
  l2a = (): number => {
    const data = this.f1040ESData()
    if (data?.estimatedDeductions !== undefined) {
      return data.estimatedDeductions
    }
    // Use current return's deduction
    return this.f1040.l12()
  }

  // Line 2b: Qualified business income deduction (if applicable)
  l2b = (): number => this.f1040.l13() ?? 0

  // Line 2c: Total deductions (2a + 2b)
  l2c = (): number => this.l2a() + this.l2b()

  // Line 3: Estimated taxable income (line 1 - line 2c)
  l3 = (): number => Math.max(0, this.l1() - this.l2c())

  // Line 4: Estimated income tax
  l4 = (): number => {
    const data = this.f1040ESData()
    if (data?.estimatedTax !== undefined) {
      return data.estimatedTax
    }
    // Use current return's tax
    return this.f1040.l16() ?? 0
  }

  // Line 5: Self-employment tax
  l5 = (): number => {
    const data = this.f1040ESData()
    if (data?.estimatedSelfEmploymentTax !== undefined) {
      return data.estimatedSelfEmploymentTax
    }
    // Get from Schedule SE if available
    return this.f1040.scheduleSE.l12() ?? 0
  }

  // Line 6: Other taxes (AMT, household employment, etc.)
  l6 = (): number => {
    const data = this.f1040ESData()
    if (data?.estimatedOtherTaxes !== undefined) {
      return data.estimatedOtherTaxes
    }
    // Include AMT (from F6251 line 11) and other Schedule 2 taxes
    const amtTax = this.f1040.f6251.l11()
    const schedule2Tax = this.f1040.schedule2.l21() ?? 0
    const seTax = this.f1040.scheduleSE.l12() ?? 0
    // Schedule 2 already includes SE tax, so subtract it to avoid double counting
    return Math.max(0, amtTax + schedule2Tax - seTax)
  }

  // Line 7: Total estimated tax (lines 4 + 5 + 6)
  l7 = (): number => sumFields([this.l4(), this.l5(), this.l6()])

  // Line 8: Estimated credits
  l8 = (): number => {
    const data = this.f1040ESData()
    if (data?.estimatedCredits !== undefined) {
      return data.estimatedCredits
    }
    // Use current return's credits
    return this.f1040.l21()
  }

  // Line 9: Net estimated tax (line 7 - line 8, but not less than zero)
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: Withholding expected
  l10 = (): number => {
    const data = this.f1040ESData()
    if (data?.expectedWithholding !== undefined) {
      return data.expectedWithholding
    }
    // Use current return's withholding
    return this.f1040.l25d()
  }

  // Line 11: Prior year overpayment applied
  l11 = (): number => this.f1040ESData()?.priorYearOverpaymentApplied ?? 0

  // Line 12: Total expected payments (line 10 + line 11)
  l12 = (): number => this.l10() + this.l11()

  // Line 13: Balance of estimated tax (line 9 - line 12)
  l13 = (): number => Math.max(0, this.l9() - this.l12())

  // ============================================================================
  // Safe Harbor Calculation
  // ============================================================================

  // Prior year tax liability (for safe harbor)
  priorYearTax = (): number => {
    return this.f1040ESData()?.priorYearTax ?? this.f1040.info.priorYearTax ?? 0
  }

  // Safe harbor amount (100% or 110% of prior year tax)
  safeHarborAmount = (): number => {
    return Math.round(this.priorYearTax() * this.safeHarborPercentage())
  }

  // 90% of current year tax
  ninetyPercentCurrentYear = (): number => {
    return Math.round(this.l9() * 0.9)
  }

  // Required annual payment (lesser of safe harbor or 90% current year)
  requiredAnnualPayment = (): number => {
    const safeHarbor = this.safeHarborAmount()
    const ninetyPercent = this.ninetyPercentCurrentYear()

    // If prior year tax was zero, only 90% rule applies
    if (this.priorYearTax() === 0) {
      return ninetyPercent
    }

    return Math.min(safeHarbor, ninetyPercent)
  }

  // Estimated tax payments required (line 13, but considering safe harbor)
  estimatedTaxRequired = (): number => {
    const balanceDue = this.l13()

    // No estimated tax if balance is less than $1,000
    if (balanceDue < 1000) {
      return 0
    }

    return balanceDue
  }

  // ============================================================================
  // Quarterly Payment Calculations
  // ============================================================================

  // Required quarterly payment amount
  quarterlyPaymentAmount = (): number => {
    const required = this.estimatedTaxRequired()
    if (required <= 0) return 0
    return Math.ceil(required / 4)
  }

  // Get due date for a quarter
  quarterDueDate = (quarter: QuarterNumber): Date => {
    return QUARTERLY_DUE_DATES[quarter]
  }

  // Get payments made
  payments = (): EstimatedTaxPayment[] => {
    return this.f1040ESData()?.payments ?? []
  }

  // Get payment for a specific quarter
  quarterPayment = (
    quarter: QuarterNumber
  ): EstimatedTaxPayment | undefined => {
    return this.payments().find((p) => p.quarter === quarter)
  }

  // Total payments made so far
  totalPaymentsMade = (): number => {
    return this.payments().reduce((sum, p) => sum + p.amount, 0)
  }

  // Remaining balance after payments
  remainingBalance = (): number => {
    return Math.max(0, this.estimatedTaxRequired() - this.totalPaymentsMade())
  }

  // Check if underpaid (may owe penalty)
  isUnderpaid = (): boolean => {
    const required = this.requiredAnnualPayment()
    const paid = this.totalPaymentsMade() + this.l10() + this.l11()
    return paid < required
  }

  // ============================================================================
  // Payment Voucher Fields (for each quarterly voucher)
  // ============================================================================

  voucherFields = (quarter: QuarterNumber): Field[] => {
    const payment = this.quarterPayment(quarter)
    const dueDate = this.quarterDueDate(quarter)

    return [
      // Calendar year
      CURRENT_YEAR,
      // Name and SSN
      this.f1040.info.taxPayer.primaryPerson.firstName,
      this.f1040.info.taxPayer.primaryPerson.lastName,
      this.f1040.info.taxPayer.primaryPerson.ssid,
      this.f1040.info.taxPayer.spouse?.firstName ?? '',
      this.f1040.info.taxPayer.spouse?.lastName ?? '',
      this.f1040.info.taxPayer.spouse?.ssid ?? '',
      // Address
      this.f1040.info.taxPayer.primaryPerson.address.address,
      this.f1040.info.taxPayer.primaryPerson.address.city,
      this.f1040.info.taxPayer.primaryPerson.address.state ?? '',
      this.f1040.info.taxPayer.primaryPerson.address.zip ?? '',
      // Quarter info
      quarter,
      dueDate.toLocaleDateString(),
      // Payment amount
      payment?.amount ?? this.quarterlyPaymentAmount()
    ]
  }

  fields = (): Field[] => {
    const data = this.f1040ESData()

    return [
      // Taxpayer info
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      this.f1040.info.taxPayer.spouse?.ssid ?? '',
      // Address
      this.f1040.info.taxPayer.primaryPerson.address.address,
      this.f1040.info.taxPayer.primaryPerson.address.city,
      this.f1040.info.taxPayer.primaryPerson.address.state ?? '',
      this.f1040.info.taxPayer.primaryPerson.address.zip ?? '',
      // Filing status
      this.f1040.info.taxPayer.filingStatus,
      // Worksheet
      this.l1(),
      this.l2a(),
      this.l2b(),
      this.l2c(),
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
      // Safe harbor
      this.priorYearTax(),
      this.safeHarborPercentage() === 1.1, // Uses 110% rule
      this.safeHarborAmount(),
      this.ninetyPercentCurrentYear(),
      this.requiredAnnualPayment(),
      // Quarterly amounts
      this.quarterlyPaymentAmount(),
      // Quarter 1 voucher
      this.quarterDueDate(1).toLocaleDateString(),
      this.quarterPayment(1)?.amount ?? this.quarterlyPaymentAmount(),
      this.quarterPayment(1)?.datePaid?.toLocaleDateString() ?? '',
      // Quarter 2 voucher
      this.quarterDueDate(2).toLocaleDateString(),
      this.quarterPayment(2)?.amount ?? this.quarterlyPaymentAmount(),
      this.quarterPayment(2)?.datePaid?.toLocaleDateString() ?? '',
      // Quarter 3 voucher
      this.quarterDueDate(3).toLocaleDateString(),
      this.quarterPayment(3)?.amount ?? this.quarterlyPaymentAmount(),
      this.quarterPayment(3)?.datePaid?.toLocaleDateString() ?? '',
      // Quarter 4 voucher
      this.quarterDueDate(4).toLocaleDateString(),
      this.quarterPayment(4)?.amount ?? this.quarterlyPaymentAmount(),
      this.quarterPayment(4)?.datePaid?.toLocaleDateString() ?? '',
      // Totals
      this.totalPaymentsMade(),
      this.remainingBalance(),
      this.isUnderpaid()
    ]
  }

  // Generate multiple copies for quarterly vouchers
  copies = (): F1040ES[] => {
    // Each quarter gets its own voucher
    // The main form serves as Q1, copies for Q2-Q4
    return [] // Payment vouchers are typically separate filings
  }
}
