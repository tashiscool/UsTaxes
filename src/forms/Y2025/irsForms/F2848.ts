import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 2848 - Power of Attorney and Declaration of Representative
 *
 * Authorizes an individual to represent a taxpayer before the IRS.
 *
 * Key uses:
 * - Authorize CPA, attorney, or enrolled agent to represent taxpayer
 * - Receive confidential tax information
 * - Perform acts on behalf of taxpayer
 * - Sign returns or other documents
 *
 * Valid for matters and tax years specified on the form.
 */

export interface Representative {
  name: string
  address: string
  cafNumber: string // Centralized Authorization File number
  ptin?: string // Preparer Tax Identification Number
  phone: string
  fax?: string
  designation:
    | 'attorney'
    | 'cpa'
    | 'enrolled_agent'
    | 'officer'
    | 'employee'
    | 'family_member'
    | 'enrolled_actuary'
    | 'unenrolled_preparer'
    | 'student'
    | 'other'
  jurisdictionLicense?: string
  jurisdictionState?: string
}

export interface TaxMatter {
  taxFormNumber: string
  taxYearOrPeriod: string
  specificMatter: string
}

export interface F2848Data {
  // Taxpayer information (Part I)
  taxpayerName: string
  taxpayerSSN: string
  taxpayerAddress: string
  taxpayerPhone: string
  taxpayerFax?: string
  // If joint return
  spouseName?: string
  spouseSSN?: string
  // Plan number if applicable
  planNumber?: string
  // Representative(s) (Part II)
  representatives: Representative[]
  // Tax matters (Part III)
  taxMatters: TaxMatter[]
  // Specific acts authorized (Part IV)
  authorizeSignReturns: boolean
  authorizeSubstituteRepresentative: boolean
  authorizeAccessRecords: boolean
  authorizeDelegateAuthority: boolean
  otherActs?: string
  // Retention/revocation (Part V)
  retainPriorPOAs: boolean
  revokeDate?: Date
  // Declaration (Part VI)
  declarationDate: Date
  taxpayerSignature: boolean
  spouseSignature?: boolean
}

export default class F2848 extends F1040Attachment {
  tag: FormTag = 'f2848'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF2848Data()
  }

  hasF2848Data = (): boolean => {
    return false
  }

  f2848Data = (): F2848Data | undefined => {
    return undefined
  }

  // Taxpayer info
  taxpayerName = (): string => this.f2848Data()?.taxpayerName ?? ''
  taxpayerSSN = (): string => this.f2848Data()?.taxpayerSSN ?? ''

  // Representatives
  representatives = (): Representative[] => {
    return this.f2848Data()?.representatives ?? []
  }

  primaryRepresentative = (): Representative | undefined => {
    return this.representatives()[0]
  }

  numberOfRepresentatives = (): number => {
    return this.representatives().length
  }

  // Tax matters
  taxMatters = (): TaxMatter[] => {
    return this.f2848Data()?.taxMatters ?? []
  }

  // Authorization flags
  canSignReturns = (): boolean => {
    return this.f2848Data()?.authorizeSignReturns ?? false
  }

  canSubstituteRepresentative = (): boolean => {
    return this.f2848Data()?.authorizeSubstituteRepresentative ?? false
  }

  // Validity check
  isValid = (): boolean => {
    const data = this.f2848Data()
    if (!data) return false
    return (
      data.taxpayerSignature &&
      data.representatives.length > 0 &&
      data.taxMatters.length > 0
    )
  }

  fields = (): Field[] => {
    const data = this.f2848Data()
    const reps = this.representatives()
    const matters = this.taxMatters()

    return [
      // Part I: Taxpayer
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.taxpayerAddress ?? '',
      data?.taxpayerPhone ?? '',
      data?.taxpayerFax ?? '',
      data?.spouseName ?? '',
      data?.spouseSSN ?? '',
      data?.planNumber ?? '',
      // Part II: Representative 1
      reps[0]?.name ?? '',
      reps[0]?.address ?? '',
      reps[0]?.cafNumber ?? '',
      reps[0]?.ptin ?? '',
      reps[0]?.phone ?? '',
      reps[0]?.fax ?? '',
      reps[0]?.designation ?? '',
      reps[0]?.jurisdictionLicense ?? '',
      reps[0]?.jurisdictionState ?? '',
      // Representative 2
      reps[1]?.name ?? '',
      reps[1]?.cafNumber ?? '',
      reps[1]?.designation ?? '',
      // Representative 3
      reps[2]?.name ?? '',
      reps[2]?.cafNumber ?? '',
      // Part III: Tax matters
      matters[0]?.taxFormNumber ?? '',
      matters[0]?.taxYearOrPeriod ?? '',
      matters[0]?.specificMatter ?? '',
      matters[1]?.taxFormNumber ?? '',
      matters[1]?.taxYearOrPeriod ?? '',
      matters[2]?.taxFormNumber ?? '',
      matters[2]?.taxYearOrPeriod ?? '',
      // Part IV: Authorizations
      data?.authorizeSignReturns ?? false,
      data?.authorizeSubstituteRepresentative ?? false,
      data?.authorizeAccessRecords ?? false,
      data?.authorizeDelegateAuthority ?? false,
      data?.otherActs ?? '',
      // Part V: Retention
      data?.retainPriorPOAs ?? false,
      data?.revokeDate?.toLocaleDateString() ?? '',
      // Part VI: Declaration
      data?.declarationDate.toLocaleDateString() ?? '',
      data?.taxpayerSignature ?? false,
      data?.spouseSignature ?? false,
      // Validity
      this.numberOfRepresentatives(),
      this.taxMatters().length,
      this.isValid()
    ]
  }
}
