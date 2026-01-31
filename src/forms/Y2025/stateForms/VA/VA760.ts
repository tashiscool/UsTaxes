import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Virginia Form 760 - Resident Individual Income Tax Return
 *
 * Virginia uses progressive income tax rates (2% to 5.75%)
 * Virginia generally conforms to federal tax law with some modifications
 *
 * Note: Local taxes (BPOL, local income tax) vary by locality and are not
 * calculated here.
 */
export class VA760 extends Form {
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
    this.formName = 'VA-760'
    this.state = 'VA'
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

  // Helper: Get primary taxpayer's age
  private getPrimaryAge(): number {
    const dob = this.info.taxPayer.primaryPerson?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // Helper: Get spouse's age
  private getSpouseAge(): number {
    const dob = this.info.taxPayer.spouse?.dateOfBirth
    if (!dob) return 0
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  // INCOME SECTION
  // Line 1 - Federal Adjusted Gross Income (from federal Form 1040, Line 11)
  l1 = (): number => this.f1040.l11()

  // ADDITIONS TO FEDERAL AGI
  // Line 2a - Interest on obligations of other states (not VA)
  l2a = (): number | undefined => undefined

  // Line 2b - Other additions (Schedule ADJ, Line 3)
  l2b = (): number | undefined => undefined

  // Line 2 - Total additions
  l2 = (): number => sumFields([this.l2a(), this.l2b()])

  // Line 3 - Subtotal (Line 1 + Line 2)
  l3 = (): number => this.l1() + this.l2()

  // SUBTRACTIONS FROM FEDERAL AGI
  // Line 4a - Income from Virginia obligations
  l4a = (): number | undefined => undefined

  // Line 4b - Social Security/Tier 1 Railroad Retirement benefits
  // Virginia allows subtraction of taxable SS for qualifying taxpayers
  l4b = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l1()
    const threshold = parameters.socialSecuritySubtraction.incomeThreshold[status]

    // Check if taxpayer is 65+ and under income threshold
    const age = this.getPrimaryAge()
    if (age >= 65 && agi <= threshold) {
      return this.f1040.l6b() ?? undefined
    }

    // Partial subtraction logic could be added here
    return undefined
  }

  // Line 4c - Age deduction (for taxpayers 65+)
  l4c = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l1()
    const primaryAge = this.getPrimaryAge()
    const spouseAge = this.getSpouseAge()

    let deduction = 0

    // Primary taxpayer age deduction
    if (primaryAge >= 65) {
      const maxDeduction = parameters.ageDeduction.maxDeduction[status]
      const threshold = parameters.ageDeduction.incomeThreshold[status]

      if (agi <= threshold) {
        deduction += maxDeduction
      } else {
        // Phase out: reduce $1 for each $1 over threshold
        const reduction = (agi - threshold) * parameters.ageDeduction.phaseOutRate
        deduction += Math.max(0, maxDeduction - reduction)
      }
    }

    // Spouse age deduction (MFJ only)
    if (
      status === FilingStatus.MFJ &&
      spouseAge >= 65
    ) {
      const maxDeduction = parameters.ageDeduction.maxDeduction[status]
      const threshold = parameters.ageDeduction.incomeThreshold[status]

      if (agi <= threshold) {
        deduction += maxDeduction
      } else {
        const reduction = (agi - threshold) * parameters.ageDeduction.phaseOutRate
        deduction += Math.max(0, maxDeduction - reduction)
      }
    }

    return deduction > 0 ? Math.round(deduction) : undefined
  }

  // Line 4d - Military pay subtraction
  l4d = (): number | undefined => {
    // Would need military income data
    return undefined
  }

  // Line 4e - Virginia 529 plan contributions
  l4e = (): number | undefined => {
    // Would need 529 contribution data
    return undefined
  }

  // Line 4f - Other subtractions (Schedule ADJ)
  l4f = (): number | undefined => undefined

  // Line 4 - Total subtractions
  l4 = (): number =>
    sumFields([this.l4a(), this.l4b(), this.l4c(), this.l4d(), this.l4e(), this.l4f()])

  // Line 5 - Virginia Adjusted Gross Income (Line 3 - Line 4)
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  // DEDUCTIONS
  // Line 6 - Deductions (itemized or standard)
  l6 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const standardDeduction = parameters.standardDeduction[status]

    // Virginia itemized deductions generally follow federal
    // with some modifications
    if (this.f1040.scheduleA.isNeeded()) {
      const federalItemized = this.f1040.scheduleA.deductions()
      // VA allows most federal itemized deductions
      return Math.max(standardDeduction, federalItemized)
    }

