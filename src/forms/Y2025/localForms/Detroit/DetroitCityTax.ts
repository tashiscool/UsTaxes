import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { MI1040 } from '../../stateForms/MI/MI1040'

/**
 * Detroit City Income Tax Form (D-1040)
 *
 * Detroit imposes a city income tax on:
 * - Residents: 2.4% on all taxable income
 * - Non-residents: 1.2% on income earned in Detroit
 *
 * Key features:
 * - Based on Michigan taxable income with adjustments
 * - Credits for taxes paid to other Michigan cities
 * - Renaissance Zone exemptions available
 * - Integration with MI-1040 state return
 *
 * Taxable income includes:
 * - Wages, salaries, tips
 * - Business income
 * - Partnership/S-Corp income
 * - (Excludes Social Security, unemployment)
 */
export class DetroitCityTax extends Form {
  info: ValidatedInformation
  f1040: F1040
  miForm: MI1040
  localTaxInfo?: LocalTaxInfo
  formName: string
  state: State
  formOrder = 10
  methods: FormMethods

  constructor(f1040: F1040, miForm: MI1040, localTaxInfo?: LocalTaxInfo) {
    super()
    this.info = f1040.info
    this.f1040 = f1040
    this.miForm = miForm
    this.localTaxInfo = localTaxInfo
    this.formName = 'D-1040'
    this.state = 'MI'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Detroit city tax applies
   */
  isNeeded = (): boolean => {
    return this.isDetroitResident() || this.worksInDetroit()
  }

  /**
   * Check if taxpayer is a Detroit resident
   */
  isDetroitResident = (): boolean => {
    const city = this.localTaxInfo?.residenceCity?.toLowerCase()
    return city === 'detroit' || city === 'det'
  }

  /**
   * Check if taxpayer works in Detroit
   */
  worksInDetroit = (): boolean => {
    const city = this.localTaxInfo?.workCity?.toLowerCase()
    return city === 'detroit' || city === 'det'
  }

  /**
   * Check if in Renaissance Zone
   */
  isInRenaissanceZone = (): boolean => {
    // Would need additional data field to track zone status
    // For now, return false unless explicitly marked
    return false
  }

  /**
   * Get Renaissance Zone exemption percentage
   */
  getRenaissanceZoneExemption = (): number => {
    if (!this.isInRenaissanceZone()) return 0
    // Business income gets full exemption, residential partial
    return parameters.renaissanceZone.residentialExemptionPercent
  }

  /**
   * Get applicable tax rate based on residency
   */
  getApplicableRate = (): number => {
    if (this.isDetroitResident()) {
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
   * Part 1 - Income Subject to Detroit City Tax
   */

  /**
   * Line 1 - Wages subject to Detroit tax
   * Residents: all wages
   * Non-residents: only wages earned in Detroit
   */
  l1 = (): number => {
    const w2s = this.info.w2s

    if (this.isDetroitResident()) {
      // Residents pay on all wages
      return w2s.reduce((sum, w2) => sum + w2.income, 0)
    } else {
      // Non-residents only pay on wages earned in Detroit
      return w2s
        .filter((w2) => {
          const city = w2.employer?.address?.city.toLowerCase()
          return city === 'detroit' || city === 'det'
        })
        .reduce((sum, w2) => sum + w2.income, 0)
    }
  }

  /**
   * Line 2 - Business income subject to Detroit tax
   */
  l2 = (): number => {
    const scheduleC = this.f1040.scheduleC
    if (!scheduleC?.isNeeded()) return 0

    const netProfit = this.f1040.schedule1.l3() ?? 0

    if (this.isDetroitResident()) {
      // Residents taxed on all business income
      return Math.max(0, netProfit)
    } else {
      // Non-residents only taxed on Detroit-sourced business income
      // Simplified: assume all if work city is Detroit
      if (this.worksInDetroit()) {
        return Math.max(0, netProfit)
      }
      return 0
    }
  }

  /**
   * Line 3 - Partnership/S-Corp income
   */
  l3 = (): number => {
    const k1Income = this.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + k1.ordinaryBusinessIncome,
      0
    )
    // For residents, all is taxable; for non-residents, only Detroit-sourced
    if (this.isDetroitResident()) {
      return Math.max(0, k1Income)
    }
    return 0 // Simplified: would need Detroit source allocation
  }

  /**
   * Line 4 - Other taxable income (interest, dividends if business related)
   */
  l4 = (): number => {
    // Generally, interest and dividends are not taxable for individuals
    // Only included if from business activities
    return 0
  }

  /**
   * Line 5 - Total income before exemptions
   */
  l5 = (): number => sumFields([this.l1(), this.l2(), this.l3(), this.l4()])

  /**
   * Line 6 - Renaissance Zone exemption
   */
  l6 = (): number => {
    if (!this.isInRenaissanceZone()) return 0
    return Math.round(this.l5() * this.getRenaissanceZoneExemption())
  }

  /**
   * Line 7 - Total taxable income
   */
  l7 = (): number => Math.max(0, this.l5() - this.l6())

  /**
   * Part 2 - Tax Calculation
   */

  /**
   * Line 8 - Tax rate
   */
  l8 = (): number => this.getApplicableRate()

  /**
   * Line 9 - Gross Detroit city tax
   */
  l9 = (): number => Math.round(this.l7() * this.l8())

  /**
   * Part 3 - Credits
   */

  /**
   * Line 10 - Credit for taxes paid to other Michigan cities
   * Detroit residents who work in another Michigan city
   * can claim credit for city taxes paid there
   */
  l10 = (): number => {
    if (!this.isDetroitResident()) {
      // Non-residents don't get this credit
      return 0
    }

    // Get taxes paid to other Michigan cities
    const otherCityTax = this.localTaxInfo?.otherMunicipalTaxPaid ?? 0
    if (otherCityTax === 0) return 0

    // Credit limited to Detroit's rate on the income
    const workCityWages = this.localTaxInfo?.workCityWithholding ?? 0

    // Max credit is the lesser of:
    // 1. Actual tax paid to other city
    // 2. Detroit's rate on the wages taxed by other city
    const maxCredit = Math.round(
      ((this.localTaxInfo?.workCityWithholding ?? 0) /
        (parameters.credits.otherCityTaxCredit.nonResidentMaxCreditRate ||
          0.01)) *
        parameters.credits.otherCityTaxCredit.maxCreditRate
    )

    return Math.min(otherCityTax, maxCredit, this.l9())
  }

  /**
   * Line 11 - Total credits
   */
  l11 = (): number => this.l10()

  /**
   * Line 12 - Detroit tax after credits
   */
  l12 = (): number => Math.max(0, this.l9() - this.l11())

  /**
   * Part 4 - Payments and Amount Due
   */

  /**
   * Line 13 - Detroit city tax withheld
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
   * Check if filing is required based on income threshold
   */
  isFilingRequired = (): boolean => {
    return this.l5() >= parameters.exemptions.filingThreshold
  }

  /**
   * Get residency status for form
   */
  getResidencyStatus = (): 'Resident' | 'Non-Resident' | 'Part-Year' => {
    if (this.isDetroitResident()) {
      return 'Resident'
    }
    return 'Non-Resident'
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isDetroitResident(),
    !this.isDetroitResident(),
    this.isInRenaissanceZone(),
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
    this.refund()
  ]
}

const makeDetroitCityTax = (
  f1040: F1040,
  miForm: MI1040,
  localTaxInfo?: LocalTaxInfo
): DetroitCityTax => new DetroitCityTax(f1040, miForm, localTaxInfo)

export default makeDetroitCityTax
