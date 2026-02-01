import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 4506 - Request for Copy of Tax Return
 *
 * Used to request a copy of a previously filed tax return.
 * Fee: $50 per return ($0 for disaster victims)
 *
 * Processing time: 75 calendar days
 *
 * Note: For most purposes, a tax transcript (Form 4506-T)
 * is sufficient and free.
 */

export interface F4506Data {
  // Line 1a-2b: Taxpayer Information
  name1a: string // Name as shown on return (line 1a)
  ssn1b: string // SSN (line 1b)
  name2a?: string // Spouse name if joint return (line 2a)
  ssn2b?: string // Spouse SSN (line 2b)
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
  // Line 5: Third party recipient
  thirdPartyName?: string
  thirdPartyAddress?: string
  thirdPartyCity?: string
  thirdPartyState?: string
  thirdPartyZip?: string
  // Line 6: Tax form requested
  taxFormNumber: string // e.g., "1040", "1040-SR", "1120"
  // Line 7: Tax year(s) requested
  taxYears: number[]
  // Line 8: Total cost
  costPerReturn: number // Usually $50
  // Line 9: Specific use (optional)
  specificUse?: string
  // Signature
  signatureDate: Date
  title?: string // If signed by corporate officer
  phone: string
}

const COST_PER_RETURN = 50

export default class F4506 extends F1040Attachment {
  tag: FormTag = 'f4506'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF4506Data()
  }

  hasF4506Data = (): boolean => {
    return false
  }

  f4506Data = (): F4506Data | undefined => {
    return undefined
  }

  // Taxpayer name
  taxpayerName = (): string => this.f4506Data()?.name1a ?? ''

  // Is joint return?
  isJointReturn = (): boolean => {
    return (this.f4506Data()?.name2a ?? '').length > 0
  }

  // Tax form requested
  taxFormNumber = (): string => this.f4506Data()?.taxFormNumber ?? '1040'

  // Number of years requested
  yearsRequestedCount = (): number => {
    return this.f4506Data()?.taxYears.length ?? 0
  }

  // Total cost
  totalCost = (): number => {
    return this.yearsRequestedCount() * COST_PER_RETURN
  }

  // Has third party recipient?
  hasThirdParty = (): boolean => {
    return (this.f4506Data()?.thirdPartyName ?? '').length > 0
  }

  // Previous address different?
  hasDifferentPreviousAddress = (): boolean => {
    return (this.f4506Data()?.previousAddress ?? '').length > 0
  }

  fields = (): Field[] => {
    const data = this.f4506Data()

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
      this.hasThirdParty(),
      data?.thirdPartyName ?? '',
      data?.thirdPartyAddress ?? '',
      data?.thirdPartyCity ?? '',
      data?.thirdPartyState ?? '',
      data?.thirdPartyZip ?? '',
      // Line 6: Tax form
      data?.taxFormNumber ?? '1040',
      // Line 7: Tax years
      (data?.taxYears ?? []).join(', '),
      this.yearsRequestedCount(),
      // Line 8: Cost
      COST_PER_RETURN,
      this.totalCost(),
      // Line 9: Specific use
      data?.specificUse ?? '',
      // Signature
      data?.signatureDate.toLocaleDateString() ?? '',
      data?.title ?? '',
      data?.phone ?? ''
    ]
  }
}
