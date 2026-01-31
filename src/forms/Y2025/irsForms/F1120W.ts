import { CCorpForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  Form1120Data,
  Form1120WData,
  CorporateEstimatedPayment,
  PriorYearCorporateTax,
  AnnualizedIncomeMethod,
  SeasonalInstallmentMethod
} from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1120-W - Estimated Tax for Corporations
 *
 * Used by C-Corporations to calculate and pay estimated quarterly taxes.
 *
 * Key features:
 * - Calculates required estimated tax payments
 * - Provides safe harbor amounts (100% prior year or current year estimate)
 * - Handles large corporation adjustments ($1M+ in prior 3 years)
 * - Supports annualized income installment method
 * - Supports adjusted seasonal installment method
 *
 * Payment schedule for calendar year corporations:
 * - Q1: April 15 (25%)
 * - Q2: June 15 (25%)
 * - Q3: September 15 (25%)
 * - Q4: December 15 (25%)
 *
 * Safe harbor rules:
 * - Regular corporations: Lesser of 100% current year or 100% prior year
 * - Large corporations: Must use 100% current year (except Q1 can use prior year)
 *
 * 2025 Corporate Tax Rate: 21% flat rate
 *
 * Note: AMT for corporations was largely repealed by TCJA for tax years
 * beginning after December 31, 2017. Only certain insurance companies
 * and RICs may still be subject to AMT.
 */

// Re-export types for external use
export type {
  Form1120WData,
  CorporateEstimatedPayment,
  PriorYearCorporateTax,
  AnnualizedIncomeMethod,
  SeasonalInstallmentMethod
}

// Corporate tax rate for 2025
const CORPORATE_TAX_RATE = 0.21

// Large corporation threshold (taxable income in any of prior 3 years)
const LARGE_CORPORATION_THRESHOLD = 1000000

/**
 * Default annualization factors per IRS instructions
 */
const ANNUALIZATION_FACTORS = {
  period1: 4,       // 12/3 months
  period2: 2.4,     // 12/5 months
  period3: 1.5,     // 12/8 months
  period4: 1.09091  // 12/11 months
}

/**
 * Quarterly installment percentages (cumulative)
 */
const QUARTERLY_PERCENTAGES = {
  q1: 0.25,   // 25% of annual
  q2: 0.50,   // 50% of annual (cumulative)
  q3: 0.75,   // 75% of annual (cumulative)
  q4: 1.00    // 100% of annual (cumulative)
}

export default class F1120W extends CCorpForm {
  tag: FormTag = 'f1120w'
  sequenceIndex = 0  // Standalone form, not an attachment

  data: Form1120Data
  f1120WData: Form1120WData

  constructor(data: Form1120Data, f1120WData: Form1120WData) {
    super()
    this.data = data
    this.f1120WData = f1120WData
  }

  // =========================================================================
  // Part I - Estimated Tax Computation
  // =========================================================================

  /**
   * Line 1: Taxable income expected for the tax year
   * Enter the expected taxable income for the tax year
   */
  l1 = (): number => this.f1120WData.estimatedTaxableIncome

  /**
   * Line 2: Qualified personal service corporation tax OR regular tax
   * For regular C-Corps: 21% flat rate
   * For qualified personal service corporations: 21% flat rate (35% rate repealed)
   */
  l2 = (): number => {
    if (this.f1120WData.estimatedTax > 0) {
      return this.f1120WData.estimatedTax
    }
    return Math.round(Math.max(0, this.l1()) * CORPORATE_TAX_RATE)
  }

  /**
   * Line 3: Tax credits
   * Includes: Foreign tax credit, general business credit, etc.
   */
  l3 = (): number => this.f1120WData.estimatedCredits

  /**
   * Line 3a: Foreign tax credit (Form 1118)
   */
  l3a = (): number => this.data.foreignTaxCredit ?? 0

  /**
   * Line 3b: General business credit (Form 3800)
   */
  l3b = (): number => {
    const credits = this.data.generalBusinessCredits ?? {}
    return Object.values(credits).reduce<number>((sum, c) => sum + (c ?? 0), 0)
  }

  /**
   * Line 3c: Credit for prior year minimum tax (Form 8827)
   * Note: Most corporations no longer subject to AMT after TCJA
   */
  l3c = (): number => this.data.priorYearMinimumTax ?? 0

