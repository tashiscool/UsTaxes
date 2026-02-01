import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * District of Columbia Form D-40 - Individual Income Tax Return
 *
 * DC uses progressive income tax rates (4% to 10.75%)
 */
export class DCD40 extends Form {
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
    this.formName = 'DC-D40'
    this.state = 'DC'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest on out-of-state municipal bonds
  l2 = (): number | undefined => undefined

  // Line 3: DC additions from Schedule I
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // Line 5: Total income (federal AGI + additions)
  l5 = (): number => this.l1() + this.l4()

  // SUBTRACTIONS
  // Line 6: Social Security benefits (DC doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: DC government pension
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l6(), this.l7(), this.l8()])

  // Line 10: DC adjusted gross income
  l10 = (): number => Math.max(0, this.l5() - this.l9())

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // DC allows itemizing (uses federal Schedule A)
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

  // Line 13: DC taxable income
  l13 = (): number => Math.max(0, this.l10() - this.l11() - this.l12())

  // Line 14: DC tax
  l14 = (): number => this.calculateDCTax(this.l13())

  /**
   * Calculate DC tax using progressive brackets
   */
  private calculateDCTax(taxableIncome: number): number {
    const status = this.filingStatus() ?? FilingStatus.S
    const bracketInfo = parameters.taxBrackets[status]
    const { brackets, rates } = bracketInfo

    let tax = 0
    let previousBracket = 0

    for (let i = 0; i < rates.length; i++) {
      const bracket = brackets[i] ?? Infinity
      if (taxableIncome <= previousBracket) break

      const taxableInBracket =
        Math.min(taxableIncome, bracket) - previousBracket
      tax += taxableInBracket * rates[i]
      previousBracket = bracket
    }

    return Math.round(tax)
  }

  // CREDITS
  // Line 15: DC Earned Income Credit (40% of federal)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC
      ? Math.round(federalEIC * parameters.eicPercentage)
      : undefined
  }

  // Line 16: Other credits
  l16 = (): number | undefined => undefined

  // Line 17: Total credits (limited to tax)
  l17 = (): number => Math.min(sumFields([this.l15(), this.l16()]), this.l14())

  // Line 18: Net tax
  l18 = (): number => Math.max(0, this.l14() - this.l17())

  // PAYMENTS
  // Line 19: DC withholding
  l19 = (): number | undefined => this.methods.witholdingForState('DC')

  // Line 20: Estimated payments
  l20 = (): number | undefined => undefined

  // Line 21: Amount paid with extension
  l21 = (): number | undefined => undefined

  // Line 22: Total payments
  l22 = (): number => sumFields([this.l19(), this.l20(), this.l21()])

  // RESULTS
  // Line 23: Amount due
  l23 = (): number => Math.max(0, this.l18() - this.l22())

  // Line 24: Overpayment/Refund
  l24 = (): number => Math.max(0, this.l22() - this.l18())

  payment = (): number | undefined => {
    const due = this.l23()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson.firstName,
    this.info.taxPayer.primaryPerson.lastName,
    this.info.taxPayer.primaryPerson.ssid,
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
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
    this.l24()
  ]
}

const makeDCD40 = (f1040: F1040): DCD40 => new DCD40(f1040)

export default makeDCD40
