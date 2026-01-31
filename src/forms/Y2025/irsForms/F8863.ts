import F1040Attachment from './F1040Attachment'
import { FilingStatus, EducationExpense, PersonRole } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8863 - Education Credits
 *
 * Two credits:
 * 1. American Opportunity Tax Credit (AOTC)
 *    - Max $2,500 per student (100% of first $2,000 + 25% of next $2,000)
 *    - First 4 years of postsecondary education
 *    - 40% refundable (up to $1,000)
 *    - Phase-out: $80K-$90K single, $160K-$180K MFJ
 *
 * 2. Lifetime Learning Credit (LLC)
 *    - Max $2,000 per return (20% of up to $10,000 expenses)
 *    - Any postsecondary education
 *    - Nonrefundable
 *    - Phase-out: $80K-$90K single, $160K-$180K MFJ (2025)
 */

// 2025 parameters
const educationCredits = {
  // AOTC
  aotcMaxCredit: 2500,
  aotcFirstTierExpenses: 2000,
  aotcSecondTierExpenses: 2000,
  aotcRefundablePercent: 0.40,
  aotcPhaseOutStart: { single: 80000, mfj: 160000 },
  aotcPhaseOutEnd: { single: 90000, mfj: 180000 },

  // LLC
  llcMaxExpenses: 10000,
  llcCreditRate: 0.20,
  llcMaxCredit: 2000,
  llcPhaseOutStart: { single: 80000, mfj: 160000 },
  llcPhaseOutEnd: { single: 90000, mfj: 180000 }
}

export default class F8863 extends F1040Attachment {
  tag: FormTag = 'f8863'
  sequenceIndex = 55

  isNeeded = (): boolean => {
    return this.hasEducationExpenses() && (this.l8() > 0 || this.l19() > 0)
  }

  hasEducationExpenses = (): boolean => {
    return (this.f1040.info.educationExpenses?.length ?? 0) > 0
  }

  educationExpenses = (): EducationExpense[] => {
    return this.f1040.info.educationExpenses ?? []
  }

  aotcStudents = (): EducationExpense[] => {
    return this.educationExpenses().filter(e => e.creditType === 'AOTC')
  }

  llcStudents = (): EducationExpense[] => {
    return this.educationExpenses().filter(e => e.creditType === 'LLC')
  }

  // Calculate modified AGI for education credits
  magi = (): number => {
    // MAGI = AGI + foreign earned income exclusion
    return this.f1040.l11() + (this.f1040.f2555?.l45() ?? 0)
  }

  // Get filing status category for phase-out
  isMfj = (): boolean => {
    return this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ
  }

  // Calculate phase-out multiplier
  aotcPhaseOutMultiplier = (): number => {
    const magi = this.magi()
    const start = this.isMfj() ? educationCredits.aotcPhaseOutStart.mfj : educationCredits.aotcPhaseOutStart.single
    const end = this.isMfj() ? educationCredits.aotcPhaseOutEnd.mfj : educationCredits.aotcPhaseOutEnd.single

    if (magi <= start) return 1
    if (magi >= end) return 0
    return (end - magi) / (end - start)
  }

  llcPhaseOutMultiplier = (): number => {
    const magi = this.magi()
    const start = this.isMfj() ? educationCredits.llcPhaseOutStart.mfj : educationCredits.llcPhaseOutStart.single
    const end = this.isMfj() ? educationCredits.llcPhaseOutEnd.mfj : educationCredits.llcPhaseOutEnd.single

    if (magi <= start) return 1
    if (magi >= end) return 0
    return (end - magi) / (end - start)
  }

  // Calculate AOTC for one student
  calculateAotcForStudent = (expense: EducationExpense): number => {
    if (!expense.isFirstFourYears || expense.hasConviction) return 0

    const qualified = Math.max(0, expense.qualifiedExpenses - expense.scholarshipsReceived)

    // 100% of first $2,000 + 25% of next $2,000
    const firstTier = Math.min(qualified, educationCredits.aotcFirstTierExpenses)
    const secondTier = Math.min(
      Math.max(0, qualified - educationCredits.aotcFirstTierExpenses),
      educationCredits.aotcSecondTierExpenses
    )

    return firstTier + (secondTier * 0.25)
  }

