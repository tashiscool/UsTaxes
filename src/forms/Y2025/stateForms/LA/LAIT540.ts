import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Louisiana Form IT-540 - Individual Income Tax Return
 *
 * Louisiana uses progressive income tax rates (1.85% to 4.25%)
 * 3 tax brackets for 2025
 * Note: Federal income tax is deductible on Louisiana returns
 */
export class LAIT540 extends Form {
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
    this.formName = 'LA-IT540'
    this.state = 'LA'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined =>
    this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Interest on non-LA state/local obligations
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Federal income tax deduction (unique to LA)
  l5 = (): number | undefined => {
    // Louisiana allows a deduction for federal income tax paid
    const federalTax = this.f1040.l24()
    return federalTax > 0 ? federalTax : undefined
  }

  // Line 6: Social Security benefits (LA doesn't tax SS)
  l6 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 7: Other subtractions (military pay, etc.)
  l7 = (): number | undefined => undefined

  // Line 8: Total subtractions
  l8 = (): number => sumFields([this.l5(), this.l6(), this.l7()])

  // Line 9: Louisiana adjusted gross income
  l9 = (): number => Math.max(0, this.l1() + this.l4() - this.l8())

  // Line 10: Personal exemption
  l10 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let exemptions = parameters.personalExemption[status]

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 11: Louisiana taxable income
  l11 = (): number => Math.max(0, this.l9() - this.l10())

  // Line 12: Louisiana tax (from tax table or brackets)
  l12 = (): number => this.calculateLATax(this.l11())

  /**
   * Calculate LA tax using progressive brackets
   */
  private calculateLATax(taxableIncome: number): number {
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
  // Line 13: Personal exemption credit
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let credit = parameters.exemptionCredit[status]

    // Add dependent credits
    const numDependents = this.info.taxPayer.dependents.length
    credit += numDependents * parameters.dependentCredit

    return credit
  }

  // Line 14: Louisiana Earned Income Credit (5% of federal)
  l14 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditRate)
    }
    return undefined
  }

  // Line 15: Child Care Credit
  l15 = (): number | undefined => {
    const agi = this.l9()

    // Find applicable rate based on AGI
    let rate = 0.1 // Default lowest rate
    for (const tier of parameters.childCareCreditPercentages) {
      if (agi <= tier.agiLimit) {
        rate = tier.rate
        break
      }
    }

    // Get federal child care credit from Form 2441 (if available)
    // Simplified: check if there are young dependents
    const hasChildCareCredit = this.info.taxPayer.dependents.some(
      (d) => new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() < 13
    )

    if (hasChildCareCredit) {
      // Estimate based on typical child care credit
      return Math.round(1000 * rate)
    }
    return undefined
  }

  // Line 16: Other credits
  l16 = (): number | undefined => undefined

  // Line 17: Total credits (limited to tax)
  l17 = (): number =>
    Math.min(
      sumFields([this.l13(), this.l14(), this.l15(), this.l16()]),
      this.l12()
    )

  // Line 18: Net tax
  l18 = (): number => Math.max(0, this.l12() - this.l17())

  // PAYMENTS
  // Line 19: Louisiana withholding
  l19 = (): number | undefined => this.methods.witholdingForState('LA')

  // Line 20: Estimated payments
  l20 = (): number | undefined => undefined

  // Line 21: Other payments
  l21 = (): number | undefined => undefined

  // Line 22: Total payments
  l22 = (): number => sumFields([this.l19(), this.l20(), this.l21()])

  // RESULTS
  // Line 23: Amount due
  l23 = (): number => Math.max(0, this.l18() - this.l22())

  // Line 24: Overpayment/Refund
  l24 = (): number => Math.max(0, this.l22() - this.l18())

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
    this.l1(), this.l2(), this.l3(), this.l4(),
    this.l5(), this.l6(), this.l7(), this.l8(),
    this.l9(), this.l10(), this.l11(), this.l12(),
    this.l13(), this.l14(), this.l15(), this.l16(), this.l17(), this.l18(),
    this.l19(), this.l20(), this.l21(), this.l22(),
    this.l23(), this.l24()
  ]
}

const makeLAIT540 = (f1040: F1040): LAIT540 => new LAIT540(f1040)

export default makeLAIT540
