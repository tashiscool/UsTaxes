/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form W-9 - Request for Taxpayer Identification Number and Certification
 *
 * Used to provide TIN (SSN or EIN) to requesters for:
 * - Independent contractor work (1099-NEC/MISC)
 * - Interest and dividends (1099-INT/DIV)
 * - Real estate transactions (1099-S)
 * - Mortgage interest reporting
 * - Opening bank/brokerage accounts
 *
 * Certifies that:
 * - TIN is correct
 * - Not subject to backup withholding
 * - US person status
 * - FATCA exemption codes (if applicable)
 */

export interface W9Data {
  // Line 1: Name
  name: string
  // Line 2: Business name (if different)
  businessName?: string
  // Line 3: Federal tax classification
  taxClassification:
    | 'individual'
    | 'ccorp'
    | 'scorp'
    | 'partnership'
    | 'trust'
    | 'llc'
    | 'other'
  llcClassification?: 'C' | 'S' | 'P' // If LLC: C-corp, S-corp, or Partnership
  otherClassification?: string
  // Line 4: Exemptions
  exemptPayeeCode?: string
  exemptFATCACode?: string
  // Line 5: Address
  address: string
  // Line 6: City, state, ZIP
  city: string
  state: string
  zip: string
  // Line 7: Account numbers (optional)
  accountNumbers?: string
  // Part I: TIN
  ssn?: string
  ein?: string
  // Part II: Certification
  certifyTINCorrect: boolean
  certifyNotSubjectToBackupWithholding: boolean
  certifyUSPerson: boolean
  certifyFATCAExempt: boolean
  // Signature
  signatureDate: Date
}

// Exempt payee codes
const EXEMPT_PAYEE_CODES: Record<string, string> = {
  '1': 'Tax-exempt organization under section 501(a)',
  '2': 'The United States or any of its agencies',
  '3': 'A state or its political subdivisions',
  '4': 'A foreign government or its political subdivisions',
  '5': 'A corporation',
  '6': 'A dealer in securities or commodities',
  '7': 'A futures commission merchant',
  '8': 'A real estate investment trust',
  '9': 'An entity registered under the Investment Company Act',
  '10': 'A common trust fund',
  '11': 'A financial institution',
  '12': 'A middleman known in the investment community',
  '13': 'A trust exempt under section 664 or 4947'
}

export default class W9 extends F1040Attachment {
  tag: FormTag = 'w9'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasW9Data()
  }

  hasW9Data = (): boolean => {
    return false // Used for information, not tax filing
  }

  w9Data = (): W9Data | undefined => {
    return undefined
  }

  // Name
  name = (): string => this.w9Data()?.name ?? ''
  businessName = (): string => this.w9Data()?.businessName ?? ''

  // Tax classification
  taxClassification = (): string =>
    this.w9Data()?.taxClassification ?? 'individual'

  isIndividual = (): boolean => this.taxClassification() === 'individual'
  isCCorp = (): boolean => this.taxClassification() === 'ccorp'
  isSCorp = (): boolean => this.taxClassification() === 'scorp'
  isPartnership = (): boolean => this.taxClassification() === 'partnership'
  isLLC = (): boolean => this.taxClassification() === 'llc'

  // TIN
  hasSSN = (): boolean => (this.w9Data()?.ssn ?? '').length > 0
  hasEIN = (): boolean => (this.w9Data()?.ein ?? '').length > 0

  tin = (): string => {
    return this.w9Data()?.ssn ?? this.w9Data()?.ein ?? ''
  }

  // Exemptions
  isExemptPayee = (): boolean => {
    return (this.w9Data()?.exemptPayeeCode ?? '').length > 0
  }

  exemptPayeeDescription = (): string => {
    const code = this.w9Data()?.exemptPayeeCode ?? ''
    return EXEMPT_PAYEE_CODES[code] ?? ''
  }

  // Certifications
  allCertificationsComplete = (): boolean => {
    const data = this.w9Data()
    if (!data) return false
    return (
      data.certifyTINCorrect &&
      data.certifyNotSubjectToBackupWithholding &&
      data.certifyUSPerson
    )
  }

  fields = (): Field[] => {
    const data = this.w9Data()

    return [
      // Line 1-2: Name
      data?.name ?? '',
      data?.businessName ?? '',
      // Line 3: Tax classification
      this.isIndividual(),
      this.isCCorp(),
      this.isSCorp(),
      this.isPartnership(),
      data?.taxClassification === 'trust',
      this.isLLC(),
      data?.llcClassification ?? '',
      data?.taxClassification === 'other',
      data?.otherClassification ?? '',
      // Line 4: Exemptions
      data?.exemptPayeeCode ?? '',
      data?.exemptFATCACode ?? '',
      // Line 5-6: Address
      data?.address ?? '',
      data?.city ?? '',
      data?.state ?? '',
      data?.zip ?? '',
      // Line 7: Account numbers
      data?.accountNumbers ?? '',
      // Part I: TIN
      data?.ssn ?? '',
      data?.ein ?? '',
      this.hasSSN(),
      this.hasEIN(),
      // Part II: Certification
      data?.certifyTINCorrect ?? false,
      data?.certifyNotSubjectToBackupWithholding ?? false,
      data?.certifyUSPerson ?? false,
      data?.certifyFATCAExempt ?? false,
      // Signature
      data?.signatureDate.toLocaleDateString() ?? '',
      // Summary
      this.tin(),
      this.isExemptPayee(),
      this.exemptPayeeDescription(),
      this.allCertificationsComplete()
    ]
  }
}
