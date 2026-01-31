import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Hawaii Form N-11 - Individual Income Tax Return (Resident)
 *
 * Hawaii uses progressive income tax rates (1.4% to 11%)
 * Hawaii has one of the highest state income tax rates in the US
 */
export class HIN11 extends Form {
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
    this.formName = 'HI-N11'
    this.state = 'HI'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  private getSpouseAge(): number {
    const dob = this.info.taxPayer.spouse?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Line 7: Federal Adjusted Gross Income
  l7 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 8: State and local tax refunds (if deducted on federal)
  l8 = (): number | undefined => undefined

  // Line 9: Other additions
  l9 = (): number | undefined => undefined

  // Line 10: Total additions
  l10 = (): number => sumFields([this.l8(), this.l9()])

  // Line 11: Subtotal (AGI + additions)
  l11 = (): number => this.l7() + this.l10()

  // SUBTRACTIONS
  // Line 12: Interest from US government obligations
  l12 = (): number | undefined => undefined

  // Line 13: Social Security benefits (Hawaii doesn't tax SS)
  l13 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 14: Pension/annuity exclusion
  l14 = (): number | undefined => undefined

  // Line 15: Other subtractions
  l15 = (): number | undefined => undefined

  // Line 16: Total subtractions
  l16 = (): number => sumFields([this.l12(), this.l13(), this.l14(), this.l15()])

  // Line 17: Hawaii adjusted gross income
  l17 = (): number => Math.max(0, this.l11() - this.l16())

  // Line 18: Standard or itemized deduction
  l18 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Hawaii allows itemizing
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 19: Personal exemptions
  l19 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 20: Total deductions and exemptions
  l20 = (): number => this.l18() + this.l19()

  // Line 21: Hawaii taxable income
  l21 = (): number => Math.max(0, this.l17() - this.l20())

  // Line 22: Tax from tax table (progressive brackets)
  l22 = (): number => this.calculateHITax(this.l21())

  /**
   * Calculate Hawaii tax using progressive brackets
   */
  private calculateHITax(taxableIncome: number): number {
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
  // Line 23: Low income tax credit
  l23 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l17()
    const lowIncomeLimit = parameters.lowIncomeExemption[status]

    if (agi <= lowIncomeLimit) {
      // Low income taxpayers may qualify for reduced tax
      return Math.min(this.l22(), Math.round(agi * 0.01)) || undefined
    }
    return undefined
  }

  // Line 24: Other credits
  l24 = (): number | undefined => undefined

  // Line 25: Total credits (limited to tax)
  l25 = (): number => Math.min(sumFields([this.l23(), this.l24()]), this.l22())

  // Line 26: Net tax
  l26 = (): number => Math.max(0, this.l22() - this.l25())

  // Line 27: Food/Excise Tax Credit (refundable)
  l27 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credit = parameters.foodExciseTaxCredit[status]

    // Add for spouse if MFJ
    if (status === FilingStatus.MFJ) {
      credit += parameters.foodExciseTaxCredit[status]
    }

    // Add for dependents
    const numDependents = this.info.taxPayer.dependents.length
    credit += numDependents * parameters.foodExciseTaxCreditDependent

    return credit
  }

  // PAYMENTS
  // Line 28: Hawaii withholding
  l28 = (): number | undefined => this.methods.witholdingForState('HI')

  // Line 29: Estimated payments
  l29 = (): number | undefined => undefined

  // Line 30: Total payments and refundable credits
  l30 = (): number => sumFields([this.l27(), this.l28(), this.l29()])

  // RESULTS
  // Line 31: Amount due
  l31 = (): number => Math.max(0, this.l26() - this.l30())

  // Line 32: Overpayment/Refund
  l32 = (): number => Math.max(0, this.l30() - this.l26())

  payment = (): number | undefined => {
    const due = this.l31()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
    this.l7(), this.l8(), this.l9(), this.l10(), this.l11(),
    this.l12(), this.l13(), this.l14(), this.l15(), this.l16(),
    this.l17(), this.l18(), this.l19(), this.l20(), this.l21(),
    this.l22(), this.l23(), this.l24(), this.l25(), this.l26(),
    this.l27(), this.l28(), this.l29(), this.l30(),
    this.l31(), this.l32()
  ]
}

const makeHIN11 = (f1040: F1040): HIN11 => new HIN11(f1040)

export default makeHIN11