  /**
   * Line 3d: Other credits
   */
  l3d = (): number => {
    // Calculate other credits not included in 3a-3c
    const total = this.l3()
    const specified = sumFields([this.l3a(), this.l3b(), this.l3c()])
    return Math.max(0, total - specified)
  }

  /**
   * Line 4: Subtract line 3 from line 2 (tax after credits)
   */
  l4 = (): number => Math.max(0, this.l2() - this.l3())

  /**
   * Line 5: Recapture taxes
   * Includes: Investment credit recapture, low-income housing credit recapture,
   * Indian employment credit recapture, new markets credit recapture, etc.
   */
  l5 = (): number => this.f1120WData.recaptureTaxes

  /**
   * Line 6: Alternative minimum tax (if applicable)
   *
   * Note: Corporate AMT was repealed by TCJA for tax years beginning after
   * December 31, 2017. However, it may still apply to:
   * - Certain insurance companies
   * - Regulated investment companies (RICs)
   *
   * For most C-Corporations, this will be 0.
   */
  l6 = (): number => {
    // AMT largely repealed for corporations
    // Only certain types may still be subject
    return 0
  }

  /**
   * Line 7: Total tax (add lines 4, 5, and 6)
   */
  l7 = (): number => sumFields([this.l4(), this.l5(), this.l6()])

  /**
   * Line 8: Refundable credits
   * Includes: Credit for federal tax on fuels (Form 4136),
   * refundable portion of research credit, etc.
   */
  l8 = (): number => this.f1120WData.refundableCredits

  /**
   * Line 9: Total tax less refundable credits
   * This is the estimated tax for the year
   */
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  /**
   * Line 10: Prior year's tax (for safe harbor calculation)
   * Enter the tax shown on the prior year's return
   */
  l10 = (): number => this.f1120WData.priorYearInfo?.totalTax ?? 0

  /**
   * Line 11: Required annual payment
   * For regular corporations: Lesser of 100% current year (line 9) or 100% prior year (line 10)
   * For large corporations: 100% current year (line 9)
   */
  l11 = (): number => {
    if (this.isLargeCorporation()) {
      // Large corporations must use current year estimate
      // (Exception: Q1 can use prior year safe harbor)
      return this.l9()
    }
    // Regular corporations: lesser of current or prior year
    return Math.min(this.l9(), this.l10())
  }

  // =========================================================================
  // Large Corporation Determination
  // =========================================================================

  /**
   * Determines if corporation is a "large corporation"
   *
   * A corporation is large if it had taxable income of $1 million or more
   * in any of the 3 prior tax years.
   *
   * Large corporations:
   * - Cannot use prior year safe harbor (except for Q1)
   * - Must make up any shortfall in subsequent quarters
   */
  isLargeCorporation = (): boolean => {
    const priorInfo = this.f1120WData.priorYearInfo
    if (!priorInfo) return false

    // Check if explicitly flagged as large corporation
    if (priorInfo.wasLargeCorporation) return true

    // Check prior 3 years taxable income
    const prior1 = priorInfo.priorYear1TaxableIncome ?? 0
    const prior2 = priorInfo.priorYear2TaxableIncome ?? 0
    const prior3 = priorInfo.priorYear3TaxableIncome ?? 0

    return prior1 >= LARGE_CORPORATION_THRESHOLD ||
           prior2 >= LARGE_CORPORATION_THRESHOLD ||
           prior3 >= LARGE_CORPORATION_THRESHOLD
  }

  // =========================================================================
  // Schedule A - Required Installments
  // =========================================================================

  /**
   * Calculate required installment for each quarter
   *
   * Regular method: 25% of required annual payment per quarter
   *
   * For large corporations:
   * - Q1: Can use 25% of prior year tax
   * - Q2-Q4: Must make up any Q1 shortfall
   */

  /**
   * Q1 Required Installment - Due April 15
   * 25% of required annual payment
   */
  scheduleAQ1 = (): number => {
    if (this.f1120WData.useAnnualizedIncomeMethod) {
      return this.annualizedInstallment(1)
    }
    if (this.f1120WData.useSeasonalInstallmentMethod) {
      return this.seasonalInstallment(1)
    }

    // Large corporations can use prior year for Q1 only
    if (this.isLargeCorporation()) {
      const priorYearQ1 = Math.round(this.l10() * QUARTERLY_PERCENTAGES.q1)
      return priorYearQ1
    }

    return Math.round(this.l11() * QUARTERLY_PERCENTAGES.q1)
  }

