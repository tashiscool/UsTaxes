import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8822-B - Change of Address or Responsible Party — Business
 *
 * Used to notify the IRS of:
 * - Change of business mailing address
 * - Change of business location address
 * - Change of responsible party (for EIN purposes)
 *
 * Must be filed within 60 days of a change in responsible party.
 * Use Form 8822 for individual/personal address changes.
 */

export interface F8822BData {
  // Part I: Complete This Part To Change Your Business Mailing Address
  businessName: string
  employerIdentificationNumber: string
  // Old mailing address
  oldMailingAddress: string
  oldMailingSuite?: string
  oldMailingCity: string
  oldMailingState: string
  oldMailingZip: string
  oldMailingForeignCountry?: string
  oldMailingForeignProvince?: string
  oldMailingForeignPostalCode?: string
  // New mailing address
  newMailingAddress: string
  newMailingSuite?: string
  newMailingCity: string
  newMailingState: string
  newMailingZip: string
  newMailingForeignCountry?: string
  newMailingForeignProvince?: string
  newMailingForeignPostalCode?: string
  // Part II: Complete This Part To Change Your Business Location
  changeBusinessLocation: boolean
  oldLocationAddress?: string
  oldLocationCity?: string
  oldLocationState?: string
  oldLocationZip?: string
  newLocationAddress?: string
  newLocationCity?: string
  newLocationState?: string
  newLocationZip?: string
  // Part III: Complete This Part To Change the Responsible Party
  changeResponsibleParty: boolean
  // Previous responsible party
  previousResponsiblePartyName?: string
  previousResponsiblePartySSN?: string
  // New responsible party
  newResponsiblePartyName?: string
  newResponsiblePartySSN?: string
  newResponsiblePartyTitle?: string
  newResponsiblePartyPhone?: string
  dateOfChange?: Date
  // Entity type
  entityType:
    | 'sole_prop'
    | 'partnership'
    | 'corporation'
    | 'llc'
    | 'nonprofit'
    | 'government'
    | 'other'
  // Signature
  signatureDate: Date
  signerName: string
  signerTitle: string
  signerPhone: string
}

export default class F8822B extends F1040Attachment {
  tag: FormTag = 'f8822b'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8822BData()
  }

  hasF8822BData = (): boolean => {
    return false
  }

  f8822BData = (): F8822BData | undefined => {
    return undefined
  }

  // Business name
  businessName = (): string => this.f8822BData()?.businessName ?? ''

  // EIN
  ein = (): string => this.f8822BData()?.employerIdentificationNumber ?? ''

  // Is changing mailing address?
  isChangingMailingAddress = (): boolean => {
    const data = this.f8822BData()
    return (data?.newMailingAddress ?? '').length > 0
  }

  // Is changing business location?
  isChangingLocation = (): boolean => {
    return this.f8822BData()?.changeBusinessLocation ?? false
  }

  // Is changing responsible party?
  isChangingResponsibleParty = (): boolean => {
    return this.f8822BData()?.changeResponsibleParty ?? false
  }

  // Has foreign mailing address (old)?
  hasOldForeignMailingAddress = (): boolean => {
    return (this.f8822BData()?.oldMailingForeignCountry ?? '').length > 0
  }

  // Has foreign mailing address (new)?
  hasNewForeignMailingAddress = (): boolean => {
    return (this.f8822BData()?.newMailingForeignCountry ?? '').length > 0
  }

  // Entity type
  entityType = (): string => this.f8822BData()?.entityType ?? ''

  isSoleProprietorship = (): boolean => this.entityType() === 'sole_prop'
  isPartnership = (): boolean => this.entityType() === 'partnership'
  isCorporation = (): boolean => this.entityType() === 'corporation'
  isLLC = (): boolean => this.entityType() === 'llc'
  isNonprofit = (): boolean => this.entityType() === 'nonprofit'

  // Full old mailing address
  fullOldMailingAddress = (): string => {
    const data = this.f8822BData()
    if (!data) return ''
    const parts = [
      data.oldMailingAddress,
      data.oldMailingSuite,
      data.oldMailingCity,
      data.oldMailingState,
      data.oldMailingZip
    ].filter((p) => p && p.length > 0)
    return parts.join(', ')
  }

  // Full new mailing address
  fullNewMailingAddress = (): string => {
    const data = this.f8822BData()
    if (!data) return ''
    const parts = [
      data.newMailingAddress,
      data.newMailingSuite,
      data.newMailingCity,
      data.newMailingState,
      data.newMailingZip
    ].filter((p) => p && p.length > 0)
    return parts.join(', ')
  }

  fields = (): Field[] => {
    const data = this.f8822BData()

    return [
      // Business Info
      data?.businessName ?? '',
      data?.employerIdentificationNumber ?? '',
      // Part I: Old Mailing Address
      data?.oldMailingAddress ?? '',
      data?.oldMailingSuite ?? '',
      data?.oldMailingCity ?? '',
      data?.oldMailingState ?? '',
      data?.oldMailingZip ?? '',
      this.hasOldForeignMailingAddress(),
      data?.oldMailingForeignCountry ?? '',
      data?.oldMailingForeignProvince ?? '',
      data?.oldMailingForeignPostalCode ?? '',
      // Part I: New Mailing Address
      data?.newMailingAddress ?? '',
      data?.newMailingSuite ?? '',
      data?.newMailingCity ?? '',
      data?.newMailingState ?? '',
      data?.newMailingZip ?? '',
      this.hasNewForeignMailingAddress(),
      data?.newMailingForeignCountry ?? '',
      data?.newMailingForeignProvince ?? '',
      data?.newMailingForeignPostalCode ?? '',
      // Part II: Location Change
      this.isChangingLocation(),
      data?.oldLocationAddress ?? '',
      data?.oldLocationCity ?? '',
      data?.oldLocationState ?? '',
      data?.oldLocationZip ?? '',
      data?.newLocationAddress ?? '',
      data?.newLocationCity ?? '',
      data?.newLocationState ?? '',
      data?.newLocationZip ?? '',
      // Part III: Responsible Party Change
      this.isChangingResponsibleParty(),
      data?.previousResponsiblePartyName ?? '',
      data?.previousResponsiblePartySSN ?? '',
      data?.newResponsiblePartyName ?? '',
      data?.newResponsiblePartySSN ?? '',
      data?.newResponsiblePartyTitle ?? '',
      data?.newResponsiblePartyPhone ?? '',
      data?.dateOfChange?.toLocaleDateString() ?? '',
      // Entity Type
      this.isSoleProprietorship(),
      this.isPartnership(),
      this.isCorporation(),
      this.isLLC(),
      this.isNonprofit(),
      data?.entityType === 'government',
      data?.entityType === 'other',
      // Calculated
      this.fullOldMailingAddress(),
      this.fullNewMailingAddress(),
      // Signature
      data?.signatureDate.toLocaleDateString() ?? '',
      data?.signerName ?? '',
      data?.signerTitle ?? '',
      data?.signerPhone ?? ''
    ]
  }
}
