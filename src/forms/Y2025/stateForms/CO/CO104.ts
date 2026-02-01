import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Colorado Form DR 0104 - Individual Income Tax Return
 *
 * Colorado uses a flat 4.4% income tax rate (2025)
 * Starts with federal taxable income
 */
export class CO104 extends Form {
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
    this.formName = 'CO-DR0104'
    this.state = 'CO'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Helper: Get primary taxpayer's age
  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Line 1: Federal Taxable Income (Form 1040 line 15)
  l1 = (): number => this.f1040.l15()

  // ADDITIONS
  // Line 2: State and local bond interest (non-CO)
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // Line 5: Subtotal (Line 1 + Line 4)
  l5 = (): number => this.l1() + this.l4()

  // SUBTRACTIONS
  // Line 6: US Government interest
  l6 = (): number | undefined => undefined

  // Line 7: Colorado source capital gain subtraction (for assets held 5+ years)
  l7 = (): number | undefined => undefined

  // Line 8: State income tax refund (if included in federal)
  l8 = (): number | undefined => undefined

  // Line 9: Pension/Annuity subtraction
  l9 = (): number | undefined => {
    const age = this.getPrimaryAge()
    const pensionIncome = this.f1040.l5b() ?? 0

    if (age >= 65) {
      return Math.min(
        pensionIncome,
        parameters.seniorPensionSubtraction.maxAmount
      )
    } else if (age >= 55) {
      return Math.min(pensionIncome, parameters.pensionSubtraction.maxAmount)
    }
    return undefined
  }

  // Line 10: Social Security subtraction (65+)
  l10 = (): number | undefined => {
    const age = this.getPrimaryAge()
    if (age >= 65) {
      return this.f1040.l6b() ?? undefined
    }
    return undefined
  }

  // Line 11: Other subtractions
  l11 = (): number | undefined => undefined

  // Line 12: Total subtractions
  l12 = (): number =>
    sumFields([
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11()
    ])

  // Line 13: Colorado Taxable Income
  l13 = (): number => Math.max(0, this.l5() - this.l12())

  // Line 14: Colorado Tax (4.4% flat rate)
  l14 = (): number => Math.round(this.l13() * parameters.taxRate)

  // Line 15: Alternative minimum tax
  l15 = (): number | undefined => undefined

  // Line 16: Recapture of prior year credits
  l16 = (): number | undefined => undefined

  // Line 17: Total Colorado Tax
  l17 = (): number => sumFields([this.l14(), this.l15(), this.l16()])

  // CREDITS (Non-refundable)
  // Line 18: Child care credit (20% of federal)
  l18 = (): number | undefined => {
    const federalCredit = this.f1040.schedule3.l2()
    if (federalCredit && federalCredit > 0) {
      return Math.round(federalCredit * parameters.childCarePercentage)
    }
    return undefined
  }

  // Line 19: Other nonrefundable credits
  l19 = (): number | undefined => undefined

  // Line 20: Total nonrefundable credits (limited to tax)
  l20 = (): number => Math.min(sumFields([this.l18(), this.l19()]), this.l17())

  // Line 21: Net tax after nonrefundable credits
  l21 = (): number => Math.max(0, this.l17() - this.l20())

  // PAYMENTS
  // Line 22: CO withholding
  l22 = (): number | undefined => this.methods.witholdingForState('CO')

  // Line 23: Estimated payments
  l23 = (): number | undefined => undefined

  // Line 24: Extension payment
  l24 = (): number | undefined => undefined

  // REFUNDABLE CREDITS
  // Line 25: Colorado Earned Income Credit (25% of federal)
  l25 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 26: Colorado Child Tax Credit (10% of federal CTC)
  l26 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.f1040.l11()
    const incomeLimit = parameters.childTaxCredit.incomeLimit[status]

    if (agi <= incomeLimit) {
      const federalCTC = this.f1040.schedule8812.l14() ?? 0
      return Math.round(federalCTC * parameters.childTaxCredit.percentage)
    }
    return undefined
  }

  // Line 27: Total payments and refundable credits
  l27 = (): number =>
    sumFields([this.l22(), this.l23(), this.l24(), this.l25(), this.l26()])

  // RESULTS
  // Line 28: Overpayment
  l28 = (): number => Math.max(0, this.l27() - this.l21())

  // Line 29: Amount due
  l29 = (): number => Math.max(0, this.l21() - this.l27())

  payment = (): number | undefined => {
    const due = this.l29()
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

const makeCO104 = (f1040: F1040): CO104 => new CO104(f1040)

export default makeCO104
