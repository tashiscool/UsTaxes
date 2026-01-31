import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Iowa Form IA 1040 - Individual Income Tax Return
 *
 * Iowa uses progressive income tax rates (4.4% to 5.7% for 2025)
 * Iowa simplified to 4 brackets in 2025, moving toward flat 3.9% by 2026
 */
export class IA1040 extends Form {
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
    this.formName = 'IA-1040'
    this.state = 'IA'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest/dividends from non-Iowa state/local bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // Line 5: Gross income (federal AGI + additions)
  l5 = (): number => this.l1() + this.l4()

  // SUBTRACTIONS
  // Line 6: Interest from US government obligations
  l6 = (): number | undefined => undefined

  // Line 7: Social Security benefits exclusion (100% for 2025)
  l7 = (): number | undefined => {
    const ssBenefits = this.f1040.l6b()
    if (ssBenefits && ssBenefits > 0) {
      return Math.round(ssBenefits * parameters.socialSecurityExclusion)
    }
    return undefined
  }

  // Line 8: Pension/retirement income exclusion
  l8 = (): number | undefined => undefined

  // Line 9: Other subtractions
  l9 = (): number | undefined => undefined

  // Line 10: Total subtractions
  l10 = (): number => sumFields([this.l6(), this.l7(), this.l8(), this.l9()])

  // Line 11: Iowa net income
  l11 = (): number => Math.max(0, this.l5() - this.l10())

  // Line 12: Standard or itemized deduction
  l12 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Iowa allows itemizing
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 13: Iowa taxable income
  l13 = (): number => Math.max(0, this.l11() - this.l12())

  // Line 14: Tax from tax table (progressive brackets)
  l14 = (): number => this.calculateIATax(this.l13())

  /**
   * Calculate Iowa tax using progressive brackets
   */
  private calculateIATax(taxableIncome: number): number {
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
  // Line 15: Personal exemption credit
  l15 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credits = parameters.personalExemptionCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credits += numDependents * parameters.dependentExemptionCredit

    return credits
  }

  // Line 16: Child and Dependent Care Credit
  l16 = (): number | undefined => {
    // Based on federal credit
    const federalCredit = this.f1040.schedule3.l2()
    if (federalCredit && federalCredit > 0) {
      return Math.round(federalCredit * parameters.childDependentCareRate)
    }
    return undefined
  }

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total non-refundable credits (limited to tax)
  l18 = (): number =>
    Math.min(sumFields([this.l15(), this.l16(), this.l17()]), this.l14())

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l14() - this.l18())

  // REFUNDABLE CREDITS
  // Line 20: Iowa Earned Income Credit (15% of federal)
  l20 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditRate)
    }
    return undefined
  }

  // Line 21: Other refundable credits
  l21 = (): number | undefined => undefined

  // Line 22: Total refundable credits
  l22 = (): number => sumFields([this.l20(), this.l21()])

  // PAYMENTS
  // Line 23: Iowa withholding
  l23 = (): number | undefined => this.methods.witholdingForState('IA')

  // Line 24: Estimated payments
  l24 = (): number | undefined => undefined

  // Line 25: Total payments
  l25 = (): number => sumFields([this.l23(), this.l24()])

  // Line 26: Total payments and refundable credits
  l26 = (): number => this.l25() + this.l22()

  // RESULTS
  // Line 27: Amount due
  l27 = (): number => Math.max(0, this.l19() - this.l26())

  // Line 28: Overpayment/Refund
  l28 = (): number => Math.max(0, this.l26() - this.l19())

  payment = (): number | undefined => {
    const due = this.l27()
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
    this.l11(), this.l12(), this.l13(), this.l14(),
    this.l15(), this.l16(), this.l17(), this.l18(), this.l19(),
    this.l20(), this.l21(), this.l22(),
    this.l23(), this.l24(), this.l25(), this.l26(),
    this.l27(), this.l28()
  ]
}

const makeIA1040 = (f1040: F1040): IA1040 => new IA1040(f1040)

export default makeIA1040
