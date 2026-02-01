import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8868 - Application for Automatic Extension of Time To File
 * an Exempt Organization Return
 *
 * Used by exempt organizations to request automatic 6-month extension
 * for filing Forms 990, 990-EZ, 990-PF, 990-T, 4720, and others.
 *
 * Two types of extensions:
 * - Automatic 6-month extension (Part I)
 * - Additional extension (Part II) - rarely granted
 *
 * Key rules:
 * - Extension is automatic if properly completed and timely filed
 * - Original due date: 15th day of 5th month after year end
 * - Extended due date: 15th day of 11th month after year end
 * - Does not extend time to pay any tax owed
 */

export type ExemptReturnType =
  | '990' // Return of Organization Exempt From Income Tax
  | '990-BL' // Information and Initial Excise Tax Return for Black Lung Benefit Trusts
  | '990-EZ' // Short Form Return of Organization Exempt From Income Tax
  | '990-PF' // Return of Private Foundation
  | '990-T' // Exempt Organization Business Income Tax Return
  | '1041-A' // US Information Return - Trust Accumulation of Charitable Amounts
  | '4720' // Return of Certain Excise Taxes Under Chapters 41 and 42
  | '5227' // Split-Interest Trust Information Return
  | '6069' // Return of Excise Tax on Excess Contributions
  | '8870' // Information Return for Transfers to Certain Foreign Trusts

export interface ExemptOrgExtensionInfo {
  returnType: ExemptReturnType
  organizationName: string
  ein: string
  address: string
  city: string
  state: string
  zip: string
  taxYearBegin: Date
  taxYearEnd: Date
  tentativeTax: number // For returns with tax (990-T, 4720)
  paymentWithExtension: number
  isGroupReturn: boolean
  groupExemptionNumber?: string
}

export default class F8868 extends F1040Attachment {
  tag: FormTag = 'f8868'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasExemptExtension()
  }

  hasExemptExtension = (): boolean => {
    return this.extensionInfo() !== undefined
  }

  extensionInfo = (): ExemptOrgExtensionInfo | undefined => {
    return this.f1040.info.exemptOrgExtension as
      | ExemptOrgExtensionInfo
      | undefined
  }

  // Part I - Automatic 6-Month Extension

  // Line 1a: Organization name
  l1a = (): string => this.extensionInfo()?.organizationName ?? ''

  // Line 1b: EIN
  l1b = (): string => this.extensionInfo()?.ein ?? ''

  // Line 2: Address
  l2 = (): string => this.extensionInfo()?.address ?? ''

  // Line 3: City, State, ZIP
  l3 = (): string => {
    const info = this.extensionInfo()
    if (!info) return ''
    return `${info.city}, ${info.state} ${info.zip}`
  }

  // Line 4: Return type being extended
  l4 = (): string => this.extensionInfo()?.returnType ?? ''

  // Line 5a: Tax year beginning
  l5a = (): string => {
    return this.extensionInfo()?.taxYearBegin.toLocaleDateString() ?? ''
  }

  // Line 5b: Tax year ending
  l5b = (): string => {
    return this.extensionInfo()?.taxYearEnd.toLocaleDateString() ?? ''
  }

  // Line 6: Tentative tax (for 990-T, 4720, etc.)
  l6 = (): number => this.extensionInfo()?.tentativeTax ?? 0

  // Line 7: Total payments and credits
  l7 = (): number => 0 // Prior estimated payments

  // Line 8: Balance due (line 6 - line 7)
  l8 = (): number => Math.max(0, this.l6() - this.l7())

  // Line 9: Amount paying with extension
  l9 = (): number => this.extensionInfo()?.paymentWithExtension ?? 0

  // Group return information
  isGroupReturn = (): boolean => this.extensionInfo()?.isGroupReturn ?? false
  groupExemptNumber = (): string =>
    this.extensionInfo()?.groupExemptionNumber ?? ''

  // Due date calculations
  originalDueDate = (): Date | undefined => {
    const yearEnd = this.extensionInfo()?.taxYearEnd
    if (!yearEnd) return undefined

    // 15th day of 5th month after year end
    const dueDate = new Date(yearEnd)
    dueDate.setMonth(dueDate.getMonth() + 5)
    dueDate.setDate(15)
    return dueDate
  }

  extendedDueDate = (): Date | undefined => {
    const yearEnd = this.extensionInfo()?.taxYearEnd
    if (!yearEnd) return undefined

    // 15th day of 11th month after year end
    const dueDate = new Date(yearEnd)
    dueDate.setMonth(dueDate.getMonth() + 11)
    dueDate.setDate(15)
    return dueDate
  }

  fields = (): Field[] => [
    // Part I - Organization Info
    this.l1a(),
    this.l1b(),
    this.l2(),
    this.l3(),
    // Return info
    this.l4(),
    this.l5a(),
    this.l5b(),
    // Tax info
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    // Group return
    this.isGroupReturn(),
    this.groupExemptNumber()
  ]
}
