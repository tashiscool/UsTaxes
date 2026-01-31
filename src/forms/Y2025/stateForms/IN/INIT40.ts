import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Indiana Form IT-40 - Individual Income Tax Return
 *
 * Indiana uses a flat income tax rate of 3.05%
 * Plus county income taxes (varies by county)
 */
export class INIT40 extends Form {
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
    this.formName = 'IN-IT40'
    this.state = 'IN'
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

  // Line 1: Federal adjusted gross income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Add-back for bonus depreciation
  l2 = (): number | undefined => undefined

  // Line 3: Non-Indiana municipal bond interest
  l3 = (): number | undefined => undefined

  // Line 4: Other additions
  l4 = (): number | undefined => undefined

  // Line 5: Total additions
  l5 = (): number => sumFields([this.l2(), this.l3(), this.l4()])

  // DEDUCTIONS
  // Line 6: Indiana state/local government retirement income
  l6 = (): number | undefined => undefined

  // Line 7: Social Security benefits (fully deductible)
  l7 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 8: Military retirement deduction
  l8 = (): number | undefined => {
    // Check if has military retirement income
    const militaryRetirement = this.info.militaryRetirement
    if (militaryRetirement && militaryRetirement > 0) {
      return Math.min(militaryRetirement, parameters.retirementDeduction.militaryRetirement)
    }
    return undefined
  }

  // Line 9: Civil service annuity deduction
  l9 = (): number | undefined => undefined

  // Line 10: Indiana net operating loss deduction
  l10 = (): number | undefined => undefined

  // Line 11: Other deductions
  l11 = (): number | undefined => undefined

  // Line 12: Total deductions
  l12 = (): number => sumFields([
    this.l6(), this.l7(), this.l8(), this.l9(), this.l10(), this.l11()
  ])

  // Line 13: Indiana adjusted gross income
  l13 = (): number => Math.max(0, this.l1() + this.l5() - this.l12())

  // EXEMPTIONS
  // Line 14: Personal exemption
  l14 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let count = 1
    if (status === FilingStatus.MFJ) count = 2
    return count * parameters.personalExemption.amount
  }

  // Line 15: Dependent exemptions
  l15 = (): number => {
    return this.info.taxPayer.dependents.length * parameters.dependentExemption.amount
  }

  // Line 16: Total exemptions
  l16 = (): number => this.l14() + this.l15()

  // Line 17: Indiana taxable income
  l17 = (): number => Math.max(0, this.l13() - this.l16())

  // Line 18: State income tax (flat 3.05%)
  l18 = (): number => Math.round(this.l17() * parameters.stateRate)

  // Line 19: County income tax (varies by county)
  l19 = (): number => Math.round(this.l17() * parameters.countyRate)

  // Line 20: Total Indiana tax
  l20 = (): number => this.l18() + this.l19()

  // CREDITS
  // Line 21: Credit for taxes paid to other states
  l21 = (): number | undefined => undefined

  // Line 22: Unified Tax Credit for the Elderly (65+)
  l22 = (): number | undefined => {
    if (this.getPrimaryAge() >= 65) {
      return parameters.unifiedTaxCredit.amount
    }
    return undefined
  }

  // Line 23: College credit (20% of expenses up to $1,500)
  l23 = (): number | undefined => undefined

  // Line 24: Indiana Earned Income Credit (10% of federal)
  l24 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 25: Other nonrefundable credits
  l25 = (): number | undefined => undefined

  // Line 26: Total nonrefundable credits (limited to tax)
  l26 = (): number => Math.min(
    sumFields([this.l21(), this.l22(), this.l23(), this.l25()]),
    this.l20()
  )

  // Line 27: Tax after nonrefundable credits
  l27 = (): number => Math.max(0, this.l20() - this.l26())

  // PAYMENTS
  // Line 28: Indiana withholding
  l28 = (): number | undefined => this.methods.witholdingForState('IN')

  // Line 29: County withholding
  l29 = (): number | undefined => undefined

  // Line 30: Estimated payments
  l30 = (): number | undefined => undefined

  // Line 31: Earned Income Credit (refundable)
  l31 = (): number | undefined => this.l24()

  // Line 32: Total payments and refundable credits
  l32 = (): number => sumFields([this.l28(), this.l29(), this.l30(), this.l31()])

  // RESULTS
  // Line 33: Amount due
  l33 = (): number => Math.max(0, this.l27() - this.l32())

  // Line 34: Overpayment
  l34 = (): number => Math.max(0, this.l32() - this.l27())

  payment = (): number | undefined => {
    const due = this.l33()
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
    this.l6(), this.l7(), this.l8(), this.l9(), this.l10(), this.l11(), this.l12(),
    this.l13(), this.l14(), this.l15(), this.l16(), this.l17(),
    this.l18(), this.l19(), this.l20(),
    this.l21(), this.l22(), this.l23(), this.l24(), this.l25(), this.l26(), this.l27(),
    this.l28(), this.l29(), this.l30(), this.l31(), this.l32(),
    this.l33(), this.l34()
  ]
}

const makeINIT40 = (f1040: F1040): INIT40 => new INIT40(f1040)

export default makeINIT40
