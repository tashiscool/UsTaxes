import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8453 - U.S. Individual Income Tax Transmittal for an IRS e-file Return
 *
 * Used to transmit paper documents that support an e-filed return.
 * Required when taxpayer needs to mail supporting documents to the IRS
 * after e-filing.
 *
 * Common attachments:
 * - Form 2848 (Power of Attorney)
 * - Form 8332 (Release of Claim to Exemption)
 * - Form 8949 (continuation sheets)
 * - Supporting statements for large deductions
 */

export interface F8453Data {
  // Taxpayer information
  taxpayerName: string
  taxpayerSSN: string
  spouseName?: string
  spouseSSN?: string
  // Tax year
  taxYear: number
  // Return information
  adjustedGrossIncome: number
  totalTax: number
  federalTaxWithheld: number
  refundAmount: number
  amountOwed: number
  // Declaration Control Number (DCN)
  dcn: string
  // Documents attached (checkboxes)
  attachForm2848: boolean
  attachForm8332: boolean
  attachForm8949: boolean
  attachForm8453FE: boolean  // Foreign earned income
  attachOther: boolean
  otherDescription?: string
  // Signatures
  taxpayerSignatureDate: Date
  spouseSignatureDate?: Date
}

export default class F8453 extends F1040Attachment {
  tag: FormTag = 'f8453'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8453Data()
  }

  hasF8453Data = (): boolean => {
    return false  // Would be true when paper documents needed
  }

  f8453Data = (): F8453Data | undefined => {
    return undefined
  }

  // Taxpayer info
  taxpayerName = (): string => this.f8453Data()?.taxpayerName ?? ''
  taxpayerSSN = (): string => this.f8453Data()?.taxpayerSSN ?? ''

  // Return amounts (must match e-filed return)
  adjustedGrossIncome = (): number => this.f8453Data()?.adjustedGrossIncome ?? 0
  totalTax = (): number => this.f8453Data()?.totalTax ?? 0

  // DCN from e-file acknowledgment
  dcn = (): string => this.f8453Data()?.dcn ?? ''

  // Attached documents
  hasAttachments = (): boolean => {
    const data = this.f8453Data()
    if (!data) return false
    return data.attachForm2848 || data.attachForm8332 ||
           data.attachForm8949 || data.attachForm8453FE || data.attachOther
  }

  numberOfAttachments = (): number => {
    const data = this.f8453Data()
    if (!data) return 0
    let count = 0
    if (data.attachForm2848) count++
    if (data.attachForm8332) count++
    if (data.attachForm8949) count++
    if (data.attachForm8453FE) count++
    if (data.attachOther) count++
    return count
  }

  fields = (): Field[] => {
    const data = this.f8453Data()

    return [
      // Taxpayer info
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.spouseName ?? '',
      data?.spouseSSN ?? '',
      data?.taxYear ?? 0,
      // Return amounts
      this.adjustedGrossIncome(),
      this.totalTax(),
      data?.federalTaxWithheld ?? 0,
      data?.refundAmount ?? 0,
      data?.amountOwed ?? 0,
      // DCN
      this.dcn(),
      // Attachments
      data?.attachForm2848 ?? false,
      data?.attachForm8332 ?? false,
      data?.attachForm8949 ?? false,
      data?.attachForm8453FE ?? false,
      data?.attachOther ?? false,
      data?.otherDescription ?? '',
      // Signatures
      data?.taxpayerSignatureDate?.toLocaleDateString() ?? '',
      data?.spouseSignatureDate?.toLocaleDateString() ?? '',
      // Summary
      this.hasAttachments(),
      this.numberOfAttachments()
    ]
  }
}
