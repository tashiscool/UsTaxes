import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * New Mexico Form PIT-1 - Personal Income Tax Return
 *
 * New Mexico uses progressive income tax rates (1.7% to 5.9%)
 * 5 tax brackets for 2025
 */
export class NMPIT1 extends Form {
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
    this.formName = 'NM-PIT-1'
    this.state = 'NM'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  private getNumQualifyingChildren(): number {
    return this.info.taxPayer.dependents.filter(
      (d) =>
        new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 17
    ).length
  }

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest from other states' bonds
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Interest from US obligations
  l5 = (): number | undefined => undefined

  // Line 6: Social Security benefits (NM doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Railroad retirement
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: New Mexico adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard or itemized deduction
  l11 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

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
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption
    return exemptions
  }

  // Line 13: New Mexico taxable income
  l13 = (): number => Math.max(0, this.l10() - this.l11() - this.l12())

  // Line 14: New Mexico income tax
  l14 = (): number => this.calculateNMTax(this.l13())

  /**
   * Calculate NM tax using progressive brackets
   */
  private calculateNMTax(taxableIncome: number): number {
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
  // Line 15: Low income comprehensive tax rebate
  l15 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l10()
    const incomeLimit = parameters.lowIncomeRebateLimit[status]

    if (agi <= incomeLimit) {
      return parameters.lowIncomeTaxRebate[status]
    }
    return undefined
  }

  // Line 16: Working families tax credit (25% of federal EITC)
  l16 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC
      ? Math.round(federalEIC * parameters.workingFamiliesTaxCreditRate)
      : undefined
  }

  // Line 17: Child income tax credit
  l17 = (): number | undefined => {
    const numChildren = this.getNumQualifyingChildren()
    return numChildren > 0 ? numChildren * parameters.childTaxCredit : undefined
  }

  // Line 18: Other credits
  l18 = (): number | undefined => undefined

  // Line 19: Total credits
  l19 = (): number =>
    sumFields([this.l15(), this.l16(), this.l17(), this.l18()])

  // Line 20: Net tax (cannot be less than zero)
  l20 = (): number => Math.max(0, this.l14() - this.l19())

  // PAYMENTS
  // Line 21: NM withholding
  l21 = (): number | undefined => this.methods.witholdingForState('NM')

  // Line 22: Estimated payments
  l22 = (): number | undefined => undefined

  // Line 23: Total payments
  l23 = (): number => sumFields([this.l21(), this.l22()])

  // RESULTS
  // Line 24: Amount due
  l24 = (): number => Math.max(0, this.l20() - this.l23())

  // Line 25: Overpayment/Refund
  l25 = (): number => Math.max(0, this.l23() - this.l20())

  payment = (): number | undefined => {
    const due = this.l24()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson.firstName,
    this.info.taxPayer.primaryPerson.lastName,
    this.info.taxPayer.primaryPerson.ssid,
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
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeNMPIT1 = (f1040: F1040): NMPIT1 => new NMPIT1(f1040)

export default makeNMPIT1
