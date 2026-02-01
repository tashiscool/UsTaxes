import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * Nebraska Form 1040N - Individual Income Tax Return
 *
 * Nebraska uses a progressive income tax with 4 brackets (2.46%-5.84%)
 */
export class NE1040N extends Form {
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
    this.formName = 'NE-1040N'
    this.state = 'NE'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest from other state bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: US government interest
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (NE fully exempts SS starting 2025)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: State income tax refund (if included in federal AGI)
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Nebraska adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // NE allows itemizing (uses federal Schedule A)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 12: Nebraska taxable income
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Nebraska tax (progressive brackets)
  l13 = (): number => {
    const taxableIncome = this.l12()
    return this.calculateTax(taxableIncome)
  }

  private calculateTax(income: number): number {
    const status = this.filingStatus() ?? FilingStatus.S
    const brackets = parameters.taxBrackets[status]
    let tax = 0
    let remainingIncome = income

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break

      const taxableInBracket = Math.min(
        remainingIncome,
        bracket.max - bracket.min
      )
      tax += taxableInBracket * bracket.rate
      remainingIncome -= taxableInBracket
    }

    return Math.round(tax)
  }

  // CREDITS
  // Line 14: Personal exemption credit
  l14 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credit = parameters.personalExemptionCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credit += numDependents * parameters.dependentExemptionCredit

    return credit
  }

  // Line 15: Nebraska earned income credit (10% of federal EITC)
  l15 = (): number | undefined => {
    const federalEITC = this.f1040.l27() ?? 0
    if (federalEITC <= 0) return undefined
    return Math.round(federalEITC * parameters.eitcPercentage)
  }

  // Line 16: Child/dependent care credit
  l16 = (): number | undefined => undefined

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total credits (limited to tax)
  l18 = (): number =>
    Math.min(
      sumFields([this.l14(), this.l15(), this.l16(), this.l17()]),
      this.l13()
    )

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l13() - this.l18())

  // PAYMENTS
  // Line 20: NE withholding
  l20 = (): number | undefined => this.methods.witholdingForState('NE')

  // Line 21: Estimated payments
  l21 = (): number | undefined => undefined

  // Line 22: Total payments
  l22 = (): number => sumFields([this.l20(), this.l21()])

  // RESULTS
  // Line 23: Amount due
  l23 = (): number => Math.max(0, this.l19() - this.l22())

  // Line 24: Overpayment
  l24 = (): number => Math.max(0, this.l22() - this.l19())

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

const makeNE1040N = (f1040: F1040): NE1040N => new NE1040N(f1040)

export default makeNE1040N
