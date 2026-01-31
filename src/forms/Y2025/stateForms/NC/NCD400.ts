import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * North Carolina Form D-400 - Individual Income Tax Return
 *
 * North Carolina uses a flat 4.5% income tax rate (2025)
 * NC does NOT allow itemized deductions - must use standard deduction
 */
export class NCD400 extends Form {
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
    this.formName = 'NC-D400'
    this.state = 'NC'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 6: Federal Adjusted Gross Income (Form 1040 line 11)
  l6 = (): number => this.f1040.l11()

  // ADDITIONS TO FEDERAL AGI
  // Line 7: Interest from non-NC bonds
  l7 = (): number | undefined => undefined

  // Line 8: Bonus depreciation
  l8 = (): number | undefined => undefined

  // Line 9: Other additions (Schedule S)
  l9 = (): number | undefined => undefined

  // Line 10: Total additions
  l10 = (): number => sumFields([this.l7(), this.l8(), this.l9()])

  // DEDUCTIONS FROM FEDERAL AGI
  // Line 11: Interest from US obligations
  l11 = (): number | undefined => undefined

  // Line 12: Social Security and Railroad Retirement benefits
  // NC excludes SS benefits that were taxable federally
  l12 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 13: Bailey Settlement amounts (government retirement pre-1989)
  l13 = (): number | undefined => undefined

  // Line 14: Other deductions (Schedule S)
  l14 = (): number | undefined => undefined

  // Line 15: Total deductions
  l15 = (): number => sumFields([this.l11(), this.l12(), this.l13(), this.l14()])

  // Line 16: NC adjusted gross income
  l16 = (): number => this.l6() + this.l10() - this.l15()

  // Line 17: NC Standard Deduction (no itemizing allowed)
  l17 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    return parameters.standardDeduction[status]
  }

  // Line 18: Child deduction
  l18 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l16()
    const incomeLimit = parameters.childDeduction.incomeLimit[status]
    const numChildren = this.info.taxPayer.dependents.length

    if (numChildren === 0) return 0

    let deduction = numChildren * parameters.childDeduction.amount

    // Phase out if over income limit
    if (agi > incomeLimit) {
      const excess = agi - incomeLimit
      const reductionUnits = Math.floor(excess / 2000)
      const reduction = reductionUnits * parameters.childDeduction.amount * parameters.childDeduction.phaseOutRate
      deduction = Math.max(0, deduction - reduction)
    }

    return deduction
  }

  // Line 19: NC Taxable Income
  l19 = (): number => Math.max(0, this.l16() - this.l17() - this.l18())

  // Line 20: NC Income Tax (flat 4.5%)
  l20 = (): number => Math.round(this.l19() * parameters.taxRate)

  // TAX CREDITS
  // Line 21: Credit for children with disabilities
  l21 = (): number | undefined => undefined

  // Line 22: Credit for income tax paid to another state
  l22 = (): number | undefined => undefined

  // Line 23: Other tax credits
  l23 = (): number | undefined => undefined

  // Line 24: Total tax credits (limited to tax)
  l24 = (): number => Math.min(sumFields([this.l21(), this.l22(), this.l23()]), this.l20())

  // Line 25: Net tax
  l25 = (): number => Math.max(0, this.l20() - this.l24())

  // PAYMENTS
  // Line 26: NC tax withheld
  l26 = (): number | undefined => this.methods.witholdingForState('NC')

  // Line 27: Estimated tax payments
  l27 = (): number | undefined => undefined

  // Line 28: Other payments/credits
  l28 = (): number | undefined => undefined

  // Line 29: Total payments
  l29 = (): number => sumFields([this.l26(), this.l27(), this.l28()])

  // RESULTS
  // Line 30: Tax due
  l30 = (): number => Math.max(0, this.l25() - this.l29())

  // Line 31: Overpayment
  l31 = (): number => Math.max(0, this.l29() - this.l25())

  payment = (): number | undefined => {
    const due = this.l30()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
    this.l6(), this.l7(), this.l8(), this.l9(), this.l10(),
    this.l11(), this.l12(), this.l13(), this.l14(), this.l15(),
    this.l16(), this.l17(), this.l18(), this.l19(), this.l20(),
    this.l21(), this.l22(), this.l23(), this.l24(), this.l25(),
    this.l26(), this.l27(), this.l28(), this.l29(),
    this.l30(), this.l31()
  ]
}

const makeNCD400 = (f1040: F1040): NCD400 => new NCD400(f1040)

export default makeNCD400
