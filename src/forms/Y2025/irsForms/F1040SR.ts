import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1040-SR - U.S. Tax Return for Seniors
 *
 * Alternative to Form 1040 for taxpayers who are age 65 or older.
 * This form has:
 * - Larger print for easier reading
 * - Standard deduction chart on the form
 * - Same lines and calculations as Form 1040
 *
 * Eligibility: Taxpayer (or spouse if MFJ) is born before January 2, 1961 (for 2025)
 *
 * This implementation tracks the senior-specific benefits and provides
 * the standard deduction amounts specific to seniors.
 */

export interface Form1040SRInfo {
  // Primary taxpayer born before January 2, 1961
  primaryIsSenior: boolean
  primaryIsBlind: boolean
  // Spouse (if applicable)
  spouseIsSenior: boolean
  spouseIsBlind: boolean
  // Filing status
  filingStatus: FilingStatus
}

// 2025 Standard Deduction amounts for seniors
const SENIOR_STANDARD_DEDUCTIONS_2025 = {
  // Base amounts (same as regular 1040)
  [FilingStatus.S]: 15000,
  [FilingStatus.MFJ]: 30000,
  [FilingStatus.MFS]: 15000,
  [FilingStatus.HOH]: 22500,
  [FilingStatus.W]: 30000,
  // Additional amounts for age 65+ and/or blind
  additionalSingleOrHOH: 2000,  // Per qualifying condition
  additionalMarried: 1600       // Per qualifying condition
}

export default class F1040SR extends F1040Attachment {
  tag: FormTag = 'f1040sr'
  sequenceIndex = 0  // Primary form

  isNeeded = (): boolean => {
    // Form 1040-SR is needed if primary or spouse is 65 or older
    return this.isPrimaryEligible() || this.isSpouseEligible()
  }

  // Check if taxpayer is born before January 2, 1961 (age 65+ by end of 2025)
  isPrimaryEligible = (): boolean => {
    const dob = this.f1040.info.taxPayer.primaryPerson.dateOfBirth
    const seniorCutoff = new Date(1961, 0, 2)  // January 2, 1961
    return dob < seniorCutoff
  }

  isSpouseEligible = (): boolean => {
    const spouse = this.f1040.info.taxPayer.spouse
    if (!spouse) return false
    const dob = spouse.dateOfBirth
    const seniorCutoff = new Date(1961, 0, 2)
    return dob < seniorCutoff
  }

  isPrimaryBlind = (): boolean => {
    return this.f1040.info.taxPayer.primaryPerson.isBlind
  }

  isSpouseBlind = (): boolean => {
    return this.f1040.info.taxPayer.spouse?.isBlind ?? false
  }

  filingStatus = (): FilingStatus => {
    return this.f1040.info.taxPayer.filingStatus
  }

  // Calculate number of additional deduction amounts (for age 65+ and blind)
  numberOfAdditionalDeductions = (): number => {
    let count = 0
    if (this.isPrimaryEligible()) count++
    if (this.isPrimaryBlind()) count++
    if (this.isSpouseEligible()) count++
    if (this.isSpouseBlind()) count++
    return count
  }

  // Get the base standard deduction
  baseStandardDeduction = (): number => {
    return SENIOR_STANDARD_DEDUCTIONS_2025[this.filingStatus()]
  }

  // Get the additional deduction amount per qualifying condition
  additionalDeductionAmount = (): number => {
    const status = this.filingStatus()
    if (status === FilingStatus.S || status === FilingStatus.HOH) {
      return SENIOR_STANDARD_DEDUCTIONS_2025.additionalSingleOrHOH
    }
    return SENIOR_STANDARD_DEDUCTIONS_2025.additionalMarried
  }

  // Total additional deductions
  totalAdditionalDeductions = (): number => {
    return this.numberOfAdditionalDeductions() * this.additionalDeductionAmount()
  }

  // Total standard deduction for seniors
  seniorStandardDeduction = (): number => {
    return this.baseStandardDeduction() + this.totalAdditionalDeductions()
  }

  // Standard deduction chart values (displayed on Form 1040-SR)
  standardDeductionChartSingle = (): number => {
    // Single, 65+, not blind
    return SENIOR_STANDARD_DEDUCTIONS_2025[FilingStatus.S] +
           SENIOR_STANDARD_DEDUCTIONS_2025.additionalSingleOrHOH
  }

  standardDeductionChartSingleBlind = (): number => {
    // Single, 65+, blind
    return SENIOR_STANDARD_DEDUCTIONS_2025[FilingStatus.S] +
           (SENIOR_STANDARD_DEDUCTIONS_2025.additionalSingleOrHOH * 2)
  }

  standardDeductionChartMFJBoth65 = (): number => {
    // MFJ, both 65+, neither blind
    return SENIOR_STANDARD_DEDUCTIONS_2025[FilingStatus.MFJ] +
           (SENIOR_STANDARD_DEDUCTIONS_2025.additionalMarried * 2)
  }

  standardDeductionChartMFJBoth65BothBlind = (): number => {
    // MFJ, both 65+, both blind
    return SENIOR_STANDARD_DEDUCTIONS_2025[FilingStatus.MFJ] +
           (SENIOR_STANDARD_DEDUCTIONS_2025.additionalMarried * 4)
  }

  // Checkboxes for line 12 (standard deduction section)
  checkboxAge65Primary = (): boolean => this.isPrimaryEligible()
  checkboxBlindPrimary = (): boolean => this.isPrimaryBlind()
  checkboxAge65Spouse = (): boolean => this.isSpouseEligible()
  checkboxBlindSpouse = (): boolean => this.isSpouseBlind()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Filing status
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
    // Age/Blind checkboxes
    this.checkboxAge65Primary(),
    this.checkboxBlindPrimary(),
    this.checkboxAge65Spouse(),
    this.checkboxBlindSpouse(),
    // Standard deduction calculation
    this.baseStandardDeduction(),
    this.numberOfAdditionalDeductions(),
    this.additionalDeductionAmount(),
    this.totalAdditionalDeductions(),
    this.seniorStandardDeduction(),
    // Standard deduction chart reference values
    this.standardDeductionChartSingle(),
    this.standardDeductionChartSingleBlind(),
    this.standardDeductionChartMFJBoth65(),
    this.standardDeductionChartMFJBoth65BothBlind()
  ]
}
