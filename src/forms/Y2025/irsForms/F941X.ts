import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 941-X - Adjusted Employer's QUARTERLY Federal Tax Return or Claim for Refund
 *
 * Used to correct errors on a previously filed Form 941.
 *
 * Can be used to:
 * - Correct wages, tips, and other compensation
 * - Correct federal income tax withheld
 * - Correct social security and Medicare taxes
 * - Correct Additional Medicare Tax withheld
 * - Claim refunds or adjustments
 *
 * Two types of corrections:
 * - Adjusted employment tax return (increases or decreases tax)
 * - Claim for refund (only when requesting refund)
 */

export interface F941XCorrection {
  lineNumber: number
  originalAmount: number
  correctedAmount: number
  difference: number
  explanation: string
}

export interface F941XData {
  // Return being corrected
  quarterBeingCorrected: 1 | 2 | 3 | 4
  yearBeingCorrected: number
  dateOriginalReturnFiled: Date
  // Type of correction
  isAdjustedReturn: boolean
  isClaimForRefund: boolean
  // Part 1: Corrected wages and taxes
  corrections: F941XCorrection[]
  // Wages
  correctedWages: number
  originalWages: number
  // Federal income tax withheld
  correctedFedWithheld: number
  originalFedWithheld: number
  // Social security wages
  correctedSSWages: number
  originalSSWages: number
  // Medicare wages
  correctedMedicareWages: number
  originalMedicareWages: number
  // Additional Medicare Tax
  correctedAddlMedicare: number
  originalAddlMedicare: number
  // Part 2: Explanations
  explanations: string[]
  // Part 3: Certification
  certifyCorrect: boolean
}

// Tax rates for 2025
const SOCIAL_SECURITY_RATE = 0.124  // 6.2% employee + 6.2% employer
const MEDICARE_RATE = 0.029         // 1.45% employee + 1.45% employer
const ADDL_MEDICARE_RATE = 0.009    // 0.9% on wages over $200,000

export default class F941X extends F1040Attachment {
  tag: FormTag = 'f941x'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF941XData()
  }

  hasF941XData = (): boolean => {
    // Would check if corrections are needed
    return false
  }

  f941XData = (): F941XData | undefined => {
    return undefined  // Would be populated from employer data
  }

  // Period being corrected
  quarterCorrected = (): number => this.f941XData()?.quarterBeingCorrected ?? 1
  yearCorrected = (): number => this.f941XData()?.yearBeingCorrected ?? 2025

  quarterEndDate = (): string => {
    const quarter = this.quarterCorrected()
    const year = this.yearCorrected()
    const endMonths = ['March 31', 'June 30', 'September 30', 'December 31']
    return `${endMonths[quarter - 1]}, ${year}`
  }

  // Type of form
  isAdjustedReturn = (): boolean => this.f941XData()?.isAdjustedReturn ?? true
  isClaimForRefund = (): boolean => this.f941XData()?.isClaimForRefund ?? false

  // Wages corrections
  wagesDifference = (): number => {
    const data = this.f941XData()
    return (data?.correctedWages ?? 0) - (data?.originalWages ?? 0)
  }

  // Federal income tax withheld corrections
  fedWithheldDifference = (): number => {
    const data = this.f941XData()
    return (data?.correctedFedWithheld ?? 0) - (data?.originalFedWithheld ?? 0)
  }

  // Social security corrections
  ssWagesDifference = (): number => {
    const data = this.f941XData()
    return (data?.correctedSSWages ?? 0) - (data?.originalSSWages ?? 0)
  }

  ssTaxDifference = (): number => {
    return Math.round(this.ssWagesDifference() * SOCIAL_SECURITY_RATE)
  }

  // Medicare corrections
  medicareWagesDifference = (): number => {
    const data = this.f941XData()
    return (data?.correctedMedicareWages ?? 0) - (data?.originalMedicareWages ?? 0)
  }

  medicareTaxDifference = (): number => {
    return Math.round(this.medicareWagesDifference() * MEDICARE_RATE)
  }

  // Additional Medicare Tax corrections
  addlMedicareDifference = (): number => {
    const data = this.f941XData()
    return (data?.correctedAddlMedicare ?? 0) - (data?.originalAddlMedicare ?? 0)
  }

  // Total tax difference
  totalTaxDifference = (): number => {
    return sumFields([
      this.fedWithheldDifference(),
      this.ssTaxDifference(),
      this.medicareTaxDifference(),
      this.addlMedicareDifference()
    ])
  }

  // Amount due or refund
  amountDue = (): number => Math.max(0, this.totalTaxDifference())
  amountToRefund = (): number => Math.max(0, -this.totalTaxDifference())

  fields = (): Field[] => {
    const data = this.f941XData()

    return [
      // Header
      data?.yearBeingCorrected ?? 0,
      data?.quarterBeingCorrected ?? 1,
      this.quarterEndDate(),
      data?.dateOriginalReturnFiled?.toLocaleDateString() ?? '',
      // Type
      this.isAdjustedReturn(),
      this.isClaimForRefund(),
      // Wages
      data?.originalWages ?? 0,
      data?.correctedWages ?? 0,
      this.wagesDifference(),
      // Federal income tax withheld
      data?.originalFedWithheld ?? 0,
      data?.correctedFedWithheld ?? 0,
      this.fedWithheldDifference(),
      // Social security wages
      data?.originalSSWages ?? 0,
      data?.correctedSSWages ?? 0,
      this.ssWagesDifference(),
      this.ssTaxDifference(),
      // Medicare wages
      data?.originalMedicareWages ?? 0,
      data?.correctedMedicareWages ?? 0,
      this.medicareWagesDifference(),
      this.medicareTaxDifference(),
      // Additional Medicare
      data?.originalAddlMedicare ?? 0,
      data?.correctedAddlMedicare ?? 0,
      this.addlMedicareDifference(),
      // Totals
      this.totalTaxDifference(),
      this.amountDue(),
      this.amountToRefund(),
      // Certification
      data?.certifyCorrect ?? false
    ]
  }
}
