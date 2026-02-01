import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8332 - Release/Revocation of Release of Claim to Exemption for Child by Custodial Parent
 *
 * Used by divorced/separated parents to transfer the dependency exemption
 * (and related tax benefits) from the custodial parent to the noncustodial parent.
 *
 * Key benefits that can be transferred:
 * - Child Tax Credit
 * - Credit for Other Dependents
 * - Dependency exemption (if restored)
 *
 * Benefits that CANNOT be transferred (always stay with custodial parent):
 * - Head of Household filing status
 * - Earned Income Credit
 * - Child and Dependent Care Credit
 * - Exclusion for dependent care benefits
 *
 * Can be for:
 * - Current year only
 * - Future years
 * - All future years
 */

export interface F8332Data {
  // Part I: Release of Claim (Custodial parent completes)
  childName: string
  childSSN: string
  // Year(s) for which claim is released
  releaseType: 'current_year' | 'specific_years' | 'all_future_years'
  currentTaxYear?: number
  specificYears?: number[]
  // Custodial parent (releasing claim)
  custodialParentName: string
  custodialParentSSN: string
  custodialParentAddress: string
  custodialParentSignatureDate: Date
  // Noncustodial parent (claiming exemption)
  noncustodialParentName: string
  noncustodialParentSSN: string
  noncustodialParentAddress: string
  // Part II: Revocation (if revoking prior release)
  isRevocation: boolean
  revocationYear?: number
  originalReleaseYear?: number
  noncustodialParentNotified: boolean
  notificationDate?: Date
}

export default class F8332 extends F1040Attachment {
  tag: FormTag = 'f8332'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8332Data()
  }

  hasF8332Data = (): boolean => {
    return false
  }

  f8332Data = (): F8332Data | undefined => {
    return undefined
  }

  // Child info
  childName = (): string => this.f8332Data()?.childName ?? ''
  childSSN = (): string => this.f8332Data()?.childSSN ?? ''

  // Release type
  releaseType = (): string => this.f8332Data()?.releaseType ?? 'current_year'

  isCurrentYearOnly = (): boolean => this.releaseType() === 'current_year'
  isSpecificYears = (): boolean => this.releaseType() === 'specific_years'
  isAllFutureYears = (): boolean => this.releaseType() === 'all_future_years'

  // Years covered
  yearsCovered = (): string => {
    const data = this.f8332Data()
    if (!data) return ''

    switch (data.releaseType) {
      case 'current_year':
        return data.currentTaxYear?.toString() ?? ''
      case 'specific_years':
        return (data.specificYears ?? []).join(', ')
      case 'all_future_years':
        return `${data.currentTaxYear ?? ''} and all future years`
      default:
        return ''
    }
  }

  // Custodial parent
  custodialParentName = (): string =>
    this.f8332Data()?.custodialParentName ?? ''

  // Noncustodial parent
  noncustodialParentName = (): string =>
    this.f8332Data()?.noncustodialParentName ?? ''

  // Is this a revocation?
  isRevocation = (): boolean => this.f8332Data()?.isRevocation ?? false

  // Validity check
  isValid = (): boolean => {
    const data = this.f8332Data()
    if (!data) return false

    // Must have child info
    if (!data.childName || !data.childSSN) return false

    // Must have both parents
    if (!data.custodialParentName || !data.noncustodialParentName) return false

    // If revocation, must have notification
    if (data.isRevocation && !data.noncustodialParentNotified) return false

    return true
  }

  fields = (): Field[] => {
    const data = this.f8332Data()

    return [
      // Part I: Release
      data?.childName ?? '',
      data?.childSSN ?? '',
      // Release type
      this.isCurrentYearOnly(),
      this.isSpecificYears(),
      this.isAllFutureYears(),
      data?.currentTaxYear ?? 0,
      (data?.specificYears ?? []).join(', '),
      this.yearsCovered(),
      // Custodial parent
      data?.custodialParentName ?? '',
      data?.custodialParentSSN ?? '',
      data?.custodialParentAddress ?? '',
      data?.custodialParentSignatureDate.toLocaleDateString() ?? '',
      // Noncustodial parent
      data?.noncustodialParentName ?? '',
      data?.noncustodialParentSSN ?? '',
      data?.noncustodialParentAddress ?? '',
      // Part II: Revocation
      this.isRevocation(),
      data?.revocationYear ?? 0,
      data?.originalReleaseYear ?? 0,
      data?.noncustodialParentNotified ?? false,
      data?.notificationDate?.toLocaleDateString() ?? '',
      // Status
      this.isValid()
    ]
  }
}
