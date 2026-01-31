import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Marion County (Indianapolis) Income Tax
 *
 * Indianapolis/Marion County imposes a county income tax as part of
 * Indiana's local income tax system. The tax is calculated on
 * Indiana adjusted gross income and collected through the state return.
 *
 * Key features:
 * - Combined rate of 2.02% (CAGIT + CEDIT)
 * - Based on Indiana adjusted gross income
 * - Collected with IN Form IT-40
 * - Applies to Marion County residents only
 *
 * Note: Indianapolis is coextensive with Marion County, so
 * Indianapolis residents are also Marion County residents.
 */
export class MarionCountyTax extends Form {
  info: ValidatedInformation
  f1040: F1040
  localTaxInfo?: LocalTaxInfo
  formName: string
  state: State
  formOrder = 10
  methods: FormMethods

  constructor(f1040: F1040, localTaxInfo?: LocalTaxInfo) {
    super()
    this.info = f1040.info
    this.f1040 = f1040
    this.localTaxInfo = localTaxInfo
    this.formName = 'MARION-CTY'
    this.state = 'IN'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Marion County tax applies
   */
  isNeeded = (): boolean => {
    return this.isMarionCountyResident()
  }

  /**
   * Check if taxpayer is an Indianapolis/Marion County resident
   */
  isMarionCountyResident = (): boolean => {
    const city = this.localTaxInfo?.residenceCity?.toLowerCase()
    return (
      city === 'indianapolis' ||
      city === 'indy' ||
      city === 'marion county' ||
      city === 'marion'
    )
  }

  /**
   * Check if taxpayer works in Indianapolis
   * (Informational - county tax based on residence, not work location)
   */
  worksInIndianapolis = (): boolean => {
    const city = this.localTaxInfo?.workCity?.toLowerCase()
    return (
      city === 'indianapolis' ||
      city === 'indy' ||
      city === 'marion county' ||
      city === 'marion'
    )
  }

  /**
   * Get applicable tax rate
   */
  getApplicableRate = (): number => {
    return parameters.taxRate
  }

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  /**
   * Get number of exemptions
   */
  getExemptionCount = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    let count = 1
    if (status === FilingStatus.MFJ) count = 2
    count += this.info.taxPayer.dependents.length
    return count
  }

  /**
   * Part 1 - Indiana Adjusted Gross Income
   */

  /**
   * Line 1 - Federal adjusted gross income
   */
  l1 = (): number => this.f1040.l11()

  /**
   * Line 2 - Indiana additions (simplified)
   * Interest from state/local bonds of other states, etc.
   */
  l2 = (): number => 0

  /**
   * Line 3 - Indiana subtractions
   * Social Security, military pay, certain retirement income
   */
  l3 = (): number => {
    // Social Security is exempt in Indiana
    const ssBenefits = this.f1040.l6b() ?? 0
    return ssBenefits
  }

  /**
   * Line 4 - Indiana adjusted gross income
   */
  l4 = (): number => Math.max(0, this.l1() + this.l2() - this.l3())

  /**
   * Line 5 - Personal exemptions
   */
  l5 = (): number => {
    return this.getExemptionCount() * parameters.exemptions.personalExemption
  }

  /**
   * Line 6 - Indiana taxable income
   */
  l6 = (): number => Math.max(0, this.l4() - this.l5())

  /**
   * Part 2 - County Tax Calculation
   */

  /**
   * Line 7 - County tax rate
   */
  l7 = (): number => this.getApplicableRate()

  /**
   * Line 8 - Gross county tax
   */
  l8 = (): number => Math.round(this.l6() * this.l7())

  /**
   * Part 3 - Credits
   */

  /**
   * Line 9 - Unified tax credit
   * Indiana provides a base credit
   */
  l9 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    if (status === FilingStatus.MFJ) {
      return parameters.credits.unifiedTaxCredit.joint
    }
    return parameters.credits.unifiedTaxCredit.single
  }

  /**
   * Line 10 - Net county tax after credit
   */
  l10 = (): number => Math.max(0, this.l8() - this.l9())

  /**
   * Part 4 - Payments
   */

  /**
   * Line 11 - County tax withheld
   */
  l11 = (): number => {
    return this.localTaxInfo?.localWithholding ?? 0
  }

  /**
   * Line 12 - Estimated tax payments
   */
  l12 = (): number => {
    return this.localTaxInfo?.estimatedPayments ?? 0
  }

  /**
   * Line 13 - Total payments
   */
  l13 = (): number => sumFields([this.l11(), this.l12()])

  /**
   * Line 14 - Tax due or overpayment
   */
  l14 = (): number => this.l10() - this.l13()

  /**
   * Amount owed
   */
  amountOwed = (): number => Math.max(0, this.l14())

  /**
   * Refund amount
   */
  refund = (): number => Math.max(0, -this.l14())

  /**
   * Payment due
   */
  payment = (): number | undefined => {
    const due = this.amountOwed()
    return due > 0 ? due : undefined
  }

  /**
   * Get county code for IN filing
   */
  getCountyCode = (): string => {
    return parameters.indianaLocalTaxSystem.countyCode
  }

  /**
   * Get residency status for form
   */
  getResidencyStatus = (): 'Marion County Resident' | 'Non-Resident' => {
    if (this.isMarionCountyResident()) {
      return 'Marion County Resident'
    }
    return 'Non-Resident'
  }

  /**
   * Calculate estimated tax needed for next year
   * Based on current year liability
   */
  estimatedTaxNeeded = (): number => {
    // If this year's tax was significant, may need estimated payments
    const thisTaxOwed = this.amountOwed()
    if (thisTaxOwed > 1000) {
      // Recommend quarterly estimated payments
      return Math.ceil(thisTaxOwed / 4)
    }
    return 0
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isMarionCountyResident(),
    this.getCountyCode(),
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
    this.amountOwed(),
    this.refund()
  ]
}

const makeMarionCountyTax = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): MarionCountyTax => new MarionCountyTax(f1040, localTaxInfo)

export default makeMarionCountyTax
