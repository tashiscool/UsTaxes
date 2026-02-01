import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * New York Form IT-201 - Resident Income Tax Return
 *
 * New York uses progressive income tax rates (4% to 10.9%)
 */
export class NYIT201 extends Form {
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
    this.formName = 'NY-IT-201'
    this.state = 'NY'
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

  // Income section
  // Line 1 - Wages, salaries, tips
  l1 = (): number => this.f1040.l1a()

  // Line 2 - Taxable interest
  l2 = (): number | undefined => this.f1040.l2b()

  // Line 3 - Ordinary dividends
  l3 = (): number | undefined => this.f1040.l3b()

  // Line 4 - Taxable refunds
  l4 = (): number | undefined => undefined

  // Line 5 - Alimony received
  l5 = (): number | undefined => undefined

  // Line 6 - Business income/loss
  l6 = (): number | undefined =>
    this.f1040.scheduleC?.isNeeded() ? this.f1040.schedule1.l3() : undefined

  // Line 7 - Capital gain/loss
  l7 = (): number | undefined => this.f1040.l7()

  // Line 8 - Other gains/losses
  l8 = (): number | undefined => undefined

  // Line 9 - Taxable IRA distributions
  l9 = (): number | undefined => this.f1040.l4b()

  // Line 10 - Taxable pensions
  l10 = (): number | undefined => this.f1040.l5b()

  // Line 11 - Rental, royalty, partnership income
  l11 = (): number | undefined =>
    this.f1040.scheduleE.isNeeded() ? this.f1040.scheduleE.l26() : undefined

  // Line 12 - Farm income/loss
  l12 = (): number | undefined => undefined

  // Line 13 - Unemployment compensation
  l13 = (): number | undefined => undefined

  // Line 14 - Taxable Social Security
  l14 = (): number | undefined => this.f1040.l6b()

  // Line 15 - Other income
  l15 = (): number | undefined => undefined

  // Line 16 - Federal adjusted gross income (from federal 1040)
  l16 = (): number => this.f1040.l11()

  // NY Additions
  // Line 17 - Interest income from other states' bonds
  l17 = (): number | undefined => undefined

  // Line 18 - Other additions
  l18 = (): number | undefined => undefined

  // Line 19 - Total NY additions
  l19 = (): number => sumFields([this.l17(), this.l18()])

  // Line 20 - Federal AGI plus NY additions
  l20 = (): number => this.l16() + this.l19()

  // NY Subtractions
  // Line 21 - Taxable refunds (if added back)
  l21 = (): number | undefined => undefined

  // Line 22 - Pensions of NY/local government employees
  l22 = (): number | undefined => undefined

  // Line 23 - Social Security (NY doesn't tax SS)
  l23 = (): number | undefined => this.f1040.l6b()

  // Line 24 - Interest from US bonds
  l24 = (): number | undefined => undefined

  // Line 25 - Other subtractions
  l25 = (): number | undefined => undefined

  // Line 26 - Total NY subtractions
  l26 = (): number =>
    sumFields([this.l21(), this.l22(), this.l23(), this.l24(), this.l25()])

  // Line 27 - NY adjusted gross income
  l27 = (): number => Math.max(0, this.l20() - this.l26())

  // Deductions
  // Line 28 - NY itemized deductions OR standard deduction
  l28 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Use federal itemized if greater (with NY modifications)
    if (this.f1040.scheduleA.isNeeded()) {
      // NY doesn't allow SALT deduction
      const federalItemized = this.f1040.scheduleA.deductions()
      // Simplified: use standard deduction comparison
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 29 - Dependent exemptions
  l29 = (): number =>
    this.info.taxPayer.dependents.length * parameters.dependentExemption

  // Line 30 - NY taxable income
  l30 = (): number => Math.max(0, this.l27() - this.l28() - this.l29())

  // Tax Computation
  // Line 31 - NY state tax
  l31 = (): number => this.calculateNYTax(this.l30())

  /**
   * Calculate NY tax using progressive brackets
   */
  private calculateNYTax(taxableIncome: number): number {
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

  // Credits
  // Line 32 - Household credit
  l32 = (): number | undefined => undefined

  // Line 33 - NY Earned Income Credit (30% of federal)
  l33 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC
      ? Math.round(federalEIC * parameters.eicPercentage)
      : undefined
  }

  // Line 34 - Empire State child credit
  l34 = (): number | undefined => {
    const numChildren = this.info.taxPayer.dependents.filter(
      (d) =>
        new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 17
    ).length
    return numChildren > 0
      ? numChildren * parameters.empireStateChildCredit
      : undefined
  }

  // Line 35 - Other credits
  l35 = (): number | undefined => undefined

  // Line 36 - Total credits
  l36 = (): number =>
    sumFields([this.l32(), this.l33(), this.l34(), this.l35()])

  // Line 37 - Tax after credits
  l37 = (): number => Math.max(0, this.l31() - this.l36())

  // Line 38 - Other taxes (use tax, etc.)
  l38 = (): number | undefined => undefined

  // Line 39 - Total NY state tax
  l39 = (): number => sumFields([this.l37(), this.l38()])

  // Payments
  // Line 40 - NY withholding
  l40 = (): number | undefined => this.methods.witholdingForState('NY')

  // Line 41 - Estimated payments
  l41 = (): number | undefined => undefined

  // Line 42 - Amount paid with extension
  l42 = (): number | undefined => undefined

  // Line 43 - Total payments
  l43 = (): number => sumFields([this.l40(), this.l41(), this.l42()])

  // Results
  // Line 44 - Overpayment
  l44 = (): number => Math.max(0, this.l43() - this.l39())

  // Line 45 - Amount due
  l45 = (): number => Math.max(0, this.l39() - this.l43())

  // Line 46 - Refund
  l46 = (): number => this.l44()

  payment = (): number | undefined => {
    const due = this.l45()
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
    this.l1(),
    this.l2(),
    this.l3(),
    this.l7(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l14(),
    this.l16(),
    this.l19(),
    this.l20(),
    this.l23(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l33(),
    this.l34(),
    this.l36(),
    this.l37(),
    this.l39(),
    this.l40(),
    this.l41(),
    this.l42(),
    this.l43(),
    this.l44(),
    this.l45(),
    this.l46(),
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeNYIT201 = (f1040: F1040): NYIT201 => new NYIT201(f1040)

export default makeNYIT201
