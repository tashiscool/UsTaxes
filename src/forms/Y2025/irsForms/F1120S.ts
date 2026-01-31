import { SCorpForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form1120SData, ScheduleKItems, SCorpShareholder } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1120-S - U.S. Income Tax Return for an S Corporation
 *
 * S-Corporations are pass-through entities where income, deductions,
 * and credits flow through to shareholders on Schedule K-1.
 *
 * Key features:
 * - Generally no entity-level tax (exceptions: built-in gains, passive income)
 * - Income/loss passes through to shareholders based on ownership %
 * - Must file by March 15 (calendar year) or 15th day of 3rd month after year end
 * - Requires Schedule K-1 for each shareholder
 *
 * 2025 thresholds:
 * - $250,000 gross receipts / $250,000 total assets for Schedule L/M-1 exemption
 */

// 2025 tax rates for built-in gains (if applicable)
const CCORP_RATE = 0.21  // Built-in gains taxed at C-Corp rate

export default class F1120S extends SCorpForm {
  tag: FormTag = 'f1120s'
  sequenceIndex = 0  // Main return

  data: Form1120SData

  constructor(data: Form1120SData) {
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

  // Line 4: Net gain (loss) from Form 4797
  l4 = (): number => this.data.income.netGainFromSaleOfAssets

  // Line 5: Other income (loss) (attach statement)
  l5 = (): number => this.data.income.otherIncome

  // Line 6: Total income (loss) (add lines 3 through 5)
  l6 = (): number => this.l3() + this.l4() + this.l5()

  // =========================================================================
  // Page 1 - Deductions
  // =========================================================================

  // Line 7: Compensation of officers
  l7 = (): number => this.data.deductions.compensation

  // Line 8: Salaries and wages (less employment credits)
  l8 = (): number => this.data.deductions.salariesAndWages

  // Line 9: Repairs and maintenance
  l9 = (): number => this.data.deductions.repairsAndMaintenance

  // Line 10: Bad debts
  l10 = (): number => this.data.deductions.badDebts

  // Line 11: Rents
  l11 = (): number => this.data.deductions.rents

  // Line 12: Taxes and licenses
  l12 = (): number => this.data.deductions.taxesAndLicenses

  // Line 13: Interest
  l13 = (): number => this.data.deductions.interest

  // Line 14: Depreciation not claimed on Schedule A or elsewhere
  l14 = (): number => this.data.deductions.depreciation

  // Line 15: Depletion
  l15 = (): number => this.data.deductions.depletion

  // Line 16: Advertising
  l16 = (): number => this.data.deductions.advertising

  // Line 17: Pension, profit-sharing, etc., plans
  l17 = (): number => this.data.deductions.pensionPlans

  // Line 18: Employee benefit programs
  l18 = (): number => this.data.deductions.employeeBenefits

  // Line 19: Other deductions (attach statement)
  l19 = (): number => this.data.deductions.otherDeductions

  // Line 20: Total deductions (add lines 7 through 19)
  l20 = (): number => {
    return sumFields([
      this.l7(), this.l8(), this.l9(), this.l10(), this.l11(),
      this.l12(), this.l13(), this.l14(), this.l15(), this.l16(),
      this.l17(), this.l18(), this.l19()
    ])
  }

  // Line 21: Ordinary business income (loss) (line 6 minus line 20)
  l21 = (): number => this.l6() - this.l20()

  // =========================================================================
  // Page 1 - Tax and Payments
  // =========================================================================

  // Line 22a: Excess net passive income or LIFO recapture tax
  l22a = (): number => this.excessPassiveIncomeTax()

  // Line 22b: Tax from Schedule D (Form 1120-S)
  l22b = (): number => this.builtInGainsTax()

  // Line 22c: Add lines 22a and 22b
  l22c = (): number => this.l22a() + this.l22b()

  // Line 23a: 2024 estimated tax payments
  l23a = (): number => this.data.estimatedTaxPayments

  // Line 23b: Tax deposited with Form 7004
  l23b = (): number => 0  // Would need to track

  // Line 23c: Credit for federal tax paid on fuels
  l23c = (): number => 0

  // Line 23d: Add lines 23a through 23c
  l23d = (): number => this.l23a() + this.l23b() + this.l23c()

  // Line 24: Estimated tax penalty
  l24 = (): number => 0

  // Line 25: Amount owed
  l25 = (): number => {
    const taxDue = this.l22c() + this.l24() - this.l23d()
    return Math.max(0, taxDue)
  }

  // Line 26: Overpayment
  l26 = (): number => {
    const overpayment = this.l23d() - this.l22c() - this.l24()
    return Math.max(0, overpayment)
  }

  // Line 27: Credit or refund
  l27 = (): number => this.l26()

  // =========================================================================
  // Special Taxes
  // =========================================================================

  /**
   * Built-in gains tax applies when:
   * - S-Corp converted from C-Corp within 5 years
   * - Has net recognized built-in gain
   * - Has net unrealized built-in gain at conversion
   */
  builtInGainsTax = (): number => {
    return this.data.builtInGainsTax ?? 0
  }

  /**
   * Excess net passive income tax applies when:
   * - S-Corp has accumulated E&P from C-Corp years
   * - Passive investment income exceeds 25% of gross receipts
   */
  excessPassiveIncomeTax = (): number => {
    return this.data.excessPassiveIncomeTax ?? 0
  }

  // =========================================================================
  // Schedule B - Other Information
  // =========================================================================

  // Question 1: Business activity code
  businessActivityCode = (): string => this.data.entity.principalBusinessActivity

  // Question 2: Product or service
  productOrService = (): string => this.data.entity.principalProductOrService

  // Question 3: Did S-Corp own 20% or more of any foreign/domestic corporation?
  ownsOtherCorps = (): boolean => false  // Would need to track

  // Question 5: At any time during tax year, did corporation have assets abroad?
  hasAssetsAbroad = (): boolean => false  // Would need to track

  // Question 6: Total shareholders at end of year
  totalShareholders = (): number => this.data.shareholders.length

  // =========================================================================
  // Schedule K - Shareholders' Pro Rata Share Items
  // =========================================================================

  scheduleK = (): ScheduleKItems => this.data.scheduleK

  // Income (Loss)
  kL1 = (): number => this.scheduleK().ordinaryBusinessIncome
  kL2 = (): number => this.scheduleK().netRentalRealEstateIncome
  kL3c = (): number => this.scheduleK().otherNetRentalIncome
  kL4 = (): number => this.scheduleK().interestIncome
  kL5a = (): number => this.scheduleK().dividendIncome
  kL5b = (): number => this.scheduleK().qualifiedDividends
  kL6 = (): number => this.scheduleK().royalties
  kL7 = (): number => this.scheduleK().netShortTermCapitalGain
  kL8a = (): number => this.scheduleK().netLongTermCapitalGain
  kL8b = (): number => this.scheduleK().collectibles28Gain
  kL8c = (): number => this.scheduleK().unrecaptured1250Gain
  kL9 = (): number => this.scheduleK().net1231Gain
  kL10 = (): number => this.scheduleK().otherIncome

  // Deductions
  kL11 = (): number => this.scheduleK().section179Deduction
  kL12 = (): number => this.scheduleK().otherDeductions

  // Credits
  kL13a = (): number => this.scheduleK().lowIncomeHousingCredit
  kL13b = (): number => this.scheduleK().otherCredits

  // Tax-Exempt Income and Nondeductible Expenses
  kL16a = (): number => this.scheduleK().taxExemptInterest
  kL16b = (): number => this.scheduleK().otherTaxExemptIncome
  kL16c = (): number => this.scheduleK().nondeductibleExpenses
  kL16d = (): number => this.scheduleK().cashDistributions

  // Section 199A QBI
  kL17 = (): number => this.scheduleK().section199AQBI

  // =========================================================================
  // Schedule L - Balance Sheets per Books
  // =========================================================================

  // Required if total receipts >= $250,000 or total assets >= $250,000
  requiresScheduleL = (): boolean => {
    return this.l1a() >= 250000 || this.data.entity.totalAssets >= 250000
  }

  // Beginning of year assets
  beginningAssets = (): number => 0  // Would need prior year data

  // End of year assets
  endingAssets = (): number => this.data.entity.totalAssets

  // =========================================================================
  // Shareholders Information
  // =========================================================================

  shareholders = (): SCorpShareholder[] => this.data.shareholders

  // Total shares outstanding
  totalShares = (): number => {
    return this.data.shareholders.reduce((sum, s) => sum + s.stockOwned, 0)
  }

  // Total ownership percentage (should be 100)
  totalOwnership = (): number => {
    return this.data.shareholders.reduce((sum, s) => sum + s.ownershipPercentage, 0)
  }

  // Get shareholder's K-1 allocation
  shareholderAllocation = (shareholder: SCorpShareholder): ScheduleKItems => {
    const pct = shareholder.ownershipPercentage / 100
    const k = this.scheduleK()
    return {
      ordinaryBusinessIncome: Math.round(k.ordinaryBusinessIncome * pct),
      netRentalRealEstateIncome: Math.round(k.netRentalRealEstateIncome * pct),
      otherNetRentalIncome: Math.round(k.otherNetRentalIncome * pct),
      interestIncome: Math.round(k.interestIncome * pct),
      dividendIncome: Math.round(k.dividendIncome * pct),
      qualifiedDividends: Math.round(k.qualifiedDividends * pct),
      royalties: Math.round(k.royalties * pct),
      netShortTermCapitalGain: Math.round(k.netShortTermCapitalGain * pct),
      netLongTermCapitalGain: Math.round(k.netLongTermCapitalGain * pct),
      collectibles28Gain: Math.round(k.collectibles28Gain * pct),
      unrecaptured1250Gain: Math.round(k.unrecaptured1250Gain * pct),
      net1231Gain: Math.round(k.net1231Gain * pct),
      otherIncome: Math.round(k.otherIncome * pct),
      section179Deduction: Math.round(k.section179Deduction * pct),
      otherDeductions: Math.round(k.otherDeductions * pct),
      charitableContributions: Math.round(k.charitableContributions * pct),
      lowIncomeHousingCredit: Math.round(k.lowIncomeHousingCredit * pct),
      otherCredits: Math.round(k.otherCredits * pct),
      netEarningsSE: 0,  // S-Corp shareholders don't have SE income from K-1
      taxExemptInterest: Math.round(k.taxExemptInterest * pct),
      otherTaxExemptIncome: Math.round(k.otherTaxExemptIncome * pct),
      nondeductibleExpenses: Math.round(k.nondeductibleExpenses * pct),
      cashDistributions: Math.round(k.cashDistributions * pct),
      propertyDistributions: Math.round(k.propertyDistributions * pct),
      section199AQBI: Math.round(k.section199AQBI * pct)
    }
  }

  // =========================================================================
  // Tax Due Calculation
  // =========================================================================

  totalTax = (): number => this.l22c()
  balanceDue = (): number => this.l25()
  overpayment = (): number => this.l26()

  // =========================================================================
  // PDF Fields
  // =========================================================================

  fields = (): Field[] => [
    // Header
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.data.entity.dateIncorporated ? this.formatDate(this.data.entity.dateIncorporated) : '',
    this.data.entity.totalAssets,
    // Accounting method checkboxes
    this.data.entity.accountingMethod === 'cash',
    this.data.entity.accountingMethod === 'accrual',
    this.data.entity.accountingMethod === 'other',
    // Business activity
    this.businessActivityCode(),
    this.productOrService(),
    // Income
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    // Deductions
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
    // Tax
    this.l22a(),
    this.l22b(),
    this.l22c(),
    // Payments
    this.l23a(),
    this.l23b(),
    this.l23c(),
    this.l23d(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    // Schedule K
    this.kL1(),
    this.kL2(),
    this.kL3c(),
    this.kL4(),
    this.kL5a(),
    this.kL5b(),
    this.kL6(),
    this.kL7(),
    this.kL8a(),
    this.kL8b(),
    this.kL8c(),
    this.kL9(),
    this.kL10(),
    this.kL11(),
    this.kL12(),
    this.kL13a(),
    this.kL13b(),
    this.kL16a(),
    this.kL16b(),
    this.kL16c(),
    this.kL16d(),
    this.kL17()
  ]
}
