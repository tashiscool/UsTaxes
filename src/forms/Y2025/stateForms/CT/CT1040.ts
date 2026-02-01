import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Connecticut Form CT-1040 - Resident Income Tax Return
 *
 * Connecticut uses progressive income tax rates (2% to 6.99%)
 * Uses federal AGI as starting point with modifications
 */
export class CT1040 extends Form {
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
    this.formName = 'CT-1040'
    this.state = 'CT'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal adjusted gross income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest from non-CT state/local bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Interest from US obligations
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefit adjustment
  l6 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const ssIncome = this.f1040.l6b() ?? 0
    const agi = this.l1()
    const incomeLimit = parameters.socialSecurityExemption.incomeLimit[status]

    if (ssIncome > 0 && agi <= incomeLimit) {
      return ssIncome // Full exemption if under limit
    }
    return undefined
  }

  // Line 7: Pension and annuity subtraction
  l7 = (): number | undefined => {
    const pensionIncome = this.f1040.l5b() ?? 0
    if (pensionIncome > 0) {
      // CT allows partial exemption
      return Math.min(pensionIncome, 14000)
    }
    return undefined
  }

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Connecticut adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Connecticut taxable income (same as CT AGI for most)
  l11 = (): number => this.l10()

  // Line 12: Connecticut income tax
  l12 = (): number => this.calculateCTTax(this.l11())

  /**
   * Calculate Connecticut tax using progressive brackets
   */
  private calculateCTTax(taxableIncome: number): number {
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

  // Line 13: Personal tax credit
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const creditBase = parameters.personalCredit[status]
    const agi = this.l10()

    // Credit phases out at higher incomes
    if (agi > creditBase) {
      const excess = agi - creditBase
      const reduction = Math.floor(excess / 1000) * 10
      return Math.max(0, Math.round(this.l12() * 0.75) - reduction)
    }
    return Math.round(this.l12() * 0.75)
  }

  // CREDITS
  // Line 14: Property tax credit
  l14 = (): number | undefined => {
    const agi = this.l10()
    if (agi <= parameters.propertyTaxCredit.incomeLimit) {
      return parameters.propertyTaxCredit.maxCredit
    }
    return undefined
  }

  // Line 15: Credit for taxes paid to other states
  l15 = (): number | undefined => undefined

  // Line 16: Other nonrefundable credits
  l16 = (): number | undefined => undefined

  // Line 17: Total nonrefundable credits (limited to tax after personal credit)
  l17 = (): number => {
    const taxAfterPersonalCredit = Math.max(0, this.l12() - this.l13())
    return Math.min(
      sumFields([this.l14(), this.l15(), this.l16()]),
      taxAfterPersonalCredit
    )
  }

  // Line 18: Tax after nonrefundable credits
  l18 = (): number => Math.max(0, this.l12() - this.l13() - this.l17())

  // PAYMENTS
  // Line 19: Connecticut withholding
  l19 = (): number | undefined => this.methods.witholdingForState('CT')

  // Line 20: Estimated payments
  l20 = (): number | undefined => undefined

  // Line 21: Connecticut Earned Income Tax Credit (30.5% of federal)
  l21 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 22: Child Tax Credit
  l22 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l10()
    const incomeLimit = parameters.childTaxCredit.incomeLimit[status]
    const numDependents = this.info.taxPayer.dependents.length

    if (numDependents > 0 && agi <= incomeLimit) {
      return numDependents * parameters.childTaxCredit.amountPerChild
    }
    return undefined
  }

  // Line 23: Total payments and refundable credits
  l23 = (): number =>
    sumFields([this.l19(), this.l20(), this.l21(), this.l22()])

  // RESULTS
  // Line 24: Amount due
  l24 = (): number => Math.max(0, this.l18() - this.l23())

  // Line 25: Overpayment
  l25 = (): number => Math.max(0, this.l23() - this.l18())

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

const makeCT1040 = (f1040: F1040): CT1040 => new CT1040(f1040)

export default makeCT1040
