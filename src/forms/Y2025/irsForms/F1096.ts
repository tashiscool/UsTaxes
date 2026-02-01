import Form from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form1096Data } from 'ustaxes/core/data'

/**
 * Form 1096 - Annual Summary and Transmittal of U.S. Information Returns
 *
 * Used to transmit paper Forms 1099, 1098, 5498, and W-2G to the IRS.
 * A separate Form 1096 must be filed for each type of form being transmitted.
 *
 * Not needed if filing electronically.
 *
 * Due dates:
 * - Paper filing: February 28
 * - Electronic filing: March 31
 *
 * Electronic filing required if 10+ information returns of any type
 */

export default class F1096 extends Form {
  tag: FormTag = 'f1096'
  sequenceIndex = 999

  data: Form1096Data

  constructor(data: Form1096Data) {
    super()
    this.data = data
  }

  // Filer identification
  filerName = (): string => this.data.filerName
  filerTIN = (): string => this.data.filerTIN
  filerAddress = (): string => {
    const addr = this.data.filerAddress
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${
      addr.zip ?? ''
    }`
  }

  // Contact information
  contactName = (): string => this.data.contactName ?? ''
  contactPhone = (): string => this.data.contactPhone ?? ''
  contactEmail = (): string => this.data.contactEmail ?? ''

  // Box 1: Employer identification number
  ein = (): string => this.data.filerTIN

  // Box 2: Social security number (if individual filer)
  ssn = (): string => '' // EIN takes precedence for businesses

  // Box 3: Total number of forms
  numberOfForms = (): number => this.data.numberOfForms

  // Box 4: Federal income tax withheld
  federalWithholding = (): number => this.data.federalWithholding ?? 0

  // Box 5: Total amount reported
  totalAmount = (): number => this.data.totalAmount

  // Box 6: Type of form being transmitted
  formType = (): string => this.data.formType

  // Checkboxes for form type
  is1099NEC = (): boolean => this.data.formType === '1099-NEC'
  is1099MISC = (): boolean => this.data.formType === '1099-MISC'
  is1099INT = (): boolean => this.data.formType === '1099-INT'
  is1099DIV = (): boolean => this.data.formType === '1099-DIV'
  is1099B = (): boolean => this.data.formType === '1099-B'
  is1099R = (): boolean => this.data.formType === '1099-R'
  is1099S = (): boolean => this.data.formType === '1099-S'
  is1099K = (): boolean => this.data.formType === '1099-K'

  taxYear = (): number => this.data.taxYear

  // Filing requirements
  requiresElectronicFiling = (): boolean => this.numberOfForms() >= 10

  // Form type name for display
  formTypeName = (): string => {
    switch (this.data.formType) {
      case '1099-NEC':
        return 'Form 1099-NEC, Nonemployee Compensation'
      case '1099-MISC':
        return 'Form 1099-MISC, Miscellaneous Information'
      case '1099-INT':
        return 'Form 1099-INT, Interest Income'
      case '1099-DIV':
        return 'Form 1099-DIV, Dividends and Distributions'
      case '1099-B':
        return 'Form 1099-B, Proceeds From Broker Transactions'
      case '1099-R':
        return 'Form 1099-R, Distributions From Pensions'
      case '1099-S':
        return 'Form 1099-S, Proceeds From Real Estate'
      case '1099-K':
        return 'Form 1099-K, Payment Card Transactions'
      default:
        return this.data.formType
    }
  }

  fields = (): Field[] => [
    this.filerName(),
    this.filerTIN(),
    this.filerAddress(),
    this.contactName(),
    this.contactPhone(),
    this.contactEmail(),
    this.numberOfForms(),
    this.federalWithholding(),
    this.totalAmount(),
    this.is1099NEC(),
    this.is1099MISC(),
    this.is1099INT(),
    this.is1099DIV(),
    this.is1099B(),
    this.is1099R(),
    this.is1099S(),
    this.is1099K(),
    this.taxYear()
  ]
}
