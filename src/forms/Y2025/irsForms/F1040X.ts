import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1040-X - Amended U.S. Individual Income Tax Return
 *
 * Used to correct errors on a previously filed Form 1040, 1040-SR, or 1040-NR.
 *
 * Common reasons to amend:
 * - Correct income, deductions, or credits
 * - Change filing status
 * - Add or remove dependents
 * - Correct withholding or estimated tax payments
 *
 * Must be filed within 3 years of original filing date or
 * 2 years of tax payment date, whichever is later.
 */

export interface F1040XData {
  // Return being amended
  taxYear: number
  originalFilingDate: Date
  filingStatus: 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw'
  amendedFilingStatus?: 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw'
  // Part I: Income and Deductions
  // Column A: Original amount
  originalAGI: number
  originalItemizedOrStandard: number
  originalExemptions: number
  originalTaxableIncome: number
  originalTax: number
  originalCredits: number
  originalOtherTaxes: number
  originalTotalTax: number
  originalPayments: number
  originalRefund: number
  originalAmountOwed: number
  // Column C: Corrected amount
  correctedAGI: number
  correctedItemizedOrStandard: number
  correctedExemptions: number
  correctedTaxableIncome: number
  correctedTax: number
  correctedCredits: number
  correctedOtherTaxes: number
  correctedTotalTax: number
  correctedPayments: number
  // Part II: Presidential Election Campaign Fund
  originalContribution: number
  amendedContribution: number
  // Part III: Explanation of Changes
  explanation: string
}

export default class F1040X extends F1040Attachment {
  tag: FormTag = 'f1040x'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasAmendedData()
  }

  hasAmendedData = (): boolean => {
    return false // Would check if amendment is needed
  }

  f1040XData = (): F1040XData | undefined => {
    return undefined
  }

  taxYear = (): number => this.f1040XData()?.taxYear ?? 2025

  // Column B: Net change (Corrected - Original)
  agiChange = (): number => {
    const data = this.f1040XData()
    return (data?.correctedAGI ?? 0) - (data?.originalAGI ?? 0)
  }

  deductionChange = (): number => {
    const data = this.f1040XData()
    return (
      (data?.correctedItemizedOrStandard ?? 0) -
      (data?.originalItemizedOrStandard ?? 0)
    )
  }

  taxableIncomeChange = (): number => {
    const data = this.f1040XData()
    return (
      (data?.correctedTaxableIncome ?? 0) - (data?.originalTaxableIncome ?? 0)
    )
  }

  taxChange = (): number => {
    const data = this.f1040XData()
    return (data?.correctedTax ?? 0) - (data?.originalTax ?? 0)
  }

  creditsChange = (): number => {
    const data = this.f1040XData()
    return (data?.correctedCredits ?? 0) - (data?.originalCredits ?? 0)
  }

  otherTaxesChange = (): number => {
    const data = this.f1040XData()
    return (data?.correctedOtherTaxes ?? 0) - (data?.originalOtherTaxes ?? 0)
  }

  totalTaxChange = (): number => {
    const data = this.f1040XData()
    return (data?.correctedTotalTax ?? 0) - (data?.originalTotalTax ?? 0)
  }

  paymentsChange = (): number => {
    const data = this.f1040XData()
    return (data?.correctedPayments ?? 0) - (data?.originalPayments ?? 0)
  }

  // Line 20: Amount you owe
  amountOwed = (): number => {
    const data = this.f1040XData()
    const correctedTax = data?.correctedTotalTax ?? 0
    const correctedPayments = data?.correctedPayments ?? 0
    const originalRefund = data?.originalRefund ?? 0
    return Math.max(0, correctedTax - correctedPayments + originalRefund)
  }

  // Line 21: Overpayment
  overpayment = (): number => {
    const data = this.f1040XData()
    const correctedPayments = data?.correctedPayments ?? 0
    const correctedTax = data?.correctedTotalTax ?? 0
    const originalAmountOwed = data?.originalAmountOwed ?? 0
    return Math.max(0, correctedPayments - correctedTax + originalAmountOwed)
  }

  // Amount to refund
  refundAmount = (): number => this.overpayment()

  // Amount to apply to next year
  applyToNextYear = (): number => 0

  fields = (): Field[] => {
    const data = this.f1040XData()

    return [
      // Header
      data?.taxYear ?? 0,
      data?.originalFilingDate.toLocaleDateString() ?? '',
      data?.filingStatus ?? 'single',
      data?.amendedFilingStatus ?? data?.filingStatus ?? 'single',
      // Part I, Line 1: AGI
      data?.originalAGI ?? 0,
      this.agiChange(),
      data?.correctedAGI ?? 0,
      // Line 2: Itemized or standard deduction
      data?.originalItemizedOrStandard ?? 0,
      this.deductionChange(),
      data?.correctedItemizedOrStandard ?? 0,
      // Line 4: Taxable income
      data?.originalTaxableIncome ?? 0,
      this.taxableIncomeChange(),
      data?.correctedTaxableIncome ?? 0,
      // Line 6: Tax
      data?.originalTax ?? 0,
      this.taxChange(),
      data?.correctedTax ?? 0,
      // Line 7: Credits
      data?.originalCredits ?? 0,
      this.creditsChange(),
      data?.correctedCredits ?? 0,
      // Line 10: Other taxes
      data?.originalOtherTaxes ?? 0,
      this.otherTaxesChange(),
      data?.correctedOtherTaxes ?? 0,
      // Line 11: Total tax
      data?.originalTotalTax ?? 0,
      this.totalTaxChange(),
      data?.correctedTotalTax ?? 0,
      // Line 12: Payments
      data?.originalPayments ?? 0,
      this.paymentsChange(),
      data?.correctedPayments ?? 0,
      // Line 18: Refund from original
      data?.originalRefund ?? 0,
      // Line 19: Amount owed on original
      data?.originalAmountOwed ?? 0,
      // Line 20: Amount you owe
      this.amountOwed(),
      // Line 21: Overpayment
      this.overpayment(),
      // Line 22: Refund
      this.refundAmount(),
      // Line 23: Apply to next year
      this.applyToNextYear(),
      // Part III: Explanation
      data?.explanation ?? ''
    ]
  }
}
