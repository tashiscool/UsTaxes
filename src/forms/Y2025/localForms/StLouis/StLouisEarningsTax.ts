import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * St. Louis Earnings Tax Form (E-5)
 *
 * St. Louis City imposes a 1% earnings tax on:
 * - All residents (on all earnings)
 * - All non-residents who work in St. Louis City
 *
 * Key features:
 * - Flat 1% rate
 * - No reciprocal credits with other cities
 * - Applies to wages, salaries, commissions, bonuses, tips
 * - Self-employed pay on net profits
 *
 * Note: This is for St. Louis CITY, not County.
 */
export class StLouisEarningsTax extends Form {
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
    this.formName = 'STL-E5'
    this.state = 'MO'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if St. Louis earnings tax applies
   */
  isNeeded = (): boolean => {
    return this.isStLouisResident() || this.worksInStLouis()
  }

  /**
   * Check if taxpayer is a St. Louis City resident
   */
  isStLouisResident = (): boolean => {
    const city = this.localTaxInfo?.residenceCity?.toLowerCase()
    return (
      city === 'st. louis' ||
      city === 'st louis' ||
      city === 'saint louis' ||
      city === 'stl'
    )
  }

  /**
   * Check if taxpayer works in St. Louis City
   */
  worksInStLouis = (): boolean => {
    const city = this.localTaxInfo?.workCity?.toLowerCase()
    return (
      city === 'st. louis' ||
      city === 'st louis' ||
      city === 'saint louis' ||
      city === 'stl'
    )
  }

  /**
   * Get applicable tax rate (same for all)
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
   * Part 1 - Wages and Salaries
   */

  /**
   * Line 1 - Total wages subject to St. Louis earnings tax
   * Residents: all wages
   * Non-residents: only wages earned in St. Louis
   */
  l1 = (): number => {
    const w2s = this.info.w2s

    if (this.isStLouisResident()) {
      // Residents pay on all wages
      return w2s.reduce((sum, w2) => sum + w2.income, 0)
    } else {
      // Non-residents only pay on wages earned in St. Louis
      return w2s
        .filter((w2) => {
          const city = w2.employer?.address?.city.toLowerCase()
          return (
            city === 'st. louis' ||
            city === 'st louis' ||
            city === 'saint louis' ||
            city === 'stl'
          )
        })
        .reduce((sum, w2) => sum + w2.income, 0)
    }
  }

  /**
   * Line 2 - Commissions, bonuses, tips included in wages
   * (Already included in Line 1 from W-2, informational only)
   */
  l2 = (): number => 0 // Already included in l1

  /**
   * Part 2 - Self-Employment Income
   */

  /**
   * Line 3 - Net profits from self-employment
   * From Schedule C or business activities
   */
  l3 = (): number => {
    const scheduleC = this.f1040.scheduleC
    if (!scheduleC?.isNeeded()) return 0

    const netProfit = this.f1040.schedule1.l3() ?? 0

    if (this.isStLouisResident()) {
      // Residents taxed on all business income
      return Math.max(0, netProfit)
    } else {
      // Non-residents only taxed on St. Louis-sourced income
      if (this.worksInStLouis()) {
        return Math.max(0, netProfit)
      }
      return 0
    }
  }

  /**
   * Line 4 - Partnership/S-Corp distributive share
   */
  l4 = (): number => {
    if (!this.isStLouisResident() && !this.worksInStLouis()) {
      return 0
    }

    const k1Income = this.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + k1.ordinaryBusinessIncome,
      0
    )

    // For residents, all is taxable; for non-residents, only STL-sourced
    if (this.isStLouisResident()) {
      return Math.max(0, k1Income)
    }
    return 0 // Simplified: would need STL source allocation for non-residents
  }

  /**
   * Line 5 - Total self-employment income
   */
  l5 = (): number => sumFields([this.l3(), this.l4()])

  /**
   * Part 3 - Total Earnings and Tax Calculation
   */

  /**
   * Line 6 - Total earnings subject to tax
   */
  l6 = (): number => sumFields([this.l1(), this.l5()])

  /**
   * Line 7 - Earnings tax rate
   */
  l7 = (): number => this.getApplicableRate()

  /**
   * Line 8 - Gross earnings tax
   */
  l8 = (): number => Math.round(this.l6() * this.l7())

  /**
   * Part 4 - Payments and Amount Due
   */

  /**
   * Line 9 - St. Louis earnings tax withheld
   * From W-2 Box 19 (if St. Louis local tax)
   */
  l9 = (): number => {
    return this.localTaxInfo?.localWithholding ?? 0
  }

  /**
   * Line 10 - Estimated tax payments
   */
  l10 = (): number => {
    return this.localTaxInfo?.estimatedPayments ?? 0
  }

  /**
   * Line 11 - Total payments
   */
  l11 = (): number => sumFields([this.l9(), this.l10()])

  /**
   * Line 12 - Tax due or overpayment
   */
  l12 = (): number => this.l8() - this.l11()

  /**
   * Amount owed
   */
  amountOwed = (): number => Math.max(0, this.l12())

  /**
   * Refund amount
   */
  refund = (): number => Math.max(0, -this.l12())

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
  getResidencyStatus = (): 'City Resident' | 'Non-Resident' => {
    if (this.isStLouisResident()) {
      return 'City Resident'
    }
    return 'Non-Resident'
  }

  /**
   * Calculate penalty for late filing (if applicable)
   */
  calculateLatePenalty = (daysLate: number): number => {
    if (daysLate <= 0) return 0
    return Math.round(
      this.amountOwed() * parameters.penalties.lateFilingPenalty
    )
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isStLouisResident(),
    !this.isStLouisResident(),
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
    this.amountOwed(),
    this.refund()
  ]
}

const makeStLouisEarningsTax = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): StLouisEarningsTax => new StLouisEarningsTax(f1040, localTaxInfo)

export default makeStLouisEarningsTax
