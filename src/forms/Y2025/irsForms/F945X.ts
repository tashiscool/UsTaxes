import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 945-X - Adjusted Annual Return of Withheld Federal Income Tax or Claim for Refund
 *
 * Used to correct errors on a previously filed Form 945.
 * Form 945 reports federal income tax withheld from nonpayroll payments:
 * - Pensions
 * - Annuities
 * - IRAs
 * - Military retirement
 * - Gambling winnings
 * - Backup withholding
 * - Payments to foreign persons
 *
 * Can be used to:
 * - Correct withholding amounts
 * - Claim refunds or adjustments
 */

export interface F945XData {
  // Return being corrected
  yearBeingCorrected: number
  dateOriginalReturnFiled: Date
  // Type of correction
  isAdjustedReturn: boolean
  isClaimForRefund: boolean
  // Federal income tax withheld
  correctedFedWithheld: number
  originalFedWithheld: number
  // Backup withholding
  correctedBackupWithholding: number
  originalBackupWithholding: number
  // Explanation
  explanationOfChanges: string
  // Certification
  certifyCorrect: boolean
}

export default class F945X extends F1040Attachment {
  tag: FormTag = 'f945x'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF945XData()
  }

  hasF945XData = (): boolean => {
    return false
  }

  f945XData = (): F945XData | undefined => {
    return undefined
  }

  yearCorrected = (): number => this.f945XData()?.yearBeingCorrected ?? 2025

  fedWithheldDifference = (): number => {
    const data = this.f945XData()
    return (data?.correctedFedWithheld ?? 0) - (data?.originalFedWithheld ?? 0)
  }

  backupWithholdingDifference = (): number => {
    const data = this.f945XData()
    return (
      (data?.correctedBackupWithholding ?? 0) -
      (data?.originalBackupWithholding ?? 0)
    )
  }

  totalDifference = (): number => {
    return this.fedWithheldDifference() + this.backupWithholdingDifference()
  }

  amountDue = (): number => Math.max(0, this.totalDifference())
  amountToRefund = (): number => Math.max(0, -this.totalDifference())

  fields = (): Field[] => {
    const data = this.f945XData()

    return [
      data?.yearBeingCorrected ?? 0,
      data?.dateOriginalReturnFiled.toLocaleDateString() ?? '',
      data?.isAdjustedReturn ?? true,
      data?.isClaimForRefund ?? false,
      data?.originalFedWithheld ?? 0,
      data?.correctedFedWithheld ?? 0,
      this.fedWithheldDifference(),
      data?.originalBackupWithholding ?? 0,
      data?.correctedBackupWithholding ?? 0,
      this.backupWithholdingDifference(),
      this.totalDifference(),
      this.amountDue(),
      this.amountToRefund(),
      data?.explanationOfChanges ?? '',
      data?.certifyCorrect ?? false
    ]
  }
}
