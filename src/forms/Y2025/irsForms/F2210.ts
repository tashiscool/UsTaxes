import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 2210 - Underpayment of Estimated Tax by Individuals, Estates, and Trusts
 *
 * Used to determine if you owe a penalty for underpaying estimated taxes
 * and to calculate the penalty amount if applicable.
 *
 * Safe harbor rules:
 * - Pay 90% of current year tax, OR
 * - Pay 100% of prior year tax (110% if AGI > $150K)
 */

// 2025 penalty rate (based on federal short-term rate + 3%)
const penaltyRate = 0.08  // 8% annual rate

export default class F2210 extends F1040Attachment {
  tag: FormTag = 'f2210'
  sequenceIndex = 6

  isNeeded = (): boolean => {
    // Form is needed if there's potential underpayment
    return this.l8() > 0 && !this.meetsException()
  }

  meetsException = (): boolean => {
    // No penalty if tax owed is less than $1,000
    if (this.l6() < 1000) return true

    // No penalty if withholding covered 90% of current year tax
    if (this.l7() >= this.l6() * 0.90) return true

    // No penalty if withholding covered 100% of prior year tax (110% for high income)
    const priorYearTax = this.f1040.info.priorYearTax ?? 0
    const threshold = this.requiresHigherSafeHarbor() ? 1.10 : 1.00
    if (this.l7() >= priorYearTax * threshold) return true

    return false
  }

  requiresHigherSafeHarbor = (): boolean => {
    // 110% safe harbor for AGI > $150,000 ($75,000 MFS)
    const agi = this.f1040.l11()
    const threshold = this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS
      ? 75000
      : 150000
    return agi > threshold
  }

  // Part I - Required Annual Payment

  // Line 1: Tax from Form 1040 line 24
  l1 = (): number => this.f1040.l24()

  // Line 2: Other taxes (simplified)
  l2 = (): number => 0

  // Line 3: Total tax (line 1 + line 2)
  l3 = (): number => this.l1() + this.l2()

  // Line 4: Credits
  l4 = (): number => {
    return sumFields([
      this.f1040.l27(),  // EIC
      this.f1040.l28(),  // Additional CTC
      this.f1040.l29(),  // AOTC
      this.f1040.l30(),  // Other credits
      this.f1040.l31()   // Schedule 3 credits
    ])
  }

  // Line 5: Subtract line 4 from line 3 (total tax after credits)
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  // Line 6: Other payments (simplified)
  l6 = (): number => this.l5()

  // Line 7: Withholding from Forms W-2, 1099, etc.
  l7 = (): number => this.f1040.l25d()

  // Line 8: Underpayment (line 6 - line 7)
  l8 = (): number => Math.max(0, this.l6() - this.l7())

  // Line 9: Required annual payment (lesser of 90% of line 6 or 100%/110% of prior year)
  l9 = (): number => {
    const currentYear90 = Math.round(this.l6() * 0.90)
    const priorYearTax = this.f1040.info.priorYearTax ?? 0
    const priorYearRequired = this.requiresHigherSafeHarbor()
      ? Math.round(priorYearTax * 1.10)
      : priorYearTax

    return Math.min(currentYear90, priorYearRequired)
  }

  // Part II - Reasons for Filing (checkboxes)

  // Box A: Annualized income installment method
  boxA = (): boolean => false

  // Box B: Prior year tax was zero
  boxB = (): boolean => (this.f1040.info.priorYearTax ?? 0) === 0

  // Box C: Waiver request
  boxC = (): boolean => false

  // Box D: Married filing separately special rule
  boxD = (): boolean => false

  // Part III - Short Method (if applicable)

  // Line 10: Amount from line 8
  l10 = (): number => this.l8()

  // Line 11: Multiply line 10 by penalty rate
  l11 = (): number => Math.round(this.l10() * penaltyRate)

  // Line 12: Multiply line 11 by number of days from 4/15 to payment date
  // Simplified - assumes full year penalty
  l12 = (): number => this.l11()

  // Line 13: Penalty (simplified calculation)
  l13 = (): number => {
    if (this.meetsException()) return 0
    // Simplified: assume ~9 month average underpayment period
    return Math.round(this.l10() * penaltyRate * 0.75)
  }

  // Penalty amount to Form 1040 line 38
  penalty = (): number => this.l13()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    // Part II
    this.boxA(),
    this.boxB(),
    this.boxC(),
    this.boxD(),
    // Part III
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13()
  ]
}
