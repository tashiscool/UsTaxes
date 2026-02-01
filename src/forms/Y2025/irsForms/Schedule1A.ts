import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import {
  overtimeExemption,
  tipIncomeExemption,
  autoLoanInterestDeduction,
  seniorAdditionalDeduction
} from '../data/federal'
import { CURRENT_YEAR } from '../data/federal'

/**
 * Schedule 1-A: Additional Deductions
 *
 * New for 2025 under OBBBA (One Big Beautiful Bill Act)
 *
 * This schedule handles the following new above-the-line deductions:
 * - Part I: Overtime Income Exemption
 * - Part II: Tip Income Exemption
 * - Part III: Auto Loan Interest Deduction
 * - Part IV: Senior Additional Deduction (65+)
 */
export default class Schedule1A extends F1040Attachment {
  tag: FormTag = 'f1040s1a'
  sequenceIndex = 1.5 // After Schedule 1, before Schedule 2

  constructor(f1040: F1040) {
    super(f1040)
  }

  isNeeded = (): boolean => {
    return (
      this.hasOvertimeIncome() ||
      this.hasTipIncome() ||
      this.hasAutoLoanInterest() ||
      this.qualifiesForSeniorDeduction()
    )
  }

  // =========================================================================
  // Part I: Overtime Income Exemption
  // =========================================================================

  hasOvertimeIncome = (): boolean => {
    return (this.f1040.info.overtimeIncome?.amount ?? 0) > 0
  }

  // Line 1: Total qualified overtime wages
  l1 = (): number => {
    return this.f1040.info.overtimeIncome?.amount ?? 0
  }

  // Line 2: Phase-out calculation
  // Note: Uses total income (l9) instead of AGI (l11) to avoid circular dependency.
  // AGI depends on this schedule's deductions, so we use pre-adjustment income.
  l2 = (): number => {
    // Use total income before adjustments to avoid circular dependency
    const totalIncome = this.f1040.l9()
    const filingStatus = this.f1040.info.taxPayer.filingStatus
    const phaseOutStart = overtimeExemption.phaseOutStart(filingStatus)
    const phaseOutEnd = overtimeExemption.phaseOutEnd(filingStatus)

    if (totalIncome <= phaseOutStart) {
      return 1 // 100% allowed
    } else if (totalIncome >= phaseOutEnd) {
      return 0 // 0% allowed
    } else {
      // Linear phase-out
      return (phaseOutEnd - totalIncome) / (phaseOutEnd - phaseOutStart)
    }
  }

  // Line 3: Overtime deduction (before cap)
  l3 = (): number => {
    return Math.round(this.l1() * this.l2())
  }

  // Line 4: Annual cap
  l4 = (): number => {
    return overtimeExemption.annualCap(this.f1040.info.taxPayer.filingStatus)
  }

  // Line 5: Overtime exemption (smaller of l3 or l4)
  l5 = (): number => {
    return Math.min(this.l3(), this.l4())
  }

  // =========================================================================
  // Part II: Tip Income Exemption
  // =========================================================================

  hasTipIncome = (): boolean => {
    return (this.f1040.info.tipIncome?.amount ?? 0) > 0
  }

  // Line 6: Total qualified tip income
  l6 = (): number => {
    return this.f1040.info.tipIncome?.amount ?? 0
  }

  // Line 7: Phase-out calculation
  // Note: Uses total income (l9) instead of AGI (l11) to avoid circular dependency.
  // AGI depends on this schedule's deductions, so we use pre-adjustment income.
  l7 = (): number => {
    const totalIncome = this.f1040.l9()
    const filingStatus = this.f1040.info.taxPayer.filingStatus
    const phaseOutStart = tipIncomeExemption.phaseOutStart(filingStatus)
    const phaseOutEnd = tipIncomeExemption.phaseOutEnd(filingStatus)

    if (totalIncome <= phaseOutStart) {
      return 1 // 100% allowed
    } else if (totalIncome >= phaseOutEnd) {
      return 0 // 0% allowed
    } else {
      // Linear phase-out
      return (phaseOutEnd - totalIncome) / (phaseOutEnd - phaseOutStart)
    }
  }

  // Line 8: Tip income exemption
  // Using Senate version with $25,000 cap
  l8 = (): number => {
    const tipAmount = Math.round(this.l6() * this.l7())
    const cap = tipIncomeExemption.annualCap
    return Math.min(tipAmount, cap)
  }

