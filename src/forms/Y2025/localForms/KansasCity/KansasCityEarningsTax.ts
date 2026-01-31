import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FilingStatus, State, LocalTaxInfo } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Kansas City Earnings Tax Form (RD-109)
 *
 * Kansas City, MO imposes a 1% earnings tax on:
 * - All residents (on all earnings)
 * - All non-residents who work in Kansas City
 *
 * Key features:
 * - Flat 1% rate
 * - No reciprocal credits with other cities
 * - Applies to wages, salaries, commissions, bonuses, tips
 * - Self-employed pay on net profits
 *
 * The earnings tax is administered by the Kansas City Revenue Division.
 */
export class KansasCityEarningsTax extends Form {
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
    this.formName = 'KC-RD109'
    this.state = 'MO'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Kansas City earnings tax applies
   */
  isNeeded = (): boolean => {
    return this.isKansasCityResident() || this.worksInKansasCity()
  }

  /**
   * Check if taxpayer is a Kansas City resident
   */
  isKansasCityResident = (): boolean => {
    const city = this.localTaxInfo?.residenceCity?.toLowerCase()
    return (
      city === 'kansas city' ||
      city === 'kc' ||
      city === 'kcmo'
    )
  }

  /**
   * Check if taxpayer works in Kansas City
   */
  worksInKansasCity = (): boolean => {
    const city = this.localTaxInfo?.workCity?.toLowerCase()
    return (
      city === 'kansas city' ||
      city === 'kc' ||
      city === 'kcmo'
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
   * Part 1 - Wages and Compensation
   */

  /**
   * Line 1 - Total wages subject to Kansas City earnings tax
   * Residents: all wages
   * Non-residents: only wages earned in Kansas City
   */
  l1 = (): number => {
    const w2s = this.info.w2s

    if (this.isKansasCityResident()) {
      // Residents pay on all wages
      return w2s.reduce((sum, w2) => sum + w2.income, 0)
    } else {
      // Non-residents only pay on wages earned in Kansas City
      return w2s
        .filter((w2) => {
          const city = w2.employer?.address?.city?.toLowerCase()
          return (
            city === 'kansas city' ||
            city === 'kc' ||
            city === 'kcmo'
          )
        })
        .reduce((sum, w2) => sum + w2.income, 0)
    }
  }

  /**
   * Line 2 - Other taxable compensation
   * (Tips, bonuses, commissions not already in W-2)
   */
  l2 = (): number => 0 // Typically included in W-2

  /**
   * Line 3 - Total wages and compensation
   */
  l3 = (): number => sumFields([this.l1(), this.l2()])

  /**
   * Part 2 - Self-Employment and Business Income
   */

  /**
   * Line 4 - Net profits from self-employment
   */
  l4 = (): number => {
    const scheduleC = this.f1040.scheduleC
    if (!scheduleC?.isNeeded()) return 0

    const netProfit = this.f1040.schedule1.l3() ?? 0

    if (this.isKansasCityResident()) {
      // Residents taxed on all business income
      return Math.max(0, netProfit)
    } else {
      // Non-residents only taxed on KC-sourced income
      if (this.worksInKansasCity()) {
        return Math.max(0, netProfit)
      }
      return 0
    }
  }

  /**
   * Line 5 - Partnership/S-Corp income from KC businesses
   */
  l5 = (): number => {
    if (!this.isKansasCityResident() && !this.worksInKansasCity()) {
      return 0
    }

    const k1Income = this.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + k1.ordinaryBusinessIncome,
      0
    )

    if (this.isKansasCityResident()) {
      return Math.max(0, k1Income)
    }
    return 0 // Non-residents need KC source allocation
  }

  /**
   * Line 6 - Total business income
   */
  l6 = (): number => sumFields([this.l4(), this.l5()])

  /**
   * Part 3 - Total Earnings and Tax
   */

  /**
   * Line 7 - Total earnings subject to tax
   */
  l7 = (): number => sumFields([this.l3(), this.l6()])

  /**
   * Line 8 - Earnings tax rate
   */
  l8 = (): number => this.getApplicableRate()

  /**
   * Line 9 - Gross earnings tax
   */
  l9 = (): number => Math.round(this.l7() * this.l8())

  /**
   * Part 4 - Payments
   */

  /**
   * Line 10 - Kansas City earnings tax withheld
   */
  l10 = (): number => {
    return this.localTaxInfo?.localWithholding ?? 0
  }

  /**
   * Line 11 - Estimated tax payments
   */
  l11 = (): number => {
    return this.localTaxInfo?.estimatedPayments ?? 0
  }

  /**
   * Line 12 - Prior year overpayment applied
   */
  l12 = (): number => 0 // Would need prior year data

  /**
   * Line 13 - Total payments and credits
   */
  l13 = (): number => sumFields([this.l10(), this.l11(), this.l12()])

  /**
   * Line 14 - Tax due or overpayment
   */
  l14 = (): number => this.l9() - this.l13()

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
   * Get residency status for form
   */
  getResidencyStatus = (): 'KC Resident' | 'Non-Resident' => {
    if (this.isKansasCityResident()) {
      return 'KC Resident'
    }
    return 'Non-Resident'
  }

  /**
   * Calculate late filing penalty
   */
  calculateLatePenalty = (monthsLate: number): number => {
    if (monthsLate <= 0) return 0
    const penaltyRate = Math.min(
      monthsLate * parameters.penalties.lateFilingPenalty,
      parameters.penalties.lateFilingPenaltyMax
    )
    return Math.round(this.amountOwed() * penaltyRate)
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isKansasCityResident(),
    !this.isKansasCityResident(),
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

const makeKansasCityEarningsTax = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): KansasCityEarningsTax => new KansasCityEarningsTax(f1040, localTaxInfo)

export default makeKansasCityEarningsTax
