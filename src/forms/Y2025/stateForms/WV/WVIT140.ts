import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * West Virginia Form IT-140 - Individual Income Tax Return
 *
 * West Virginia uses progressive income tax rates (2.36% to 5.12%)
 * WV has been reducing rates in recent years
 */
export class WVIT140 extends Form {
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
    this.formName = 'WV-IT-140'
    this.state = 'WV'
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

  // Line 1: Federal Adjusted Gross Income (from federal Form 1040)
  l1 = (): number => this.f1040.l11()

  // ADDITIONS TO INCOME
  // Line 2: Interest on obligations of other states
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS FROM INCOME
  // Line 5: Interest on US government obligations
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (WV doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Railroad retirement benefits
  l7 = (): number | undefined => undefined

  // Line 8: Pension/retirement income (partial exclusion for seniors)
  l8 = (): number | undefined => undefined

  // Line 9: Other subtractions
  l9 = (): number | undefined => undefined

  // Line 10: Total subtractions
  l10 = (): number =>
    sumFields([this.l5(), this.l6(), this.l7(), this.l8(), this.l9()])

  // Line 11: West Virginia adjusted gross income
  l11 = (): number => Math.max(0, this.l1() + this.l4() - this.l10())

  // MODIFICATIONS
  // Line 12: Low income exclusion
  l12 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const wvAGI = this.l11()
    const exclusionLimit = parameters.lowIncomeExclusion[status]

    if (wvAGI <= exclusionLimit) {
      return wvAGI // Full exclusion if under limit
    }
    return undefined
  }

  // Line 13: Personal exemptions
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 14: Total modifications
  l14 = (): number => sumFields([this.l12(), this.l13()])

  // Line 15: West Virginia taxable income
  l15 = (): number => Math.max(0, this.l11() - this.l14())

  // Line 16: Tax from tax rate schedule
  l16 = (): number => this.calculateWVTax(this.l15())

  /**
   * Calculate WV tax using progressive brackets
   */
  private calculateWVTax(taxableIncome: number): number {
    const status = this.filingStatus() ?? FilingStatus.S
    const bracketInfo = parameters.taxBrackets[status]
    const { brackets, rates } = bracketInfo

    let tax = 0
    let previousBracket = 0

    for (let i = 0; i < rates.length; i++) {
      const bracket = brackets[i] ?? Infinity
      if (taxableIncome <= previousBracket) break

      const taxableInBracket =
        Math.min(taxableIncome, bracket) - previousBracket
      tax += taxableInBracket * rates[i]
      previousBracket = bracket
    }

    return Math.round(tax)
  }

  // CREDITS
  // Line 17: Senior Citizens Credit (65+, income under limits)
  l17 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    const wvAGI = this.l11()
    const incomeLimit = parameters.seniorCitizensCredit.incomeLimit[status]

    if (wvAGI > incomeLimit) return undefined

    let credit = 0

    // Primary taxpayer 65+
    if (primaryAge >= 65) {
      credit += parameters.seniorCitizensCredit.maxCredit
    }

    // Spouse 65+ (if MFJ)
    if (status === FilingStatus.MFJ && spouseAge >= 65) {
      credit += parameters.seniorCitizensCredit.maxCredit
    }

    return credit > 0 ? credit : undefined
  }

  // Line 18: Family Tax Credit (low-income families)
  l18 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const wvAGI = this.l11()
    const incomeLimit = parameters.familyTaxCredit.incomeLimit[status]

    if (wvAGI <= incomeLimit) {
      return parameters.familyTaxCredit.maxCredit
    }
    return undefined
  }

  // Line 19: Other credits
  l19 = (): number | undefined => undefined

  // Line 20: Total credits (limited to tax)
  l20 = (): number =>
    Math.min(sumFields([this.l17(), this.l18(), this.l19()]), this.l16())

  // Line 21: Net tax
  l21 = (): number => Math.max(0, this.l16() - this.l20())

  // PAYMENTS
  // Line 22: WV income tax withheld
  l22 = (): number | undefined => this.methods.witholdingForState('WV')

  // Line 23: Estimated tax payments
  l23 = (): number | undefined => undefined

  // Line 24: Amount paid with extension
  l24 = (): number | undefined => undefined

  // Line 25: Total payments
  l25 = (): number => sumFields([this.l22(), this.l23(), this.l24()])

  // RESULTS
  // Line 26: Amount due (if tax exceeds payments)
  l26 = (): number => Math.max(0, this.l21() - this.l25())

  // Line 27: Overpayment (if payments exceed tax)
  l27 = (): number => Math.max(0, this.l25() - this.l21())

  // Line 28: Refund
  l28 = (): number => this.l27()

  payment = (): number | undefined => {
    const due = this.l26()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson.firstName,
    this.info.taxPayer.primaryPerson.lastName,
    this.info.taxPayer.primaryPerson.ssid,
    this.info.taxPayer.spouse?.firstName,
    this.info.taxPayer.spouse?.lastName,
    this.info.taxPayer.spouse?.ssid,
    this.info.taxPayer.primaryPerson.address.address,
    this.info.taxPayer.primaryPerson.address.city,
    this.info.taxPayer.primaryPerson.address.state,
    this.info.taxPayer.primaryPerson.address.zip,
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
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
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeWVIT140 = (f1040: F1040): WVIT140 => new WVIT140(f1040)

export default makeWVIT140
