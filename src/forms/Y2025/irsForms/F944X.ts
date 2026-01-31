import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 944-X - Adjusted Employer's ANNUAL Federal Tax Return or Claim for Refund
 *
 * Used to correct errors on a previously filed Form 944.
 * Form 944 is the annual return for small employers (less than $1,000 annual tax liability).
 *
 * Can be used to:
 * - Correct wages and tips
 * - Correct federal income tax withheld
 * - Correct social security and Medicare taxes
 * - Claim refunds or adjustments
 */

export interface F944XData {
  // Return being corrected
  yearBeingCorrected: number
  dateOriginalReturnFiled: Date
  // Type of correction
  isAdjustedReturn: boolean
  isClaimForRefund: boolean
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
  // Explanation
  explanationOfChanges: string
  // Certification
  certifyCorrect: boolean
}

// Tax rates
const SOCIAL_SECURITY_RATE = 0.124
const MEDICARE_RATE = 0.029

export default class F944X extends F1040Attachment {
  tag: FormTag = 'f944x'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF944XData()
  }

  hasF944XData = (): boolean => {
    return false
  }

  f944XData = (): F944XData | undefined => {
    return undefined
  }

  yearCorrected = (): number => this.f944XData()?.yearBeingCorrected ?? 2025

  wagesDifference = (): number => {
    const data = this.f944XData()
    return (data?.correctedWages ?? 0) - (data?.originalWages ?? 0)
  }

  fedWithheldDifference = (): number => {
    const data = this.f944XData()
    return (data?.correctedFedWithheld ?? 0) - (data?.originalFedWithheld ?? 0)
  }

  ssWagesDifference = (): number => {
    const data = this.f944XData()
    return (data?.correctedSSWages ?? 0) - (data?.originalSSWages ?? 0)
  }

  ssTaxDifference = (): number => {
    return Math.round(this.ssWagesDifference() * SOCIAL_SECURITY_RATE)
  }

  medicareWagesDifference = (): number => {
    const data = this.f944XData()
    return (data?.correctedMedicareWages ?? 0) - (data?.originalMedicareWages ?? 0)
  }

  medicareTaxDifference = (): number => {
    return Math.round(this.medicareWagesDifference() * MEDICARE_RATE)
  }

  addlMedicareDifference = (): number => {
    const data = this.f944XData()
    return (data?.correctedAddlMedicare ?? 0) - (data?.originalAddlMedicare ?? 0)
  }

  totalTaxDifference = (): number => {
    return sumFields([
      this.fedWithheldDifference(),
      this.ssTaxDifference(),
      this.medicareTaxDifference(),
      this.addlMedicareDifference()
    ])
  }

  amountDue = (): number => Math.max(0, this.totalTaxDifference())
  amountToRefund = (): number => Math.max(0, -this.totalTaxDifference())

  fields = (): Field[] => {
    const data = this.f944XData()

    return [
      data?.yearBeingCorrected ?? 0,
      data?.dateOriginalReturnFiled?.toLocaleDateString() ?? '',
      data?.isAdjustedReturn ?? true,
      data?.isClaimForRefund ?? false,
      data?.originalWages ?? 0,
      data?.correctedWages ?? 0,
      this.wagesDifference(),
      data?.originalFedWithheld ?? 0,
      data?.correctedFedWithheld ?? 0,
      this.fedWithheldDifference(),
      data?.originalSSWages ?? 0,
      data?.correctedSSWages ?? 0,
      this.ssWagesDifference(),
      this.ssTaxDifference(),
      data?.originalMedicareWages ?? 0,
      data?.correctedMedicareWages ?? 0,
      this.medicareWagesDifference(),
      this.medicareTaxDifference(),
      data?.originalAddlMedicare ?? 0,
      data?.correctedAddlMedicare ?? 0,
      this.addlMedicareDifference(),
      this.totalTaxDifference(),
      this.amountDue(),
      this.amountToRefund(),
      data?.explanationOfChanges ?? '',
      data?.certifyCorrect ?? false
    ]
  }
}
