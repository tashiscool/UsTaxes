import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Ohio Municipal Income Tax Form
 *
 * Ohio has a unique system where municipalities (cities and villages) can
 * levy their own income tax on wages, salaries, and net profits from business.
 *
 * Key features:
 * - Tax rates vary by municipality (typically 1% to 3%)
 * - Credit available for taxes paid to work city
 * - RITA (Regional Income Tax Agency) administers for 300+ cities
 * - CCA (Central Collection Agency) administers for Cleveland area
 *
 * This form handles:
 * - Residence city tax calculation
 * - Work city tax calculation
 * - Credit for taxes paid to other municipalities
 * - Net profits tax for self-employed
 */
export class OhioMunicipalTax extends Form {
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
    this.formName = 'OHIO-MUNI-TAX'
    this.state = 'OH'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Ohio municipal tax applies
   */
  isNeeded = (): boolean => {
    const stateResidency = this.info.stateResidencies.find(
      (s) => s.state === 'OH'
    )
    return (
      stateResidency !== undefined &&
      (this.localTaxInfo?.residenceCity !== undefined ||
        this.localTaxInfo?.workCity !== undefined)
    )
  }

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  /**
   * Get city tax rate
   */
  getCityRate = (cityName: string | undefined): number => {
    if (!cityName) return 0

    // Normalize city name for lookup
    const normalizedName = cityName.replace(/\s+/g, '_')
    const cityInfo =
      parameters.cityRates[normalizedName as keyof typeof parameters.cityRates]

    if (cityInfo) {
      return cityInfo.rate
    }

    // Default rate for unknown cities
    return parameters.cityRates.default.rate
  }

  /**
   * Get city credit rate (percentage of credit allowed)
   */
  getCityCreditRate = (cityName: string | undefined): number => {
    if (!cityName) return 1.0

    const normalizedName = cityName.replace(/\s+/g, '_')
    const cityInfo =
      parameters.cityRates[normalizedName as keyof typeof parameters.cityRates]

    if (cityInfo) {
      return cityInfo.creditRate
    }

    return parameters.cityRates.default.creditRate
  }

  /**
   * Part 1 - Residence City Information
   */

  /**
   * Line 1 - Residence City Name
   */
  residenceCity = (): string | undefined => this.localTaxInfo?.residenceCity

  /**
   * Line 2 - Residence City Tax Rate
   */
  residenceCityRate = (): number => this.getCityRate(this.residenceCity())

  /**
   * Part 2 - Work City Information
   */

  /**
   * Line 3 - Work City Name
   */
  workCity = (): string | undefined => this.localTaxInfo?.workCity

  /**
   * Line 4 - Work City Tax Rate
   */
  workCityRate = (): number => this.getCityRate(this.workCity())

  /**
   * Part 3 - Income Subject to Municipal Tax
   */

  /**
   * Line 5 - Qualifying Wages (W-2 income from Ohio employers)
   */
  l5 = (): number => {
    return this.info.w2s
      .filter((w2) => w2.state === 'OH')
      .reduce((sum, w2) => sum + w2.income, 0)
  }

  /**
   * Line 6 - Net Profits from self-employment
   * Schedule C net profit allocated to Ohio
   */
  l6 = (): number => {
    const scheduleC = this.f1040.scheduleC
    if (!scheduleC?.isNeeded()) return 0

    // For Ohio residents, all SE income is subject to municipal tax
    // For non-residents, only SE income from Ohio business locations
    return Math.max(0, this.f1040.schedule1.l3() ?? 0)
  }

  /**
   * Line 7 - Partnership/S-Corp income allocated to Ohio
   */
  l7 = (): number => {
    // K-1 income from Ohio partnerships/S-Corps
    return this.info.scheduleK1Form1065s
      .filter(() => true) // Simplified - would need to check if OH source
      .reduce((sum, k1) => sum + k1.ordinaryBusinessIncome, 0)
  }

  /**
   * Line 8 - Total Ohio Municipal Taxable Income
   */
  l8 = (): number => sumFields([this.l5(), this.l6(), this.l7()])

  /**
   * Part 4 - Work City Tax Calculation
   */

  /**
   * Line 9 - Wages earned in work city
   */
  l9 = (): number => {
    // Wages earned in the work city
    // If work city differs from residence city, allocate wages
    if (this.workCity() === this.residenceCity()) {
      return 0 // No separate work city calculation needed
    }

    // Allocate based on W-2s with matching employer location
    // Simplified: assume all wages are from work city
    return this.l5()
  }

  /**
   * Line 10 - Work City Tax (before credit)
   */
  l10 = (): number => Math.round(this.l9() * this.workCityRate())

