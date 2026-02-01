import { CCorpForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form1120Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1120 - U.S. Corporation Income Tax Return
 *
 * C-Corporations are separate tax entities that pay tax on their income.
 * Unlike S-Corps and partnerships, C-Corps have entity-level taxation.
 *
 * Key features:
 * - 21% flat corporate tax rate (2025)
 * - Dividends received deduction for qualifying dividends
 * - Net operating loss can be carried forward indefinitely
 * - Can accumulate earnings but subject to accumulated earnings tax
 * - Must file by April 15 (calendar year) or 15th day of 4th month after year end
 *
 * 2025 rates and thresholds:
 * - Corporate tax rate: 21% flat
 * - DRD: 50%, 65%, or 100% depending on ownership
 * - Accumulated earnings tax: 20% on accumulated taxable income
 * - Personal holding company tax: 20% on undistributed PHC income
 */

const CORPORATE_TAX_RATE = 0.21

export default class F1120 extends CCorpForm {
  tag: FormTag = 'f1120'
  sequenceIndex = 0 // Main return

  data: Form1120Data

  constructor(data: Form1120Data) {
    super()
    this.data = data
  }

  // =========================================================================
  // Page 1 - Income
  // =========================================================================

  // Line 1a: Gross receipts or sales
  l1a = (): number => this.data.income.grossReceiptsOrSales

  // Line 1b: Returns and allowances
  l1b = (): number => this.data.income.returnsAndAllowances

  // Line 1c: Balance (subtract line 1b from line 1a)
  l1c = (): number => Math.max(0, this.l1a() - this.l1b())

  // Line 2: Cost of goods sold (Schedule A)
  l2 = (): number => this.data.income.costOfGoodsSold

  // Line 3: Gross profit (line 1c minus line 2)
  l3 = (): number => this.l1c() - this.l2()

  // Line 4: Dividends (Schedule C)
  l4 = (): number => this.data.income.dividendIncome

  // Line 5: Interest
  l5 = (): number => this.data.income.interestIncome

  // Line 6: Gross rents
  l6 = (): number => this.data.income.grossRents

  // Line 7: Gross royalties
  l7 = (): number => this.data.income.grossRoyalties

  // Line 8: Capital gain net income (Schedule D)
  l8 = (): number => this.data.income.capitalGainNetIncome

  // Line 9: Net gain or (loss) from Form 4797
  l9 = (): number => this.data.income.netGainFromSaleOfAssets

  // Line 10: Other income (attach statement)
  l10 = (): number => this.data.income.otherIncome

  // Line 11: Total income (add lines 3 through 10)
  l11 = (): number => {
    return sumFields([
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10()
    ])
  }

  // =========================================================================
  // Page 1 - Deductions
  // =========================================================================

  // Line 12: Compensation of officers (Schedule E)
  l12 = (): number => this.data.deductions.compensationOfOfficers

  // Line 13: Salaries and wages (less employment credits)
  l13 = (): number => this.data.deductions.salariesAndWages

  // Line 14: Repairs and maintenance
  l14 = (): number => this.data.deductions.repairsAndMaintenance

  // Line 15: Bad debts
  l15 = (): number => this.data.deductions.badDebts

  // Line 16: Rents
  l16 = (): number => this.data.deductions.rents

  // Line 17: Taxes and licenses
  l17 = (): number => this.data.deductions.taxesAndLicenses

  // Line 18: Interest
  l18 = (): number => this.data.deductions.interest

  // Line 19: Charitable contributions (limited to 10% of line 30)
  l19 = (): number => {
    // Charitable contributions limited to 10% of taxable income before deduction
    const incomeBeforeCharity =
      this.l11() -
      this.l12() -
      this.l13() -
      this.l14() -
      this.l15() -
      this.l16() -
      this.l17() -
      this.l18() -
      this.l20() -
      this.l21() -
      this.l22() -
      this.l23() -
      this.l24() -
      this.l25() -
      this.l26()
    const limit = Math.max(0, incomeBeforeCharity * 0.1)
    return Math.min(this.data.deductions.charitableContributions, limit)
  }

  // Line 20: Depreciation from Form 4562
  l20 = (): number => this.data.deductions.depreciation

  // Line 21: Depletion
  l21 = (): number => this.data.deductions.depletion

  // Line 22: Advertising
  l22 = (): number => this.data.deductions.advertising

  // Line 23: Pension, profit-sharing, etc., plans
  l23 = (): number => this.data.deductions.pensionPlans

  // Line 24: Employee benefit programs
  l24 = (): number => this.data.deductions.employeeBenefits

  // Line 25: Reserved for future use
  l25 = (): number => 0

  // Line 26: Other deductions (attach statement)
  l26 = (): number => this.data.deductions.otherDeductions

  // Line 27: Total deductions (add lines 12 through 26)
  l27 = (): number => {
    return sumFields([
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
      this.l22(),
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26()
    ])
  }

  // Line 28: Taxable income before NOL deduction and special deductions (line 11 - line 27)
  l28 = (): number => this.l11() - this.l27()

  // Line 29a: Net operating loss deduction
  l29a = (): number => this.data.specialDeductions.nol

  // Line 29b: Special deductions (Schedule C)
  l29b = (): number => this.totalSpecialDeductions()

  // Line 29c: Add lines 29a and 29b
  l29c = (): number => this.l29a() + this.l29b()

  // Line 30: Taxable income (line 28 minus line 29c)
  l30 = (): number => Math.max(0, this.l28() - this.l29c())

  // =========================================================================
  // Page 1 - Tax and Payments
  // =========================================================================

  // Line 31: Total tax (Schedule J, Part I)
  l31 = (): number => this.calculateTax()

  // Line 32: Total credits (Schedule J, Part II)
  l32 = (): number => this.totalCredits()

  // Line 33: Subtract line 32 from line 31
  l33 = (): number => Math.max(0, this.l31() - this.l32())

  // Line 34: Other taxes (Schedule J, Part III)
  l34 = (): number => this.otherTaxes()

  // Line 35: Total tax (add lines 33 and 34)
  l35 = (): number => this.l33() + this.l34()

  // Line 36: Total payments and refundable credits
  l36 = (): number => this.totalPayments()

  // Line 37: Estimated tax penalty
  l37 = (): number => 0

  // Line 38: Amount owed
  l38 = (): number => {
    const owed = this.l35() + this.l37() - this.l36()
    return Math.max(0, owed)
  }

  // Line 39: Overpayment
  l39 = (): number => {
    const overpayment = this.l36() - this.l35() - this.l37()
    return Math.max(0, overpayment)
  }

  // =========================================================================
  // Tax Computation (Schedule J, Part I)
  // =========================================================================

  calculateTax = (): number => {
    // 21% flat rate for C corporations
    return Math.round(this.l30() * CORPORATE_TAX_RATE)
  }

  // =========================================================================
  // Special Deductions (Schedule C)
  // =========================================================================

  /**
   * Dividends Received Deduction (DRD)
   * - 50% DRD for <20% ownership of dividend-paying corporation
   * - 65% DRD for 20%-79% ownership
   * - 100% DRD for 80%+ ownership (affiliated group)
   */
  dividendsReceivedDeduction = (): number => {
    return this.data.specialDeductions.dividendsReceivedDeduction
  }

  dividendsFromAffiliated = (): number => {
    return this.data.specialDeductions.dividendsFromAffiliated
  }

  totalSpecialDeductions = (): number => {
    return sumFields([
      this.dividendsReceivedDeduction(),
      this.dividendsFromAffiliated(),
      this.data.specialDeductions.dividendsOnDebtFinancedStock,
      this.data.specialDeductions.dividendsOnCertainPreferred,
      this.data.specialDeductions.foreignDividends
    ])
  }

  // =========================================================================
  // Credits (Schedule J, Part II)
  // =========================================================================

  foreignTaxCredit = (): number => this.data.foreignTaxCredit ?? 0

  generalBusinessCredit = (): number => {
    const credits = this.data.generalBusinessCredits ?? {}
    return Object.values(credits).reduce((sum, c) => sum + (c ?? 0), 0)
  }

  priorYearMinimumTax = (): number => this.data.priorYearMinimumTax ?? 0

  totalCredits = (): number => {
    return sumFields([
      this.foreignTaxCredit(),
      this.generalBusinessCredit(),
      this.priorYearMinimumTax()
    ])
  }

  // =========================================================================
  // Other Taxes (Schedule J, Part III)
  // =========================================================================

  /**
   * Accumulated Earnings Tax (IRC Section 531)
   * 20% tax on accumulated taxable income beyond reasonable needs
   */
  accumulatedEarningsTax = (): number => this.data.accumulatedEarnings ?? 0

  /**
   * Personal Holding Company Tax (IRC Section 541)
   * 20% tax on undistributed PHC income
   */
  personalHoldingCompanyTax = (): number =>
    this.data.personalHoldingCompanyTax ?? 0

  otherTaxes = (): number => {
    return sumFields([
      this.accumulatedEarningsTax(),
      this.personalHoldingCompanyTax()
    ])
  }

  // =========================================================================
  // Payments
  // =========================================================================

  estimatedTaxPayments = (): number => this.data.estimatedTaxPayments

  extensionPayment = (): number => this.data.extensionPayment ?? 0

  priorYearOverpayment = (): number => this.data.priorYearOverpayment ?? 0

  totalPayments = (): number => {
    return sumFields([
      this.estimatedTaxPayments(),
      this.extensionPayment(),
      this.priorYearOverpayment()
    ])
  }

  // =========================================================================
  // Schedule B - Other Information
  // =========================================================================

  // Question 1: Check if corporation is a:
  isBank = (): boolean => false
  isInsuranceCompany = (): boolean => false
  isPersonalHoldingCompany = (): boolean => false

  // Question 4: Is the corporation a subsidiary in an affiliated group?
  isSubsidiary = (): boolean => false

  // Question 5: At the end of the tax year, did the corporation own or control:
  // 50% or more of voting power of another corporation?
  ownsOtherCorp = (): boolean => false

  // =========================================================================
  // Schedule L - Balance Sheets per Books
  // =========================================================================

  // Required for all corporations unless total receipts and total assets < $250,000
  requiresScheduleL = (): boolean => {
    return this.l1a() >= 250000 || this.data.entity.totalAssets >= 250000
  }

  totalAssets = (): number => this.data.entity.totalAssets

  // =========================================================================
  // Tax Due Summary
  // =========================================================================

  taxableIncome = (): number => this.l30()
  totalTax = (): number => this.l35()
  balanceDue = (): number => this.l38()
  overpayment = (): number => this.l39()

  // =========================================================================
  // PDF Fields
  // =========================================================================

  fields = (): Field[] => [
    // Header
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.data.entity.dateIncorporated
      ? this.formatDate(this.data.entity.dateIncorporated)
      : '',
    this.data.entity.totalAssets,
    // Accounting method checkboxes
    this.data.entity.accountingMethod === 'cash',
    this.data.entity.accountingMethod === 'accrual',
    this.data.entity.accountingMethod === 'other',
    // Business activity
    this.principalBusinessActivity(),
    this.principalProductOrService(),
    // Income
    this.l1a(),
    this.l1b(),
    this.l1c(),
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
    // Deductions
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
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    // Special deductions
    this.l29a(),
    this.l29b(),
    this.l29c(),
    this.l30(),
    // Tax
    this.l31(),
    this.l32(),
    this.l33(),
    this.l34(),
    this.l35(),
    // Payments
    this.l36(),
    this.l37(),
    this.l38(),
    this.l39(),
    // Schedule C - Special Deductions
    this.dividendsReceivedDeduction(),
    this.dividendsFromAffiliated(),
    this.totalSpecialDeductions(),
    // Schedule J - Tax Computation
    this.calculateTax(),
    this.foreignTaxCredit(),
    this.generalBusinessCredit(),
    this.totalCredits()
  ]
}
