import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8809 - Application for Extension of Time To File Information Returns
 *
 * Used to request an automatic 30-day extension (and additional 30-day extension)
 * for filing information returns such as:
 * - Forms 1097, 1098, 1099, 3921, 3922, 5498, W-2G
 * - Forms W-2, W-2AS, W-2CM, W-2GU, W-2VI
 *
 * Key rules:
 * - Initial extension: Automatic 30-day extension
 * - Additional extension: May request one additional 30-day extension
 * - Must file by the due date of the information returns
 * - Separate form for each type of return or use single form with attachment
 */

export type InformationReturnType =
  | 'W-2' // Wage and Tax Statement
  | '1098' // Mortgage Interest
  | '1098-C' // Vehicle Contributions
  | '1098-E' // Student Loan Interest
  | '1098-T' // Tuition Statement
  | '1099-A' // Acquisition or Abandonment
  | '1099-B' // Proceeds from Broker
  | '1099-C' // Cancellation of Debt
  | '1099-CAP' // Corporate Control Changes
  | '1099-DIV' // Dividends
  | '1099-G' // Government Payments
  | '1099-INT' // Interest
  | '1099-K' // Payment Card Transactions
  | '1099-LS' // Life Insurance Sale
  | '1099-LTC' // Long-Term Care
  | '1099-MISC' // Miscellaneous Income
  | '1099-NEC' // Nonemployee Compensation
  | '1099-OID' // Original Issue Discount
  | '1099-PATR' // Patronage Dividends
  | '1099-Q' // Education Program Payments
  | '1099-R' // Retirement Distributions
  | '1099-S' // Real Estate Transactions
  | '1099-SA' // HSA/MSA Distributions
  | '1099-SB' // Seller's Investment
  | '3921' // ISO Stock Options
  | '3922' // ESPP Stock Transfers
  | '5498' // IRA Contributions
  | '5498-ESA' // Coverdell ESA
  | '5498-SA' // HSA/MSA Contributions
  | 'W-2G' // Gambling Winnings

export interface InfoReturnExtensionInfo {
  returnTypes: InformationReturnType[]
  taxYear: number
  filerName: string
  filerEin: string
  filerAddress: string
  filerCity: string
  filerState: string
  filerZip: string
  numberOfForms: number
  isInitialRequest: boolean // false = additional 30-day request
  reasonForAdditionalExtension?: string
}

export default class F8809 extends F1040Attachment {
  tag: FormTag = 'f8809'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasInfoReturnExtension()
  }

  hasInfoReturnExtension = (): boolean => {
    return this.extensionInfo() !== undefined
  }

  extensionInfo = (): InfoReturnExtensionInfo | undefined => {
    return this.f1040.info.infoReturnExtension as
      | InfoReturnExtensionInfo
      | undefined
  }

  // Part I - Filer Information

  // Line 1: Filer's name
  l1 = (): string => this.extensionInfo()?.filerName ?? ''

  // Line 2: Filer's EIN or SSN
  l2 = (): string => this.extensionInfo()?.filerEin ?? ''

  // Line 3: Address
  l3 = (): string => this.extensionInfo()?.filerAddress ?? ''

  // Line 4: City, State, ZIP
  l4 = (): string => {
    const info = this.extensionInfo()
    if (!info) return ''
    return `${info.filerCity}, ${info.filerState} ${info.filerZip}`
  }

  // Part II - Extension Request

  // Line 5: Tax year
  l5 = (): number => this.extensionInfo()?.taxYear ?? 2025

  // Line 6: Type of returns (checkboxes)
  returnTypes = (): InformationReturnType[] => {
    return this.extensionInfo()?.returnTypes ?? []
  }

  hasReturnType = (type: InformationReturnType): boolean => {
    return this.returnTypes().includes(type)
  }

  // Line 7: Is this an initial request?
  l7Initial = (): boolean => this.extensionInfo()?.isInitialRequest ?? true
  l7Additional = (): boolean => !this.l7Initial()

  // Line 8: Number of forms
  l8 = (): number => this.extensionInfo()?.numberOfForms ?? 0

  // Line 9: Reason for additional extension (if applicable)
  l9 = (): string => this.extensionInfo()?.reasonForAdditionalExtension ?? ''

  // Due dates
  originalDueDate = (): string => {
    // Most info returns due by Feb 28 (paper) or March 31 (electronic)
    return 'February 28 (paper) / March 31 (electronic)'
  }

  extendedDueDate = (): string => {
    // 30 days after original due date
    return 'March 30 (paper) / April 30 (electronic)'
  }

  fields = (): Field[] => [
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    // Part II
    this.l5(),
    // Return type checkboxes
    this.hasReturnType('W-2'),
    this.hasReturnType('1099-MISC'),
    this.hasReturnType('1099-NEC'),
    this.hasReturnType('1099-INT'),
    this.hasReturnType('1099-DIV'),
    this.hasReturnType('1099-B'),
    this.hasReturnType('1099-R'),
    this.hasReturnType('1098'),
    this.hasReturnType('5498'),
    // Extension info
    this.l7Initial(),
    this.l7Additional(),
    this.l8(),
    this.l9()
  ]
}
