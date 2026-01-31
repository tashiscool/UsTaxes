import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Maine Form 1040ME - Individual Income Tax Return
 *
 * Maine uses progressive tax rates: 5.8%, 6.75%, 7.15% (3 brackets)
 */
export class ME1040 extends Form {
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
    this.formName = 'ME-1040'
    this.state = 'ME'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  private getSpouseAge(): number {
    const dob = this.info.taxPayer.spouse?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Calculate tax using progressive brackets
  private calculateTax(taxableIncome: number): number {
    const status = this.filingStatus() ?? FilingStatus.S
    const brackets = parameters.brackets[status]
    let tax = 0

    for (const bracket of brackets) {
      if (taxableIncome > bracket.min) {
        const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min
        tax += taxableInBracket * bracket.rate
      }
    }

    return Math.round(tax)
  }

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest on non-Maine state/local bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: US government interest
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (Maine doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Pension income deduction
  l7 = (): number | undefined => {
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    const status = this.filingStatus() ?? FilingStatus.S
    let deduction = 0

    // Primary taxpayer (65+)
    if (primaryAge >= 65) {
      deduction += parameters.pensionDeduction.maxDeduction
    }

    // Spouse (if MFJ and 65+)
    if (status === FilingStatus.MFJ && spouseAge >= 65) {
      deduction += parameters.pensionDeduction.maxDeduction
    }

    // Limited to actual pension income
    const pensionIncome = this.f1040.l5b() ?? 0
    return Math.min(deduction, pensionIncome) || undefined
  }

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Maine adjusted gross income
  l10 = (): number => this.l1() + this.l4() - this.l9()

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Maine allows itemizing (uses federal Schedule A)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 12: Personal exemptions
  l12 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 13: Maine taxable income
  l13 = (): number => Math.max(0, this.l10() - this.l11() - this.l12())

  // Line 14: Maine tax (progressive rates)
  l14 = (): number => this.calculateTax(this.l13())

  // CREDITS
  // Line 15: Personal exemption credit
  l15 = (): number | undefined => undefined

  // Line 16: Other credits
  l16 = (): number | undefined => undefined

  // Line 17: Total credits (limited to tax)
  l17 = (): number => Math.min(sumFields([this.l15(), this.l16()]), this.l14())

  // Line 18: Net tax
  l18 = (): number => Math.max(0, this.l14() - this.l17())

  // PAYMENTS
  // Line 19: Maine withholding
  l19 = (): number | undefined => this.methods.witholdingForState('ME')

  // Line 20: Estimated payments
  l20 = (): number | undefined => undefined

  // Line 21: Total payments
  l21 = (): number => sumFields([this.l19(), this.l20()])

  // RESULTS
  // Line 22: Amount due
  l22 = (): number => Math.max(0, this.l18() - this.l21())

  // Line 23: Overpayment
  l23 = (): number => Math.max(0, this.l21() - this.l18())

  payment = (): number | undefined => {
    const due = this.l22()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
    this.l1(), this.l2(), this.l3(), this.l4(),
    this.l5(), this.l6(), this.l7(), this.l8(), this.l9(),
    this.l10(), this.l11(), this.l12(), this.l13(), this.l14(),
    this.l15(), this.l16(), this.l17(), this.l18(),
    this.l19(), this.l20(), this.l21(),
    this.l22(), this.l23()
  ]
}

const makeME1040 = (f1040: F1040): ME1040 => new ME1040(f1040)

export default makeME1040
