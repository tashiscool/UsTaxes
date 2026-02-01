import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * Minnesota Form M1 - Individual Income Tax Return
 *
 * Minnesota uses progressive income tax rates (5.35% to 9.85%)
 * One of the higher-tax states with generous credits
 */
export class MNM1 extends Form {
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
    this.formName = 'MN-M1'
    this.state = 'MN'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal adjusted gross income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest from non-MN state/local bonds
  l2 = (): number | undefined => undefined

  // Line 3: State income tax deduction addback
  l3 = (): number | undefined => {
    // If itemizing, add back state income tax deduction
    if (this.f1040.scheduleA.isNeeded()) {
      return this.f1040.scheduleA.l5a() ?? undefined
    }
    return undefined
  }

  // Line 4: Other additions
  l4 = (): number | undefined => undefined

  // Line 5: Total additions
  l5 = (): number => sumFields([this.l2(), this.l3(), this.l4()])

  // SUBTRACTIONS
  // Line 6: US bond interest
  l6 = (): number | undefined => undefined

  // Line 7: Social Security subtraction
  l7 = (): number | undefined => {
    const ssIncome = this.f1040.l6b() ?? 0
    if (ssIncome > 0) {
      const status = this.filingStatus() ?? FilingStatus.S
      const phaseOutStart =
        parameters.socialSecuritySubtraction.incomePhaseOutStart[status]
      const agi = this.l1()

      if (agi <= phaseOutStart) {
        return Math.min(
          ssIncome,
          parameters.socialSecuritySubtraction.maxSubtraction
        )
      }
      // Phase out at higher incomes
      const excess = agi - phaseOutStart
      const reduction = Math.round(excess * 0.1)
      const availableSubtraction = Math.max(
        0,
        parameters.socialSecuritySubtraction.maxSubtraction - reduction
      )
      return Math.min(ssIncome, availableSubtraction)
    }
    return undefined
  }

  // Line 8: K-12 education expenses
  l8 = (): number | undefined => undefined

  // Line 9: Other subtractions
  l9 = (): number | undefined => undefined

  // Line 10: Total subtractions
  l10 = (): number => sumFields([this.l6(), this.l7(), this.l8(), this.l9()])

  // Line 11: Minnesota taxable income before deductions
  l11 = (): number => Math.max(0, this.l1() + this.l5() - this.l10())

  // Line 12: Standard or itemized deduction
  l12 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    if (this.f1040.scheduleA.isNeeded()) {
      // MN uses federal itemized with modifications
      const federalItemized = this.f1040.scheduleA.deductions()
      // Add back state income tax deduction (already added to income)
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 13: Minnesota taxable income
  l13 = (): number => Math.max(0, this.l11() - this.l12())

  // Line 14: Minnesota income tax
  l14 = (): number => this.calculateMNTax(this.l13())

  /**
   * Calculate Minnesota tax using progressive brackets
   */
  private calculateMNTax(taxableIncome: number): number {
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
  // Line 15: Child and Dependent Care Credit
  l15 = (): number | undefined => {
    const federalCredit = this.f1040.schedule3.l2()
    if (federalCredit && federalCredit > 0) {
      return Math.round(federalCredit * parameters.childCareCreditPercentage)
    }
    return undefined
  }

  // Line 16: K-12 Education Credit
  l16 = (): number | undefined => undefined

  // Line 17: Credit for taxes paid to other states
  l17 = (): number | undefined => undefined

  // Line 18: Other nonrefundable credits
  l18 = (): number | undefined => undefined

  // Line 19: Total nonrefundable credits (limited to tax)
  l19 = (): number =>
    Math.min(
      sumFields([this.l15(), this.l16(), this.l17(), this.l18()]),
      this.l14()
    )

  // Line 20: Tax after nonrefundable credits
  l20 = (): number => Math.max(0, this.l14() - this.l19())

  // PAYMENTS
  // Line 21: Minnesota withholding
  l21 = (): number | undefined => this.methods.witholdingForState('MN')

  // Line 22: Estimated payments
  l22 = (): number | undefined => undefined

  // Line 23: Working Family Credit (34% of federal EIC)
  l23 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      const credit = Math.round(
        federalEIC * parameters.workingFamilyCredit.percentage
      )
      return Math.min(credit, parameters.workingFamilyCredit.maxCredit)
    }
    return undefined
  }

  // Line 24: Other refundable credits
  l24 = (): number | undefined => undefined

  // Line 25: Total payments and refundable credits
  l25 = (): number =>
    sumFields([this.l21(), this.l22(), this.l23(), this.l24()])

  // RESULTS
  // Line 26: Amount due
  l26 = (): number => Math.max(0, this.l20() - this.l25())

  // Line 27: Overpayment
  l27 = (): number => Math.max(0, this.l25() - this.l20())

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

const makeMNM1 = (f1040: F1040): MNM1 => new MNM1(f1040)

export default makeMNM1
