import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 2350 - Application for Extension of Time To File U.S. Income Tax Return
 * (For U.S. Citizens and Resident Aliens Abroad Who Expect To Qualify for
 * Special Tax Treatment)
 *
 * Used when a US citizen or resident abroad needs additional time beyond
 * the regular extension (Form 4868) to qualify for:
 * - Foreign earned income exclusion (Form 2555)
 * - Foreign housing exclusion or deduction
 *
 * Key rules:
 * - Must be outside the US on the regular due date
 * - Used when you expect to meet either:
 *   - Bona fide residence test
 *   - Physical presence test (330 days in 12-month period)
 * - Can extend up to 30 days after qualifying date
 * - Does not extend time to pay tax
 *
 * Deadline strategy:
 * - Regular due date: April 15
 * - Auto 2-month extension: June 15 (if abroad)
 * - Form 4868 extension: October 15
 * - Form 2350 extension: Beyond October 15 if needed to qualify
 */

export interface AbroadExtensionInfo {
  foreignCountry: string
  foreignAddress: string
  dateLeftUS: Date
  expectedReturnDate?: Date
  qualificationTest: 'bonaFideResident' | 'physicalPresence'
  expectedQualifyingDate: Date  // Date expect to meet test
  taxYear: number
  estimatedTax: number
  amountPaid: number
  requestedDueDate: Date  // Extended due date requested
}

export default class F2350 extends F1040Attachment {
  tag: FormTag = 'f2350'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasAbroadExtension()
  }

  hasAbroadExtension = (): boolean => {
    return this.extensionInfo() !== undefined
  }

  extensionInfo = (): AbroadExtensionInfo | undefined => {
    return this.f1040.info.abroadExtension as AbroadExtensionInfo | undefined
  }

  // Part I - Identification

  // Line 1: Name and SSN (from F1040)

  // Line 2: Present home address abroad
  l2Address = (): string => this.extensionInfo()?.foreignAddress ?? ''
  l2Country = (): string => this.extensionInfo()?.foreignCountry ?? ''

  // Line 3: US address (for mailing)
  l3 = (): string => {
    const addr = this.f1040.info.taxPayer.primaryPerson.address
    return `${addr.address ?? ''}, ${addr.city ?? ''}, ${addr.state ?? ''} ${addr.zip ?? ''}`
  }

  // Part II - Tax Year and Extension Information

  // Line 4: Tax year for which extension is requested
  l4 = (): number => this.extensionInfo()?.taxYear ?? 2025

  // Line 5: Date you left the United States
  l5 = (): string => {
    return this.extensionInfo()?.dateLeftUS?.toLocaleDateString() ?? ''
  }

  // Line 6: Date you expect to return to US (if applicable)
  l6 = (): string => {
    return this.extensionInfo()?.expectedReturnDate?.toLocaleDateString() ?? 'Indefinite'
  }

  // Part III - Qualification Test

  // Line 7: Which test do you expect to meet?
  l7BonaFide = (): boolean => {
    return this.extensionInfo()?.qualificationTest === 'bonaFideResident'
  }
  l7PhysicalPresence = (): boolean => {
    return this.extensionInfo()?.qualificationTest === 'physicalPresence'
  }

  // Line 8: Date you expect to qualify
  l8 = (): string => {
    return this.extensionInfo()?.expectedQualifyingDate?.toLocaleDateString() ?? ''
  }

  // Line 9: Extended due date requested (30 days after qualifying date)
  l9 = (): string => {
    const qualifyDate = this.extensionInfo()?.expectedQualifyingDate
    if (!qualifyDate) return ''

    const extendedDate = new Date(qualifyDate)
    extendedDate.setDate(extendedDate.getDate() + 30)
    return extendedDate.toLocaleDateString()
  }

  // Part IV - Tax Information

  // Line 10: Estimated total tax for the year
  l10 = (): number => this.extensionInfo()?.estimatedTax ?? 0

  // Line 11: Total payments made
  l11 = (): number => this.extensionInfo()?.amountPaid ?? 0

  // Line 12: Balance due (line 10 - line 11)
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Amount paying with this extension
  l13 = (): number => 0  // Usually $0 as this is just a filing extension

  // Calculate days until qualifying
  daysUntilQualifying = (): number => {
    const qualifyDate = this.extensionInfo()?.expectedQualifyingDate
    if (!qualifyDate) return 0

    const today = new Date()
    const diffTime = qualifyDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l2Address(),
    this.l2Country(),
    this.l3(),
    // Part II
    this.l4(),
    this.l5(),
    this.l6(),
    // Part III
    this.l7BonaFide(),
    this.l7PhysicalPresence(),
    this.l8(),
    this.l9(),
    // Part IV
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13()
  ]
}