  /**
   * Line 11 - Work City Tax Withheld
   */
  l11 = (): number => {
    // Tax withheld by employer for work city
    return this.localTaxInfo?.workCityWithholding ?? 0
  }

  /**
   * Part 5 - Residence City Tax Calculation
   */

  /**
   * Line 12 - Income subject to residence city tax
   */
  l12 = (): number => this.l8()

  /**
   * Line 13 - Gross Residence City Tax
   */
  l13 = (): number => Math.round(this.l12() * this.residenceCityRate())

  /**
   * Line 14 - Credit for taxes paid to work city
   * Ohio law allows a credit, but it may be limited
   */
  l14 = (): number => {
    if (this.workCity() === this.residenceCity()) {
      return 0 // Same city, no credit needed
    }

    // Credit is limited to:
    // 1. Actual tax paid to work city
    // 2. Residence city credit rate applied to residence rate
    const workCityTax = this.l10()
    const residenceRate = this.residenceCityRate()
    const creditRate = this.getCityCreditRate(this.residenceCity())

    // Maximum credit based on residence city's credit policy
    const maxCredit = Math.round(this.l9() * residenceRate * creditRate)

    return Math.min(workCityTax, maxCredit)
  }

  /**
   * Line 15 - Residence City Tax after credit
   */
  l15 = (): number => Math.max(0, this.l13() - this.l14())

  /**
   * Line 16 - Residence City Tax Withheld
   */
  l16 = (): number => {
    return this.localTaxInfo?.localWithholding ?? 0
  }

  /**
   * Part 6 - Total Tax and Payments
   */

  /**
   * Line 17 - Total Municipal Tax Due
   * (Work city tax + Residence city tax after credit)
   */
  l17 = (): number => {
    // If work city = residence city, just use residence calculation
    if (this.workCity() === this.residenceCity()) {
      return this.l13()
    }

    // Otherwise, both cities may have tax due
    // Work city: any difference between tax and withholding
    // Residence city: tax after credit
    return sumFields([Math.max(0, this.l10() - this.l11()), this.l15()])
  }

  /**
   * Line 18 - Total Withholding
   */
  l18 = (): number => sumFields([this.l11(), this.l16()])

  /**
   * Line 19 - Estimated Payments
   */
  l19 = (): number => this.localTaxInfo?.estimatedPayments ?? 0

  /**
   * Line 20 - Total Payments
   */
  l20 = (): number => sumFields([this.l18(), this.l19()])

  /**
   * Line 21 - Tax Due or Overpayment
   */
  l21 = (): number => this.l17() - this.l20()

  /**
   * Summary calculations
   */

  /**
   * Amount owed to all municipalities
   */
  amountOwed = (): number => Math.max(0, this.l21())

  /**
   * Refund from all municipalities
   */
  refund = (): number => Math.max(0, -this.l21())

  /**
   * Payment due
   */
  payment = (): number | undefined => {
    const due = this.amountOwed()
    return due > 0 ? due : undefined
  }

  /**
   * Determine which collection agency to file with
   */
  getCollectionAgency = (): 'RITA' | 'CCA' | 'Direct' => {
    const city = this.residenceCity()
    if (!city) return 'Direct'

    // Check if CCA city
    if (parameters.cca.memberCities.includes(city.replace(/\s+/g, '_'))) {
      return 'CCA'
    }

    // Default to RITA for most Ohio cities
    return 'RITA'
  }

  /**
   * Get breakdown by city for detailed reporting
   */
  getTaxBreakdown = (): {
    residenceCity: {
      name: string
      rate: number
      tax: number
      withholding: number
      due: number
    }
    workCity?: {
      name: string
      rate: number
      tax: number
      withholding: number
      due: number
    }
  } => {
    const result: ReturnType<typeof this.getTaxBreakdown> = {
      residenceCity: {
        name: this.residenceCity() ?? 'Unknown',
        rate: this.residenceCityRate(),
        tax: this.l15(),
        withholding: this.l16(),
        due: Math.max(0, this.l15() - this.l16())
      }
    }

    if (this.workCity() && this.workCity() !== this.residenceCity()) {
      result.workCity = {
        name: this.workCity() ?? 'Unknown',
        rate: this.workCityRate(),
        tax: this.l10(),
        withholding: this.l11(),
        due: Math.max(0, this.l10() - this.l11())
      }
    }

    return result
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.residenceCity(),
    this.residenceCityRate(),
    this.workCity(),
    this.workCityRate(),
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
    this.amountOwed(),
    this.refund(),
    this.getCollectionAgency()
  ]
}

const makeOhioMunicipalTax = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): OhioMunicipalTax => new OhioMunicipalTax(f1040, localTaxInfo)

export default makeOhioMunicipalTax
