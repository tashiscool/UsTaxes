import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { CURRENT_YEAR } from '../data/federal'

/**
 * Form 4868 - Application for Automatic Extension of Time to File U.S. Individual Income Tax Return
 *
 * Grants an automatic 6-month extension to file (not to pay).
 * Original deadline: April 15
 * Extended deadline: October 15
 *
 * Important: This is an extension to FILE, not an extension to PAY.
 * Interest and penalties still accrue on unpaid taxes after April 15.
 */

export default class F4868 extends F1040Attachment {
  tag: FormTag = 'f4868'
  sequenceIndex = 0 // Filed separately before main return

  isNeeded = (): boolean => {
    // User must explicitly request extension
    return this.f1040.info.requestExtension ?? false
  }

  // Part I - Identification

  // Line 1: Name and address (from taxpayer info)

  // Line 2: SSN
  ssn = (): string => this.f1040.info.taxPayer.primaryPerson.ssid

  // Line 3: Spouse's SSN (if MFJ)
  spouseSSN = (): string | undefined => this.f1040.info.taxPayer.spouse?.ssid

  // Part II - Individual Income Tax

  // Line 4: Estimate of total tax liability for the year
  l4 = (): number => {
    // Best estimate of total tax
    return this.f1040.l24()
  }

  // Line 5: Total payments already made
  l5 = (): number => {
    return this.f1040.l33()
  }

  // Line 6: Balance due (line 4 - line 5)
  l6 = (): number => Math.max(0, this.l4() - this.l5())

  // Line 7: Amount you're paying
  l7 = (): number => {
    // Amount taxpayer intends to pay with extension
    return this.f1040.info.extensionPayment ?? this.l6()
  }

  // Part III - Out of the Country

  // Check if taxpayer is out of country on due date
  outOfCountry = (): boolean => {
    return this.f1040.info.outOfCountryOnDueDate ?? false
  }

  // Original due date
  originalDueDate = (): string => `April 15, ${CURRENT_YEAR + 1}`

  // Extended due date
  extendedDueDate = (): string => `October 15, ${CURRENT_YEAR + 1}`

  // Filing deadline message
  filingDeadline = (): string => {
    if (this.outOfCountry()) {
      return `June 15, ${
        CURRENT_YEAR + 1
      } (automatic 2-month extension for those abroad)`
    }
    return this.originalDueDate()
  }

  fields = (): Field[] => [
    // Identification
    this.f1040.info.taxPayer.primaryPerson.firstName,
    this.f1040.info.taxPayer.primaryPerson.lastName,
    this.f1040.info.taxPayer.spouse?.firstName ?? '',
    this.f1040.info.taxPayer.spouse?.lastName ?? '',
    this.f1040.info.taxPayer.primaryPerson.address.address,
    this.f1040.info.taxPayer.primaryPerson.address.aptNo ?? '',
    this.f1040.info.taxPayer.primaryPerson.address.city,
    this.f1040.info.taxPayer.primaryPerson.address.state,
    this.f1040.info.taxPayer.primaryPerson.address.zip,
    this.ssn(),
    this.spouseSSN() ?? '',
    // Part II
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    // Part III
    this.outOfCountry()
  ]
}
