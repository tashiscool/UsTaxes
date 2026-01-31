import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Utah Form TC-40 - Individual Income Tax Return
 *
 * Utah uses a flat 4.65% income tax rate (2025)
 */
export class UTTC40 extends Form {
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
    this.formName = 'UT-TC-40'
    this.state = 'UT'
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
  // Line 2: Interest from non-Utah municipal bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: US government interest
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (UT doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: State tax refunds (if itemizing)
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Utah adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Utah taxable income (same as AGI for flat tax)
  l11 = (): number => this.l10()

  // Line 12: Utah tax (flat 4.65%)
  l12 = (): number => Math.round(this.l11() * parameters.taxRate)

  // CREDITS
  // Line 13: Taxpayer tax credit
  // 6% of federal deduction + Utah exemption amounts
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S

    // Get federal deduction (standard or itemized)
    let federalDeduction = 0
    if (this.f1040.scheduleA.isNeeded()) {
      federalDeduction = this.f1040.scheduleA.deductions()
    } else {
      // Use federal standard deduction
      federalDeduction = this.f1040.standardDeduction() ?? 0
    }

    // Add Utah personal exemption amounts
    let exemptionAmount = parameters.utahPersonalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptionAmount += numDependents * parameters.utahDependentExemption

    // Credit is 6% of total, limited to tax
    const creditBase = federalDeduction + exemptionAmount
    const credit = Math.round(creditBase * parameters.taxpayerCreditRate)

    return Math.min(credit, this.l12())
  }

  // Line 14: Retirement income credit
  l14 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    let credit = 0

    // Primary taxpayer age 65+
    if (primaryAge >= 65) {
      credit += parameters.retirementCreditMax
    }

    // Spouse age 65+ (if MFJ)
    if (status === FilingStatus.MFJ && spouseAge >= 65) {
      credit += parameters.retirementCreditMax
    }

    return credit > 0 ? credit : undefined
  }

  // Line 15: UT Earned Income Credit (20% of federal)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC ? Math.round(federalEIC * parameters.eicPercentage) : undefined
  }

  // Line 16: Other credits
  l16 = (): number | undefined => undefined

  // Line 17: Total credits (limited to tax)
  l17 = (): number => Math.min(
    sumFields([this.l13(), this.l14(), this.l15(), this.l16()]),
    this.l12()
  )

  // Line 18: Net tax
  l18 = (): number => Math.max(0, this.l12() - this.l17())

  // PAYMENTS
  // Line 19: UT withholding
  l19 = (): number | undefined => this.methods.witholdingForState('UT')

  // Line 20: Estimated payments
  l20 = (): number | undefined => undefined

  // Line 21: Total payments
  l21 = (): number => sumFields([this.l19(), this.l20()])

  // RESULTS
  // Line 22: Amount due
  l22 = (): number => Math.max(0, this.l18() - this.l21())

  // Line 23: Overpayment
  l23 = (): number => Math.max(0, this.l21() - this.l18())

  payment = (): number | undefined => {
    const due = this.l22()
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
    this.l10(), this.l11(), this.l12(),
    this.l13(), this.l14(), this.l15(), this.l16(), this.l17(), this.l18(),
    this.l19(), this.l20(), this.l21(),
    this.l22(), this.l23()
  ]
}

const makeUTTC40 = (f1040: F1040): UTTC40 => new UTTC40(f1040)

export default makeUTTC40
