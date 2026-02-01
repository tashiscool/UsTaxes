import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Pittsburgh Earned Income Tax (EIT) Form
 *
 * Pittsburgh imposes an Earned Income Tax on:
 * - Residents: 3.0% (1% city + 2% school district)
 * - Non-residents who work in Pittsburgh: 1.0%
 *
 * Key features:
 * - Part of Pennsylvania's local earned income tax system
 * - Administered by Jordan Tax Service
 * - Credit available for EIT paid to work municipality
 * - Applies to wages, salaries, and net profits
 *
 * Note: The resident rate includes both city (1%) and
 * Pittsburgh School District (2%) portions.
 */
export class PittsburghEIT extends Form {
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
    this.formName = 'PITTS-EIT'
    this.state = 'PA'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Pittsburgh EIT applies
   */
  isNeeded = (): boolean => {
    return this.isPittsburghResident() || this.worksInPittsburgh()
  }

  /**
   * Check if taxpayer is a Pittsburgh resident
   */
  isPittsburghResident = (): boolean => {
    const city = this.localTaxInfo?.residenceCity?.toLowerCase()
    return city === 'pittsburgh' || city === 'pgh' || city === 'pitt'
  }

  /**
   * Check if taxpayer works in Pittsburgh
   */
  worksInPittsburgh = (): boolean => {
    const city = this.localTaxInfo?.workCity?.toLowerCase()
    return city === 'pittsburgh' || city === 'pgh' || city === 'pitt'
  }

  /**
   * Get applicable tax rate based on residency
   */
  getApplicableRate = (): number => {
    if (this.isPittsburghResident()) {
      return parameters.taxRates.resident
    }
    return parameters.taxRates.nonResident
  }

  /**
   * Get city portion of rate
   */
  getCityRate = (): number => {
    if (this.isPittsburghResident()) {
      return parameters.taxRates.residentCity
    }
    return parameters.taxRates.nonResident
  }

  /**
   * Get school district portion of rate (residents only)
   */
  getSchoolDistrictRate = (): number => {
    if (this.isPittsburghResident()) {
      return parameters.taxRates.residentSchoolDistrict
    }
    return 0 // Non-residents don't pay school district tax
  }

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  /**
   * Part 1 - Earned Income
   */

  /**
   * Line 1 - Total wages, salaries, tips
   * Residents: all wages
   * Non-residents: only wages earned in Pittsburgh
   */
  l1 = (): number => {
    const w2s = this.info.w2s

    if (this.isPittsburghResident()) {
      // Residents pay on all wages
      return w2s.reduce((sum, w2) => sum + w2.income, 0)
    } else {
      // Non-residents only pay on wages earned in Pittsburgh
      return w2s
        .filter((w2) => {
          const city = w2.employer?.address?.city.toLowerCase()
          return city === 'pittsburgh' || city === 'pgh' || city === 'pitt'
        })
        .reduce((sum, w2) => sum + w2.income, 0)
    }
  }

  /**
   * Line 2 - Other taxable compensation
   * (Commissions, bonuses not in W-2)
   */
  l2 = (): number => 0 // Typically included in W-2

  /**
   * Line 3 - Net profits from self-employment
   */
  l3 = (): number => {
    const scheduleC = this.f1040.scheduleC
    if (!scheduleC?.isNeeded()) return 0

    const netProfit = this.f1040.schedule1.l3() ?? 0

    if (this.isPittsburghResident()) {
      return Math.max(0, netProfit)
    } else {
      // Non-residents only on Pittsburgh-sourced business income
      if (this.worksInPittsburgh()) {
        return Math.max(0, netProfit)
      }
      return 0
    }
  }

  /**
   * Line 4 - Partnership/S-Corp income
   */
  l4 = (): number => {
    if (!this.isPittsburghResident() && !this.worksInPittsburgh()) {
      return 0
    }

    const k1Income = this.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + k1.ordinaryBusinessIncome,
      0
    )

    if (this.isPittsburghResident()) {
      return Math.max(0, k1Income)
    }
    return 0 // Non-residents need Pittsburgh source allocation
  }

  /**
   * Line 5 - Total earned income
   */
  l5 = (): number => sumFields([this.l1(), this.l2(), this.l3(), this.l4()])

  /**
   * Part 2 - Tax Calculation
   */

  /**
   * Line 6 - City EIT rate
   */
  l6 = (): number => this.getCityRate()

  /**
   * Line 7 - City EIT
   */
  l7 = (): number => Math.round(this.l5() * this.l6())

  /**
   * Line 8 - School District EIT rate (residents only)
   */
  l8 = (): number => this.getSchoolDistrictRate()

  /**
   * Line 9 - School District EIT
   */
  l9 = (): number => Math.round(this.l5() * this.l8())

  /**
   * Line 10 - Total gross EIT
   */
  l10 = (): number => sumFields([this.l7(), this.l9()])

  /**
   * Part 3 - Credits
   */

  /**
   * Line 11 - Credit for EIT paid to work municipality
   * Pittsburgh residents who work elsewhere can claim credit
   */
  l11 = (): number => {
    if (!this.isPittsburghResident()) {
      return 0 // Non-residents don't get this credit
    }

    const workCityEIT = this.localTaxInfo?.workCityWithholding ?? 0
    if (workCityEIT === 0) return 0

    // Credit limited to Pittsburgh's total rate
    const maxCredit = Math.round(
      this.l5() * parameters.credits.workLocationCredit.maxCreditRate
    )

    return Math.min(workCityEIT, maxCredit, this.l10())
  }

  /**
   * Line 12 - Net EIT after credit
   */
  l12 = (): number => Math.max(0, this.l10() - this.l11())

  /**
   * Part 4 - Payments
   */

  /**
   * Line 13 - EIT withheld by employer
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
  getResidencyStatus = (): 'Pittsburgh Resident' | 'Non-Resident' => {
    if (this.isPittsburghResident()) {
      return 'Pittsburgh Resident'
    }
    return 'Non-Resident'
  }

  /**
   * Get PSD code for PA filing
   */
  getPSDCode = (): string => {
    return parameters.paEitSystem.psdCode
  }

  /**
   * Get breakdown of tax by component
   */
  getTaxBreakdown = (): {
    cityTax: number
    schoolDistrictTax: number
    totalTax: number
  } => {
    return {
      cityTax: this.l7(),
      schoolDistrictTax: this.l9(),
      totalTax: this.l10()
    }
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isPittsburghResident(),
    !this.isPittsburghResident(),
    this.getPSDCode(),
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

const makePittsburghEIT = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): PittsburghEIT => new PittsburghEIT(f1040, localTaxInfo)

export default makePittsburghEIT
