import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Arkansas Form AR1000 - Individual Income Tax Return
 *
 * Arkansas uses progressive income tax rates (0.9% to 4.4% for 2025)
 * Top rate reduced from 4.7% to 4.4% for 2025
 */
export class AR1000 extends Form {
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
    this.formName = 'AR-1000'
    this.state = 'AR'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest on out-of-state municipal bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: US government interest
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (AR doesn't tax SS starting 2024)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Retirement income
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Arkansas adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    return parameters.standardDeduction[status]
  }

  // Line 12: Itemized deductions (if claimed)
  l12 = (): number | undefined => {
    if (this.f1040.scheduleA.isNeeded()) {
      return this.f1040.scheduleA.deductions()
    }
    return undefined
  }

  // Line 13: Deduction amount (greater of standard or itemized)
  l13 = (): number => Math.max(this.l11(), this.l12() ?? 0)

  // Line 14: Arkansas net income
  l14 = (): number => Math.max(0, this.l10() - this.l13())

  // Line 15: Arkansas tax
  l15 = (): number => this.calculateARTax(this.l14())

  /**
   * Calculate Arkansas tax using progressive brackets
   */
  private calculateARTax(taxableIncome: number): number {
    const status = this.filingStatus() ?? FilingStatus.S
    const bracketInfo = parameters.taxBrackets[status]
    const { brackets, rates } = bracketInfo

    let tax = 0
    let previousBracket = 0

    for (let i = 0; i < rates.length; i++) {
      const bracket = brackets[i] ?? Infinity
      if (taxableIncome <= previousBracket) break

      const taxableInBracket = Math.min(taxableIncome, bracket) - previousBracket
      tax += taxableInBracket * rates[i]
      previousBracket = bracket
    }

    return Math.round(tax)
  }

  // CREDITS
  // Line 16: Personal tax credits
  l16 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credits = parameters.personalCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credits += numDependents * parameters.dependentCredit

    return credits
  }

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total credits (limited to tax)
  l18 = (): number => Math.min(sumFields([this.l16(), this.l17()]), this.l15())

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l15() - this.l18())

  // PAYMENTS
  // Line 20: AR withholding
  l20 = (): number | undefined => this.methods.witholdingForState('AR')

  // Line 21: Estimated payments
  l21 = (): number | undefined => undefined

  // Line 22: Total payments
  l22 = (): number => sumFields([this.l20(), this.l21()])

  // RESULTS
  // Line 23: Amount due
  l23 = (): number => Math.max(0, this.l19() - this.l22())

  // Line 24: Overpayment/Refund
  l24 = (): number => Math.max(0, this.l22() - this.l19())

  payment = (): number | undefined => {
    const due = this.l23()
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
    this.l10(), this.l11(), this.l12(), this.l13(), this.l14(), this.l15(),
    this.l16(), this.l17(), this.l18(), this.l19(),
    this.l20(), this.l21(), this.l22(),
    this.l23(), this.l24()
  ]
}

const makeAR1000 = (f1040: F1040): AR1000 => new AR1000(f1040)

export default makeAR1000
