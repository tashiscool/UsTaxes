import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8822 - Change of Address
 *
 * Used to notify the IRS of a change of home address.
 * Should be filed when:
 * - Moving to a new home
 * - PO Box changes
 * - Address correction needed
 *
 * Important: This form does NOT change your address with
 * the Social Security Administration or state tax agencies.
 * Use Form 8822-B for business address changes.
 */

export interface F8822Data {
  // Part I: Complete This Part To Change Your Home Mailing Address
  yourName: string
  spouseName?: string
  yourSSN: string
  spouseSSN?: string
  priorFirstName: string
  priorLastName: string
  // Old address
  oldAddress: string
  oldAptNo?: string
  oldCity: string
  oldState: string
  oldZip: string
  oldForeignCountry?: string
  oldForeignProvince?: string
  oldForeignPostalCode?: string
  // New address
  newAddress: string
  newAptNo?: string
  newCity: string
  newState: string
  newZip: string
  newForeignCountry?: string
  newForeignProvince?: string
  newForeignPostalCode?: string
  // Options
  isJointReturn: boolean
  bothSpousesSameAddress: boolean
  // Signature
  signatureDate: Date
  spouseSignatureDate?: Date
}

export default class F8822 extends F1040Attachment {
  tag: FormTag = 'f8822'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8822Data()
  }

  hasF8822Data = (): boolean => {
    return false
  }

  f8822Data = (): F8822Data | undefined => {
    return undefined
  }

  // Names
  yourName = (): string => this.f8822Data()?.yourName ?? ''
  spouseName = (): string => this.f8822Data()?.spouseName ?? ''

  // Is joint return?
  isJointReturn = (): boolean => this.f8822Data()?.isJointReturn ?? false

  // Has spouse?
  hasSpouse = (): boolean => (this.f8822Data()?.spouseName ?? '').length > 0

  // Both spouses same new address?
  bothSpousesSameAddress = (): boolean =>
    this.f8822Data()?.bothSpousesSameAddress ?? false

  // Is foreign address (old)?
  hasOldForeignAddress = (): boolean => {
    return (this.f8822Data()?.oldForeignCountry ?? '').length > 0
  }

  // Is foreign address (new)?
  hasNewForeignAddress = (): boolean => {
    return (this.f8822Data()?.newForeignCountry ?? '').length > 0
  }

  // Full old address
  fullOldAddress = (): string => {
    const data = this.f8822Data()
    if (!data) return ''
    const parts = [
      data.oldAddress,
      data.oldAptNo,
      data.oldCity,
      data.oldState,
      data.oldZip
    ].filter((p) => p && p.length > 0)
    return parts.join(', ')
  }

  // Full new address
  fullNewAddress = (): string => {
    const data = this.f8822Data()
    if (!data) return ''
    const parts = [
      data.newAddress,
      data.newAptNo,
      data.newCity,
      data.newState,
      data.newZip
    ].filter((p) => p && p.length > 0)
    return parts.join(', ')
  }

  fields = (): Field[] => {
    const data = this.f8822Data()

    return [
      // Part I: Names and SSNs
      data?.yourName ?? '',
      data?.spouseName ?? '',
      data?.yourSSN ?? '',
      data?.spouseSSN ?? '',
      data?.priorFirstName ?? '',
      data?.priorLastName ?? '',
      // Old address
      data?.oldAddress ?? '',
      data?.oldAptNo ?? '',
      data?.oldCity ?? '',
      data?.oldState ?? '',
      data?.oldZip ?? '',
      this.hasOldForeignAddress(),
      data?.oldForeignCountry ?? '',
      data?.oldForeignProvince ?? '',
      data?.oldForeignPostalCode ?? '',
      // New address
      data?.newAddress ?? '',
      data?.newAptNo ?? '',
      data?.newCity ?? '',
      data?.newState ?? '',
      data?.newZip ?? '',
      this.hasNewForeignAddress(),
      data?.newForeignCountry ?? '',
      data?.newForeignProvince ?? '',
      data?.newForeignPostalCode ?? '',
      // Options
      this.isJointReturn(),
      this.bothSpousesSameAddress(),
      // Signature
      data?.signatureDate.toLocaleDateString() ?? '',
      data?.spouseSignatureDate?.toLocaleDateString() ?? '',
      // Calculated
      this.fullOldAddress(),
      this.fullNewAddress()
    ]
  }
}
