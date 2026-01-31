import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Kentucky Form 740 - Individual Income Tax Return
 *
 * Kentucky uses a flat 4% income tax rate (moved to flat rate in 2024)
 */
export class KY740 extends Form {
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
    this.formName = 'KY-740'
    this.state = 'KY'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  private getFamilySize(): number {
    const status = this.filingStatus() ?? FilingStatus.S
    let size = 1
    if (status === FilingStatus.MFJ || status === FilingStatus.W) {
      size = 2
    }
    size += this.info.taxPayer.dependents.length
    return Math.min(size, 8) // Cap at 8 for credit table
  }

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest on non-KY state/local obligations
  l2 = (): number | undefined => undefined

  // Line 3: Other additions (lump sum distributions, etc.)
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Kentucky exempt income (US government interest)
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (KY doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Pension income exclusion (up to $31,110)
  l7 = (): number | undefined => {
    const pensionIncome = this.f1040.l5b() ?? 0
    return Math.min(pensionIncome, parameters.pensionExclusion) || undefined
  }

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Kentucky adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // KY allows itemizing (uses federal Schedule A)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 12: Kentucky taxable income
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Kentucky tax (flat 4%)
  l13 = (): number => Math.round(this.l12() * parameters.taxRate)

  // CREDITS
  // Line 14: Personal tax credit
  l14 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credit = parameters.personalTaxCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credit += numDependents * parameters.dependentCredit

    return credit
  }

  // Line 15: Family Size Tax Credit (for low income)
  l15 = (): number | undefined => {
    const familySize = this.getFamilySize()
    const threshold =
      parameters.familySizeTaxCreditThreshold[
        familySize as keyof typeof parameters.familySizeTaxCreditThreshold
      ]
    const mgi = this.l10()

    if (mgi <= threshold) {
      // Full credit equals tax liability
      return this.l13()
    }
    return undefined
  }

  // Line 16: Child and dependent care credit
  l16 = (): number | undefined => undefined

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total credits (limited to tax)
  l18 = (): number =>
    Math.min(
      sumFields([this.l14(), this.l15(), this.l16(), this.l17()]),
      this.l13()
    )

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l13() - this.l18())

  // PAYMENTS
  // Line 20: Kentucky withholding
  l20 = (): number | undefined => this.methods.witholdingForState('KY')

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
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
    this.l1(), this.l2(), this.l3(), this.l4(),
    this.l5(), this.l6(), this.l7(), this.l8(), this.l9(),
    this.l10(), this.l11(), this.l12(), this.l13(),
    this.l14(), this.l15(), this.l16(), this.l17(), this.l18(), this.l19(),
    this.l20(), this.l21(), this.l22(), this.l23(),
    this.l24(), this.l25()
  ]
}

const makeKY740 = (f1040: F1040): KY740 => new KY740(f1040)

export default makeKY740
