import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8821 - Tax Information Authorization
 *
 * Authorizes any individual, corporation, or other entity to
 * receive and inspect confidential tax information.
 *
 * Unlike Form 2848, this does NOT authorize the designee to:
 * - Represent the taxpayer before the IRS
 * - Sign documents on behalf of taxpayer
 * - Advocate for the taxpayer
 *
 * Commonly used for:
 * - Mortgage applications (lender needs tax transcripts)
 * - Financial planning
 * - Divorce proceedings
 * - Business due diligence
 */

export interface Designee {
  name: string
  address: string
  cafNumber?: string
  phone: string
  fax?: string
}

export interface TaxInfoMatter {
  taxFormNumber: string
  taxYearOrPeriod: string
  specificTaxInfo?: string
}

export interface F8821Data {
  // Taxpayer information (Line 1)
  taxpayerName: string
  taxpayerSSN: string
  taxpayerAddress: string
  taxpayerPhone: string
  // If joint
  spouseName?: string
  spouseSSN?: string
  // Designee(s) (Line 2)
  designees: Designee[]
  // Tax information (Line 3)
  taxMatters: TaxInfoMatter[]
  // Specific use (Line 4)
  specificUseNotRecorded: boolean
  // Retention (Line 5)
  retainPriorAuthorizations: boolean
  // Signature
  signatureDate: Date
  taxpayerSignature: boolean
  spouseSignature?: boolean
}

export default class F8821 extends F1040Attachment {
  tag: FormTag = 'f8821'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8821Data()
  }

  hasF8821Data = (): boolean => {
    return false
  }

  f8821Data = (): F8821Data | undefined => {
    return undefined
  }

  // Taxpayer info
  taxpayerName = (): string => this.f8821Data()?.taxpayerName ?? ''
  taxpayerSSN = (): string => this.f8821Data()?.taxpayerSSN ?? ''

  // Designees
  designees = (): Designee[] => {
    return this.f8821Data()?.designees ?? []
  }

  primaryDesignee = (): Designee | undefined => {
    return this.designees()[0]
  }

  numberOfDesignees = (): number => {
    return this.designees().length
  }

  // Tax matters
  taxMatters = (): TaxInfoMatter[] => {
    return this.f8821Data()?.taxMatters ?? []
  }

  // Specific use indicator
  isSpecificUseNotRecorded = (): boolean => {
    return this.f8821Data()?.specificUseNotRecorded ?? false
  }

  // Validity check
  isValid = (): boolean => {
    const data = this.f8821Data()
    if (!data) return false
    return (
      data.taxpayerSignature &&
      data.designees.length > 0 &&
      data.taxMatters.length > 0
    )
  }

  fields = (): Field[] => {
    const data = this.f8821Data()
    const designees = this.designees()
    const matters = this.taxMatters()

    return [
      // Line 1: Taxpayer
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.taxpayerAddress ?? '',
      data?.taxpayerPhone ?? '',
      data?.spouseName ?? '',
      data?.spouseSSN ?? '',
      // Line 2: Designee 1
      designees[0]?.name ?? '',
      designees[0]?.address ?? '',
      designees[0]?.cafNumber ?? '',
      designees[0]?.phone ?? '',
      designees[0]?.fax ?? '',
      // Designee 2
      designees[1]?.name ?? '',
      designees[1]?.address ?? '',
      designees[1]?.cafNumber ?? '',
      // Line 3: Tax matters
      matters[0]?.taxFormNumber ?? '',
      matters[0]?.taxYearOrPeriod ?? '',
      matters[0]?.specificTaxInfo ?? '',
      matters[1]?.taxFormNumber ?? '',
      matters[1]?.taxYearOrPeriod ?? '',
      matters[2]?.taxFormNumber ?? '',
      matters[2]?.taxYearOrPeriod ?? '',
      // Line 4: Specific use
      this.isSpecificUseNotRecorded(),
      // Line 5: Retention
      data?.retainPriorAuthorizations ?? false,
      // Signature
      data?.signatureDate.toLocaleDateString() ?? '',
      data?.taxpayerSignature ?? false,
      data?.spouseSignature ?? false,
      // Summary
      this.numberOfDesignees(),
      this.taxMatters().length,
      this.isValid()
    ]
  }
}
