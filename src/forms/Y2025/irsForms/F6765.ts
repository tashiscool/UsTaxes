import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form6765Data } from 'ustaxes/core/data'

/**
 * Form 6765 - Credit for Increasing Research Activities
 *
 * Also known as the R&D Tax Credit or Research Credit.
 * Available for businesses that incur qualified research expenses.
 *
 * Qualified research expenses (QRE) include:
 * - Wages for qualified research
 * - Supplies used in qualified research
 * - Contract research expenses (65% of amount paid)
 * - Basic research payments to qualified organizations
 *
 * Two calculation methods:
 * 1. Regular Credit: 20% of QRE over base amount
 * 2. Alternative Simplified Credit (ASC): 14% of QRE over 50% of avg prior 3 years
 *
 * Qualified Small Business (QSB) election:
 * - Gross receipts < $5 million for 5 years, AND
 * - No gross receipts more than 5 years ago
 * - Can apply credit against payroll tax (up to $500,000/year)
 */

export default class F6765 extends F1040Attachment {
  tag: FormTag = 'f6765'
  sequenceIndex = 84

  isNeeded = (): boolean => {
    return this.hasResearchCredit()
  }

  hasResearchCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && data.qualifiedResearchExpenses > 0
  }

  creditData = (): Form6765Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Section A - Regular Credit

  // Line 1: Paid or incurred to energy consortia
  l1 = (): number => 0

  // Line 2: Basic research payments
  l2 = (): number => this.creditData()?.basicResearchPayments ?? 0

  // Line 3: Qualified organization base amount
  l3 = (): number => 0

  // Line 4: Subtract line 3 from line 2
  l4 = (): number => Math.max(0, this.l2() - this.l3())

  // Line 5: Wages for qualified services
  l5 = (): number => 0

  // Line 6: Cost of supplies
  l6 = (): number => 0

  // Line 7: Rental of computer
  l7 = (): number => 0

  // Line 8: Contract research (65% of amount paid)
  l8 = (): number => 0

  // Line 9: Total qualified research expenses (add lines 5-8)
  l9 = (): number => this.creditData()?.qualifiedResearchExpenses ?? 0

  // Line 10: Fixed-base percentage
  l10 = (): number => this.creditData()?.fixedBasePercentage ?? 0

  // Line 11: Average annual gross receipts
  l11 = (): number => 0

  // Line 12: Multiply line 10 by line 11
  l12 = (): number => Math.round(this.l10() * this.l11())

  // Line 13: Subtract line 12 from line 9
  l13 = (): number => Math.max(0, this.l9() - this.l12())

  // Line 14: Multiply line 13 by 20%
  l14 = (): number => Math.round(this.l13() * 0.20)

  // Line 15: Add lines 1, 4, and 14 (regular credit)
  l15 = (): number => this.l1() + this.l4() + this.l14()

  // Section B - Alternative Simplified Credit (ASC)

  // Line 24: Qualified research expenses for current year
  l24 = (): number => this.creditData()?.currentYearQRE ?? 0

  // Lines 25-27: QRE for prior 3 years
  l25 = (): number => this.creditData()?.priorYearQRE?.[0] ?? 0
  l26 = (): number => this.creditData()?.priorYearQRE?.[1] ?? 0
  l27 = (): number => this.creditData()?.priorYearQRE?.[2] ?? 0

  // Line 28: Add lines 25-27
  l28 = (): number => this.l25() + this.l26() + this.l27()

  // Line 29: Divide line 28 by 3
  l29 = (): number => Math.round(this.l28() / 3)

  // Line 30: Multiply line 29 by 50%
  l30 = (): number => Math.round(this.l29() * 0.50)

  // Line 31: Subtract line 30 from line 24
  l31 = (): number => Math.max(0, this.l24() - this.l30())

  // Line 32: Multiply line 31 by 14%
  l32 = (): number => Math.round(this.l31() * 0.14)

  // Use simplified method?
  useSimplifiedMethod = (): boolean => this.creditData()?.useSimplifiedMethod ?? false

  // Total credit
  totalCredit = (): number => {
    if (this.useSimplifiedMethod()) {
      return this.creditData()?.alternativeCredit ?? this.l32()
    }
    return this.creditData()?.regularCredit ?? this.l15()
  }

  // Payroll tax election (qualified small business)
  electPayrollTax = (): boolean => this.creditData()?.electPayrollTaxCredit ?? false
  payrollTaxCredit = (): number => this.creditData()?.payrollTaxCreditAmount ?? 0

  // Credit for Form 3800
  credit = (): number => this.totalCredit()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Section A
    this.l1(),
    this.l2(),
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
    this.l14(),
    this.l15(),
    // Section B
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.useSimplifiedMethod(),
    // Total
    this.totalCredit(),
    this.electPayrollTax(),
    this.payrollTaxCredit()
  ]
}
