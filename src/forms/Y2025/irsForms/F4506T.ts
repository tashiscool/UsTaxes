import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 4506-T - Request for Transcript of Tax Return
 *
 * Used to request FREE transcripts of tax information:
 * - Tax Return Transcript (most common)
 * - Tax Account Transcript
 * - Record of Account
 * - Verification of Non-filing Letter
 * - Wage and Income Transcript (W-2, 1099 info)
 *
 * Processing time: 5-10 business days (by mail)
 * Available online at IRS.gov for immediate access
 */

export interface F4506TData {
  // Line 1a-2b: Taxpayer Information
  name1a: string
  ssn1b: string
  name2a?: string
  ssn2b?: string
  // Line 3: Current address
  currentAddress: string
  currentCity: string
  currentState: string
  currentZip: string
  // Line 4: Previous address (if different from return)
  previousAddress?: string
  previousCity?: string
  previousState?: string
  previousZip?: string
  // Line 5: Third party (send transcript to)
  sendToThirdParty: boolean
  thirdPartyName?: string
  thirdPartyAddress?: string
  thirdPartyCity?: string
  thirdPartyState?: string
  thirdPartyZip?: string
  // Line 6: Transcript type requested
  transcriptType: 'return' | 'account' | 'record_of_account' | 'verification_nonfiling' | 'wage_income'
  // Line 7: Tax form requested
  taxFormNumber: string
  // Line 8: Tax year(s) or period(s)
  taxYears: number[]
  // Signature
  signatureDate: Date
  phone: string
}

// Transcript type descriptions
const TRANSCRIPT_TYPES: Record<string, string> = {
  'return': 'Tax Return Transcript - Shows most line items from return',
  'account': 'Tax Account Transcript - Shows payments, penalties, adjustments',
  'record_of_account': 'Record of Account - Combination of return and account',
  'verification_nonfiling': 'Verification of Non-filing Letter',
  'wage_income': 'Wage and Income Transcript - W-2 and 1099 information'
}

export default class F4506T extends F1040Attachment {
  tag: FormTag = 'f4506t'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF4506TData()
  }

  hasF4506TData = (): boolean => {
    return false
  }

  f4506TData = (): F4506TData | undefined => {
    return undefined
  }

  // Transcript type
  transcriptType = (): string => this.f4506TData()?.transcriptType ?? 'return'

  transcriptTypeDescription = (): string => {
    return TRANSCRIPT_TYPES[this.transcriptType()] ?? ''
  }

  // Is tax return transcript?
  isTaxReturnTranscript = (): boolean => {
    return this.transcriptType() === 'return'
  }

  // Is tax account transcript?
  isTaxAccountTranscript = (): boolean => {
    return this.transcriptType() === 'account'
  }

  // Is record of account?
  isRecordOfAccount = (): boolean => {
    return this.transcriptType() === 'record_of_account'
  }

  // Is verification of non-filing?
  isVerificationOfNonfiling = (): boolean => {
    return this.transcriptType() === 'verification_nonfiling'
  }

  // Is wage and income transcript?
  isWageAndIncomeTranscript = (): boolean => {
    return this.transcriptType() === 'wage_income'
  }

  // Is joint return?
  isJointReturn = (): boolean => {
    return (this.f4506TData()?.name2a ?? '').length > 0
  }

  // Sending to third party?
  sendingToThirdParty = (): boolean => {
    return this.f4506TData()?.sendToThirdParty ?? false
  }

  // Number of years requested
  yearsRequestedCount = (): number => {
    return this.f4506TData()?.taxYears.length ?? 0
  }

  // Previous address different?
  hasDifferentPreviousAddress = (): boolean => {
    return (this.f4506TData()?.previousAddress ?? '').length > 0
  }

  fields = (): Field[] => {
    const data = this.f4506TData()

    return [
      // Lines 1-2: Taxpayer Information
      data?.name1a ?? '',
      data?.ssn1b ?? '',
      data?.name2a ?? '',
      data?.ssn2b ?? '',
      this.isJointReturn(),
      // Line 3: Current address
      data?.currentAddress ?? '',
      data?.currentCity ?? '',
      data?.currentState ?? '',
      data?.currentZip ?? '',
      // Line 4: Previous address
      this.hasDifferentPreviousAddress(),
      data?.previousAddress ?? '',
      data?.previousCity ?? '',
      data?.previousState ?? '',
      data?.previousZip ?? '',
      // Line 5: Third party
      this.sendingToThirdParty(),
      data?.thirdPartyName ?? '',
      data?.thirdPartyAddress ?? '',
      data?.thirdPartyCity ?? '',
      data?.thirdPartyState ?? '',
      data?.thirdPartyZip ?? '',
      // Line 6: Transcript type (checkboxes)
      this.isTaxReturnTranscript(),
      this.isTaxAccountTranscript(),
      this.isRecordOfAccount(),
      this.isVerificationOfNonfiling(),
      this.isWageAndIncomeTranscript(),
      this.transcriptTypeDescription(),
      // Line 7: Tax form
      data?.taxFormNumber ?? '1040',
      // Line 8: Tax years
      (data?.taxYears ?? []).join(', '),
      this.yearsRequestedCount(),
      // Signature
      data?.signatureDate?.toLocaleDateString() ?? '',
      data?.phone ?? ''
    ]
  }
}
