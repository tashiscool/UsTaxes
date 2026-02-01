import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { CURRENT_YEAR } from '../../data/federal'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * Arizona Form 140 - Resident Personal Income Tax Return
 *
 * Arizona has a flat 2.5% income tax rate (as of 2023)
 * Uses federal AGI as starting point
 */
export class AZ140 extends Form {
  info: ValidatedInformation
  f1040: F1040
  formName: string
  state: State
  formOrder = 0
  methods: FormMethods

  constructor(f1040: F1040) {
    super()
    this.info = f1040.info
    this.f1040 = f1040
    this.formName = 'AZ-140'
    this.state = 'AZ'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  spouseFirstName = (): string | undefined =>
    this.info.taxPayer.spouse?.firstName

  spouseLastName = (): string | undefined => this.info.taxPayer.spouse?.lastName

  spouseSSN = (): string | undefined => this.info.taxPayer.spouse?.ssid

  address = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.address

  city = (): string | undefined => this.info.taxPayer.primaryPerson.address.city

  stateField = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.state

  zip = (): string | undefined => this.info.taxPayer.primaryPerson.address.zip

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Income section
  // Line 12 - Federal adjusted gross income from federal Form 1040
  l12 = (): number => this.f1040.l11()

  // Line 13 - Additions (Arizona-specific additions to income)
  l13 = (): number | undefined => undefined

  // Line 14 - Subtotal
  l14 = (): number => sumFields([this.l12(), this.l13()])

  // Line 15 - Subtractions (Arizona-specific subtractions)
  // Includes U.S. government interest, Social Security if taxed federally, etc.
  l15 = (): number | undefined => {
    // Arizona excludes Social Security benefits from state taxation
    const ssBenefits = this.f1040.l6a() ?? 0
    return ssBenefits > 0 ? ssBenefits : undefined
  }

  // Line 16 - Arizona adjusted gross income
  l16 = (): number => Math.max(0, this.l14() - (this.l15() ?? 0))

  // Deductions section
  // Line 17 - Standard deduction OR itemized deductions
  l17 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Use federal itemized if greater
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 18 - Personal exemptions
  l18 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 19 - Age 65+ exemption
  l19 = (): number => {
    let exemption = 0
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
    if (dob && dob < new Date(CURRENT_YEAR - 65, 0, 2)) {
      exemption += parameters.seniorExemption
    }
    const spouseDob = this.info.taxPayer.spouse?.dateOfBirth
    if (spouseDob && spouseDob < new Date(CURRENT_YEAR - 65, 0, 2)) {
      exemption += parameters.seniorExemption
    }
    return exemption
  }

  // Line 20 - Blind exemption
  l20 = (): number => {
    let exemption = 0
    if (this.info.taxPayer.primaryPerson.isBlind) {
      exemption += parameters.blindExemption
    }
    if (this.info.taxPayer.spouse?.isBlind) {
      exemption += parameters.blindExemption
    }
    return exemption
  }

  // Line 21 - Total deductions and exemptions
  l21 = (): number =>
    sumFields([this.l17(), this.l18(), this.l19(), this.l20()])

  // Line 22 - Arizona taxable income
  l22 = (): number => Math.max(0, this.l16() - this.l21())

  // Tax computation
  // Line 23 - Tax from tax rate (flat 2.5%)
  l23 = (): number => Math.round(this.l22() * parameters.taxRate)

  // Line 24 - Tax from recapture of credits
  l24 = (): number | undefined => undefined

  // Line 25 - Subtotal of tax
  l25 = (): number => sumFields([this.l23(), this.l24()])

  // Credits section
  // Line 26 - Family income tax credit (for low-income filers)
  l26 = (): number | undefined => undefined

  // Line 27 - Other nonrefundable credits
  l27 = (): number | undefined => undefined

  // Line 28 - Total nonrefundable credits
  l28 = (): number => sumFields([this.l26(), this.l27()])

  // Line 29 - Tax after nonrefundable credits
  l29 = (): number => Math.max(0, this.l25() - this.l28())

  // Payments section
  // Line 30 - Arizona withholding
  l30 = (): number | undefined => this.methods.witholdingForState('AZ')

  // Line 31 - Estimated payments
  l31 = (): number | undefined => undefined

  // Line 32 - Extension payment
  l32 = (): number | undefined => undefined

  // Line 33 - Refundable credits
  l33 = (): number | undefined => undefined

  // Line 34 - Total payments and refundable credits
  l34 = (): number =>
    sumFields([this.l30(), this.l31(), this.l32(), this.l33()])

  // Results
  // Line 35 - Tax due (if tax > payments)
  l35 = (): number => Math.max(0, this.l29() - this.l34())

  // Line 36 - Overpayment (if payments > tax)
  l36 = (): number => Math.max(0, this.l34() - this.l29())

  // Line 37 - Amount to be refunded
  l37 = (): number => this.l36()

  payment = (): number | undefined => {
    const due = this.l35()
    return due > 0 ? due : undefined
  }

  // Bank information for direct deposit
  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.spouseFirstName(),
    this.spouseLastName(),
    this.spouseSSN(),
    this.address(),
    this.city(),
    this.stateField(),
    this.zip(),
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33(),
    this.l34(),
    this.l35(),
    this.l36(),
    this.l37(),
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeAZ140 = (f1040: F1040): AZ140 => new AZ140(f1040)

export default makeAZ140
