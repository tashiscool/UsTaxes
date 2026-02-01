import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-S - Proceeds from Real Estate Transactions
 *
 * Reports gross proceeds from the sale or exchange of real estate.
 * Filed by the person responsible for closing (settlement agent, title company, etc.)
 *
 * Gross proceeds include:
 * - Cash received
 * - Notes and mortgages assumed by buyer
 * - Fair market value of other property received
 *
 * Used for Schedule D / Form 8949 calculations.
 */

export interface F1099SData {
  // Filer (closing agent)
  filerName: string
  filerAddress: string
  filerTIN: string
  filerPhone: string
  // Transferor (seller)
  transferorName: string
  transferorAddress: string
  transferorTIN: string
  // Account number
  accountNumber?: string
  // Transaction details
  dateOfClosing: Date // Box 1
  grossProceeds: number // Box 2
  propertyAddress: string // Box 3
  transferorReceivedProperty: boolean // Box 4 checkbox
  partOfPropertySold: boolean // Box 5 checkbox
  buyerPropertyTaxReimbursement: number // Box 6
  // Property type
  propertyType: 'residence' | 'commercial' | 'land' | 'other'
}

export default class F1099S extends F1040Attachment {
  tag: FormTag = 'f1099s'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099SData()
  }

  hasF1099SData = (): boolean => {
    return false
  }

  f1099SData = (): F1099SData | undefined => {
    return undefined
  }

  // Box 1: Date of closing
  dateOfClosing = (): Date | undefined => {
    return this.f1099SData()?.dateOfClosing
  }

  // Box 2: Gross proceeds
  grossProceeds = (): number => {
    return this.f1099SData()?.grossProceeds ?? 0
  }

  // Box 3: Property address
  propertyAddress = (): string => {
    return this.f1099SData()?.propertyAddress ?? ''
  }

  // Box 6: Buyer's property tax reimbursement
  buyerPropertyTaxReimbursement = (): number => {
    return this.f1099SData()?.buyerPropertyTaxReimbursement ?? 0
  }

  // Is this a residence? (May qualify for Section 121 exclusion)
  isResidence = (): boolean => {
    return this.f1099SData()?.propertyType === 'residence'
  }

  // To Form 8949 / Schedule D
  toForm8949 = (): number => this.grossProceeds()

  fields = (): Field[] => {
    const data = this.f1099SData()

    return [
      // Filer info
      data?.filerName ?? '',
      data?.filerAddress ?? '',
      data?.filerTIN ?? '',
      data?.filerPhone ?? '',
      // Transferor info
      data?.transferorName ?? '',
      data?.transferorAddress ?? '',
      data?.transferorTIN ?? '',
      data?.accountNumber ?? '',
      // Transaction details
      data?.dateOfClosing.toLocaleDateString() ?? '', // Box 1
      data?.grossProceeds ?? 0, // Box 2
      data?.propertyAddress ?? '', // Box 3
      data?.transferorReceivedProperty ?? false, // Box 4
      data?.partOfPropertySold ?? false, // Box 5
      data?.buyerPropertyTaxReimbursement ?? 0, // Box 6
      // Property type
      data?.propertyType ?? '',
      this.isResidence(),
      // Routing
      this.toForm8949()
    ]
  }
}
