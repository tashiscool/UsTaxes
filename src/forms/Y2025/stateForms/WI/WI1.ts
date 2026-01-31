import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Wisconsin Form 1 - Income Tax Return
 *
 * Wisconsin uses progressive income tax rates (3.54% to 7.65%)
 * Unique features include sliding scale standard deduction
 */
export class WI1 extends Form {
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
    this.formName = 'WI-1'
    this.state = 'WI'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Non-Wisconsin state/local bond interest
  l2 = (): number | undefined => undefined

  // Line 3: Capital gains exclusion add-back (if claimed federal 1202)
  l3 = (): number | undefined => undefined

  // Line 4: Other additions
  l4 = (): number | undefined => undefined

  // Line 5: Total additions
  l5 = (): number => sumFields([this.l2(), this.l3(), this.l4()])

  // SUBTRACTIONS
  // Line 6: US government interest
  l6 = (): number | undefined => undefined

  // Line 7: State income tax refund (if not taxed federally)
  l7 = (): number | undefined => undefined

  // Line 8: Retirement benefits subtraction
  l8 = (): number | undefined => {
    const retirementIncome = this.f1040.l5b() ?? 0
    if (retirementIncome > 0) {
      return Math.min(retirementIncome, parameters.retirementSubtraction.maxAmount)
    }
    return undefined
  }

  // Line 9: Social Security (not taxable in WI)
  l9 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 10: Other subtractions
  l10 = (): number | undefined => undefined

  // Line 11: Total subtractions
  l11 = (): number => sumFields([
    this.l6(), this.l7(), this.l8(), this.l9(), this.l10()
  ])

  // Line 12: Wisconsin adjusted gross income
  l12 = (): number => Math.max(0, this.l1() + this.l5() - this.l11())

  // Line 13: Standard deduction (with phase-out)
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const baseDeduction = parameters.standardDeduction[status]
    const phaseOutStart = parameters.standardDeductionPhaseOut.startAgi[status]
    const agi = this.l12()

    // If itemizing, use federal itemized
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(baseDeduction, federalItemized)
    }

    // Phase out standard deduction at higher incomes
    if (agi > phaseOutStart) {
      const excess = agi - phaseOutStart
      const reduction = Math.round(excess * parameters.standardDeductionPhaseOut.reductionRate)
      return Math.max(0, baseDeduction - reduction)
    }

    return baseDeduction
  }

  // Line 14: Wisconsin taxable income
  l14 = (): number => Math.max(0, this.l12() - this.l13())

  // Line 15: Wisconsin income tax
  l15 = (): number => this.calculateWITax(this.l14())

  /**
   * Calculate Wisconsin tax using progressive brackets
   */
  private calculateWITax(taxableIncome: number): number {
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
  // Line 16: Wisconsin Earned Income Credit
  l16 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (!federalEIC || federalEIC <= 0) return undefined

    const numDependents = this.info.taxPayer.dependents.length
    let percentage: number

    if (numDependents >= 3) {
      percentage = parameters.earnedIncomeCredit.threeOrMoreChildren
    } else if (numDependents === 2) {
      percentage = parameters.earnedIncomeCredit.twoChildren
    } else if (numDependents === 1) {
      percentage = parameters.earnedIncomeCredit.oneChild
    } else {
      return undefined  // WI EIC requires at least one qualifying child
    }

    return Math.round(federalEIC * percentage)
  }

  // Line 17: Child/Dependent Care Credit (50% of federal)
  l17 = (): number | undefined => {
    const federalCredit = this.f1040.schedule3.l2()
    if (federalCredit && federalCredit > 0) {
      return Math.round(federalCredit * parameters.childCareCreditFactor)
    }
    return undefined
  }

  // Line 18: Homestead credit (separate calculation)
  l18 = (): number | undefined => undefined

  // Line 19: School property tax credit
  l19 = (): number | undefined => undefined

  // Line 20: Other nonrefundable credits
  l20 = (): number | undefined => undefined

  // Line 21: Total nonrefundable credits (limited to tax)
  l21 = (): number => Math.min(
    sumFields([this.l17(), this.l19(), this.l20()]),
    this.l15()
  )

  // Line 22: Tax after nonrefundable credits
  l22 = (): number => Math.max(0, this.l15() - this.l21())

  // PAYMENTS
  // Line 23: Wisconsin withholding
  l23 = (): number | undefined => this.methods.witholdingForState('WI')

  // Line 24: Estimated payments
  l24 = (): number | undefined => undefined

  // Line 25: Earned Income Credit (refundable)
  l25 = (): number | undefined => this.l16()

  // Line 26: Homestead credit (refundable)
  l26 = (): number | undefined => this.l18()

  // Line 27: Total payments and refundable credits
  l27 = (): number => sumFields([this.l23(), this.l24(), this.l25(), this.l26()])

  // RESULTS
  // Line 28: Amount due
  l28 = (): number => Math.max(0, this.l22() - this.l27())

  // Line 29: Overpayment
  l29 = (): number => Math.max(0, this.l27() - this.l22())

  payment = (): number | undefined => {
    const due = this.l28()
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
    this.l6(), this.l7(), this.l8(), this.l9(), this.l10(), this.l11(),
    this.l12(), this.l13(), this.l14(), this.l15(),
    this.l16(), this.l17(), this.l18(), this.l19(), this.l20(), this.l21(),
    this.l22(), this.l23(), this.l24(), this.l25(), this.l26(), this.l27(),
    this.l28(), this.l29()
  ]
}

const makeWI1 = (f1040: F1040): WI1 => new WI1(f1040)

export default makeWI1