    return standardDeduction
  }

  // Line 7 - Virginia Taxable Income before exemptions
  l7 = (): number => Math.max(0, this.l5() - this.l6())

  // EXEMPTIONS
  // Line 8 - Personal and dependent exemptions
  l8 = (): number => {
    let exemptions = 0

    // Personal exemption for taxpayer
    exemptions += parameters.personalExemption

    // Personal exemption for spouse (MFJ or MFS)
    const status = this.filingStatus() ?? FilingStatus.S
    if (status === FilingStatus.MFJ || status === FilingStatus.MFS) {
      exemptions += parameters.personalExemption
    }

    // Dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    exemptions += numDependents * parameters.dependentExemption

    return exemptions
  }

  // Line 9 - Virginia Taxable Income (Line 7 - Line 8)
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // TAX COMPUTATION
  // Line 10 - Tax from tax table or calculation
  l10 = (): number => this.calculateVATax(this.l9())

  /**
   * Calculate Virginia tax using progressive brackets
   * $0 - $3,000: 2%
   * $3,001 - $5,000: 3%
   * $5,001 - $17,000: 5%
   * Over $17,000: 5.75%
   */
  private calculateVATax(taxableIncome: number): number {
    const { brackets, rates } = parameters.taxBrackets

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

  // Line 11 - Spouse Tax Adjustment (MFS with both having income)
  l11 = (): number | undefined => {
    const status = this.filingStatus()
    if (status === FilingStatus.MFS) {
      // Simplified: would need spouse income data
      return undefined
    }
    return undefined
  }

  // Line 12 - Tax after spouse adjustment
  l12 = (): number => Math.max(0, this.l10() - (this.l11() ?? 0))

  // CREDITS
  // Line 13 - Credit for tax paid to other states
  l13 = (): number | undefined => undefined

  // Line 14 - Low Income Individuals Credit
  l14 = (): number | undefined => {
    const status = this.filingStatus() ?? FilingStatus.S
    const agi = this.l1()
    const threshold = parameters.lowIncomeCreditThreshold[status]

    if (agi <= threshold) {
      return parameters.lowIncomeCredit[status]
    }
    return undefined
  }

  // Line 15 - Virginia Earned Income Credit (20% of federal EIC, refundable)
  l15 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 16 - Other credits (Schedule CR)
  l16 = (): number | undefined => undefined

  // Line 17 - Total nonrefundable credits (limited to tax)
  l17 = (): number => {
    const credits = sumFields([this.l13(), this.l14(), this.l16()])
    return Math.min(credits, this.l12())
  }

  // Line 18 - Tax after nonrefundable credits
  l18 = (): number => Math.max(0, this.l12() - this.l17())

  // Line 19 - Consumer's Use Tax
  l19 = (): number | undefined => undefined

  // Line 20 - Total tax (Line 18 + Line 19)
  l20 = (): number => sumFields([this.l18(), this.l19()])

  // PAYMENTS AND REFUNDABLE CREDITS
  // Line 21 - Virginia income tax withheld
  l21 = (): number | undefined => this.methods.witholdingForState('VA')

  // Line 22 - Estimated tax payments
  l22 = (): number | undefined => undefined

  // Line 23 - Extension payment
  l23 = (): number | undefined => undefined

  // Line 24 - Virginia Earned Income Credit (refundable portion)
  // EIC is fully refundable in Virginia
  l24 = (): number | undefined => this.l15()

  // Line 25 - Other refundable credits
  l25 = (): number | undefined => undefined

  // Line 26 - Total payments and refundable credits
  l26 = (): number =>
    sumFields([this.l21(), this.l22(), this.l23(), this.l24(), this.l25()])

  // RESULTS
  // Line 27 - Overpayment (if Line 26 > Line 20)
  l27 = (): number => Math.max(0, this.l26() - this.l20())

  // Line 28 - Amount due (if Line 20 > Line 26)
  l28 = (): number => Math.max(0, this.l20() - this.l26())

  // Line 29 - Refund
  l29 = (): number => this.l27()

  payment = (): number | undefined => {
    const due = this.l28()
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
    this.l1(),
    this.l2a(),
    this.l2b(),
    this.l2(),
    this.l3(),
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l4d(),
    this.l4e(),
    this.l4f(),
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
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeVA760 = (f1040: F1040): VA760 => new VA760(f1040)

export default makeVA760
