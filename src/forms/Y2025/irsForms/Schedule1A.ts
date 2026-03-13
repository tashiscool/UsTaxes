import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus } from 'ustaxes/core/data'
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
    return this.l5() > 0 || this.l8() > 0 || this.l14() > 0 || this.l16() > 0
  }

  private normalizedSsn = (ssn?: string): string =>
    (ssn ?? '').replace(/-/g, '')

  private hasValidSsn = (ssn?: string): boolean =>
    /^\d{9}$/.test(this.normalizedSsn(ssn))

  private filingStatus = (): FilingStatus =>
    this.f1040.info.taxPayer.filingStatus

  // Schedule 1-A phaseouts are based on AGI before the Schedule 1-A
  // above-the-line deductions are applied.
  private agiBeforeSchedule1A = (): number =>
    Math.max(0, this.f1040.l9() - this.f1040.schedule1.to1040Line10())

  private thousandDollarReduction = (
    excessIncome: number,
    reductionPerThousand: number,
    roundUp: boolean
  ): number => {
    if (excessIncome <= 0) return 0
    const units = roundUp
      ? Math.ceil(excessIncome / 1000)
      : Math.floor(excessIncome / 1000)
    return units * reductionPerThousand
  }

  private eligibleForQualifiedWageDeductions = (): boolean => {
    const filingStatus = this.filingStatus()
    if (filingStatus === FilingStatus.MFS) return false
    if (!this.hasValidSsn(this.f1040.info.taxPayer.primaryPerson.ssid)) {
      return false
    }
    if (filingStatus === FilingStatus.MFJ) {
      return this.hasValidSsn(this.f1040.info.taxPayer.spouse?.ssid)
    }
    return true
  }

  private seniorPhaseOutAmount = (): number => {
    const count = this.l15()
    if (count === 0) return 0
    const threshold = seniorAdditionalDeduction.phaseOutStart(
      this.filingStatus()
    )
    const agi = this.agiBeforeSchedule1A()
    if (agi <= threshold) return 0
    return Math.round(
      (agi - threshold) * seniorAdditionalDeduction.phaseOutRate
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
  l2 = (): number => {
    if (!this.eligibleForQualifiedWageDeductions()) {
      return 0
    }

    const agi = this.agiBeforeSchedule1A()
    const filingStatus = this.filingStatus()
    const phaseOutStart = overtimeExemption.phaseOutStart(filingStatus)
    return this.thousandDollarReduction(
      agi - phaseOutStart,
      overtimeExemption.phaseOutReductionPerThousand,
      false
    )
  }

  // Line 3: Overtime deduction before phase-out
  l3 = (): number => {
    if (!this.eligibleForQualifiedWageDeductions()) {
      return 0
    }
    return Math.min(this.l1(), this.l4())
  }

  // Line 4: Annual cap
  l4 = (): number => {
    return overtimeExemption.annualCap(this.filingStatus())
  }

  // Line 5: Overtime exemption after phase-out
  l5 = (): number => {
    return Math.max(0, this.l3() - this.l2())
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

  // Line 7: Phase-out reduction amount
  l7 = (): number => {
    if (!this.eligibleForQualifiedWageDeductions()) {
      return 0
    }

    const agi = this.agiBeforeSchedule1A()
    const filingStatus = this.filingStatus()
    const phaseOutStart = tipIncomeExemption.phaseOutStart(filingStatus)
    return this.thousandDollarReduction(
      agi - phaseOutStart,
      tipIncomeExemption.phaseOutReductionPerThousand,
      false
    )
  }

  // Line 8: Tip income exemption
  l8 = (): number => {
    if (!this.eligibleForQualifiedWageDeductions()) {
      return 0
    }
    const cappedTipAmount = Math.min(this.l6(), tipIncomeExemption.annualCap)
    return Math.max(0, cappedTipAmount - this.l7())
  }

  // =========================================================================
  // Part III: Auto Loan Interest Deduction
  // =========================================================================

  hasAutoLoanInterest = (): boolean => {
    return (this.f1040.info.autoLoanInterest?.amount ?? 0) > 0
  }

  // Line 9: Does the vehicle meet the final-assembly-in-the-U.S. test?
  l9 = (): boolean => {
    return this.f1040.info.autoLoanInterest?.domesticManufacture ?? false
  }

  // Line 10: Total auto loan interest paid
  l10 = (): number => {
    // Only allowed if the vehicle satisfies the current data-model eligibility
    // check for U.S. final assembly.
    if (!this.l9()) {
      return 0
    }
    return this.f1040.info.autoLoanInterest?.amount ?? 0
  }

  // Line 11: Phase-out reduction amount
  l11 = (): number => {
    const agi = this.agiBeforeSchedule1A()
    const filingStatus = this.filingStatus()
    const phaseOutStart = autoLoanInterestDeduction.phaseOutStart(filingStatus)
    return this.thousandDollarReduction(
      agi - phaseOutStart,
      autoLoanInterestDeduction.phaseOutReductionPerThousand,
      true
    )
  }

  // Line 12: Auto loan interest deduction before phase-out
  l12 = (): number => {
    return Math.min(this.l10(), this.l13())
  }

  // Line 13: Annual cap
  l13 = (): number => {
    return autoLoanInterestDeduction.annualCap
  }

  // Line 14: Auto loan interest deduction after phase-out
  l14 = (): number => {
    return Math.max(0, this.l12() - this.l11())
  }

  // =========================================================================
  // Part IV: Senior Additional Deduction (65+)
  // =========================================================================

  qualifiesForSeniorDeduction = (): boolean => {
    return this.l15() > 0
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
    const filingStatus = this.filingStatus()
    if (filingStatus === FilingStatus.MFS) {
      return 0
    }

    let count = 0
    if (
      this.getPrimaryAge() >= seniorAdditionalDeduction.minAge &&
      this.hasValidSsn(this.f1040.info.taxPayer.primaryPerson.ssid)
    ) {
      count++
    }
    const spouseAge = this.getSpouseAge()
    if (
      filingStatus === FilingStatus.MFJ &&
      spouseAge !== undefined &&
      spouseAge >= seniorAdditionalDeduction.minAge &&
      this.hasValidSsn(this.f1040.info.taxPayer.spouse?.ssid)
    ) {
      count++
    }
    return count
  }

  // Line 16: Senior additional deduction
  l16 = (): number => {
    const baseDeduction = this.l15() * seniorAdditionalDeduction.amount
    return Math.max(0, baseDeduction - this.seniorPhaseOutAmount())
  }

  // =========================================================================
  // Total Additional Deductions
  // =========================================================================

  // Simplified schedule total used by the current implementation. For 2025 this
  // entire amount flows into the deductions section of Form 1040/1040-NR.
  l17 = (): number => {
    return sumFields([this.l5(), this.l8(), this.l14(), this.l16()])
  }

  // Transfer Schedule 1-A deductions into the deductions section.
  to1040 = (): number => this.l17()

  // Retained for compatibility with older callers; the senior amount is already
  // included in to1040() for 2025 resident-return calculations.
  seniorDeductionTo1040 = (): number => {
    return this.l16()
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