  /**
   * Q2 Required Installment - Due June 15
   * 25% of required annual payment
   * Large corporations: Must include any Q1 shortfall
   */
  scheduleAQ2 = (): number => {
    if (this.f1120WData.useAnnualizedIncomeMethod) {
      return this.annualizedInstallment(2)
    }
    if (this.f1120WData.useSeasonalInstallmentMethod) {
      return this.seasonalInstallment(2)
    }

    const baseInstallment = Math.round(this.l11() * QUARTERLY_PERCENTAGES.q1)

    // Large corporations: Make up Q1 shortfall if prior year was used
    if (this.isLargeCorporation()) {
      const q1Shortfall = Math.max(0, baseInstallment - this.scheduleAQ1())
      return baseInstallment + q1Shortfall
    }

    return baseInstallment
  }

  /**
   * Q3 Required Installment - Due September 15
   * 25% of required annual payment
   */
  scheduleAQ3 = (): number => {
    if (this.f1120WData.useAnnualizedIncomeMethod) {
      return this.annualizedInstallment(3)
    }
    if (this.f1120WData.useSeasonalInstallmentMethod) {
      return this.seasonalInstallment(3)
    }

    return Math.round(this.l11() * QUARTERLY_PERCENTAGES.q1)
  }

  /**
   * Q4 Required Installment - Due December 15
   * 25% of required annual payment (or remaining balance)
   */
  scheduleAQ4 = (): number => {
    if (this.f1120WData.useAnnualizedIncomeMethod) {
      return this.annualizedInstallment(4)
    }
    if (this.f1120WData.useSeasonalInstallmentMethod) {
      return this.seasonalInstallment(4)
    }

    // Q4 is the remainder to reach 100%
    const priorQuarters = sumFields([
      this.scheduleAQ1(),
      this.scheduleAQ2(),
      this.scheduleAQ3()
    ])
    return Math.max(0, this.l11() - priorQuarters)
  }

  /**
   * Total required annual installments
   */
  totalRequiredInstallments = (): number => {
    return sumFields([
      this.scheduleAQ1(),
      this.scheduleAQ2(),
      this.scheduleAQ3(),
      this.scheduleAQ4()
    ])
  }

  // =========================================================================
  // Annualized Income Installment Method (Schedule A, Part II)
  // =========================================================================

  /**
   * Calculate installment using annualized income method
   *
   * This method allows corporations with uneven income throughout the year
   * to base payments on actual income received during each period.
   *
   * Annualization periods:
   * - Q1: First 3 months (Jan-Mar), factor = 4
   * - Q2: First 5 months (Jan-May), factor = 2.4
   * - Q3: First 8 months (Jan-Aug), factor = 1.5
   * - Q4: First 11 months (Jan-Nov), factor = 1.09091
   */
  annualizedInstallment = (quarter: 1 | 2 | 3 | 4): number => {
    const annualizedData = this.f1120WData.annualizedIncomeData
    if (!annualizedData) {
      // Fall back to regular method
      return Math.round(this.l11() * QUARTERLY_PERCENTAGES.q1)
    }

    let periodIncome: number
    let factor: number

    switch (quarter) {
      case 1:
        periodIncome = annualizedData.period1Income
        factor = annualizedData.period1Factor || ANNUALIZATION_FACTORS.period1
        break
      case 2:
        periodIncome = annualizedData.period2Income
        factor = annualizedData.period2Factor || ANNUALIZATION_FACTORS.period2
        break
      case 3:
        periodIncome = annualizedData.period3Income
        factor = annualizedData.period3Factor || ANNUALIZATION_FACTORS.period3
        break
      case 4:
        periodIncome = annualizedData.period4Income
        factor = annualizedData.period4Factor || ANNUALIZATION_FACTORS.period4
        break
    }

    // Annualized income
    const annualizedIncome = periodIncome * factor

    // Tax on annualized income
    const annualizedTax = Math.round(annualizedIncome * CORPORATE_TAX_RATE)

    // Cumulative installment percentage
    const cumulativePercentage = quarter * 0.25

    // Required cumulative amount
    const cumulativeRequired = Math.round(annualizedTax * cumulativePercentage)

    // Prior installments
    let priorInstallments = 0
    for (let q = 1; q < quarter; q++) {
      priorInstallments += this.annualizedInstallment(q as 1 | 2 | 3 | 4)
    }

    // Current quarter installment
    return Math.max(0, cumulativeRequired - priorInstallments)
  }

