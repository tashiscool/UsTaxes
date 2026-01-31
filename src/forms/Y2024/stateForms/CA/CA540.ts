import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * California Form 540 - Resident Income Tax Return
 *
 * California uses progressive income tax rates (1% to 12.3%)
 * Plus 1% mental health services tax on income over $1,000,000
 */
export class CA540 extends Form {
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
    this.formName = 'CA-540'
    this.state = 'CA'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  spouseFirstName = (): string | undefined =>
    this.info.taxPayer.spouse?.firstName

  spouseLastName = (): string | undefined => this.info.taxPayer.spouse?.lastName

  spouseSSN = (): string | undefined => this.info.taxPayer.spouse?.ssid

  address = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.address

  city = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.city

  stateField = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.state

  zip = (): string | undefined => this.info.taxPayer.primaryPerson.address.zip

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 7 - Federal adjusted gross income from federal Form 1040
  l7 = (): number => this.f1040.l11()

  // California Additions
  // Line 8 - State and municipal bond interest (non-CA)
  l8 = (): number | undefined => undefined

  // Line 9 - Other additions (Schedule CA)
  l9 = (): number | undefined => undefined

  // Line 10 - Total additions
  l10 = (): number => sumFields([this.l8(), this.l9()])

  // Line 11 - Subtotal
  l11 = (): number => this.l7() + this.l10()

  // California Subtractions
  // Line 12 - Social Security benefits (CA doesn't tax SS)
  l12 = (): number | undefined => this.f1040.l6b()

  // Line 13 - CA lottery winnings
  l13 = (): number | undefined => undefined

  // Line 14 - Other subtractions (Schedule CA)
  l14 = (): number | undefined => undefined

  // Line 15 - Total subtractions
  l15 = (): number => sumFields([this.l12(), this.l13(), this.l14()])

  // Line 16 - California adjusted gross income (CA AGI)
  l16 = (): number => Math.max(0, this.l11() - this.l15())

  // Deductions
  // Line 17 - CA itemized OR standard deduction
  l17 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // CA itemized deductions differ from federal
    // Simplified: use standard deduction comparison
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      // CA doesn't allow certain federal deductions
      return Math.max(standardDeduction, federalItemized * 0.9) // Rough estimate
    }
    return standardDeduction
  }

  // Line 18 - California taxable income
  l18 = (): number => Math.max(0, this.l16() - this.l17())

  // Tax Computation
  // Line 19 - Tax from tax table or tax rate schedules
  l19 = (): number => this.calculateCATax(this.l18())

  /**
   * Calculate CA tax using progressive brackets
   */
  private calculateCATax(taxableIncome: number): number {
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

  // Line 20 - Mental Health Services Tax (1% on income over $1M)
  l20 = (): number => {
    const income = this.l18()
    if (income > parameters.mentalHealthTaxThreshold) {
      const excessIncome = income - parameters.mentalHealthTaxThreshold
      return Math.round(excessIncome * parameters.mentalHealthTaxRate)
    }
    return 0
  }

  // Line 21 - Total tax before credits
  l21 = (): number => this.l19() + this.l20()

  // Credits
  // Line 22 - Exemption credits
  l22 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credits = parameters.exemptionCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credits += numDependents * parameters.dependentExemptionCredit

    return credits
  }

  // Line 23 - Other credits (child care, renter's, etc.)
  l23 = (): number | undefined => {
    // Renter's credit check
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l16()
    const incomeLimit = parameters.rentersIncomeLimit[status]

    if (agi <= incomeLimit) {
      return parameters.rentersCredit[status]
    }
    return undefined
  }

  // Line 24 - Total credits
  l24 = (): number => sumFields([this.l22(), this.l23()])

  // Line 25 - Tax after credits
  l25 = (): number => Math.max(0, this.l21() - this.l24())

  // Line 26 - Other taxes (use tax, etc.)
  l26 = (): number | undefined => undefined

  // Line 27 - Total tax
  l27 = (): number => sumFields([this.l25(), this.l26()])

  // Payments
  // Line 28 - CA withholding
  l28 = (): number | undefined => this.methods.witholdingForState('CA')

  // Line 29 - Estimated payments
  l29 = (): number | undefined => undefined

  // Line 30 - CA Earned Income Tax Credit
  l30 = (): number | undefined => {
    // Simplified CA EITC check
    const agi = this.l16()
    if (agi <= parameters.eicMaxIncome.withChildren) {
      const federalEIC = this.f1040.scheduleEIC.credit()
      // CA EITC is separate but related to federal
      return federalEIC ? Math.round(federalEIC * 0.85) : undefined
    }
    return undefined
  }

  // Line 31 - Young Child Tax Credit
  l31 = (): number | undefined => {
    const youngChildren = this.info.taxPayer.dependents.filter(
      (d) =>
        new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 6
    ).length
    return youngChildren > 0 ? parameters.youngChildTaxCredit : undefined
  }

  // Line 32 - Other payments
  l32 = (): number | undefined => undefined

  // Line 33 - Total payments and credits
  l33 = (): number =>
    sumFields([this.l28(), this.l29(), this.l30(), this.l31(), this.l32()])

  // Results
  // Line 34 - Overpayment
  l34 = (): number => Math.max(0, this.l33() - this.l27())

  // Line 35 - Amount due
  l35 = (): number => Math.max(0, this.l27() - this.l33())

  // Line 36 - Refund
  l36 = (): number => this.l34()

  payment = (): number | undefined => {
    const due = this.l35()
    return due > 0 ? due : undefined
  }

  // Bank information
  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.spouseFirstName(),
    this.spouseLastName(),
    this.spouseSSN(),
    this.address(),
    this.city(),
    this.stateField(),
    this.zip(),
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
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
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33(),
    this.l34(),
    this.l35(),
    this.l36(),
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeCA540 = (f1040: F1040): CA540 => new CA540(f1040)

export default makeCA540
