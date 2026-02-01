import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Georgia Form 500 - Individual Income Tax Return
 *
 * Georgia uses a flat 5.39% income tax rate (2025)
 * GA moved to flat tax starting 2024
 */
export class GA500 extends Form {
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
    this.formName = 'GA-500'
    this.state = 'GA'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
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
  // Line 2: Other state/local bond interest
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: US government interest
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (GA doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Retirement income exclusion
  l7 = (): number | undefined => {
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    const status = this.filingStatus() ?? FilingStatus.S
    let exclusion = 0

    // Primary taxpayer
    if (primaryAge >= 65) {
      exclusion += parameters.retirementExclusion.age65Plus
    } else if (primaryAge >= 62) {
      exclusion += parameters.retirementExclusion.age62To64
    }

    // Spouse (if MFJ)
    if (status === FilingStatus.MFJ) {
      if (spouseAge >= 65) {
        exclusion += parameters.retirementExclusion.age65Plus
      } else if (spouseAge >= 62) {
        exclusion += parameters.retirementExclusion.age62To64
      }
    }

    // Limited to actual retirement income
    const retirementIncome = this.f1040.l5b() ?? 0
    return Math.min(exclusion, retirementIncome) || undefined
  }

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Georgia adjusted gross income
  l10 = (): number => this.l1() + this.l4() - this.l9()

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // GA allows itemizing (uses federal Schedule A)
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 12: Personal and dependent exemptions
  l12 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 13: Georgia taxable income
  l13 = (): number => Math.max(0, this.l10() - this.l11() - this.l12())

  // Line 14: Georgia tax (flat 5.39%)
  l14 = (): number => Math.round(this.l13() * parameters.taxRate)

  // CREDITS
  // Line 15: Low income credit
  l15 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l10()
    const incomeLimit = parameters.lowIncomeIncomeLimit[status]

    if (agi <= incomeLimit) {
      return parameters.lowIncomeCredit[status]
    }
    return undefined
  }

  // Line 16: Other credits
  l16 = (): number | undefined => undefined

  // Line 17: Total credits (limited to tax)
  l17 = (): number => Math.min(sumFields([this.l15(), this.l16()]), this.l14())

  // Line 18: Net tax
  l18 = (): number => Math.max(0, this.l14() - this.l17())

  // PAYMENTS
  // Line 19: GA withholding
  l19 = (): number | undefined => this.methods.witholdingForState('GA')

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
    this.l23()
  ]
}

const makeGA500 = (f1040: F1040): GA500 => new GA500(f1040)

export default makeGA500
