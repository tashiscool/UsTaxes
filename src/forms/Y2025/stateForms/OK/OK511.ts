import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Oklahoma Form 511 - Individual Income Tax Return
 *
 * Oklahoma uses progressive income tax rates (0.25% to 4.75%)
 * 6 tax brackets for 2025
 */
export class OK511 extends Form {
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
    this.formName = 'OK-511'
    this.state = 'OK'
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

  private getSpouseAge(): number {
    const dob = this.info.taxPayer.spouse?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  private getNumQualifyingChildren(): number {
    return this.info.taxPayer.dependents.filter(
      (d) => new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 17
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

  // Line 6: Social Security benefits (OK doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Retirement income exclusion (65+)
  l7 = (): number | undefined => {
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()
    const status = this.filingStatus() ?? FilingStatus.S
    let exclusion = 0

    // Primary taxpayer
    if (primaryAge >= 65) {
      exclusion += parameters.retirementExclusion
    }

    // Spouse (if MFJ)
    if (status === FilingStatus.MFJ && spouseAge >= 65) {
      exclusion += parameters.retirementExclusion
    }

    // Limited to actual retirement income
    const retirementIncome = this.f1040.l5b() ?? 0
    return Math.min(exclusion, retirementIncome) || undefined
  }

  // Line 8: Other subtractions
  l8 = (): number | undefined => undefined

  // Line 9: Total subtractions
  l9 = (): number => sumFields([this.l5(), this.l6(), this.l7(), this.l8()])

  // Line 10: Oklahoma adjusted gross income
  l10 = (): number => Math.max(0, this.l1() + this.l4() - this.l9())

  // Line 11: Standard or itemized deduction (Oklahoma uses federal amounts)
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

  // Line 13: Oklahoma taxable income
  l13 = (): number => Math.max(0, this.l10() - this.l11() - this.l12())

  // Line 14: Oklahoma income tax
  l14 = (): number => this.calculateOKTax(this.l13())

  /**
   * Calculate OK tax using progressive brackets
   */
  private calculateOKTax(taxableIncome: number): number {
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

  // CREDITS
  // Line 15: Oklahoma earned income credit (5% of federal EIC)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    return federalEIC
      ? Math.round(federalEIC * parameters.eicPercentage)
      : undefined
  }

  // Line 16: Child tax credit
  l16 = (): number | undefined => {
    const numChildren = this.getNumQualifyingChildren()
    return numChildren > 0 ? numChildren * parameters.childTaxCredit : undefined
  }

  // Line 17: Other credits
  l17 = (): number | undefined => undefined

  // Line 18: Total credits
  l18 = (): number => sumFields([this.l15(), this.l16(), this.l17()])

  // Line 19: Net tax
  l19 = (): number => Math.max(0, this.l14() - this.l18())

  // PAYMENTS
  // Line 20: OK withholding
  l20 = (): number | undefined => this.methods.witholdingForState('OK')

  // Line 21: Estimated payments
  l21 = (): number | undefined => undefined

  // Line 22: Total payments
  l22 = (): number => sumFields([this.l20(), this.l21()])

  // RESULTS
  // Line 23: Amount due
  l23 = (): number => Math.max(0, this.l19() - this.l22())

  // Line 24: Overpayment/Refund
  l24 = (): number => Math.max(0, this.l22() - this.l19())

  payment = (): number | undefined => {
    const due = this.l23()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson?.firstName,
    this.info.taxPayer.primaryPerson?.lastName,
    this.info.taxPayer.primaryPerson?.ssid,
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
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeOK511 = (f1040: F1040): OK511 => new OK511(f1040)

export default makeOK511