  // =========================================================================
  // Adjusted Seasonal Installment Method (Schedule A, Part III)
  // =========================================================================

  /**
   * Calculate installment using adjusted seasonal method
   *
   * This method is for corporations with seasonal income patterns.
   * Uses average percentages from prior 3 years to determine
   * expected income distribution.
   */
  seasonalInstallment = (quarter: 1 | 2 | 3 | 4): number => {
    const seasonalData = this.f1120WData.seasonalInstallmentData
    if (!seasonalData) {
      // Fall back to regular method
      return Math.round(this.l11() * QUARTERLY_PERCENTAGES.q1)
    }

    let cumulativePercentage: number
    let incomeThroughPeriod: number

    switch (quarter) {
      case 1:
        cumulativePercentage = seasonalData.q1Percentage
        incomeThroughPeriod = seasonalData.incomeThroughQ1
        break
      case 2:
        cumulativePercentage = seasonalData.q1Percentage + seasonalData.q2Percentage
        incomeThroughPeriod = seasonalData.incomeThroughQ2
        break
      case 3:
        cumulativePercentage = seasonalData.q1Percentage + seasonalData.q2Percentage + seasonalData.q3Percentage
        incomeThroughPeriod = seasonalData.incomeThroughQ3
        break
      case 4:
        cumulativePercentage = 1.0 // 100%
        incomeThroughPeriod = seasonalData.incomeThroughQ4
        break
    }

    // Estimate annual income based on seasonal pattern
    const estimatedAnnualIncome = incomeThroughPeriod / cumulativePercentage

    // Tax on estimated annual income
    const estimatedAnnualTax = Math.round(estimatedAnnualIncome * CORPORATE_TAX_RATE)

    // Required cumulative amount
    const cumulativeRequired = Math.round(estimatedAnnualTax * cumulativePercentage)

    // Prior installments
    let priorInstallments = 0
    for (let q = 1; q < quarter; q++) {
      priorInstallments += this.seasonalInstallment(q as 1 | 2 | 3 | 4)
    }

    // Current quarter installment
    return Math.max(0, cumulativeRequired - priorInstallments)
  }

  // =========================================================================
  // Payment Tracking
  // =========================================================================

  /**
   * Get payment due dates for calendar year corporation
   */
  getPaymentDueDates = (): { q1: Date; q2: Date; q3: Date; q4: Date } => {
    const year = this.f1120WData.taxYear

    return {
      q1: new Date(year, 3, 15),   // April 15
      q2: new Date(year, 5, 15),   // June 15
      q3: new Date(year, 8, 15),   // September 15
      q4: new Date(year, 11, 15)   // December 15
    }
  }

