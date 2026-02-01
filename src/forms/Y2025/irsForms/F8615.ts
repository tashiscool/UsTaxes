import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { computeOrdinaryTax } from './TaxTable'
import { CURRENT_YEAR } from '../data/federal'

/**
 * Form 8615 - Tax for Certain Children Who Have Unearned Income
 *
 * "Kiddie Tax" - applies to children under 19 (or under 24 if full-time student)
 * with unearned income over $2,500 (2025).
 *
 * The child's unearned income above the threshold is taxed at the parent's
 * marginal tax rate.
 */

// 2025 thresholds
const kiddieeTaxThresholds = {
  // Amount of unearned income that is tax-free
  exemptAmount: 1300,
  // Additional amount taxed at child's rate
  childRateAmount: 1300,
  // Total threshold before parent's rate applies
  threshold: 2600
}

interface ParentInfo {
  taxableIncome?: number
  filingStatus?: FilingStatus
  name?: string
  ssid?: string
}

export default class F8615 extends F1040Attachment {
  tag: FormTag = 'f8615'
  sequenceIndex = 33

  isNeeded = (): boolean => {
    return this.qualifies() && this.l1() > kiddieeTaxThresholds.threshold
  }

  // Check if child qualifies for kiddie tax
  qualifies = (): boolean => {
    const birthDate = this.f1040.info.taxPayer.primaryPerson.dateOfBirth
    const age = CURRENT_YEAR - birthDate.getFullYear()

    // Child must be under 19, or under 24 if full-time student
    const isUnder19 = age < 19
    const isStudentUnder24 =
      age < 24 && (this.f1040.info.taxPayer.primaryPerson.isStudent ?? false)

    // Child must have unearned income
    const hasUnearnedIncome = this.l1() > 0

    // Child must have required support from parent (simplified check)
    const hasParentSupport =
      this.f1040.info.taxPayer.primaryPerson.isTaxpayerDependent ||
      this.parentInfo() !== undefined

    return (
      (isUnder19 || isStudentUnder24) && hasUnearnedIncome && hasParentSupport
    )
  }

  // Get parent information (for calculating parent's tax rate)
  parentInfo = (): ParentInfo | undefined => {
    return this.f1040.info.parentInfo as ParentInfo | undefined
  }

  // Part I - Child's Net Unearned Income

  // Line 1: Child's unearned income (interest, dividends, capital gains, etc.)
  l1 = (): number => {
    const interest = this.f1040.l2b() ?? 0
    const dividends = this.f1040.l3b() ?? 0
    const capitalGains = this.f1040.l7() ?? 0
    return interest + dividends + capitalGains
  }

  // Line 2: If child itemized, enter $0. Otherwise, enter $2,600 (2025)
  l2 = (): number => {
    if (this.f1040.scheduleA.isNeeded()) {
      return Math.min(this.l1(), 1300 + this.f1040.scheduleA.deductions())
    }
    return Math.min(this.l1(), kiddieeTaxThresholds.threshold)
  }

  // Line 3: Subtract line 2 from line 1 (net unearned income)
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Part II - Tentative Tax Based on Parent's Tax Rate

  // Line 4: Parent's taxable income from Form 1040 line 15
  l4 = (): number => {
    const parent = this.parentInfo()
    return parent?.taxableIncome ?? 0
  }

  // Line 5: Add line 3 to line 4 (parent's income plus child's unearned income)
  l5 = (): number => this.l4() + this.l3()

  // Line 6: Parent's tax based on amount on line 4
  l6 = (): number => {
    const parent = this.parentInfo()
    const filingStatus = parent?.filingStatus ?? FilingStatus.S
    return computeOrdinaryTax(filingStatus, this.l4())
  }

  // Line 7: Tax on line 5 using parent's filing status
  l7 = (): number => {
    const parent = this.parentInfo()
    const filingStatus = parent?.filingStatus ?? FilingStatus.S
    return computeOrdinaryTax(filingStatus, this.l5())
  }

  // Line 8: Subtract line 6 from line 7 (additional tax from child's income)
  l8 = (): number => Math.max(0, this.l7() - this.l6())

  // Line 9: Child's earned income plus $2,600 (simplified base)
  l9 = (): number => {
    const earnedIncome = this.f1040.l1z() - this.l1()
    return Math.max(0, earnedIncome) + kiddieeTaxThresholds.threshold
  }

  // Line 10: Child's taxable income (Form 1040 line 15)
  l10 = (): number => this.f1040.l15()

  // Line 11: Subtract line 9 from line 10
  l11 = (): number => Math.max(0, this.l10() - this.l9())

  // Line 12: Tax on line 11 at parent's rate
  l12 = (): number => {
    const parent = this.parentInfo()
    const filingStatus = parent?.filingStatus ?? FilingStatus.S
    return computeOrdinaryTax(filingStatus, this.l11())
  }

  // Line 13: Add lines 8 and 12 (tentative tax at parent's rate)
  l13 = (): number => this.l8() + this.l12()

  // Part III - Tax Computation

  // Line 14: Tax on child's taxable income at child's rate
  l14 = (): number => {
    return computeOrdinaryTax(this.f1040.info.taxPayer.filingStatus, this.l10())
  }

  // Line 15: Enter larger of line 13 or line 14
  l15 = (): number => Math.max(this.l13(), this.l14())

  // This is the tax that goes to Form 1040 line 16
  tax = (): number => {
    if (!this.isNeeded()) {
      return 0
    }
    return this.l15()
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Parent information
    this.parentInfo()?.name ?? '',
    this.parentInfo()?.ssid ?? '',
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    // Part II
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
    // Part III
    this.l14(),
    this.l15()
  ]
}
