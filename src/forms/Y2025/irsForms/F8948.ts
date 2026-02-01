/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8948 - Preparer Explanation for Not Filing Electronically
 *
 * Used by paid preparers who file paper returns when e-filing
 * is normally required. Must explain why the return was not
 * filed electronically.
 *
 * E-filing is required for preparers who file more than 10 returns.
 */

export interface F8948Data {
  // Preparer Information
  preparerName: string
  preparerPTIN: string
  preparerFirmName?: string
  preparerFirmEIN?: string
  preparerAddress: string
  preparerCity: string
  preparerState: string
  preparerZip: string
  preparerPhone: string
  // Taxpayer Information
  taxpayerName: string
  taxpayerSSN: string
  taxYear: number
  // Reason for not e-filing
  reasonCode: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
  otherExplanation?: string
  // Checkbox reasons
  taxpayerChoseToFile: boolean // (a) Taxpayer chose to file on paper
  returnTypeNotAccepted: boolean // (b) Return type not accepted
  schedulesNotAccepted: boolean // (c) Schedules/forms not accepted
  irsRejectedReturn: boolean // (d) IRS rejected e-filed return
  softwareNotReady: boolean // (e) Software not ready
  taxpayerFilesLater: boolean // (f) Taxpayer will file return later
  other: boolean // (g) Other
  // Signature
  signatureDate: Date
}

// Reason code descriptions
const REASON_CODES: Record<string, string> = {
  a: 'Taxpayer chose to file on paper',
  b: 'Return type not accepted for e-filing',
  c: 'Schedules, forms, or attachments cannot be e-filed',
  d: 'IRS rejected the e-filed return and preparer cannot correct issue',
  e: 'E-file software not ready for this return type',
  f: 'Taxpayer will file return at later date',
  g: 'Other (explanation required)',
  h: 'Preparer has waiver from e-file requirement'
}

export default class F8948 extends F1040Attachment {
  tag: FormTag = 'f8948'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8948Data()
  }

  hasF8948Data = (): boolean => {
    return false // Only needed by paid preparers filing paper returns
  }

  f8948Data = (): F8948Data | undefined => {
    return undefined
  }

  // Reason code
  reasonCode = (): string => this.f8948Data()?.reasonCode ?? ''

  reasonDescription = (): string => {
    return REASON_CODES[this.reasonCode()] ?? ''
  }

  // Is taxpayer choice?
  isTaxpayerChoice = (): boolean => {
    return this.f8948Data()?.taxpayerChoseToFile ?? false
  }

  // Is technical limitation?
  isTechnicalLimitation = (): boolean => {
    const data = this.f8948Data()
    if (!data) return false
    return (
      data.returnTypeNotAccepted ||
      data.schedulesNotAccepted ||
      data.softwareNotReady
    )
  }

  // Is IRS rejection?
  isIRSRejection = (): boolean => {
    return this.f8948Data()?.irsRejectedReturn ?? false
  }

  // Requires explanation?
  requiresExplanation = (): boolean => {
    return this.f8948Data()?.other ?? false
  }

  // Has valid explanation?
  hasValidExplanation = (): boolean => {
    if (!this.requiresExplanation()) return true
    return (this.f8948Data()?.otherExplanation ?? '').length > 0
  }

  fields = (): Field[] => {
    const data = this.f8948Data()

    return [
      // Preparer Information
      data?.preparerName ?? '',
      data?.preparerPTIN ?? '',
      data?.preparerFirmName ?? '',
      data?.preparerFirmEIN ?? '',
      data?.preparerAddress ?? '',
      data?.preparerCity ?? '',
      data?.preparerState ?? '',
      data?.preparerZip ?? '',
      data?.preparerPhone ?? '',
      // Taxpayer Information
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.taxYear ?? 2025,
      // Reason checkboxes
      data?.taxpayerChoseToFile ?? false, // (a)
      data?.returnTypeNotAccepted ?? false, // (b)
      data?.schedulesNotAccepted ?? false, // (c)
      data?.irsRejectedReturn ?? false, // (d)
      data?.softwareNotReady ?? false, // (e)
      data?.taxpayerFilesLater ?? false, // (f)
      data?.other ?? false, // (g)
      data?.otherExplanation ?? '',
      // Analysis
      this.reasonCode(),
      this.reasonDescription(),
      this.isTaxpayerChoice(),
      this.isTechnicalLimitation(),
      this.isIRSRejection(),
      this.hasValidExplanation(),
      // Signature
      data?.signatureDate.toLocaleDateString() ?? ''
    ]
  }
}
