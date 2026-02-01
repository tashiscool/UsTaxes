import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * Idaho Form 40 - Individual Income Tax Return
 *
 * Idaho uses a flat 5.695% income tax rate (as of 2023)
 * Idaho moved from progressive brackets to flat tax in 2023
 */
export class ID40 extends Form {
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
    this.formName = 'ID-40'
    this.state = 'ID'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  private getSpouseAge(): number {
    const dob = this.info.taxPayer.spouse?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Line 6: Federal Adjusted Gross Income
  l6 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 7: Interest from non-Idaho state/local bonds
  l7 = (): number | undefined => undefined

  // Line 8: Other additions
  l8 = (): number | undefined => undefined

  // Line 9: Total additions
  l9 = (): number => sumFields([this.l7(), this.l8()])

  // Line 10: Total income (AGI + additions)
  l10 = (): number => this.l6() + this.l9()

  // SUBTRACTIONS
  // Line 11: Interest from US government obligations
  l11 = (): number | undefined => undefined

  // Line 12: Social Security benefits (Idaho doesn't tax SS)
  l12 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 13: Retirement benefits deduction
  l13 = (): number | undefined => {
    const retirementIncome = this.f1040.l5b() ?? 0
    if (retirementIncome > 0) {
      return Math.min(
        retirementIncome,
        parameters.retirementBenefitsDeduction.maxDeduction
      )
    }
    return undefined
  }

  // Line 14: Other subtractions
  l14 = (): number | undefined => undefined

  // Line 15: Total subtractions
  l15 = (): number =>
    sumFields([this.l11(), this.l12(), this.l13(), this.l14()])

  // Line 16: Idaho adjusted income
  l16 = (): number => Math.max(0, this.l10() - this.l15())

  // Line 17: Standard or itemized deduction
  l17 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Idaho conforms to federal deductions
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 18: Idaho taxable income
  l18 = (): number => Math.max(0, this.l16() - this.l17())

  // Line 19: Idaho tax (flat 5.695%)
  l19 = (): number => Math.round(this.l18() * parameters.taxRate)

  // CREDITS
  // Line 20: Personal exemption credit
  l20 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credits = parameters.personalExemptionCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credits += numDependents * parameters.dependentExemptionCredit

    return credits
  }

  // Line 21: Child tax credit
  l21 = (): number | undefined => {
    const qualifyingChildren = this.info.taxPayer.dependents.filter(
      (d) =>
        new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 17
    ).length
    return qualifyingChildren > 0
      ? qualifyingChildren * parameters.childTaxCredit
      : undefined
  }

  // Line 22: Other credits
  l22 = (): number | undefined => undefined

  // Line 23: Total non-refundable credits (limited to tax)
  l23 = (): number =>
    Math.min(sumFields([this.l20(), this.l21(), this.l22()]), this.l19())

  // Line 24: Net tax
  l24 = (): number => Math.max(0, this.l19() - this.l23())

  // REFUNDABLE CREDITS
  // Line 25: Idaho Grocery Credit (refundable)
  l25 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()

    let credit = 0

    // Primary taxpayer
    credit +=
      primaryAge >= 65
        ? parameters.groceryCredit.age65Plus
        : parameters.groceryCredit.base

    // Spouse if MFJ
    if (status === FilingStatus.MFJ) {
      credit +=
        spouseAge >= 65
          ? parameters.groceryCredit.age65Plus
          : parameters.groceryCredit.base
    }

    // Dependents
    const numDependents = this.info.taxPayer.dependents.length
    credit += numDependents * parameters.groceryCredit.base

    return credit
  }

  // Line 26: Other refundable credits
  l26 = (): number | undefined => undefined

  // Line 27: Total refundable credits
  l27 = (): number => sumFields([this.l25(), this.l26()])

  // PAYMENTS
  // Line 28: Idaho withholding
  l28 = (): number | undefined => this.methods.witholdingForState('ID')

  // Line 29: Estimated payments
  l29 = (): number | undefined => undefined

  // Line 30: Total payments
  l30 = (): number => sumFields([this.l28(), this.l29()])

  // Line 31: Total payments and refundable credits
  l31 = (): number => this.l30() + this.l27()

  // RESULTS
  // Line 32: Amount due
  l32 = (): number => Math.max(0, this.l24() - this.l31())

  // Line 33: Overpayment/Refund
  l33 = (): number => Math.max(0, this.l31() - this.l24())

  payment = (): number | undefined => {
    const due = this.l32()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson.firstName,
    this.info.taxPayer.primaryPerson.lastName,
    this.info.taxPayer.primaryPerson.ssid,
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
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
    this.l33()
  ]
}

const makeID40 = (f1040: F1040): ID40 => new ID40(f1040)

export default makeID40
