import { PartnershipForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form1065Data, ScheduleKItems, PartnerInfo } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1065 - U.S. Return of Partnership Income
 *
 * Partnerships (including LLCs taxed as partnerships) are pass-through entities.
 * The partnership itself does not pay income tax; instead, income, deductions,
 * gains, losses, and credits pass through to partners on Schedule K-1.
 *
 * Key features:
 * - No entity-level income tax
 * - Income/loss allocated to partners based on partnership agreement
 * - Partners pay SE tax on their distributive share of ordinary income
 * - Must file by March 15 (calendar year) or 15th day of 3rd month after year end
 *
 * 2025 filing requirements:
 * - Schedule L/M-1/M-2 not required if:
 *   - Gross receipts < $250,000
 *   - Total assets < $1,000,000
 *   - Schedules K-1 are timely filed
 *   - Partnership is not filing Schedule M-3
 */

export default class F1065 extends PartnershipForm {
  tag: FormTag = 'f1065'
  sequenceIndex = 0 // Main return

  data: Form1065Data

  constructor(data: Form1065Data) {
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

  // Line 4: Ordinary income (loss) from other partnerships, estates, trusts
  l4 = (): number => this.data.income.ordinaryIncome

  // Line 5: Net farm profit (loss) (Schedule F)
  l5 = (): number => this.data.income.netFarmProfit

  // Line 6: Net gain (loss) from Form 4797
  l6 = (): number => this.data.income.netGainFromSaleOfAssets

  // Line 7: Other income (loss) (attach statement)
  l7 = (): number => this.data.income.otherIncome

  // Line 8: Total income (loss) (add lines 3 through 7)
  l8 = (): number => {
    return sumFields([this.l3(), this.l4(), this.l5(), this.l6(), this.l7()])
  }

  // =========================================================================
  // Page 1 - Deductions
  // =========================================================================

  // Line 9: Salaries and wages (other than to partners)
  l9 = (): number => this.data.deductions.salariesAndWages

  // Line 10: Guaranteed payments to partners
  l10 = (): number => this.data.deductions.guaranteedPaymentsToPartners

  // Line 11: Repairs and maintenance
  l11 = (): number => this.data.deductions.repairsAndMaintenance

  // Line 12: Bad debts
  l12 = (): number => this.data.deductions.badDebts

  // Line 13: Rent
  l13 = (): number => this.data.deductions.rents

  // Line 14: Taxes and licenses
  l14 = (): number => this.data.deductions.taxesAndLicenses

  // Line 15: Interest
  l15 = (): number => this.data.deductions.interest

  // Line 16a: Depreciation (not on Schedule A)
  l16a = (): number => this.data.deductions.depreciation

  // Line 16b: Less depreciation reported on Schedule A
  l16b = (): number => 0

  // Line 16c: Net depreciation (subtract line 16b from 16a)
  l16c = (): number => this.l16a() - this.l16b()

  // Line 17: Depletion
  l17 = (): number => this.data.deductions.depletion

  // Line 18: Retirement plans, etc.
  l18 = (): number => this.data.deductions.retirementPlans

  // Line 19: Employee benefit programs
  l19 = (): number => this.data.deductions.employeeBenefits

  // Line 20: Other deductions (attach statement)
  l20 = (): number => this.data.deductions.otherDeductions

  // Line 21: Total deductions (add lines 9 through 20)
  l21 = (): number => {
    return sumFields([
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16c(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20()
    ])
  }

  // Line 22: Ordinary business income (loss) (line 8 minus line 21)
  l22 = (): number => this.l8() - this.l21()

  // =========================================================================
  // Schedule B - Other Information
  // =========================================================================

  // Question 1: What type of entity is filing this return?
  entityType = (): string => this.data.entity.entityType

  // Question 2: At any time during the tax year, was any partner in the partnership
  // a disregarded entity, a partnership, a trust, an S corporation, etc.?
  hasEntityPartners = (): boolean => {
    return this.data.partners.some((p) => p.tinType === 'EIN')
  }

  // Question 3: At the end of the tax year:
  // Number of general partners
  numberOfGeneralPartners = (): number => this.data.numberOfGeneralPartners

  // Number of limited partners
  numberOfLimitedPartners = (): number => this.data.numberOfLimitedPartners

  // Question 6: Is this partnership a publicly traded partnership?
  isPubliclyTraded = (): boolean => false

  // Question 8: Does the partnership meet all four requirements for Schedule L/M-1/M-2 exemption?
  isExemptFromScheduleL = (): boolean => {
    return this.l1a() < 250000 && this.data.entity.totalAssets < 1000000
  }

  // =========================================================================
  // Schedule K - Partners' Distributive Share Items
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
  kL12 = (): number => this.scheduleK().charitableContributions
  kL13a = (): number => this.scheduleK().otherDeductions

  // Self-Employment
  kL14a = (): number => this.scheduleK().netEarningsSE // General partners
  kL14b = (): number => 0 // Gross farming/fishing income
  kL14c = (): number => 0 // Gross non-farm income

  // Credits
  kL15a = (): number => this.scheduleK().lowIncomeHousingCredit
  kL15b = (): number => this.scheduleK().otherCredits

  // Alternative Minimum Tax Items
  // (Would need to expand for full AMT support)

  // Tax-Exempt Income and Nondeductible Expenses
  kL18a = (): number => this.scheduleK().taxExemptInterest
  kL18b = (): number => this.scheduleK().otherTaxExemptIncome
  kL18c = (): number => this.scheduleK().nondeductibleExpenses

  // Distributions
  kL19a = (): number => this.scheduleK().cashDistributions
  kL19b = (): number => this.scheduleK().propertyDistributions

  // Section 199A QBI
  kL20 = (): number => this.scheduleK().section199AQBI

  // =========================================================================
  // Schedule L - Balance Sheets per Books
  // =========================================================================

  // Required if total receipts >= $250,000 or total assets >= $1,000,000
  requiresScheduleL = (): boolean => {
    return this.l1a() >= 250000 || this.data.entity.totalAssets >= 1000000
  }

  // End of year assets
  totalAssets = (): number => this.data.entity.totalAssets

  // =========================================================================
  // Schedule M-2 - Analysis of Partners' Capital Accounts
  // =========================================================================

  // Line 1: Balance at beginning of year
  capitalBeginning = (): number => {
    return this.data.partners.reduce(
      (sum, p) => sum + p.beginningCapitalAccount,
      0
    )
  }

  // Line 2: Capital contributed during the year
  capitalContributed = (): number => {
    return this.data.partners.reduce((sum, p) => sum + p.capitalContributed, 0)
  }

  // Line 3: Net income per books
  netIncome = (): number => this.l22()

  // Line 4: Other increases
  otherIncreases = (): number => {
    return this.data.partners.reduce((sum, p) => sum + p.currentYearIncrease, 0)
  }

  // Line 5: Add lines 1 through 4
  l5Total = (): number => {
    return (
      this.capitalBeginning() +
      this.capitalContributed() +
      this.netIncome() +
      this.otherIncreases()
    )
  }

  // Line 6: Distributions
  totalDistributions = (): number => {
    return this.data.partners.reduce(
      (sum, p) => sum + p.withdrawalsDistributions,
      0
    )
  }

  // Line 7: Other decreases
  otherDecreases = (): number => 0

  // Line 8: Add lines 6 and 7
  totalDecreases = (): number =>
    this.totalDistributions() + this.otherDecreases()

  // Line 9: Balance at end of year (line 5 minus line 8)
  capitalEnding = (): number => {
    return this.data.partners.reduce(
      (sum, p) => sum + p.endingCapitalAccount,
      0
    )
  }

  // =========================================================================
  // Partners Information
  // =========================================================================

  partners = (): PartnerInfo[] => this.data.partners

  // Get partner's K-1 allocation
  partnerAllocation = (partner: PartnerInfo): ScheduleKItems => {
    const profitPct = partner.profitSharingPercent / 100
    const lossPct = partner.lossSharingPercent / 100
    const k = this.scheduleK()

    // Use profit sharing for positive items, loss sharing for negative
    const allocateAmount = (amount: number): number => {
      const pct = amount >= 0 ? profitPct : lossPct
      return Math.round(amount * pct)
    }

    return {
      ordinaryBusinessIncome: allocateAmount(k.ordinaryBusinessIncome),
      netRentalRealEstateIncome: allocateAmount(k.netRentalRealEstateIncome),
      otherNetRentalIncome: allocateAmount(k.otherNetRentalIncome),
      interestIncome: Math.round(k.interestIncome * profitPct),
      dividendIncome: Math.round(k.dividendIncome * profitPct),
      qualifiedDividends: Math.round(k.qualifiedDividends * profitPct),
      royalties: Math.round(k.royalties * profitPct),
      netShortTermCapitalGain: allocateAmount(k.netShortTermCapitalGain),
      netLongTermCapitalGain: allocateAmount(k.netLongTermCapitalGain),
      collectibles28Gain: Math.round(k.collectibles28Gain * profitPct),
      unrecaptured1250Gain: Math.round(k.unrecaptured1250Gain * profitPct),
      net1231Gain: allocateAmount(k.net1231Gain),
      otherIncome: allocateAmount(k.otherIncome),
      section179Deduction: Math.round(
        partner.share179Deduction ?? k.section179Deduction * profitPct
      ),
      otherDeductions: Math.round(
        partner.shareOtherDeductions ?? k.otherDeductions * lossPct
      ),
      charitableContributions: Math.round(
        k.charitableContributions * profitPct
      ),
      lowIncomeHousingCredit: Math.round(k.lowIncomeHousingCredit * profitPct),
      otherCredits: Math.round(k.otherCredits * profitPct),
      // SE earnings only for general partners
      netEarningsSE: partner.isGeneralPartner
        ? allocateAmount(k.netEarningsSE)
        : 0,
      taxExemptInterest: Math.round(k.taxExemptInterest * profitPct),
      otherTaxExemptIncome: Math.round(k.otherTaxExemptIncome * profitPct),
      nondeductibleExpenses: Math.round(k.nondeductibleExpenses * profitPct),
      cashDistributions: Math.round(partner.withdrawalsDistributions),
      propertyDistributions: 0,
      section199AQBI: Math.round(k.section199AQBI * profitPct)
    }
  }

  // =========================================================================
  // Liabilities Analysis
  // =========================================================================

  totalRecourseDebt = (): number => this.data.liabilitiesAtYearEnd.recourse
  totalNonrecourseDebt = (): number =>
    this.data.liabilitiesAtYearEnd.nonrecourse
  totalQualifiedNonrecourse = (): number =>
    this.data.liabilitiesAtYearEnd.qualifiedNonrecourse
  totalLiabilities = (): number => {
    return (
      this.totalRecourseDebt() +
      this.totalNonrecourseDebt() +
      this.totalQualifiedNonrecourse()
    )
  }

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
    // Capital account method
    this.data.capitalAccountMethod,
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
    // Deductions
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16a(),
    this.l16b(),
    this.l16c(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    // Schedule B
    this.numberOfGeneralPartners(),
    this.numberOfLimitedPartners(),
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
    this.kL14a(),
    this.kL15a(),
    this.kL15b(),
    this.kL18a(),
    this.kL18b(),
    this.kL18c(),
    this.kL19a(),
    this.kL19b(),
    this.kL20(),
    // Schedule M-2
    this.capitalBeginning(),
    this.capitalContributed(),
    this.netIncome(),
    this.totalDistributions(),
    this.capitalEnding()
  ]
}
