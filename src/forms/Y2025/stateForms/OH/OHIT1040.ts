import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Ohio Form IT 1040 - Individual Income Tax Return
 *
 * Ohio uses progressive income tax rates (0% to 3.5%)
 * Income under $26,050 is not taxed
 * Ohio school district taxes are separate
 */
export class OHIT1040 extends Form {
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
    this.formName = 'OH-IT1040'
    this.state = 'OH'
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

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2a: Non-Ohio state/local income
  l2a = (): number | undefined => undefined

  // Line 2b: Non-Ohio local government interest
  l2b = (): number | undefined => undefined

  // Line 2c: Other additions
  l2c = (): number | undefined => undefined

  // Line 3: Total additions
  l3 = (): number => sumFields([this.l2a(), this.l2b(), this.l2c()])

  // DEDUCTIONS
  // Line 4: Business income deduction (first $250,000 at 0%)
  l4 = (): number | undefined => {
    const businessIncome = this.f1040.scheduleC?.l31() ?? 0
    if (businessIncome > 0) {
      return Math.min(businessIncome, parameters.businessIncomeDeduction)
    }
    return undefined
  }

  // Line 5: Social Security and certain retirement benefits
  l5 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 6: Federal interest and dividends (US obligations)
  l6 = (): number | undefined => undefined

  // Line 7: Disability and survivorship benefits
  l7 = (): number | undefined => undefined

  // Line 8: Military pay
  l8 = (): number | undefined => undefined

  // Line 9: Other deductions
  l9 = (): number | undefined => undefined

  // Line 10: Total deductions
  l10 = (): number => sumFields([
    this.l4(), this.l5(), this.l6(), this.l7(), this.l8(), this.l9()
  ])

  // Line 11: Ohio adjusted gross income
  l11 = (): number => Math.max(0, this.l1() + this.l3() - this.l10())

  // Line 12: Ohio taxable income (same as Ohio AGI for most)
  l12 = (): number => this.l11()

  // Line 13: Ohio income tax
  l13 = (): number => this.calculateOHTax(this.l12())

  /**
   * Calculate Ohio tax using progressive brackets
   */
  private calculateOHTax(taxableIncome: number): number {
    const { brackets, rates } = parameters.taxBrackets

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
  // Line 14: Joint filing credit
  l14 = (): number | undefined => {
    const status = this.filingStatus()
    if (status === FilingStatus.MFJ) {
      // $650 credit for married filing jointly if both have income
      return 650
    }
    return undefined
  }

  // Line 15: Ohio Earned Income Credit (30% of federal)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 16: Retirement income credit
  l16 = (): number | undefined => {
    const retirementIncome = this.f1040.l5b() ?? 0
    const agi = this.l11()

    if (retirementIncome > 0 && agi <= parameters.retirementIncomeCredit.incomeLimit) {
      return Math.min(
        parameters.retirementIncomeCredit.maxCredit,
        Math.round(retirementIncome * 0.05)
      )
    }
    return undefined
  }

  // Line 17: Senior citizen credit (65+)
  l17 = (): number | undefined => {
    const age = this.getPrimaryAge()
    if (age >= 65) {
      return parameters.seniorCitizenCredit
    }
    return undefined
  }

  // Line 18: Child care credit
  l18 = (): number | undefined => {
    const agi = this.l11()
    if (agi <= parameters.childCareIncomeLimit) {
      const federalCredit = this.f1040.schedule3.l2()
      if (federalCredit && federalCredit > 0) {
        return Math.round(federalCredit * parameters.childCareCreditPercentage)
      }
    }
    return undefined
  }

  // Line 19: Credit for taxes paid to other states
  l19 = (): number | undefined => undefined

  // Line 20: Other nonrefundable credits
  l20 = (): number | undefined => undefined

  // Line 21: Total nonrefundable credits (limited to tax)
  l21 = (): number => Math.min(
    sumFields([this.l14(), this.l15(), this.l16(), this.l17(), this.l18(), this.l19(), this.l20()]),
    this.l13()
  )

  // Line 22: Tax after nonrefundable credits
  l22 = (): number => Math.max(0, this.l13() - this.l21())

  // PAYMENTS
  // Line 23: Ohio withholding
  l23 = (): number | undefined => this.methods.witholdingForState('OH')

  // Line 24: Estimated payments
  l24 = (): number | undefined => undefined

  // Line 25: Refundable credits (EIC refundable portion)
  l25 = (): number | undefined => {
    // Ohio EIC is partially refundable
    const eic = this.l15() ?? 0
    const usedAgainstTax = Math.min(eic, this.l13())
    return eic > usedAgainstTax ? eic - usedAgainstTax : undefined
  }

  // Line 26: Total payments and refundable credits
  l26 = (): number => sumFields([this.l23(), this.l24(), this.l25()])

  // RESULTS
  // Line 27: Amount due
  l27 = (): number => Math.max(0, this.l22() - this.l26())

  // Line 28: Overpayment
  l28 = (): number => Math.max(0, this.l26() - this.l22())

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
    this.l1(), this.l2a(), this.l2b(), this.l2c(), this.l3(),
    this.l4(), this.l5(), this.l6(), this.l7(), this.l8(), this.l9(), this.l10(),
    this.l11(), this.l12(), this.l13(),
    this.l14(), this.l15(), this.l16(), this.l17(), this.l18(), this.l19(), this.l20(), this.l21(),
    this.l22(), this.l23(), this.l24(), this.l25(), this.l26(),
    this.l27(), this.l28()
  ]
}

const makeOHIT1040 = (f1040: F1040): OHIT1040 => new OHIT1040(f1040)

export default makeOHIT1040
