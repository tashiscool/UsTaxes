import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Michigan Form MI-1040 - Individual Income Tax Return
 *
 * Michigan uses a flat income tax rate of 4.25%
 * Key features: generous personal exemptions, pension subtraction
 */
export class MI1040 extends Form {
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
    this.formName = 'MI-1040'
    this.state = 'MI'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Line 1: Wages, salaries, tips (from federal)
  l1 = (): number => this.f1040.l1a() ?? 0

  // Line 2: Interest and dividend income
  l2 = (): number => sumFields([this.f1040.l2b(), this.f1040.l3b()])

  // Line 3: Business income
  l3 = (): number => this.f1040.scheduleC?.l31() ?? 0

  // Line 4: Capital gains
  l4 = (): number => this.f1040.l7() ?? 0

  // Line 5: Other income
  l5 = (): number => this.f1040.l8() ?? 0

  // Line 6: Total income
  l6 = (): number =>
    sumFields([this.l1(), this.l2(), this.l3(), this.l4(), this.l5()])

  // SUBTRACTIONS
  // Line 7: IRA/pension/annuity subtraction
  l7 = (): number | undefined => {
    const pensionIncome = this.f1040.l5b() ?? 0
    if (pensionIncome > 0) {
      // Simplified: allow up to limit for private pensions
      return Math.min(
        pensionIncome,
        parameters.retirementSubtraction.privatePensionLimit
      )
    }
    return undefined
  }

  // Line 8: Social Security subtraction (fully exempt in MI)
  l8 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 9: Military pay subtraction
  l9 = (): number | undefined => undefined

  // Line 10: Other subtractions
  l10 = (): number | undefined => undefined

  // Line 11: Total subtractions
  l11 = (): number => sumFields([this.l7(), this.l8(), this.l9(), this.l10()])

  // Line 12: Michigan adjusted gross income
  l12 = (): number => Math.max(0, this.l6() - this.l11())

  // Line 13: Personal exemptions
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let count = 1
    if (status === FilingStatus.MFJ) count = 2

    let exemption = count * parameters.personalExemption.amount

    // Additional exemption for 67+ or blind
    if (this.getPrimaryAge() >= 67) {
      exemption += parameters.personalExemption.seniorBlindAmount
    }

    return exemption
  }

  // Line 14: Dependent exemptions
  l14 = (): number => {
    return this.info.taxPayer.dependents.length * parameters.dependentExemption
  }

  // Line 15: Total exemptions
  l15 = (): number => this.l13() + this.l14()

  // Line 16: Michigan taxable income
  l16 = (): number => Math.max(0, this.l12() - this.l15())

  // Line 17: Michigan income tax (flat 4.25%)
  l17 = (): number => Math.round(this.l16() * parameters.taxRate)

  // CREDITS
  // Line 18: Income tax paid to other states
  l18 = (): number | undefined => undefined

  // Line 19: Michigan Earned Income Tax Credit (6% of federal)
  l19 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 20: Other nonrefundable credits
  l20 = (): number | undefined => undefined

  // Line 21: Total nonrefundable credits (limited to tax)
  l21 = (): number => Math.min(sumFields([this.l18(), this.l20()]), this.l17())

  // Line 22: Tax after nonrefundable credits
  l22 = (): number => Math.max(0, this.l17() - this.l21())

  // PAYMENTS
  // Line 23: Michigan withholding
  l23 = (): number | undefined => this.methods.witholdingForState('MI')

  // Line 24: Estimated payments
  l24 = (): number | undefined => undefined

  // Line 25: Earned Income Tax Credit (refundable)
  l25 = (): number | undefined => this.l19()

  // Line 26: Homestead property tax credit
  l26 = (): number | undefined => undefined

  // Line 27: Total payments and refundable credits
  l27 = (): number =>
    sumFields([this.l23(), this.l24(), this.l25(), this.l26()])

  // RESULTS
  // Line 28: Amount due
  l28 = (): number => Math.max(0, this.l22() - this.l27())

  // Line 29: Overpayment
  l29 = (): number => Math.max(0, this.l27() - this.l22())

  payment = (): number | undefined => {
    const due = this.l28()
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
    this.l27(),
    this.l28(),
    this.l29()
  ]
}

const makeMI1040 = (f1040: F1040): MI1040 => new MI1040(f1040)

export default makeMI1040
