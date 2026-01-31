import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Baltimore City Income Tax
 *
 * Baltimore City imposes a local income tax as part of the Maryland
 * local income tax system. The tax is calculated on Maryland taxable
 * income and collected through the Maryland state return.
 *
 * Key features:
 * - Residents: 3.2% (highest local rate in Maryland)
 * - Non-residents who work in Baltimore: 1.75%
 * - Based on Maryland taxable income
 * - Collected with MD-502 state return
 *
 * Note: This form represents the Baltimore portion of Maryland local taxes.
 */
export class BaltimoreCityTax extends Form {
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
    this.formName = 'BALT-LOCAL'
    this.state = 'MD'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Baltimore city tax applies
   */
  isNeeded = (): boolean => {
    return this.isBaltimoreResident() || this.worksInBaltimore()
  }

  /**
   * Check if taxpayer is a Baltimore City resident
   */
  isBaltimoreResident = (): boolean => {
    const city = this.localTaxInfo?.residenceCity?.toLowerCase()
    return (
      city === 'baltimore' ||
      city === 'baltimore city' ||
      city === 'balt'
    )
  }

  /**
   * Check if taxpayer works in Baltimore City
   */
  worksInBaltimore = (): boolean => {
    const city = this.localTaxInfo?.workCity?.toLowerCase()
    return (
      city === 'baltimore' ||
      city === 'baltimore city' ||
      city === 'balt'
    )
  }

  /**
   * Get applicable tax rate based on residency
   */
  getApplicableRate = (): number => {
    if (this.isBaltimoreResident()) {
      return parameters.taxRates.resident
    }
    return parameters.taxRates.nonResident
  }

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  /**
   * Get Maryland standard deduction based on filing status
   */
  getStandardDeduction = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const deductions = parameters.exemptions.standardDeduction

    switch (status) {
      case FilingStatus.MFJ:
        return deductions.marriedFilingJointly
      case FilingStatus.MFS:
        return deductions.marriedFilingSeparately
      case FilingStatus.HOH:
        return deductions.headOfHousehold
      default:
        return deductions.single
    }
  }

  /**
   * Part 1 - Maryland Gross Income
   */

  /**
   * Line 1 - Federal adjusted gross income
   */
  l1 = (): number => this.f1040.l11()

  /**
   * Line 2 - Additions to income (Maryland-specific)
   * (Simplified - would need full MD form)
   */
  l2 = (): number => 0

  /**
   * Line 3 - Modified federal AGI
   */
  l3 = (): number => sumFields([this.l1(), this.l2()])

  /**
   * Line 4 - Subtractions from income
   * Social Security exempt, partial pension exemption, etc.
   */
  l4 = (): number => {
    // Social Security is exempt in Maryland
    const ssBenefits = this.f1040.l6b() ?? 0
    return ssBenefits
  }

  /**
   * Line 5 - Maryland adjusted gross income
   */
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  /**
   * Line 6 - Standard or itemized deduction
   */
  l6 = (): number => this.getStandardDeduction()

  /**
   * Line 7 - Maryland taxable income
   */
  l7 = (): number => Math.max(0, this.l5() - this.l6())

  /**
   * Part 2 - Local Tax Calculation
   */

  /**
   * Line 8 - Income subject to Baltimore local tax
   * For residents: all Maryland taxable income
   * For non-residents: Maryland source income only
   */
  l8 = (): number => {
    if (this.isBaltimoreResident()) {
      return this.l7()
    }

    // Non-residents: allocate based on wages earned in Baltimore
    const totalWages = this.info.w2s.reduce((sum, w2) => sum + w2.income, 0)
    if (totalWages === 0) return 0

    const baltimoreWages = this.info.w2s
      .filter((w2) => {
        const city = w2.employer?.address?.city?.toLowerCase()
        return (
          city === 'baltimore' ||
          city === 'baltimore city' ||
          city === 'balt'
        )
      })
      .reduce((sum, w2) => sum + w2.income, 0)

    // Allocate taxable income based on wage ratio
    const allocationRatio = baltimoreWages / totalWages
    return Math.round(this.l7() * allocationRatio)
  }

  /**
   * Line 9 - Baltimore local tax rate
   */
  l9 = (): number => this.getApplicableRate()

  /**
   * Line 10 - Gross Baltimore local tax
   */
  l10 = (): number => Math.round(this.l8() * this.l9())

  /**
   * Part 3 - Credits
   */

  /**
   * Line 11 - Credit for taxes paid to other localities
   * (For Baltimore residents who work in other jurisdictions)
   */
  l11 = (): number => {
    if (!this.isBaltimoreResident()) {
      return 0
    }

    const otherLocalTax = this.localTaxInfo?.otherMunicipalTaxPaid ?? 0
    const maxCredit = Math.round(
      this.l8() * parameters.credits.otherLocalityCredit.maxCreditRate
    )

    return Math.min(otherLocalTax, maxCredit)
  }

  /**
   * Line 12 - Net Baltimore local tax
   */
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  /**
   * Part 4 - Payments
   */

  /**
   * Line 13 - Local tax withheld
   * From W-2 Box 19
   */
  l13 = (): number => {
    return this.localTaxInfo?.localWithholding ?? 0
  }

  /**
   * Line 14 - Estimated tax payments
   */
  l14 = (): number => {
    return this.localTaxInfo?.estimatedPayments ?? 0
  }

  /**
   * Line 15 - Total payments
   */
  l15 = (): number => sumFields([this.l13(), this.l14()])

  /**
   * Line 16 - Tax due or overpayment
   */
  l16 = (): number => this.l12() - this.l15()

  /**
   * Amount owed
   */
  amountOwed = (): number => Math.max(0, this.l16())

  /**
   * Refund amount
   */
  refund = (): number => Math.max(0, -this.l16())

  /**
   * Payment due
   */
  payment = (): number | undefined => {
    const due = this.amountOwed()
    return due > 0 ? due : undefined
  }

  /**
   * Get residency status for form
   */
  getResidencyStatus = (): 'Baltimore Resident' | 'Non-Resident' => {
    if (this.isBaltimoreResident()) {
      return 'Baltimore Resident'
    }
    return 'Non-Resident'
  }

  /**
   * Get subdivision code for MD filing
   */
  getSubdivisionCode = (): string => {
    return parameters.marylandLocalTaxSystem.subdivisionCode
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isBaltimoreResident(),
    !this.isBaltimoreResident(),
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
    this.amountOwed(),
    this.refund(),
    this.getSubdivisionCode()
  ]
}

const makeBaltimoreCityTax = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): BaltimoreCityTax => new BaltimoreCityTax(f1040, localTaxInfo)

export default makeBaltimoreCityTax
