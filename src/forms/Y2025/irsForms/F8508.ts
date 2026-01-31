import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8508 - Request for Waiver From Filing Information Returns Electronically
 *
 * Used to request a waiver from the requirement to file information
 * returns electronically. Required when filing 10 or more returns.
 *
 * Waivers may be granted if:
 * - Undue hardship would result from e-filing
 * - Technology limitations prevent e-filing
 * - Cost of e-filing is prohibitive for small filer
 */

export interface F8508Data {
  // Filer Information
  filerName: string
  filerTIN: string                         // SSN or EIN
  filerAddress: string
  filerCity: string
  filerState: string
  filerZip: string
  filerPhone: string
  filerEmail?: string
  contactName: string
  // Information Return Types
  returnTypes: string[]                    // e.g., ['1099-MISC', '1099-NEC', 'W-2']
  // Calendar Year
  calendarYear: number
  // Number of Returns
  numberOfReturns: number
  // Reason for Waiver Request
  waiverReason: 'hardship' | 'technology' | 'cost' | 'religious' | 'other'
  reasonExplanation: string
  // Hardship details
  lackOfComputer?: boolean
  lackOfInternet?: boolean
  costProhibitive?: boolean
  religiousBeliefs?: boolean
  disasterAffected?: boolean
  // Prior waivers
  hadPriorWaiver: boolean
  priorWaiverYear?: number
  // Signature
  signatureDate: Date
  signerTitle?: string
}

// Waiver reason descriptions
const WAIVER_REASONS: Record<string, string> = {
  'hardship': 'Undue hardship - lack of technology or resources',
  'technology': 'Technology limitations prevent electronic filing',
  'cost': 'Cost of e-filing software/services is prohibitive',
  'religious': 'Religious beliefs prohibit use of technology',
  'other': 'Other reason (explanation required)'
}

export default class F8508 extends F1040Attachment {
  tag: FormTag = 'f8508'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8508Data()
  }

  hasF8508Data = (): boolean => {
    return false
  }

  f8508Data = (): F8508Data | undefined => {
    return undefined
  }

  // Number of returns
  numberOfReturns = (): number => {
    return this.f8508Data()?.numberOfReturns ?? 0
  }

  // Is e-filing required? (10 or more returns)
  isEfilingRequired = (): boolean => {
    return this.numberOfReturns() >= 10
  }

  // Return types
  returnTypesCount = (): number => {
    return this.f8508Data()?.returnTypes.length ?? 0
  }

  returnTypesList = (): string => {
    return (this.f8508Data()?.returnTypes ?? []).join(', ')
  }

  // Waiver reason
  waiverReason = (): string => {
    return this.f8508Data()?.waiverReason ?? ''
  }

  waiverReasonDescription = (): string => {
    return WAIVER_REASONS[this.waiverReason()] ?? ''
  }

  // Is hardship claim?
  isHardshipClaim = (): boolean => {
    return this.waiverReason() === 'hardship'
  }

  // Is technology limitation?
  isTechnologyLimitation = (): boolean => {
    return this.waiverReason() === 'technology'
  }

  // Is cost prohibitive?
  isCostProhibitive = (): boolean => {
    return this.waiverReason() === 'cost' ||
           (this.f8508Data()?.costProhibitive ?? false)
  }

  // Had prior waiver?
  hadPriorWaiver = (): boolean => {
    return this.f8508Data()?.hadPriorWaiver ?? false
  }

  // Is small filer (under 250 returns)?
  isSmallFiler = (): boolean => {
    return this.numberOfReturns() < 250
  }

  fields = (): Field[] => {
    const data = this.f8508Data()

    return [
      // Filer Information
      data?.filerName ?? '',
      data?.filerTIN ?? '',
      data?.filerAddress ?? '',
      data?.filerCity ?? '',
      data?.filerState ?? '',
      data?.filerZip ?? '',
      data?.filerPhone ?? '',
      data?.filerEmail ?? '',
      data?.contactName ?? '',
      // Return Types
      this.returnTypesList(),
      this.returnTypesCount(),
      // Calendar Year and Count
      data?.calendarYear ?? 2025,
      this.numberOfReturns(),
      this.isEfilingRequired(),
      // Waiver Reason
      this.isHardshipClaim(),
      this.isTechnologyLimitation(),
      this.isCostProhibitive(),
      data?.religiousBeliefs ?? false,
      data?.waiverReason === 'other',
      data?.reasonExplanation ?? '',
      this.waiverReasonDescription(),
      // Hardship details
      data?.lackOfComputer ?? false,
      data?.lackOfInternet ?? false,
      data?.disasterAffected ?? false,
      // Prior waivers
      this.hadPriorWaiver(),
      data?.priorWaiverYear ?? 0,
      // Analysis
      this.isSmallFiler(),
      // Signature
      data?.signatureDate?.toLocaleDateString() ?? '',
      data?.signerTitle ?? ''
    ]
  }
}
