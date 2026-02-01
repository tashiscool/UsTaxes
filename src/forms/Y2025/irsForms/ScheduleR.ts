/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule R (Form 1040) - Credit for the Elderly or the Disabled
 *
 * Provides a nonrefundable credit for taxpayers who are:
 * - Age 65 or older by end of tax year, OR
 * - Under 65 and retired on permanent and total disability
 *
 * 2025 Parameters:
 * - Initial amount: $5,000 (single), $7,500 (MFJ both qualify), $3,750 (MFJ one qualifies)
 * - Reduced by nontaxable Social Security, pensions, disability income
 * - Further reduced by excess AGI over threshold
 * - Credit rate: 15% of remaining amount
 *
 * AGI thresholds for reduction:
 * - Single/HOH/QSS: $7,500
 * - MFJ: $10,000
 * - MFS: $5,000
 */

// 2025 credit parameters
const scheduleRParams = {
  // Initial credit amounts (before reductions)
  initialAmountSingle: 5000, // Single, HOH, or QSS
  initialAmountMfjBoth: 7500, // MFJ, both spouses qualify
  initialAmountMfjOne: 5000, // MFJ, one spouse qualifies
  initialAmountMfs: 3750, // MFS

  // AGI thresholds for reduction
  agiThresholdSingle: 7500, // Single, HOH, QSS
  agiThresholdMfj: 10000, // MFJ
  agiThresholdMfs: 5000, // MFS

  // Reduction rate for excess AGI
  agiReductionRate: 0.5, // 50% of excess AGI

  // Credit rate
  creditRate: 0.15 // 15% of final amount
}

export default class ScheduleR extends F1040Attachment {
  tag: FormTag = 'f1040sr'
  sequenceIndex = 16

  isNeeded = (): boolean => {
    return this.qualifiesForCredit() && this.l22() > 0
  }

  qualifiesForCredit = (): boolean => {
    // Check if primary taxpayer or spouse qualifies (65+ or disabled)
    return this.is65OrOlder() || this.isPermanentlyDisabled()
  }

  is65OrOlder = (): boolean => {
    const primary = this.f1040.info.taxPayer.primaryPerson
    const currentYear = 2025

    // Check primary taxpayer age
    if (primary.dateOfBirth) {
      const birthYear = new Date(primary.dateOfBirth).getFullYear()
      if (currentYear - birthYear >= 65) return true
    }

    // Check spouse age if married
    const spouse = this.f1040.info.taxPayer.spouse
    if (spouse?.dateOfBirth) {
      const birthYear = new Date(spouse.dateOfBirth).getFullYear()
      if (currentYear - birthYear >= 65) return true
    }

    return false
  }

  isPermanentlyDisabled = (): boolean => {
    // Would need additional data field for disability status
    // Simplified: check if receiving disability income
    return (this.f1040.info.disabilityIncome ?? 0) > 0
  }

  primaryQualifies = (): boolean => {
    const primary = this.f1040.info.taxPayer.primaryPerson
    if (!primary.dateOfBirth) return false
    const birthYear = new Date(primary.dateOfBirth).getFullYear()
    return 2025 - birthYear >= 65
  }

  spouseQualifies = (): boolean => {
    const spouse = this.f1040.info.taxPayer.spouse
    if (!spouse?.dateOfBirth) return false
    const birthYear = new Date(spouse.dateOfBirth).getFullYear()
    return 2025 - birthYear >= 65
  }

  // Part I - Check the Box for Your Filing Status and Age

  // Filing status category determines initial amount
  filingCategory = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const bothQualify = this.primaryQualifies() && this.spouseQualifies()
    const oneQualifies = this.primaryQualifies() || this.spouseQualifies()

    if (fs === FilingStatus.MFJ) {
      if (bothQualify) return 2 // Box 2: MFJ, both 65+
      if (oneQualifies) return 3 // Box 3: MFJ, one 65+
    } else if (fs === FilingStatus.MFS) {
      return 6 // Box 6: MFS
    } else if (
      fs === FilingStatus.HOH ||
      fs === FilingStatus.S ||
      fs === FilingStatus.W
    ) {
      return 1 // Box 1: Single, HOH, or QSS
    }

    return 0 // Does not qualify
  }

  // Part II - Statement of Permanent and Total Disability
  // (Required if under 65 and claiming based on disability)

  // Part III - Figure Your Credit

  // Line 10: Initial amount based on filing category
  l10 = (): number => {
    const category = this.filingCategory()

    switch (category) {
      case 1:
        return scheduleRParams.initialAmountSingle // $5,000
      case 2:
        return scheduleRParams.initialAmountMfjBoth // $7,500
      case 3:
        return scheduleRParams.initialAmountMfjOne // $5,000
      case 6:
        return scheduleRParams.initialAmountMfs // $3,750
      default:
        return 0
    }
  }

  // Line 11: If you checked boxes 2, 4, 5, 6, or 9 in Part I, enter the amount shown
  // (Disability income limitation for those under 65)
  l11 = (): number => {
    // For those under 65, limit to disability income received
    if (!this.is65OrOlder()) {
      return this.f1040.info.disabilityIncome ?? 0
    }
    return this.l10() // No limit if 65+
  }

  // Line 12: If line 11 is less than line 10, enter the smaller amount
  l12 = (): number => Math.min(this.l10(), this.l11())

  // Line 13: Nontaxable Social Security and Railroad Retirement benefits
  l13 = (): number => {
    // Social Security benefits not included in income
    const ssIncome = this.f1040.l6a() ?? 0 // Total SS benefits
    const ssTaxable = this.f1040.l6b() ?? 0 // Taxable SS benefits
    return Math.max(0, ssIncome - ssTaxable)
  }

  // Line 14: Nontaxable pensions, annuities, or disability income
  l14 = (): number => {
    // Would need additional data for nontaxable pension income
    return this.f1040.info.nontaxablePensionIncome ?? 0
  }

  // Line 15: Add lines 13 and 14
  l15 = (): number => this.l13() + this.l14()

  // Line 16: Subtract line 15 from line 12
  l16 = (): number => Math.max(0, this.l12() - this.l15())

  // Line 17: AGI from Form 1040 line 11
  l17 = (): number => this.f1040.l11()

  // Line 18: AGI threshold based on filing status
  l18 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    if (fs === FilingStatus.MFJ) return scheduleRParams.agiThresholdMfj
    if (fs === FilingStatus.MFS) return scheduleRParams.agiThresholdMfs
    return scheduleRParams.agiThresholdSingle
  }

  // Line 19: Subtract line 18 from line 17 (if less than zero, enter 0)
  l19 = (): number => Math.max(0, this.l17() - this.l18())

  // Line 20: Multiply line 19 by 50% (0.50)
  l20 = (): number => Math.round(this.l19() * scheduleRParams.agiReductionRate)

  // Line 21: Subtract line 20 from line 16 (if zero or less, stop - no credit)
  l21 = (): number => Math.max(0, this.l16() - this.l20())

  // Line 22: Credit - Multiply line 21 by 15% (0.15)
  l22 = (): number => Math.round(this.l21() * scheduleRParams.creditRate)

  // Credit method for Schedule 3
  credit = (): number => this.l22()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I - Filing status boxes
    this.filingCategory() === 1, // Box 1
    this.filingCategory() === 2, // Box 2
    this.filingCategory() === 3, // Box 3
    this.filingCategory() === 4, // Box 4
    this.filingCategory() === 5, // Box 5
    this.filingCategory() === 6, // Box 6
    // Part III - Credit calculation
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22()
  ]
}
