import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Oregon Form 40 - Individual Income Tax Return
 *
 * Oregon uses progressive income tax rates (4.75% to 9.9%)
 * 4 tax brackets for 2025
 * Note: Oregon has no sales tax
 */
export class OR40 extends Form {
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
    this.formName = 'OR-40'
    this.state = 'OR'
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
  // Line 5: Federal tax liability (limited)
  l5 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const federalTax = this.f1040.l24()
    const limit = parameters.federalTaxSubtractionLimit[status]
    return Math.min(federalTax, limit) || undefined
  }

  // Line 6: Social Security benefits (OR doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Interest from US obligations
  l7 = (): number | undefined => undefined

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Oregon adjusted gross income
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

  // Line 12: Oregon taxable income
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  // Line 13: Oregon income tax
  l13 = (): number => this.calculateORTax(this.l12())

  /**
   * Calculate OR tax using progressive brackets
   */
  private calculateORTax(taxableIncome: number): number {
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
  // Line 14: Personal exemption credit
  l14 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credit = parameters.personalExemptionCredit[status]
    const numDependents = this.info.taxPayer.dependents.length
    credit += numDependents * parameters.dependentExemptionCredit
    return credit
  }

  // Line 15: Oregon earned income credit (12% of federal EIC)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC
      ? Math.round(federalEIC * parameters.eicPercentage)
      : undefined
  }

  // Line 16: Retirement income credit (62+)
  l16 = (): number | undefined => {
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l10()

    // Must be 62+ and meet income limit
    const qualifies =
      primaryAge >= 62 || (status === FilingStatus.MFJ && spouseAge >= 62)

    if (!qualifies || agi > parameters.retirementIncomeCredit.incomeLimit) {
      return undefined
    }

    // Calculate retirement income credit
    const retirementIncome = this.f1040.l5b() ?? 0
    return (
      Math.min(retirementIncome, parameters.retirementIncomeCredit.maxCredit) ||
      undefined
    )
  }

  // Line 17: Working family dependent care credit
  l17 = (): number | undefined => {
    const numDependents = this.info.taxPayer.dependents.length
    if (numDependents === 0) return undefined

    const credit = Math.min(
      numDependents * parameters.dependentCareCredit.perChild,
      parameters.dependentCareCredit.maxCredit
    )
    return credit || undefined
  }

  // Line 18: Other credits
  l18 = (): number | undefined => undefined

  // Line 19: Total credits
  l19 = (): number =>
    sumFields([this.l14(), this.l15(), this.l16(), this.l17(), this.l18()])

  // Line 20: Net tax
  l20 = (): number => Math.max(0, this.l13() - this.l19())

  // PAYMENTS
  // Line 21: OR withholding
  l21 = (): number | undefined => this.methods.witholdingForState('OR')

  // Line 22: Estimated payments
  l22 = (): number | undefined => undefined

  // Line 23: Oregon Kicker (surplus refund)
  l23 = (): number | undefined => {
    if (parameters.kickerPercentage === 0) return undefined
    // Kicker is calculated as percentage of prior year tax liability
    // This would require prior year data, returning undefined for now
    return undefined
  }

  // Line 24: Total payments
  l24 = (): number => sumFields([this.l21(), this.l22(), this.l23()])

  // RESULTS
  // Line 25: Amount due
  l25 = (): number => Math.max(0, this.l20() - this.l24())

  // Line 26: Overpayment/Refund
  l26 = (): number => Math.max(0, this.l24() - this.l20())

  payment = (): number | undefined => {
    const due = this.l25()
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
    this.l26(),
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeOR40 = (f1040: F1040): OR40 => new OR40(f1040)

export default makeOR40