  /**
   * Total payments made
   */
  totalPaymentsMade = (): number => {
    return this.f1120WData.payments.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0)
  }

  /**
   * Remaining balance due
   */
  remainingBalance = (): number => {
    return Math.max(0, this.l11() - this.totalPaymentsMade())
  }

  /**
   * Check if payment is sufficient for a quarter
   */
  isQuarterPaid = (quarter: 1 | 2 | 3 | 4): boolean => {
    const payment = this.f1120WData.payments.find(p => p.quarter === quarter)
    if (!payment || !payment.amountPaid) return false

    let requiredAmount: number
    switch (quarter) {
      case 1: requiredAmount = this.scheduleAQ1(); break
      case 2: requiredAmount = this.scheduleAQ2(); break
      case 3: requiredAmount = this.scheduleAQ3(); break
      case 4: requiredAmount = this.scheduleAQ4(); break
    }

    return payment.amountPaid >= requiredAmount
  }

  // =========================================================================
  // Underpayment Penalty Reference
  // =========================================================================

  /**
   * Check if underpayment penalty may apply
   *
   * Penalty applies if:
   * - Total payments are less than the lesser of:
   *   - 100% of prior year tax (not available for large corps after Q1)
   *   - 100% of current year tax
   * - Any quarterly installment was underpaid
   *
   * For actual penalty calculation, see Form 2220.
   */
  mayHaveUnderpaymentPenalty = (): boolean => {
    const totalRequired = this.l11()
    const totalPaid = this.totalPaymentsMade()

    // Check if total payments are insufficient
    if (totalPaid < totalRequired) {
      return true
    }

    // Check if any quarterly payment was late or short
    for (const quarter of [1, 2, 3, 4] as const) {
      if (!this.isQuarterPaid(quarter)) {
        return true
      }
    }

    return false
  }

  /**
   * Estimated underpayment amount
   * (Actual penalty calculation is done on Form 2220)
   */
  estimatedUnderpayment = (): number => {
    return Math.max(0, this.l11() - this.totalPaymentsMade())
  }

  // =========================================================================
  // Summary Methods
  // =========================================================================

  /**
   * Get estimated tax summary
   */
  getEstimatedTaxSummary = () => ({
    taxableIncome: this.l1(),
    taxBeforeCredits: this.l2(),
    credits: this.l3(),
    taxAfterCredits: this.l4(),
    recaptureTaxes: this.l5(),
    alternativeMinimumTax: this.l6(),
    totalTax: this.l7(),
    refundableCredits: this.l8(),
    estimatedTax: this.l9(),
    priorYearTax: this.l10(),
    requiredAnnualPayment: this.l11(),
    isLargeCorporation: this.isLargeCorporation()
  })

  /**
   * Get quarterly installment summary
   */
  getQuarterlyInstallments = () => {
    const dueDates = this.getPaymentDueDates()
    return {
      q1: { dueDate: dueDates.q1, amount: this.scheduleAQ1() },
      q2: { dueDate: dueDates.q2, amount: this.scheduleAQ2() },
      q3: { dueDate: dueDates.q3, amount: this.scheduleAQ3() },
      q4: { dueDate: dueDates.q4, amount: this.scheduleAQ4() },
      total: this.totalRequiredInstallments()
    }
  }

  // =========================================================================
  // PDF Fields
  // =========================================================================

  fields = (): Field[] => {
    const dueDates = this.getPaymentDueDates()
    const payments = this.f1120WData.payments

    return [
      // Header
      this.entityName(),
      this.ein(),
      this.address(),
      this.addressLine(),
      this.f1120WData.taxYear,

      // Part I - Estimated Tax Computation
      // Line 1: Taxable income
      this.l1(),
      // Line 2: Tax (21% rate)
      this.l2(),
      CORPORATE_TAX_RATE * 100, // Rate percentage
      // Line 3: Credits
      this.l3(),
      this.l3a(), // Foreign tax credit
      this.l3b(), // General business credit
      this.l3c(), // Prior year minimum tax credit
      this.l3d(), // Other credits
      // Line 4: Tax after credits
      this.l4(),
      // Line 5: Recapture taxes
      this.l5(),
      // Line 6: Alternative minimum tax
      this.l6(),
      // Line 7: Total tax
      this.l7(),
      // Line 8: Refundable credits
      this.l8(),
      // Line 9: Estimated tax for year
      this.l9(),
      // Line 10: Prior year tax
      this.l10(),
      // Line 11: Required annual payment
      this.l11(),

      // Large corporation indicator
      this.isLargeCorporation(),

      // Schedule A - Required Installments
      // Q1
      this.formatDate(dueDates.q1),
      this.scheduleAQ1(),
      payments.find(p => p.quarter === 1)?.amountPaid ?? 0,
      payments.find(p => p.quarter === 1)?.datePaid ? this.formatDate(payments.find(p => p.quarter === 1)?.datePaid) : '',
      // Q2
      this.formatDate(dueDates.q2),
      this.scheduleAQ2(),
      payments.find(p => p.quarter === 2)?.amountPaid ?? 0,
      payments.find(p => p.quarter === 2)?.datePaid ? this.formatDate(payments.find(p => p.quarter === 2)?.datePaid) : '',
      // Q3
      this.formatDate(dueDates.q3),
      this.scheduleAQ3(),
      payments.find(p => p.quarter === 3)?.amountPaid ?? 0,
      payments.find(p => p.quarter === 3)?.datePaid ? this.formatDate(payments.find(p => p.quarter === 3)?.datePaid) : '',
      // Q4
      this.formatDate(dueDates.q4),
      this.scheduleAQ4(),
      payments.find(p => p.quarter === 4)?.amountPaid ?? 0,
      payments.find(p => p.quarter === 4)?.datePaid ? this.formatDate(payments.find(p => p.quarter === 4)?.datePaid) : '',

      // Total installments
      this.totalRequiredInstallments(),
      this.totalPaymentsMade(),
      this.remainingBalance(),

      // Special methods
      this.f1120WData.useAnnualizedIncomeMethod,
      this.f1120WData.useSeasonalInstallmentMethod,

      // Underpayment indicator
      this.mayHaveUnderpaymentPenalty(),
      this.estimatedUnderpayment()
    ]
  }
}
