import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/**
 * Pennsylvania Form PA-40 - Personal Income Tax Return
 *
 * Pennsylvania uses a flat 3.07% income tax rate
 * PA taxes 8 classes of income separately
 * Note: PA also has local Earned Income Tax (EIT) which varies by municipality
 */
export class PA40 extends Form {
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
    this.formName = 'PA-40'
    this.state = 'PA'
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

  // PA Classes of Income (Lines 1a-1h)
  // PA taxes each class of income at the flat 3.07% rate

  // Line 1a - Compensation (wages, salaries, tips, etc.)
  l1a = (): number => this.f1040.l1a() ?? 0

  // Line 1b - Interest income
  l1b = (): number | undefined => this.f1040.l2b()

  // Line 1c - Dividend income
  l1c = (): number | undefined => this.f1040.l3b()

  // Line 1d - Net income from business/profession (Schedule C)
  l1d = (): number | undefined => {
    const businessIncome = this.f1040.scheduleC?.l31() ?? 0
    return businessIncome > 0 ? businessIncome : undefined
  }

  // Line 1e - Net gains from disposition of property (Schedule D)
  l1e = (): number | undefined => {
    const gains = this.f1040.scheduleD.l21()
    return gains && gains > 0 ? gains : undefined
  }

  // Line 1f - Net income from rents, royalties, estates, trusts (Schedule E)
  l1f = (): number | undefined => {
    const rentIncome = this.f1040.scheduleE.l26()
    return rentIncome && rentIncome > 0 ? rentIncome : undefined
  }

  // Line 1g - Estate or trust income
  l1g = (): number | undefined => undefined

  // Line 1h - Gambling and lottery winnings
  // Note: PA taxes gambling winnings but not PA lottery winnings
  l1h = (): number | undefined => undefined

  // Line 2 - Total PA taxable income
  l2 = (): number =>
    sumFields([
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f(),
      this.l1g(),
      this.l1h()
    ])

  // Line 3 - PA tax liability (Line 2 × 3.07%)
  l3 = (): number => Math.round(this.l2() * parameters.taxRate)

  // Line 4 - Use tax
  l4 = (): number | undefined => undefined

  // Line 5 - Total tax (add Lines 3 and 4)
  l5 = (): number => sumFields([this.l3(), this.l4()])

  // Tax Forgiveness (Lines 6-9)
  // PA provides tax forgiveness for low-income taxpayers

  // Calculate eligibility income for tax forgiveness
  eligibilityIncome = (): number => {
    // Eligibility income is total PA income plus tax-exempt interest
    return this.l2()
  }

  // Calculate the tax forgiveness amount
  taxForgivenessAmount = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const eligibilityLimit = parameters.taxForgiveness.eligibilityIncome[status]
    const numDependents = this.info.taxPayer.dependents.length
    const adjustedLimit =
      eligibilityLimit + numDependents * parameters.taxForgiveness.perDependent

    const income = this.eligibilityIncome()

    // Full forgiveness if income at or below limit
    if (income <= adjustedLimit) {
      return this.l5()
    }

    // Partial forgiveness phases out
    const excess = income - adjustedLimit
    const phaseOutAmount = excess * parameters.taxForgiveness.phaseOutRate
    const forgiveness = Math.max(0, this.l5() - phaseOutAmount)

    return Math.round(forgiveness)
  }

  // Line 6 - Total income for tax forgiveness
  l6 = (): number => this.eligibilityIncome()

  // Line 7 - Tax forgiveness percent from table
  l7 = (): number | undefined => {
    const forgiveness = this.taxForgivenessAmount()
    return forgiveness > 0 ? forgiveness / this.l5() : undefined
  }

  // Line 8 - Tax forgiveness amount
  l8 = (): number => this.taxForgivenessAmount()

  // Line 9 - Adjusted PA tax (Line 5 minus Line 8)
  l9 = (): number => Math.max(0, this.l5() - this.l8())

  // Credits (Lines 10-12)
  // Line 10 - Resident credit for tax paid to other states
  l10 = (): number | undefined => undefined

  // Line 11 - Other credits
  l11 = (): number | undefined => undefined

  // Line 12 - Total credits
  l12 = (): number => sumFields([this.l10(), this.l11()])

  // Line 13 - Tax after credits (Line 9 minus Line 12)
  l13 = (): number => Math.max(0, this.l9() - this.l12())

  // Payments (Lines 14-18)
  // Line 14 - PA income tax withheld
  l14 = (): number | undefined => this.methods.witholdingForState('PA')

  // Line 15 - Estimated payments
  l15 = (): number | undefined => undefined

  // Line 16 - Extension payment
  l16 = (): number | undefined => undefined

  // Line 17 - Pass-through entity withholding
  l17 = (): number | undefined => undefined

  // Line 18 - Total payments
  l18 = (): number =>
    sumFields([this.l14(), this.l15(), this.l16(), this.l17()])

  // Results (Lines 19-21)
  // Line 19 - Tax due (if Line 13 > Line 18)
  l19 = (): number => Math.max(0, this.l13() - this.l18())

  // Line 20 - Overpayment (if Line 18 > Line 13)
  l20 = (): number => Math.max(0, this.l18() - this.l13())

  // Line 21 - Refund
  l21 = (): number => this.l20()

  payment = (): number | undefined => {
    const due = this.l19()
    return due > 0 ? due : undefined
  }

  // Bank information for direct deposit
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
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l1d(),
    this.l1e(),
    this.l1f(),
    this.l1g(),
    this.l1h(),
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
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makePA40 = (f1040: F1040): PA40 => new PA40(f1040)

export default makePA40
