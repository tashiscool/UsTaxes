import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8879 - IRS e-file Signature Authorization
 *
 * Authorizes an Electronic Return Originator (ERO) to enter the
 * taxpayer's PIN for e-filing.
 *
 * CRITICAL for e-filing:
 * - Required for all e-filed returns when using a tax professional
 * - Contains taxpayer's authorization for the ERO to submit the return
 * - Includes self-select PIN or practitioner PIN
 *
 * This form is NOT submitted to the IRS - retained by the ERO.
 */

export interface F8879Data {
  // Part I: Taxpayer Information
  taxpayerName: string
  taxpayerSSN: string
  spouseName?: string
  spouseSSN?: string
  // Tax return information (from the return)
  adjustedGrossIncome: number // From Form 1040 Line 11
  totalTax: number // From Form 1040 Line 24
  federalIncomeTaxWithheld: number // From Form 1040 Line 25d
  refundAmount?: number // From Form 1040 Line 34
  amountOwed?: number // From Form 1040 Line 37
  // Part II: Declaration and Signature
  taxpayerPIN: string // 5-digit PIN
  spousePIN?: string // 5-digit PIN (if joint)
  eroFirmName: string
  eroAddress: string
  eroEIN: string
  eroPIN: string // ERO's PIN
  // Authorization type
  selfSelectPIN: boolean
  practitionerPIN: boolean
  // Signatures
  taxpayerSignatureDate: Date
  spouseSignatureDate?: Date
  eroSignatureDate: Date
  // Part III: For Paid Preparer
  preparerName?: string
  preparerPTIN?: string
  selfEmployed: boolean
}

export default class F8879 extends F1040Attachment {
  tag: FormTag = 'f8879'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    // Needed for all e-filed returns
    return this.hasF8879Data()
  }

  hasF8879Data = (): boolean => {
    return false // Would be true when e-filing
  }

  f8879Data = (): F8879Data | undefined => {
    return undefined
  }

  // Taxpayer info
  taxpayerName = (): string => this.f8879Data()?.taxpayerName ?? ''
  taxpayerSSN = (): string => this.f8879Data()?.taxpayerSSN ?? ''

  // Key amounts (must match the return exactly)
  adjustedGrossIncome = (): number => this.f8879Data()?.adjustedGrossIncome ?? 0
  totalTax = (): number => this.f8879Data()?.totalTax ?? 0
  federalIncomeTaxWithheld = (): number =>
    this.f8879Data()?.federalIncomeTaxWithheld ?? 0
  refundAmount = (): number => this.f8879Data()?.refundAmount ?? 0
  amountOwed = (): number => this.f8879Data()?.amountOwed ?? 0

  // PINs
  taxpayerPIN = (): string => this.f8879Data()?.taxpayerPIN ?? ''
  spousePIN = (): string => this.f8879Data()?.spousePIN ?? ''

  // Is joint return?
  isJointReturn = (): boolean => {
    return (this.f8879Data()?.spouseName ?? '').length > 0
  }

  // PIN method
  useSelfSelectPIN = (): boolean => this.f8879Data()?.selfSelectPIN ?? true
  usePractitionerPIN = (): boolean => this.f8879Data()?.practitionerPIN ?? false

  // Validity check
  isValid = (): boolean => {
    const data = this.f8879Data()
    if (!data) return false

    // PIN must be 5 digits
    if (data.taxpayerPIN.length !== 5) return false
    if (this.isJointReturn() && (data.spousePIN?.length ?? 0) !== 5)
      return false

    return true
  }

  fields = (): Field[] => {
    const data = this.f8879Data()

    return [
      // Part I: Taxpayer Information
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.spouseName ?? '',
      data?.spouseSSN ?? '',
      // Tax return amounts
      this.adjustedGrossIncome(),
      this.totalTax(),
      this.federalIncomeTaxWithheld(),
      this.refundAmount(),
      this.amountOwed(),
      // Part II: PINs and Authorization
      this.taxpayerPIN(),
      this.spousePIN(),
      this.useSelfSelectPIN(),
      this.usePractitionerPIN(),
      // ERO information
      data?.eroFirmName ?? '',
      data?.eroAddress ?? '',
      data?.eroEIN ?? '',
      data?.eroPIN ?? '',
      // Signatures
      data?.taxpayerSignatureDate.toLocaleDateString() ?? '',
      data?.spouseSignatureDate?.toLocaleDateString() ?? '',
      data?.eroSignatureDate.toLocaleDateString() ?? '',
      // Part III: Paid Preparer
      data?.preparerName ?? '',
      data?.preparerPTIN ?? '',
      data?.selfEmployed ?? false,
      // Status
      this.isJointReturn(),
      this.isValid()
    ]
  }
}
