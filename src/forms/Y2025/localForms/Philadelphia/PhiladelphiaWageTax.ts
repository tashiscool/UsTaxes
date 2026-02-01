/* eslint-disable @typescript-eslint/no-unused-vars */
import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import {
  FilingStatus,
  State,
  LocalTaxInfo,
  PersonRole
} from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Philadelphia Wage Tax Form
 *
 * This form calculates the Philadelphia wage tax and net profits tax.
 *
 * Key features:
 * - Residents pay 3.75% on all wages (regardless of work location)
 * - Non-residents pay 3.44% on wages earned in Philadelphia
 * - Self-employed pay Net Profits Tax (NPT) on business income
 * - Credits available for taxes paid to other municipalities
 *
 * The wage tax applies to:
 * - Salaries and wages
 * - Commissions
 * - Bonuses
 * - Tips
 * - Overtime pay
 * - Sick pay
 * - Holiday pay
 * - Vacation pay
 */
export class PhiladelphiaWageTax extends Form {
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
    this.formName = 'PHL-WAGE-TAX'
    this.state = 'PA'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  /**
   * Check if Philadelphia wage tax applies
   */
  isNeeded = (): boolean => {
    const isResident = this.isPhiladelphiaResident()
    const worksInPhilly = this.worksInPhiladelphia()
    return isResident || worksInPhilly
  }

  /**
   * Check if taxpayer is a Philadelphia resident
   */
  isPhiladelphiaResident = (): boolean => {
    return (
      this.localTaxInfo?.residenceCity === 'Philadelphia' ||
      this.localTaxInfo?.residenceCity === 'PHL'
    )
  }

  /**
   * Check if taxpayer works in Philadelphia
   */
  worksInPhiladelphia = (): boolean => {
    return (
      this.localTaxInfo?.workCity === 'Philadelphia' ||
      this.localTaxInfo?.workCity === 'PHL'
    )
  }

  /**
   * Get applicable tax rate based on residency
   */
  getApplicableRate = (): number => {
    if (this.isPhiladelphiaResident()) {
      return parameters.wageTax.resident
    }
    return parameters.wageTax.nonResident
  }

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  /**
   * Part 1 - Wage Tax Calculation
   */

  /**
   * Line 1 - Total Wages Subject to Philadelphia Wage Tax
   * For residents: all wages
   * For non-residents: only wages earned in Philadelphia
   */
  l1 = (): number => {
    const w2s = this.info.w2s

    if (this.isPhiladelphiaResident()) {
      // Residents pay on all wages
      return w2s.reduce((sum, w2) => sum + w2.income, 0)
    } else {
      // Non-residents only pay on wages earned in Philadelphia
      return w2s
        .filter((w2) => {
          // Check if employer is in Philadelphia
          const city = w2.employer?.address?.city.toLowerCase()
          return city === 'philadelphia' || city === 'phila' || city === 'phl'
        })
        .reduce((sum, w2) => sum + w2.income, 0)
    }
  }

  /**
   * Line 2 - Wage Tax Rate
   */
  l2 = (): number => this.getApplicableRate()

  /**
   * Line 3 - Gross Wage Tax
   */
  l3 = (): number => Math.round(this.l1() * this.l2())

  /**
   * Part 2 - Net Profits Tax (for self-employed)
   */

  /**
   * Line 4 - Net Profits from self-employment
   * From Schedule C, Schedule K-1, etc.
   */
  l4 = (): number => {
    // Get Schedule C net profit
    const scheduleC = this.f1040.scheduleC
    let netProfit = 0

    if (scheduleC?.isNeeded()) {
      netProfit = this.f1040.schedule1.l3() ?? 0
    }

    // For non-residents, only include profits from Philadelphia-based business
    if (!this.isPhiladelphiaResident()) {
      // Simplified: assume all SE income is from Philadelphia if work city is Philadelphia
      if (!this.worksInPhiladelphia()) {
        return 0
      }
    }

    return Math.max(0, netProfit)
  }

  /**
   * Line 5 - Net Profits Tax Rate
   */
  l5 = (): number => {
    if (this.isPhiladelphiaResident()) {
      return parameters.netProfitsTax.resident
    }
    return parameters.netProfitsTax.nonResident
  }

  /**
   * Line 6 - Net Profits Tax
   */
  l6 = (): number => Math.round(this.l4() * this.l5())

  /**
   * Part 3 - Credits and Payments
   */

  /**
   * Line 7 - Credit for taxes paid to other municipalities
   * Philadelphia provides a credit for local taxes paid to other PA municipalities
   */
  l7 = (): number => {
    if (!this.isPhiladelphiaResident()) {
      // Non-residents don't get this credit
      return 0
    }

    // Credit limited to max rate
    const otherMuniTax = this.localTaxInfo?.otherMunicipalTaxPaid ?? 0
    const maxCredit =
      this.l1() * parameters.credits.otherMunicipalityTaxCredit.maxCreditRate

    return Math.min(otherMuniTax, maxCredit)
  }

  /**
   * Line 8 - Total Philadelphia tax before withholding
   */
  l8 = (): number => Math.max(0, this.l3() + this.l6() - this.l7())

  /**
   * Line 9 - Philadelphia wage tax withheld
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
   * Part 4 - Low Income Exemption Check
   */

  /**
   * Check if eligible for low-income (poverty) exemption
   */
  isLowIncomeExempt = (): boolean => {
    const agi = this.f1040.l11()
    const status = this.filingStatus() ?? FilingStatus.S
    const exemptions = parameters.exemptions.povertyExemption
    const numDependents = this.info.taxPayer.dependents.length

    let threshold = exemptions.singleNoDependent

    switch (status) {
      case FilingStatus.S:
        threshold = exemptions.singleNoDependent
        break
      case FilingStatus.MFJ:
      case FilingStatus.MFS:
        threshold = exemptions.married
        break
      case FilingStatus.HOH:
        threshold = exemptions.headOfHousehold
        break
      case FilingStatus.W:
        threshold = exemptions.married
        break
    }

    threshold += numDependents * exemptions.perAdditionalDependent

    return agi <= threshold
  }

  /**
   * Amount owed (after considering exemptions)
   */
  amountOwed = (): number => {
    if (this.isLowIncomeExempt()) {
      return 0
    }
    return Math.max(0, this.l12())
  }

  /**
   * Refund amount
   */
  refund = (): number => {
    if (this.isLowIncomeExempt()) {
      // If exempt, all withholding is refunded
      return this.l11()
    }
    return Math.max(0, -this.l12())
  }

  /**
   * Payment due
   */
  payment = (): number | undefined => {
    const due = this.amountOwed()
    return due > 0 ? due : undefined
  }

  /**
   * Local Services Tax (LST) - small additional tax
   */
  localServicesTax = (): number => {
    const totalWages = this.l1()

    if (totalWages < parameters.localServicesTax.incomeThreshold) {
      return 0
    }

    return parameters.localServicesTax.annualAmount
  }

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.isPhiladelphiaResident(),
    !this.isPhiladelphiaResident(),
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
    this.refund(),
    this.localServicesTax()
  ]
}

const makePhiladelphiaWageTax = (
  f1040: F1040,
  localTaxInfo?: LocalTaxInfo
): PhiladelphiaWageTax => new PhiladelphiaWageTax(f1040, localTaxInfo)

export default makePhiladelphiaWageTax
