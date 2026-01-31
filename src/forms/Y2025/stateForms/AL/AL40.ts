import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Alabama Form 40 - Individual Income Tax Return
 *
 * Alabama uses a progressive tax rate of 2%-5%
 * Unique feature: Federal income tax is deductible
 */
export class AL40 extends Form {
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
    this.formName = 'AL-40'
    this.state = 'AL'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 1: Federal AGI
  l1 = (): number => this.f1040.l11()

  // Line 2: Additions (state/local bond interest from other states)
  l2 = (): number | undefined => undefined

  // Line 3: Total income
  l3 = (): number => this.l1() + (this.l2() ?? 0)

  // Line 4: Federal income tax deduction (unique to AL)
  l4 = (): number => {
    // Alabama allows deduction of federal income tax paid
    return Math.min(this.f1040.l24(), parameters.maxFederalTaxDeduction)
  }

  // Line 5: Other subtractions
  l5 = (): number | undefined => undefined

  // Line 6: Alabama AGI
  l6 = (): number => Math.max(0, this.l3() - this.l4() - (this.l5() ?? 0))

  // Line 7: Standard/Itemized deduction
  l7 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    return parameters.standardDeduction[status]
  }

  // Line 8: Personal exemption
  l8 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemption = parameters.personalExemption[status]
    const numDependents = this.info.taxPayer.dependents.length
    exemption += numDependents * parameters.dependentExemption
    return exemption
  }

  // Line 9: Alabama taxable income
  l9 = (): number => Math.max(0, this.l6() - this.l7() - this.l8())

  // Line 10: Tax
  l10 = (): number => {
    const income = this.l9()
    const status = this.filingStatus() ?? FilingStatus.S
    const brackets = parameters.taxBrackets[status]
    let tax = 0
    let remaining = income

    for (const bracket of brackets) {
      if (remaining <= 0) break
      const taxableAtBracket = Math.min(remaining, bracket.amount)
      tax += taxableAtBracket * bracket.rate
      remaining -= bracket.amount
    }

    return Math.round(tax)
  }

  // Line 11: Credits
  l11 = (): number | undefined => undefined

  // Line 12: Net tax
  l12 = (): number => Math.max(0, this.l10() - (this.l11() ?? 0))

  // Line 13: Withholding
  l13 = (): number | undefined => this.methods.witholdingForState('AL')

  // Line 14: Estimated payments
  l14 = (): number | undefined => undefined

  // Line 15: Total payments
  l15 = (): number => sumFields([this.l13(), this.l14()])

  // Line 16: Amount due
  l16 = (): number => Math.max(0, this.l12() - this.l15())

  // Line 17: Overpayment
  l17 = (): number => Math.max(0, this.l15() - this.l12())

  payment = (): number | undefined => {
    const due = this.l16()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
    this.l1(), this.l2(), this.l3(), this.l4(), this.l5(),
    this.l6(), this.l7(), this.l8(), this.l9(), this.l10(),
    this.l11(), this.l12(), this.l13(), this.l14(), this.l15(),
    this.l16(), this.l17()
  ]
}

const makeAL40 = (f1040: F1040): AL40 => new AL40(f1040)

export default makeAL40
