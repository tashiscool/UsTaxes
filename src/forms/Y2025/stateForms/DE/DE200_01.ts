import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Delaware Form 200-01 - Resident Individual Income Tax Return
 *
 * Delaware uses progressive income tax rates (0% to 6.6%)
 * Delaware has no sales tax
 */
export class DE200_01 extends Form {
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
    this.formName = 'DE-200-01'
    this.state = 'DE'
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

  // Line 6: Social Security benefits (DE doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Pension exclusion (for those 60+)
  l7 = (): number | undefined => {
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    const status = this.filingStatus() ?? FilingStatus.S
    let exclusion = 0

    // Primary taxpayer
    if (primaryAge >= 60) {
      exclusion += parameters.pensionExclusion.age60Plus
    }

    // Spouse (if MFJ)
    if (status === FilingStatus.MFJ && spouseAge >= 60) {
      exclusion += parameters.pensionExclusion.age60Plus
    }

    // Limited to actual pension/retirement income
    const retirementIncome = this.f1040.l5b() ?? 0
    return Math.min(exclusion, retirementIncome) || undefined
  }

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Delaware adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // DE allows itemizing (uses federal Schedule A)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 12: Delaware taxable income
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Delaware tax
  l13 = (): number => this.calculateDETax(this.l12())

  /**
   * Calculate Delaware tax using progressive brackets
   */
  private calculateDETax(taxableIncome: number): number {
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
  // Line 14: Personal credits
  l14 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credits = parameters.personalCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credits += numDependents * parameters.dependentCredit

    return credits
  }

  // Line 15: Delaware Earned Income Credit (20% of federal)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC ? Math.round(federalEIC * parameters.eicPercentage) : undefined
  }

  // Line 16: Child care credit (50% of federal, max $500)
  l16 = (): number | undefined => {
    // Simplified - would need federal child care credit info
    return undefined
  }

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total credits (limited to tax)
  l18 = (): number => Math.min(
    sumFields([this.l14(), this.l15(), this.l16(), this.l17()]),
    this.l13()
  )

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l13() - this.l18())

  // PAYMENTS
  // Line 20: DE withholding
  l20 = (): number | undefined => this.methods.witholdingForState('DE')

  // Line 21: Estimated payments
  l21 = (): number | undefined => undefined

  // Line 22: Amount paid with extension
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
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
    this.l1(), this.l2(), this.l3(), this.l4(),
    this.l5(), this.l6(), this.l7(), this.l8(), this.l9(),
    this.l10(), this.l11(), this.l12(), this.l13(),
    this.l14(), this.l15(), this.l16(), this.l17(), this.l18(), this.l19(),
    this.l20(), this.l21(), this.l22(), this.l23(),
    this.l24(), this.l25()
  ]
}

const makeDE200_01 = (f1040: F1040): DE200_01 => new DE200_01(f1040)

export default makeDE200_01
