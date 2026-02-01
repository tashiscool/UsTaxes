import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 7004 - Application for Automatic Extension of Time To File
 * Certain Business Income Tax, Information, and Other Returns
 *
 * Provides automatic extension for:
 * - Form 1065 (Partnership) - 6 months
 * - Form 1120 (Corporation) - 6 months
 * - Form 1120-S (S Corporation) - 6 months
 * - Form 1041 (Estate/Trust) - 5.5 months
 * - Form 990 (Exempt Organizations) - 6 months
 *
 * Key rules:
 * - Extension is automatic if form is properly completed and timely filed
 * - Does NOT extend time to pay taxes owed
 * - Must pay estimated tax with extension request
 * - Can be filed electronically or by mail
 *
 * Note: This is for business/entity returns, not individual Form 1040.
 * Including for completeness based on user's categorization.
 */

export type BusinessReturnType =
  | '1065' // Partnership
  | '1065-B' // Electing Large Partnership
  | '1066' // Real Estate Mortgage Investment Conduit
  | '1120' // Corporation
  | '1120-C' // Cooperative Association
  | '1120-F' // Foreign Corporation
  | '1120-FSC' // Foreign Sales Corporation
  | '1120-H' // Homeowners Association
  | '1120-L' // Life Insurance Company
  | '1120-ND' // Nuclear Decommissioning
  | '1120-PC' // Property/Casualty Insurance
  | '1120-POL' // Political Organization
  | '1120-REIT' // Real Estate Investment Trust
  | '1120-RIC' // Regulated Investment Company
  | '1120-S' // S Corporation
  | '1120-SF' // Settlement Fund
  | '1041' // Estate/Trust
  | '1041-N' // Electing Alaska Native Settlement Trust
  | '1041-QFT' // Qualified Funeral Trust
  | '990' // Exempt Organization
  | '990-BL' // Black Lung Benefit Trust
  | '990-PF' // Private Foundation
  | '990-T' // Exempt Organization Business Income
  | '8804' // Foreign Partner Withholding
  | '8831' // Excise Taxes on Excess Inclusions

export interface BusinessExtensionInfo {
  returnType: BusinessReturnType
  entityName: string
  ein: string
  address: string
  city: string
  state: string
  zip: string
  taxYear: number
  isFiscalYear: boolean
  fiscalYearEnd?: string // MM/DD format
  tentativeTax: number
  paymentWithExtension: number
  balanceDue: number
}

export default class F7004 extends F1040Attachment {
  tag: FormTag = 'f7004'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasBusinessExtension()
  }

  hasBusinessExtension = (): boolean => {
    return this.extensionInfo() !== undefined
  }

  extensionInfo = (): BusinessExtensionInfo | undefined => {
    return this.f1040.info.businessExtension as
      | BusinessExtensionInfo
      | undefined
  }

  // Extension period by return type
  extensionMonths = (): number => {
    const returnType = this.extensionInfo()?.returnType
    if (!returnType) return 0

    // Form 1041 gets 5.5 months, most others get 6 months
    if (returnType.startsWith('1041')) return 5.5
    return 6
  }

  // Part I - Identification

  // Line 1a: Name
  l1a = (): string => this.extensionInfo()?.entityName ?? ''

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

  // Part II - Return Information

  // Line 4: Form type being extended
  l4 = (): string => this.extensionInfo()?.returnType ?? ''

  // Line 5a: Tax year (calendar or fiscal)
  l5aCalendar = (): boolean => !this.extensionInfo()?.isFiscalYear
  l5aFiscal = (): boolean => this.extensionInfo()?.isFiscalYear ?? false

  // Line 5b: Fiscal year end date
  l5b = (): string => this.extensionInfo()?.fiscalYearEnd ?? ''

  // Part III - Tentative Tax

  // Line 6: Tentative total tax
  l6 = (): number => this.extensionInfo()?.tentativeTax ?? 0

  // Line 7: Total payments and credits
  l7 = (): number => 0 // Prior payments/estimated taxes

  // Line 8: Balance due (line 6 - line 7)
  l8 = (): number => Math.max(0, this.l6() - this.l7())

  // Line 9: Payment with this extension
  l9 = (): number => this.extensionInfo()?.paymentWithExtension ?? 0

  // Due date calculation
  originalDueDate = (): string => {
    const info = this.extensionInfo()
    if (!info) return ''

    // Calendar year returns
    if (!info.isFiscalYear) {
      switch (info.returnType) {
        case '1065':
        case '1120-S':
          return 'March 15' // Partnerships and S Corps
        case '1041':
          return 'April 15' // Estates and Trusts
        case '990':
        case '990-PF':
          return 'May 15' // Exempt organizations (15th day of 5th month)
        default:
          return 'April 15' // Most corporations
      }
    }

    return 'See fiscal year rules'
  }

  extendedDueDate = (): string => {
    const info = this.extensionInfo()
    if (!info) return ''

    // Calendar year returns with 6-month extension
    if (!info.isFiscalYear) {
      switch (info.returnType) {
        case '1065':
        case '1120-S':
          return 'September 15'
        case '1041':
          return 'September 30' // 5.5 months
        case '990':
        case '990-PF':
          return 'November 15'
        default:
          return 'October 15'
      }
    }

    return 'See fiscal year rules'
  }

  fields = (): Field[] => [
    // Part I
    this.l1a(),
    this.l1b(),
    this.l2(),
    this.l3(),
    // Part II
    this.l4(),
    this.l5aCalendar(),
    this.l5aFiscal(),
    this.l5b(),
    // Part III
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9()
  ]
}
