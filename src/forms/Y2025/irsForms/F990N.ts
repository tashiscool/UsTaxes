import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 990-N (e-Postcard) - Electronic Notice for Tax-Exempt Organizations
 *
 * Required for small tax-exempt organizations with gross receipts
 * normally $50,000 or less.
 *
 * Must be filed electronically - no paper filing allowed.
 * Due date: 15th day of 5th month after end of tax year.
 *
 * Required information:
 * - Legal name of organization
 * - Any other names organization uses
 * - Mailing address
 * - EIN
 * - Name and address of principal officer
 * - Website address (if any)
 * - Confirmation that gross receipts are normally $50,000 or less
 * - Tax year (annual accounting period)
 * - Statement that organization has terminated (if applicable)
 */

export interface F990NData {
  // Organization identification
  organizationName: string
  doingBusinessAs?: string
  ein: string
  mailingAddress: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  // Principal officer
  principalOfficerName: string
  principalOfficerAddress: {
    street: string
    city: string
    state: string
    zip: string
  }
  // Website
  websiteAddress?: string
  // Tax year
  taxYearBeginning: Date
  taxYearEnding: Date
  // Gross receipts confirmation
  grossReceiptsNormally50kOrLess: boolean
  // Termination
  hasTerminated: boolean
  terminationDate?: Date
}

// Gross receipts threshold for 990-N eligibility
const GROSS_RECEIPTS_THRESHOLD = 50000

export default class F990N extends F1040Attachment {
  tag: FormTag = 'f990n'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.isEligibleForEPostcard()
  }

  isEligibleForEPostcard = (): boolean => {
    // Check if organization is small enough for 990-N
    const exemptOrg = this.f1040.info.exemptOrgReturnEZ
    return exemptOrg !== undefined
  }

  f990NData = (): F990NData | undefined => {
    return undefined  // Would be populated from organization data
  }

  // Organization information
  organizationName = (): string => this.f990NData()?.organizationName ?? ''
  doingBusinessAs = (): string => this.f990NData()?.doingBusinessAs ?? ''
  ein = (): string => this.f990NData()?.ein ?? ''

  // Address
  mailingAddress = (): string => {
    const addr = this.f990NData()?.mailingAddress
    if (!addr) return ''
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`
  }

  // Principal officer
  principalOfficerName = (): string => this.f990NData()?.principalOfficerName ?? ''
  principalOfficerAddress = (): string => {
    const addr = this.f990NData()?.principalOfficerAddress
    if (!addr) return ''
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`
  }

  // Website
  websiteAddress = (): string => this.f990NData()?.websiteAddress ?? 'N/A'

  // Tax year
  taxYearBeginning = (): Date | undefined => this.f990NData()?.taxYearBeginning
  taxYearEnding = (): Date | undefined => this.f990NData()?.taxYearEnding

  taxYearString = (): string => {
    const begin = this.taxYearBeginning()
    const end = this.taxYearEnding()
    if (!begin || !end) return ''
    return `${begin.toLocaleDateString()} - ${end.toLocaleDateString()}`
  }

  // Gross receipts confirmation
  grossReceiptsUnderThreshold = (): boolean => {
    return this.f990NData()?.grossReceiptsNormally50kOrLess ?? true
  }

  // Termination
  hasTerminated = (): boolean => this.f990NData()?.hasTerminated ?? false
  terminationDate = (): Date | undefined => this.f990NData()?.terminationDate

  // Validation - organization must meet eligibility requirements
  isValid = (): boolean => {
    const data = this.f990NData()
    if (!data) return false

    // Must confirm gross receipts under threshold
    if (!data.grossReceiptsNormally50kOrLess) return false

    // Must have required fields
    if (!data.organizationName || !data.ein || !data.principalOfficerName) return false

    return true
  }

  fields = (): Field[] => {
    const data = this.f990NData()
    const addr = data?.mailingAddress

    return [
      // Organization identification
      this.organizationName(),
      this.doingBusinessAs(),
      this.ein(),
      // Mailing address
      addr?.street ?? '',
      addr?.city ?? '',
      addr?.state ?? '',
      addr?.zip ?? '',
      addr?.country ?? 'United States',
      // Principal officer
      this.principalOfficerName(),
      data?.principalOfficerAddress?.street ?? '',
      data?.principalOfficerAddress?.city ?? '',
      data?.principalOfficerAddress?.state ?? '',
      data?.principalOfficerAddress?.zip ?? '',
      // Website
      this.websiteAddress(),
      // Tax year
      data?.taxYearBeginning?.toLocaleDateString() ?? '',
      data?.taxYearEnding?.toLocaleDateString() ?? '',
      // Gross receipts
      this.grossReceiptsUnderThreshold(),
      GROSS_RECEIPTS_THRESHOLD,
      // Termination
      this.hasTerminated(),
      data?.terminationDate?.toLocaleDateString() ?? '',
      // Valid
      this.isValid()
    ]
  }
}
