import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Kansas Form K-40 - Individual Income Tax Return
 *
 * Kansas uses progressive income tax rates (3.1% to 5.7%)
 * 3 tax brackets for 2025
 */
export class KS40 extends Form {
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
    this.formName = 'KS-40'
    this.state = 'KS'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: State and municipal bond interest (non-KS)
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Kansas exempt income (state/local interest)
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (KS doesn't tax SS for AGI <= $75,000)
  l6 = (): number | undefined => {
    const agi = this.l1()
    if (agi <= 75000) {
      return this.f1040.l6b() ?? undefined
    }
    return undefined
  }

  // Line 7: Retirement income exclusion (military, government pensions)
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Kansas adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // KS allows itemizing (uses federal Schedule A with modifications)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 12: Personal and dependent exemptions
  l12 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 13: Kansas taxable income
  l13 = (): number => Math.max(0, this.l10() - this.l11() - this.l12())

  // Line 14: Kansas tax (from tax table or brackets)
  l14 = (): number => this.calculateKSTax(this.l13())

  /**
   * Calculate KS tax using progressive brackets
   */
  private calculateKSTax(taxableIncome: number): number {
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
  // Line 15: Food sales tax credit
  l15 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l10()
    const incomeLimit = parameters.foodSalesTaxCreditIncomeLimit[status]

    if (agi <= incomeLimit) {
      let credit = parameters.foodSalesTaxCredit[status]
      const numDependents = this.info.taxPayer.dependents.length
      credit += numDependents * parameters.foodSalesTaxCreditPerDependent
      return credit
    }
    return undefined
  }

  // Line 16: Child and dependent care credit
  l16 = (): number | undefined => undefined

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total credits (limited to tax)
  l18 = (): number =>
    Math.min(sumFields([this.l15(), this.l16(), this.l17()]), this.l14())

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l14() - this.l18())

  // PAYMENTS
  // Line 20: Kansas withholding
  l20 = (): number | undefined => this.methods.witholdingForState('KS')

  // Line 21: Estimated payments
  l21 = (): number | undefined => undefined

  // Line 22: Other payments
  l22 = (): number | undefined => undefined

  // Line 23: Total payments
  l23 = (): number => sumFields([this.l20(), this.l21(), this.l22()])

  // RESULTS
  // Line 24: Amount due
  l24 = (): number => Math.max(0, this.l19() - this.l23())

  // Line 25: Overpayment/Refund
  l25 = (): number => Math.max(0, this.l23() - this.l19())

  payment = (): number | undefined => {
    const due = this.l24()
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
    this.l24(),
    this.l25()
  ]
}

const makeKS40 = (f1040: F1040): KS40 => new KS40(f1040)

export default makeKS40
