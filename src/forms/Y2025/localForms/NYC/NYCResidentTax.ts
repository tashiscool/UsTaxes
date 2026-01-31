import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { NYIT201 } from '../../stateForms/NY/NYIT201'

/**
 * NYC Resident Income Tax Form
 *
 * This form calculates the NYC resident income tax which is imposed
 * on individuals who are NYC residents. The tax is progressive with
 * rates ranging from 3.078% to 3.876%.
 *
 * NYC residents must file Form NYC-201 in addition to NY State IT-201.
 * The NYC tax is based on NYC taxable income (same as NY taxable income).
 */
export class NYCResidentTax extends Form {
  info: ValidatedInformation
  f1040: F1040
  nyForm: NYIT201
  localTaxInfo?: LocalTaxInfo
  formName: string
  state: State
  formOrder = 10
  methods: FormMethods

  constructor(f1040: F1040, nyForm: NYIT201, localTaxInfo?: LocalTaxInfo) {
    super()
    this.info = f1040.info
    this.f1040 = f1040
    this.nyForm = nyForm
    this.localTaxInfo = localTaxInfo
    this.formName = 'NYC-201'
    this.state = 'NY'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if NYC resident tax applies
   */
  isNeeded = (): boolean => {
    return this.localTaxInfo?.residenceCity === 'NYC' ||
           this.localTaxInfo?.residenceCity === 'New York City'
  }

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  /**
   * Line 1 - NYC Taxable Income (from NY IT-201)
   */
  l1 = (): number => this.nyForm.l30()

  /**
   * Line 2 - NYC Tax
   * Calculate using progressive brackets
   */
  l2 = (): number => this.calculateNYCTax(this.l1())

  /**
   * Calculate NYC tax using progressive brackets
   */
  private calculateNYCTax(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0

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

  /**
   * Line 3 - NYC School Tax Credit
   */
  l3 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const creditInfo = parameters.schoolTaxCredit[status]
    const nyAGI = this.nyForm.l27()

    if (nyAGI > creditInfo.incomeThreshold) {
      return creditInfo.reducedCredit
    }

    return creditInfo.maxCredit
  }

  /**
   * Line 4 - NYC Household Credit
   */
  l4 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const creditInfo = parameters.householdCredit[status]
    const nyAGI = this.nyForm.l27()

    if (nyAGI > creditInfo.incomeThreshold) {
      return 0
    }

    const numDependents = Math.min(
      this.info.taxPayer.dependents.length,
      creditInfo.maxDependents
    )

    return creditInfo.baseCredit + (numDependents * creditInfo.perDependentCredit)
  }

  /**
   * Line 5 - Total NYC Credits
   */
  l5 = (): number => sumFields([this.l3(), this.l4()])

  /**
   * Line 6 - NYC Tax after credits
   */
  l6 = (): number => Math.max(0, this.l2() - this.l5())

  /**
   * Line 7 - NYC Unincorporated Business Tax (UBT) - self-employed
   * Applied if net earnings from self-employment exceed exemption
   */
  l7 = (): number => {
    const selfEmploymentIncome = this.f1040.schedule1.l3() ?? 0

    if (selfEmploymentIncome <= parameters.ubtExemption) {
      return 0
    }

    // UBT is 4% of net income above exemption
    const taxableAmount = selfEmploymentIncome - parameters.ubtExemption
    return Math.round(taxableAmount * parameters.ubtRate)
  }

  /**
   * Line 8 - Total NYC Tax
   */
  l8 = (): number => sumFields([this.l6(), this.l7()])

  /**
   * Line 9 - NYC Withholding
   */
  l9 = (): number => {
    return this.localTaxInfo?.localWithholding ?? 0
  }

  /**
   * Line 10 - NYC Tax Due or Overpayment
   */
  l10 = (): number => this.l8() - this.l9()

  /**
   * Amount owed
   */
  amountOwed = (): number => Math.max(0, this.l10())

  /**
   * Refund amount
   */
  refund = (): number => Math.max(0, -this.l10())

  /**
   * Payment due
   */
  payment = (): number | undefined => {
    const due = this.amountOwed()
    return due > 0 ? due : undefined
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
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
    this.amountOwed(),
    this.refund()
  ]
}

const makeNYCResidentTax = (
  f1040: F1040,
  nyForm: NYIT201,
  localTaxInfo?: LocalTaxInfo
): NYCResidentTax => new NYCResidentTax(f1040, nyForm, localTaxInfo)

export default makeNYCResidentTax
