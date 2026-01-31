import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * New Jersey Form NJ-1040 - Resident Income Tax Return
 *
 * New Jersey uses progressive income tax rates (1.4% to 10.75%)
 */
export class NJ1040 extends Form {
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
    this.formName = 'NJ-1040'
    this.state = 'NJ'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.lastName

  primarySSN = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.ssid

  spouseFirstName = (): string | undefined =>
    this.info.taxPayer.spouse?.firstName

  spouseLastName = (): string | undefined =>
    this.info.taxPayer.spouse?.lastName

  spouseSSN = (): string | undefined =>
    this.info.taxPayer.spouse?.ssid

  address = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.address.address

  city = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.address.city

  stateField = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.address.state

  zip = (): string | undefined =>
    this.info.taxPayer.primaryPerson?.address.zip

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Income Section
  // Line 15 - Wages, salaries, tips
  l15 = (): number => this.f1040.l1a() ?? 0

  // Line 16 - Taxable interest
  l16 = (): number | undefined => this.f1040.l2b()

  // Line 17 - Dividends
  l17 = (): number | undefined => this.f1040.l3b()

  // Line 18 - Business income
  l18 = (): number | undefined => {
    const businessIncome = this.f1040.scheduleC?.l31() ?? 0
    return businessIncome > 0 ? businessIncome : undefined
  }

  // Line 19 - Net gains or income from disposition of property
  l19 = (): number | undefined => this.f1040.scheduleD.l21()

  // Line 20 - Pensions, annuities, and IRA withdrawals
  l20 = (): number | undefined => this.f1040.l5b()

  // Line 21 - Partnership income
  l21 = (): number | undefined => undefined

  // Line 22 - S Corporation income
  l22 = (): number | undefined => undefined

  // Line 23 - Net rent and royalty income
  l23 = (): number | undefined => this.f1040.scheduleE.l26()

  // Line 24 - Net gambling winnings
  l24 = (): number | undefined => undefined

  // Line 25 - Alimony received
  l25 = (): number | undefined => undefined

  // Line 26 - Other income
  l26 = (): number | undefined => undefined

  // Line 27 - Total income
  l27 = (): number =>
    sumFields([
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
      this.l26()
    ])

  // Exemptions and Deductions
  // Line 28 - Pension exclusion (for 62+ or disabled)
  l28 = (): number | undefined => {
    // Simplified: would need age verification
    return undefined
  }

  // Line 29 - Other retirement income exclusion
  l29 = (): number | undefined => undefined

  // Line 30 - Exemptions
  l30 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    // Add senior/blind exemptions
    const primaryAge = this.info.taxPayer.primaryPerson?.dateOfBirth
      ? new Date().getFullYear() -
        new Date(this.info.taxPayer.primaryPerson.dateOfBirth).getFullYear()
      : 0
    if (primaryAge >= 65) {
      exemptions += parameters.seniorBlindExemption
    }

    // Add spouse exemption if MFJ
    if (status === FilingStatus.MFJ && this.info.taxPayer.spouse?.dateOfBirth) {
      const spouseAge =
        new Date().getFullYear() -
        new Date(this.info.taxPayer.spouse.dateOfBirth).getFullYear()
      if (spouseAge >= 65) {
        exemptions += parameters.seniorBlindExemption
      }
    }

    return exemptions
  }

  // Line 31 - Total exemptions and deductions
  l31 = (): number => sumFields([this.l28(), this.l29(), this.l30()])

  // Line 32 - Taxable income (Line 27 minus Line 31)
  l32 = (): number => Math.max(0, this.l27() - this.l31())

  // Line 33 - Property tax deduction (max $15,000)
  l33 = (): number | undefined => {
    // Simplified: would need property tax data
    return undefined
  }

  // Line 34 - NJ Taxable Income
  l34 = (): number => Math.max(0, this.l32() - (this.l33() ?? 0))

  // Tax Calculation
  // Line 35 - Tax from tax table
  l35 = (): number => this.calculateNJTax(this.l34())

  /**
   * Calculate NJ tax using progressive brackets
   */
  private calculateNJTax(taxableIncome: number): number {
    const status = this.filingStatus() ?? FilingStatus.S
    const bracketInfo = parameters.taxBrackets[status]
    const { brackets, rates } = bracketInfo

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

  // Line 36 - Use tax
  l36 = (): number | undefined => undefined

  // Line 37 - Total tax (add Lines 35 and 36)
  l37 = (): number => sumFields([this.l35(), this.l36()])

  // Credits
  // Line 38 - NJ Earned Income Tax Credit (40% of federal)
  l38 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.eicPercentage)
    }
    return undefined
  }

  // Line 39 - Property tax credit
  l39 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const income = this.l27()
    const incomeLimit = parameters.propertyTaxCreditIncomeLimit[status]

    if (income <= incomeLimit) {
      return parameters.propertyTaxCreditMax
    }
    return undefined
  }

  // Line 40 - Child and Dependent Care Credit
  l40 = (): number | undefined => {
    const federalCredit = this.f1040.schedule3.l2()
    if (federalCredit && federalCredit > 0) {
      return Math.round(federalCredit * parameters.childCarePercentage)
    }
    return undefined
  }

  // Line 41 - Other credits
  l41 = (): number | undefined => undefined

  // Line 42 - Total credits
  l42 = (): number => sumFields([this.l38(), this.l39(), this.l40(), this.l41()])

  // Line 43 - Balance of tax (Line 37 minus Line 42)
  l43 = (): number => Math.max(0, this.l37() - this.l42())

  // Payments
  // Line 44 - NJ income tax withheld
  l44 = (): number | undefined => this.methods.witholdingForState('NJ')

  // Line 45 - Estimated payments
  l45 = (): number | undefined => undefined

  // Line 46 - Excess NJ UI/WF/SWF withheld
  l46 = (): number | undefined => undefined

  // Line 47 - Total payments
  l47 = (): number => sumFields([this.l44(), this.l45(), this.l46()])

  // Results
  // Line 48 - Overpayment (if Line 47 > Line 43)
  l48 = (): number => Math.max(0, this.l47() - this.l43())

  // Line 49 - Balance due (if Line 43 > Line 47)
  l49 = (): number => Math.max(0, this.l43() - this.l47())

  // Line 50 - Refund
  l50 = (): number => this.l48()

  payment = (): number | undefined => {
    const due = this.l49()
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
    this.l37(),
    this.l38(),
    this.l39(),
    this.l40(),
    this.l41(),
    this.l42(),
    this.l43(),
    this.l44(),
    this.l45(),
    this.l46(),
    this.l47(),
    this.l48(),
    this.l49(),
    this.l50(),
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeNJ1040 = (f1040: F1040): NJ1040 => new NJ1040(f1040)

export default makeNJ1040
