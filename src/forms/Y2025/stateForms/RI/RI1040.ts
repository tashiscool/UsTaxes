import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Rhode Island Form RI-1040 - Resident Individual Income Tax Return
 *
 * Rhode Island uses progressive income tax rates (3.75% to 5.99%)
 * 3 tax brackets
 */
export class RI1040 extends Form {
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
    this.formName = 'RI-1040'
    this.state = 'RI'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // MODIFICATIONS - ADDITIONS
  // Line 2: Interest on non-RI state/local obligations
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // MODIFICATIONS - SUBTRACTIONS
  // Line 5: US government interest
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (RI doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Other subtractions
  l7 = (): number | undefined => undefined

  // Line 8: Total subtractions
  l8 = (): number => sumFields([this.l5(), this.l6(), this.l7()])

  // Line 9: Rhode Island adjusted gross income
  l9 = (): number => Math.max(0, this.l1() + this.l4() - this.l8())

  // Line 10: Standard or itemized deduction
  l10 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // RI allows itemizing (uses federal Schedule A)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 11: Personal exemptions
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 12: Rhode Island taxable income
  l12 = (): number => Math.max(0, this.l9() - this.l10() - this.l11())

  // Line 13: Rhode Island tax
  l13 = (): number => this.calculateRITax(this.l12())

  /**
   * Calculate RI tax using progressive brackets
   */
  private calculateRITax(taxableIncome: number): number {
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
  // Line 14: RI Earned Income Credit (16% of federal)
  l14 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC
      ? Math.round(federalEIC * parameters.eicPercentage)
      : undefined
  }

  // Line 15: Child tax credit
  l15 = (): number | undefined => {
    const numChildren = this.info.taxPayer.dependents.filter(
      (d) =>
        new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 17
    ).length
    return numChildren > 0 ? numChildren * parameters.childTaxCredit : undefined
  }

  // Line 16: Other credits
  l16 = (): number | undefined => undefined

  // Line 17: Total credits (limited to tax)
  l17 = (): number =>
    Math.min(sumFields([this.l14(), this.l15(), this.l16()]), this.l13())

  // Line 18: Net tax
  l18 = (): number => Math.max(0, this.l13() - this.l17())

  // PAYMENTS
  // Line 19: RI withholding
  l19 = (): number | undefined => this.methods.witholdingForState('RI')

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
    this.info.taxPayer.primaryPerson.firstName,
    this.info.taxPayer.primaryPerson.lastName,
    this.info.taxPayer.primaryPerson.ssid,
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
    this.l23()
  ]
}

const makeRI1040 = (f1040: F1040): RI1040 => new RI1040(f1040)

export default makeRI1040
