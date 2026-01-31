import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 56 - Notice Concerning Fiduciary Relationship
 *
 * Used to notify the IRS of the creation or termination of a
 * fiduciary relationship. Filed by:
 * - Executors/Administrators of estates
 * - Trustees of trusts
 * - Guardians/Conservators
 * - Receivers
 * - Assignees
 *
 * Required within 10 days of appointment to receive tax notices.
 */

export interface F56Data {
  // Section A: Identification
  decedentOrEntity: string                 // Name of decedent, estate, or entity
  decedentSSN: string                      // SSN or EIN
  decedentAddress: string
  decedentCity: string
  decedentState: string
  decedentZip: string
  dateOfDeath?: Date                       // For decedent estates
  // Section B: Fiduciary Information
  fiduciaryName: string
  fiduciaryAddress: string
  fiduciaryCity: string
  fiduciaryState: string
  fiduciaryZip: string
  fiduciaryPhone: string
  // Type of fiduciary
  fiduciaryType: 'executor' | 'administrator' | 'trustee' | 'guardian' |
                 'conservator' | 'receiver' | 'assignee' | 'other'
  otherFiduciaryType?: string
  // Section C: Authority
  dateAppointed: Date
  courtName?: string
  courtAddress?: string
  // Type of taxes
  incomeTax: boolean
  estateTax: boolean
  giftTax: boolean
  employmentTax: boolean
  exciseTax: boolean
  otherTax?: string
  // Termination
  isTermination: boolean
  dateTerminated?: Date
  terminationReason?: 'duties_completed' | 'revoked' | 'deceased' | 'other'
  // Signature
  signatureDate: Date
}

export default class F56 extends F1040Attachment {
  tag: FormTag = 'f56'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF56Data()
  }

  hasF56Data = (): boolean => {
    return false
  }

  f56Data = (): F56Data | undefined => {
    return undefined
  }

  // Fiduciary type
  fiduciaryType = (): string => {
    return this.f56Data()?.fiduciaryType ?? ''
  }

  isExecutor = (): boolean => this.fiduciaryType() === 'executor'
  isAdministrator = (): boolean => this.fiduciaryType() === 'administrator'
  isTrustee = (): boolean => this.fiduciaryType() === 'trustee'
  isGuardian = (): boolean => this.fiduciaryType() === 'guardian'
  isConservator = (): boolean => this.fiduciaryType() === 'conservator'
  isReceiver = (): boolean => this.fiduciaryType() === 'receiver'

  // Tax types
  hasIncomeTax = (): boolean => this.f56Data()?.incomeTax ?? false
  hasEstateTax = (): boolean => this.f56Data()?.estateTax ?? false
  hasGiftTax = (): boolean => this.f56Data()?.giftTax ?? false
  hasEmploymentTax = (): boolean => this.f56Data()?.employmentTax ?? false
  hasExciseTax = (): boolean => this.f56Data()?.exciseTax ?? false

  // Is this a termination?
  isTermination = (): boolean => this.f56Data()?.isTermination ?? false

  // Is this an estate?
  isEstate = (): boolean => {
    return this.isExecutor() || this.isAdministrator()
  }

  // Is decedent deceased?
  hasDateOfDeath = (): boolean => {
    return this.f56Data()?.dateOfDeath !== undefined
  }

  fields = (): Field[] => {
    const data = this.f56Data()

    return [
      // Section A: Identification
      data?.decedentOrEntity ?? '',
      data?.decedentSSN ?? '',
      data?.decedentAddress ?? '',
      data?.decedentCity ?? '',
      data?.decedentState ?? '',
      data?.decedentZip ?? '',
      data?.dateOfDeath?.toLocaleDateString() ?? '',
      // Section B: Fiduciary Information
      data?.fiduciaryName ?? '',
      data?.fiduciaryAddress ?? '',
      data?.fiduciaryCity ?? '',
      data?.fiduciaryState ?? '',
      data?.fiduciaryZip ?? '',
      data?.fiduciaryPhone ?? '',
      // Fiduciary type checkboxes
      this.isExecutor(),
      this.isAdministrator(),
      this.isTrustee(),
      this.isGuardian(),
      this.isConservator(),
      this.isReceiver(),
      data?.fiduciaryType === 'assignee',
      data?.fiduciaryType === 'other',
      data?.otherFiduciaryType ?? '',
      // Section C: Authority
      data?.dateAppointed?.toLocaleDateString() ?? '',
      data?.courtName ?? '',
      data?.courtAddress ?? '',
      // Tax type checkboxes
      this.hasIncomeTax(),
      this.hasEstateTax(),
      this.hasGiftTax(),
      this.hasEmploymentTax(),
      this.hasExciseTax(),
      data?.otherTax ?? '',
      // Termination
      this.isTermination(),
      data?.dateTerminated?.toLocaleDateString() ?? '',
      data?.terminationReason ?? '',
      // Signature
      data?.signatureDate?.toLocaleDateString() ?? ''
    ]
  }
}
