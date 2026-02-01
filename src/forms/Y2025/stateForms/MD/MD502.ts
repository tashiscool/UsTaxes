import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Maryland Form 502 - Resident Income Tax Return
 *
 * Maryland uses progressive income tax rates (2% to 5.75%)
 * Plus mandatory local county income tax
 */
export class MD502 extends Form {
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
    this.formName = 'MD-502'
    this.state = 'MD'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1: Federal Adjusted Gross Income
  l1 = (): number => this.f1040.l11()

  // ADDITIONS
  // Line 2: Non-Maryland state/local bond interest
  l2 = (): number | undefined => undefined

  // Line 3: Other additions
  l3 = (): number | undefined => undefined

  // Line 4: Total additions
  l4 = (): number => sumFields([this.l2(), this.l3()])

  // SUBTRACTIONS
  // Line 5: Social Security and Railroad Retirement
  l5 = (): number | undefined => this.f1040.l6b() ?? undefined

  // Line 6: Maryland state/local employee retirement pickup
  l6 = (): number | undefined => undefined

  // Line 7: Two-income subtraction (MFJ)
  l7 = (): number | undefined => {
    const status = this.filingStatus()
    if (status === FilingStatus.MFJ) {
      // Lesser of $1,200 or lower-earning spouse's income
      return Math.min(1200, this.f1040.l1a() ?? 0)
    }
    return undefined
  }

  // Line 8: Child/dependent care expenses
  l8 = (): number | undefined => undefined

  // Line 9: Pension exclusion (65+)
  l9 = (): number | undefined => undefined

  // Line 10: Other subtractions
  l10 = (): number | undefined => undefined

  // Line 11: Total subtractions
  l11 = (): number =>
    sumFields([
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10()
    ])

  // Line 12: Maryland adjusted gross income
  l12 = (): number => Math.max(0, this.l1() + this.l4() - this.l11())

  // Line 13: Standard or itemized deduction
  l13 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // MD limits itemized deductions
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      return Math.max(standardDeduction, federalItemized)
    }
    return standardDeduction
  }

  // Line 14: Net income
  l14 = (): number => Math.max(0, this.l12() - this.l13())

  // Line 15: Personal exemptions
  l15 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l12()
    const phaseOutStart = parameters.personalExemption.phaseOutStart[status]

    // Count exemptions (self + spouse for MFJ)
    let count = 1
    if (status === FilingStatus.MFJ) count = 2

    // Add dependents
    count += this.info.taxPayer.dependents.length

    let exemption = count * parameters.personalExemption.amount

    // Phase out if over threshold
    if (agi > phaseOutStart) {
      const excess = agi - phaseOutStart
      const reductionPercent = Math.min(1, excess / 100000)
      exemption = Math.round(exemption * (1 - reductionPercent))
    }

    return exemption
  }

  // Line 16: Maryland taxable income
  l16 = (): number => Math.max(0, this.l14() - this.l15())

  // Line 17: Maryland state tax
  l17 = (): number => this.calculateMDTax(this.l16())

  /**
   * Calculate Maryland tax using progressive brackets
   */
  private calculateMDTax(taxableIncome: number): number {
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

  // Line 18: Local tax (county tax)
  l18 = (): number => Math.round(this.l16() * parameters.localTaxRate)

  // Line 19: Total Maryland tax (state + local)
  l19 = (): number => this.l17() + this.l18()

  // CREDITS
  // Line 20: Earned Income Credit (45% of federal, refundable)
  l20 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 21: Poverty level credit
  l21 = (): number | undefined => undefined

  // Line 22: Other nonrefundable credits
  l22 = (): number | undefined => undefined

  // Line 23: Total credits (limited to tax)
  l23 = (): number => {
    const credits = sumFields([this.l21(), this.l22()])
    return Math.min(credits, this.l19())
  }

  // Line 24: Tax after nonrefundable credits
  l24 = (): number => Math.max(0, this.l19() - this.l23())

  // PAYMENTS
  // Line 25: MD withholding
  l25 = (): number | undefined => this.methods.witholdingForState('MD')

  // Line 26: Estimated payments
  l26 = (): number | undefined => undefined

  // Line 27: Maryland Earned Income Credit (refundable)
  l27 = (): number | undefined => this.l20()

  // Line 28: Total payments and refundable credits
  l28 = (): number => sumFields([this.l25(), this.l26(), this.l27()])

  // RESULTS
  // Line 29: Amount due
  l29 = (): number => Math.max(0, this.l24() - this.l28())

  // Line 30: Overpayment
  l30 = (): number => Math.max(0, this.l28() - this.l24())

  payment = (): number | undefined => {
    const due = this.l29()
    return due > 0 ? due : undefined
  }

  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.info.taxPayer.primaryPerson.firstName,
    this.info.taxPayer.primaryPerson.lastName,
    this.info.taxPayer.primaryPerson.ssid,
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
    this.l29(),
    this.l30()
  ]
}

const makeMD502 = (f1040: F1040): MD502 => new MD502(f1040)

export default makeMD502
