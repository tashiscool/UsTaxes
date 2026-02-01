import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * South Carolina Form SC1040 - Individual Income Tax Return
 *
 * South Carolina uses progressive income tax rates (0% to 6.4%)
 * SC is gradually reducing rates toward a flat 3.99% by 2027
 */
export class SC1040 extends Form {
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
    this.formName = 'SC-1040'
    this.state = 'SC'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest from non-SC state/local bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions (out-of-state losses, etc.)
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Interest from US obligations
  l5 = (): number | undefined => undefined

  // Line 6: SC state/local government retirement
  l6 = (): number | undefined => undefined

  // Line 7: Retirement income deduction (65+)
  l7 = (): number | undefined => {
    if (this.getPrimaryAge() >= 65) {
      const retirementIncome = this.f1040.l5b() ?? 0
      return Math.min(
        retirementIncome,
        parameters.retirementDeduction.maxAmount
      )
    }
    return undefined
  }

  // Line 8: Social Security benefits deduction
  l8 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 9: Other subtractions
  l9 = (): number | undefined => undefined

  // Line 10: Total subtractions
  l10 = (): number =>
    sumFields([this.l5(), this.l6(), this.l7(), this.l8(), this.l9()])

  // Line 11: SC adjusted gross income
  l11 = (): number => Math.max(0, this.l1() + this.l4() - this.l10())

  // Line 12: Standard or itemized deduction
  l12 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // SC allows federal itemized deductions
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 13: Personal exemption
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let count = 1
    if (status === FilingStatus.MFJ) count = 2

    return count * parameters.personalExemption.amount
  }

  // Line 14: Dependent exemptions
  l14 = (): number => {
    return this.info.taxPayer.dependents.length * parameters.dependentExemption
  }

  // Line 15: Total exemptions
  l15 = (): number => this.l13() + this.l14()

  // Line 16: SC taxable income
  l16 = (): number => Math.max(0, this.l11() - this.l12() - this.l15())

  // Line 17: SC income tax
  l17 = (): number => this.calculateSCTax(this.l16())

  /**
   * Calculate South Carolina tax using progressive brackets
   */
  private calculateSCTax(taxableIncome: number): number {
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
  // Line 18: Two-wage earner credit (MFJ only)
  l18 = (): number | undefined => {
    const status = this.filingStatus()
    if (status === FilingStatus.MFJ) {
      // Credit is lesser of $420 or 1% of lesser-earning spouse's income
      const spouseIncome = this.f1040.l1a() ?? 0
      const credit = Math.round(
        spouseIncome * parameters.twoWageEarnerCredit.percentage
      )
      return Math.min(credit, parameters.twoWageEarnerCredit.maxCredit)
    }
    return undefined
  }

  // Line 19: Child/Dependent care credit (7% of federal)
  l19 = (): number | undefined => {
    const federalCredit = this.f1040.schedule3.l2()
    if (federalCredit && federalCredit > 0) {
      return Math.round(federalCredit * parameters.childCareCreditFactor)
    }
    return undefined
  }

  // Line 20: Other nonrefundable credits
  l20 = (): number | undefined => undefined

  // Line 21: Total credits (limited to tax)
  l21 = (): number =>
    Math.min(sumFields([this.l18(), this.l19(), this.l20()]), this.l17())

  // Line 22: Tax after credits
  l22 = (): number => Math.max(0, this.l17() - this.l21())

  // PAYMENTS
  // Line 23: SC withholding
  l23 = (): number | undefined => this.methods.witholdingForState('SC')

  // Line 24: Estimated payments
  l24 = (): number | undefined => undefined

  // Line 25: Total payments
  l25 = (): number => sumFields([this.l23(), this.l24()])

  // RESULTS
  // Line 26: Amount due
  l26 = (): number => Math.max(0, this.l22() - this.l25())

  // Line 27: Overpayment
  l27 = (): number => Math.max(0, this.l25() - this.l22())

  payment = (): number | undefined => {
    const due = this.l26()
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
    this.l25(),
    this.l26(),
    this.l27()
  ]
}

const makeSC1040 = (f1040: F1040): SC1040 => new SC1040(f1040)

export default makeSC1040
