import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { CURRENT_YEAR } from '../../data/federal'

/**
 * Massachusetts Form 1 - Resident Income Tax Return
 *
 * Massachusetts has a flat 5% income tax rate
 * Plus 4% surtax on income over $1,000,000 (millionaire's tax)
 */
export class MA1 extends Form {
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
    this.formName = 'MA-1'
    this.state = 'MA'
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

  city = (): string | undefined => this.info.taxPayer.primaryPerson.address.city

  stateField = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.state

  zip = (): string | undefined => this.info.taxPayer.primaryPerson.address.zip

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Part 1 - Income
  // Line 1 - Wages, salaries, tips (from federal W-2s)
  l1 = (): number => this.f1040.l1a()

  // Line 2 - Interest (taxable and tax-exempt)
  l2 = (): number | undefined => this.f1040.l2b()

  // Line 3 - Dividends
  l3 = (): number | undefined => this.f1040.l3b()

  // Line 4 - Capital gains/losses
  l4 = (): number | undefined => {
    const gain = this.f1040.l7()
    // MA treats short-term and long-term gains differently
    // Short-term: 12%, Long-term: 5%
    // For simplicity, using federal Schedule D amount
    return gain
  }

  // Line 5 - Rental, royalty, partnership income
  l5 = (): number | undefined => {
    const scheduleE = this.f1040.scheduleE
    return scheduleE.isNeeded() ? scheduleE.l26() : undefined
  }

  // Line 6 - Pensions and annuities (taxable amount)
  l6 = (): number | undefined => this.f1040.l5b()

  // Line 7 - Other income
  l7 = (): number | undefined => undefined

  // Line 8 - Total Massachusetts gross income
  l8 = (): number =>
    sumFields([
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7()
    ])

  // Part 2 - Adjustments to Gross Income
  // Line 9 - Total adjustments (similar to federal adjustments)
  l9 = (): number | undefined => this.f1040.l10()

  // Line 10 - Massachusetts adjusted gross income
  l10 = (): number => Math.max(0, this.l8() - (this.l9() ?? 0))

  // Part 3 - Deductions
  // Line 11 - Personal exemptions
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemption = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemption += numDependents * parameters.dependentExemption

    // Add senior exemption
    const dob = this.info.taxPayer.primaryPerson.dateOfBirth
    if (dob && dob < new Date(CURRENT_YEAR - 65, 0, 2)) {
      exemption += parameters.seniorExemption
    }
    const spouseDob = this.info.taxPayer.spouse?.dateOfBirth
    if (spouseDob && spouseDob < new Date(CURRENT_YEAR - 65, 0, 2)) {
      exemption += parameters.seniorExemption
    }

    // Add blind exemption
    if (this.info.taxPayer.primaryPerson.isBlind) {
      exemption += parameters.blindExemption
    }
    if (this.info.taxPayer.spouse?.isBlind) {
      exemption += parameters.blindExemption
    }

    return exemption
  }

  // Line 12 - Other deductions (rental, commuter, etc.)
  l12 = (): number | undefined => undefined

  // Line 13 - Total deductions
  l13 = (): number => sumFields([this.l11(), this.l12()])

  // Line 14 - Massachusetts taxable income
  l14 = (): number => Math.max(0, this.l10() - this.l13())

  // Part 4 - Tax Calculation
  // Line 15 - Tax at 5% rate
  l15 = (): number => Math.round(this.l14() * parameters.taxRate)

  // Line 16 - Additional 4% tax on income over $1M (millionaire's tax)
  l16 = (): number => {
    const income = this.l14()
    if (income > parameters.millionaireTaxThreshold) {
      const excessIncome = income - parameters.millionaireTaxThreshold
      return Math.round(excessIncome * parameters.millionaireTaxRate)
    }
    return 0
  }

  // Line 17 - Total tax before credits
  l17 = (): number => this.l15() + this.l16()

  // Part 5 - Credits
  // Line 18 - Credits (limited income credit, other)
  l18 = (): number | undefined => undefined

  // Line 19 - Tax after credits
  l19 = (): number => Math.max(0, this.l17() - (this.l18() ?? 0))

  // Part 6 - Payments
  // Line 20 - Massachusetts withholding
  l20 = (): number | undefined => this.methods.witholdingForState('MA')

  // Line 21 - Estimated payments
  l21 = (): number | undefined => undefined

  // Line 22 - Extension payment
  l22 = (): number | undefined => undefined

  // Line 23 - Total payments
  l23 = (): number => sumFields([this.l20(), this.l21(), this.l22()])

  // Part 7 - Refund or Amount Due
  // Line 24 - Overpayment (refund)
  l24 = (): number => Math.max(0, this.l23() - this.l19())

  // Line 25 - Amount due
  l25 = (): number => Math.max(0, this.l19() - this.l23())

  // Line 26 - Refund amount
  l26 = (): number => this.l24()

  payment = (): number | undefined => {
    const due = this.l25()
    return due > 0 ? due : undefined
  }

  // Bank information for direct deposit
  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  // Check for no-tax status
  isNoTaxStatus = (): boolean => {
    const status = this.filingStatus() ?? FilingStatus.S
    const threshold = parameters.noTaxStatus[status]
    return this.l10() <= threshold
  }

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
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeMA1 = (f1040: F1040): MA1 => new MA1(f1040)

export default makeMA1