  // =========================================================================
  // Part III: Auto Loan Interest Deduction
  // =========================================================================

  hasAutoLoanInterest = (): boolean => {
    return (this.f1040.info.autoLoanInterest?.amount ?? 0) > 0
  }

  // Line 9: Is the vehicle manufactured in the USA?
  l9 = (): boolean => {
    return this.f1040.info.autoLoanInterest?.domesticManufacture ?? false
  }

  // Line 10: Total auto loan interest paid
  l10 = (): number => {
    // Only allowed if vehicle is manufactured in USA
    if (!this.l9()) {
      return 0
    }
    return this.f1040.info.autoLoanInterest?.amount ?? 0
  }

  // Line 11: Phase-out calculation
  // Note: Uses total income (f1040.l9) instead of AGI (f1040.l11) to avoid circular dependency.
  // AGI depends on this schedule's deductions, so we use pre-adjustment income.
  l11 = (): number => {
    const totalIncome = this.f1040.l9()
    const filingStatus = this.f1040.info.taxPayer.filingStatus
    const phaseOutStart = autoLoanInterestDeduction.phaseOutStart(filingStatus)
    const phaseOutEnd = autoLoanInterestDeduction.phaseOutEnd(filingStatus)

    if (totalIncome <= phaseOutStart) {
      return 1 // 100% allowed
    } else if (totalIncome >= phaseOutEnd) {
      return 0 // 0% allowed
    } else {
      // Linear phase-out
      return (phaseOutEnd - totalIncome) / (phaseOutEnd - phaseOutStart)
    }
  }

  // Line 12: Auto loan interest deduction (before cap)
  l12 = (): number => {
    return Math.round(this.l10() * this.l11())
  }

  // Line 13: Annual cap
  l13 = (): number => {
    return autoLoanInterestDeduction.annualCap(
      this.f1040.info.taxPayer.filingStatus
    )
  }

  // Line 14: Auto loan interest deduction (smaller of l12 or l13)
  l14 = (): number => {
    return Math.min(this.l12(), this.l13())
  }

  // =========================================================================
  // Part IV: Senior Additional Deduction (65+)
  // =========================================================================

  qualifiesForSeniorDeduction = (): boolean => {
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    return primaryAge >= 65 || (spouseAge !== undefined && spouseAge >= 65)
  }

  getPrimaryAge = (): number => {
    const birthDate = this.f1040.info.taxPayer.primaryPerson.dateOfBirth
    const taxYear = CURRENT_YEAR
    const age = taxYear - birthDate.getFullYear()
    return age
  }

  getSpouseAge = (): number | undefined => {
    const spouse = this.f1040.info.taxPayer.spouse
    if (!spouse) return undefined
    const birthDate = spouse.dateOfBirth
    const taxYear = CURRENT_YEAR
    const age = taxYear - birthDate.getFullYear()
    return age
  }

  // Line 15: Number of qualifying seniors (65+)
  l15 = (): number => {
    let count = 0
    if (this.getPrimaryAge() >= 65) count++
    const spouseAge = this.getSpouseAge()
    if (spouseAge !== undefined && spouseAge >= 65) count++
    return count
  }

  // Line 16: Senior additional deduction
  l16 = (): number => {
    return this.l15() * seniorAdditionalDeduction.amount
  }

  // =========================================================================
  // Total Additional Deductions
  // =========================================================================

  // Line 17: Total additional deductions (sum of above-the-line parts only)
  // Note: Senior deduction (l16) is NOT included here - it goes to Line 12
  l17 = (): number => {
    return sumFields([this.l5(), this.l8(), this.l14()])
  }

  // Transfer to Form 1040 Line 10 (above-the-line deductions)
  // Senior deduction goes separately to Line 12
  to1040 = (): number => this.l17()

  // Transfer senior deduction to Form 1040 Line 12
  seniorDeductionTo1040 = (): number => {
    return this.isNeeded() ? this.l16() : 0
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I: Overtime
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    // Part II: Tips
    this.l6(),
    this.l7(),
    this.l8(),
    // Part III: Auto Loan Interest
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    // Part IV: Senior Deduction
    this.l15(),
    this.l16(),
    // Total
    this.l17()
  ]
}
