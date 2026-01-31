import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * North Dakota Form ND-1 - Individual Income Tax Return
 *
 * North Dakota has very low progressive tax rates (1.95%-2.5%)
 * Uses federal taxable income as starting point
 */
export class ND1 extends Form {
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
    this.formName = 'ND-1'
    this.state = 'ND'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 1: Federal taxable income (from 1040 line 15)
  l1 = (): number => this.f1040.l15()

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

  // Line 6: Social Security exemption (if below threshold)
  l6 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.f1040.l11()
    const threshold = parameters.socialSecurityExemptionThreshold[status]

    if (agi <= threshold) {
      return this.f1040.l6b() ?? undefined
    }
    return undefined
  }

  // Line 7: Net long-term capital gains included in federal taxable income
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: North Dakota taxable income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: North Dakota tax (progressive brackets)
  l11 = (): number => {
    const taxableIncome = this.l10()
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
  // Line 12: Credits from Schedule ND-1CR
  l12 = (): number | undefined => undefined

  // Line 13: Other credits
  l13 = (): number | undefined => undefined

  // Line 14: Total credits (limited to tax)
  l14 = (): number => Math.min(sumFields([this.l12(), this.l13()]), this.l11())

  // Line 15: Net tax
  l15 = (): number => Math.max(0, this.l11() - this.l14())

  // PAYMENTS
  // Line 16: ND withholding
  l16 = (): number | undefined => this.methods.witholdingForState('ND')

  // Line 17: Estimated payments
  l17 = (): number | undefined => undefined

  // Line 18: Total payments
  l18 = (): number => sumFields([this.l16(), this.l17()])

  // RESULTS
  // Line 19: Amount due
  l19 = (): number => Math.max(0, this.l15() - this.l18())

  // Line 20: Overpayment
  l20 = (): number => Math.max(0, this.l18() - this.l15())

  payment = (): number | undefined => {
    const due = this.l19()
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
    this.l10(), this.l11(),
    this.l12(), this.l13(), this.l14(), this.l15(),
    this.l16(), this.l17(), this.l18(),
    this.l19(), this.l20()
  ]
}

const makeND1 = (f1040: F1040): ND1 => new ND1(f1040)

export default makeND1