  // Part I - Refundable American Opportunity Credit

  // Line 1: AOTC credit amount before phase-out (total for all students)
  l1 = (): number => {
    return this.aotcStudents()
      .reduce((sum, s) => sum + this.calculateAotcForStudent(s), 0)
  }

  // Line 2: MAGI
  l2 = (): number => this.magi()

  // Line 3: Phase-out threshold
  l3 = (): number => this.isMfj() ? 160000 : 80000

  // Line 4: Subtract line 3 from line 2
  l4 = (): number => Math.max(0, this.l2() - this.l3())

  // Line 5: Divide line 4 by $10,000 ($20,000 if MFJ)
  l5 = (): number => {
    const divisor = this.isMfj() ? 20000 : 10000
    return Math.min(1, this.l4() / divisor)
  }

  // Line 6: Multiply line 1 by line 5
  l6 = (): number => Math.round(this.l1() * this.l5())

  // Line 7: Tentative AOTC (line 1 - line 6)
  l7 = (): number => Math.max(0, this.l1() - this.l6())

  // Line 8: Refundable AOTC (40% of line 7, max $1,000 per student)
  l8 = (): number => {
    const refundableAmount = Math.round(this.l7() * educationCredits.aotcRefundablePercent)
    // Maximum $1,000 per student
    const maxRefundable = this.aotcStudents().length * 1000
    return Math.min(refundableAmount, maxRefundable)
  }

  // Part II - Nonrefundable Education Credits

  // Line 9: Nonrefundable AOTC (line 7 - line 8)
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: LLC qualified expenses
  l10 = (): number => {
    const totalExpenses = this.llcStudents()
      .reduce((sum, s) => sum + Math.max(0, s.qualifiedExpenses - s.scholarshipsReceived), 0)
    return Math.min(totalExpenses, educationCredits.llcMaxExpenses)
  }

  // Line 11: LLC credit (line 10 × 20%)
  l11 = (): number => Math.round(this.l10() * educationCredits.llcCreditRate)

  // Line 12-17: LLC phase-out (similar to AOTC)
  l12 = (): number => this.magi()
  l13 = (): number => this.isMfj() ? 160000 : 80000
  l14 = (): number => Math.max(0, this.l12() - this.l13())
  l15 = (): number => {
    const divisor = this.isMfj() ? 20000 : 10000
    return Math.min(1, this.l14() / divisor)
  }
  l16 = (): number => Math.round(this.l11() * this.l15())
  l17 = (): number => Math.max(0, this.l11() - this.l16())

  // Line 18: Add lines 9 and 17 (total nonrefundable)
  l18 = (): number => this.l9() + this.l17()

  // Line 19: Credit limit based on tax liability
  l19 = (): number => {
    // Limited by tax minus other nonrefundable credits
    const tax = this.f1040.l18()
    const otherCredits = sumFields([
      this.f1040.schedule3.l1(),
      this.f1040.schedule3.l2(),
      this.f1040.schedule3.l4()
    ])
    const limit = Math.max(0, tax - otherCredits)
    return Math.min(this.l18(), limit)
  }

  // Summary methods
  refundableCredit = (): number => this.l8()  // Goes to Form 1040 line 29
  nonrefundableCredit = (): number => this.l19()  // Goes to Schedule 3 line 3

  fields = (): Field[] => {
    // Student information (up to 4 students)
    const studentFields: Field[] = []
    const allStudents = this.educationExpenses()

    for (let i = 0; i < 4; i++) {
      const student = allStudents[i]
      studentFields.push(
        student?.studentName ?? '',
        student?.studentSsn ?? '',
        student?.institutionName ?? '',
        student?.institutionEin ?? '',
        student?.qualifiedExpenses ?? 0,
        student?.scholarshipsReceived ?? 0,
        student?.creditType === 'AOTC',
        student?.creditType === 'LLC',
        student?.isFirstFourYears ?? false,
        student?.isHalfTimeStudent ?? false
      )
    }

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Student information
      ...studentFields,
      // Part I - Refundable AOTC
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      // Part II - Nonrefundable
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19()
    ]
  }
}
