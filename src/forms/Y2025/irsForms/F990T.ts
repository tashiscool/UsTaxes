import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 990-T - Exempt Organization Business Income Tax Return
 *
 * Filed by tax-exempt organizations with $1,000+ of gross income
 * from an unrelated trade or business (UBTI).
 *
 * Unrelated Business Taxable Income (UBTI):
 * - Regularly carried on trade or business
 * - Not substantially related to exempt purpose
 * - Exceptions: volunteer labor, convenience of members, donated goods
 *
 * Key Considerations:
 * - $1,000 specific deduction
 * - Net operating loss deduction allowed
 * - Organizations must calculate tax separately for each unrelated trade
 * - Debt-financed property rules (Section 514)
 * - Certain investment income may be taxable
 *
 * Due Date: 15th day of 5th month after tax year end
 */

export interface UnrelatedBusinessActivity {
  description: string
  naicsCode: string
  grossReceipts: number
  costOfGoodsSold: number
  grossProfit: number
  capitalGain: number
  rentIncome: number
  debtFinancedIncome: number
  investmentIncome: number
  otherIncome: number
  // Deductions
  salaries: number
  repairs: number
  badDebts: number
  interest: number
  taxes: number
  depreciation: number
  depletion: number
  contributions: number
  otherDeductions: number
}

export interface Form990TInfo {
  // Organization Info
  orgName: string
  ein: string
  exemptUnder: string  // 501(c)(3), 501(c)(4), etc.
  groupExemptionNumber?: string
  // Fiscal Year
  fiscalYearStart: Date
  fiscalYearEnd: Date
  isFinalReturn: boolean
  isAmendedReturn: boolean
  // Unrelated Business Activities (may have multiple)
  activities: UnrelatedBusinessActivity[]
  // Tax Credits
  foreignTaxCredit: number
  otherCredits: number
  // Payments
  estimatedTaxPayments: number
  withholdingCredit: number
  priorYearOverpayment: number
  // Elections
  section512bElection: boolean  // Controlled entity income
}

// 2025 Corporate Tax Rate for UBTI
const CORPORATE_TAX_RATE = 0.21
const SPECIFIC_DEDUCTION = 1000

export default class F990T extends F1040Attachment {
  tag: FormTag = 'f990t'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm990TInfo()
  }

  hasForm990TInfo = (): boolean => {
    return this.f990TInfo() !== undefined
  }

  f990TInfo = (): Form990TInfo | undefined => {
    return this.f1040.info.ubitReturn as Form990TInfo | undefined
  }

  // Organization Info
  orgName = (): string => this.f990TInfo()?.orgName ?? ''
  ein = (): string => this.f990TInfo()?.ein ?? ''
  exemptUnder = (): string => this.f990TInfo()?.exemptUnder ?? '501(c)(3)'

  // Activities
  activities = (): UnrelatedBusinessActivity[] => this.f990TInfo()?.activities ?? []
  numberOfActivities = (): number => this.activities().length

  // Part I: Unrelated Trade or Business Income (aggregated)

  // Line 1: Gross receipts from all activities
  l1 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.grossReceipts, 0)
  }

  // Line 2: Cost of goods sold
  l2 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.costOfGoodsSold, 0)
  }

  // Line 3: Gross profit
  l3 = (): number => this.l1() - this.l2()

  // Line 4a: Capital gain net income
  l4a = (): number => {
    return this.activities().reduce((sum, a) => sum + a.capitalGain, 0)
  }

  // Line 5: Income from debt-financed property
  l5 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.debtFinancedIncome, 0)
  }

  // Line 6: Investment income of Section 501(c)(7), (9), (17)
  l6 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.investmentIncome, 0)
  }

  // Line 7: Rent income
  l7 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.rentIncome, 0)
  }

  // Line 12: Other income
  l12 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.otherIncome, 0)
  }

  // Line 13: Total unrelated business income
  l13 = (): number => {
    return sumFields([this.l3(), this.l4a(), this.l5(), this.l6(), this.l7(), this.l12()])
  }

  // Part II: Deductions

  // Line 14: Salaries and wages
  l14 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.salaries, 0)
  }

  // Line 15: Repairs and maintenance
  l15 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.repairs, 0)
  }

  // Line 16: Bad debts
  l16 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.badDebts, 0)
  }

  // Line 17: Interest
  l17 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.interest, 0)
  }

  // Line 18: Taxes and licenses
  l18 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.taxes, 0)
  }

  // Line 20: Depreciation
  l20 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.depreciation, 0)
  }

  // Line 21: Depletion
  l21 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.depletion, 0)
  }

  // Line 22: Contributions
  l22 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.contributions, 0)
  }

  // Line 24: Other deductions
  l24 = (): number => {
    return this.activities().reduce((sum, a) => sum + a.otherDeductions, 0)
  }

  // Line 25: Total deductions
  l25 = (): number => {
    return sumFields([
      this.l14(), this.l15(), this.l16(), this.l17(), this.l18(),
      this.l20(), this.l21(), this.l22(), this.l24()
    ])
  }

  // Line 26: Unrelated business taxable income before NOL and specific deduction
  l26 = (): number => this.l13() - this.l25()

  // Line 28: Specific deduction ($1,000)
  l28 = (): number => SPECIFIC_DEDUCTION

  // Line 29: Unrelated business taxable income
  l29 = (): number => Math.max(0, this.l26() - this.l28())

  // Part III: Tax Computation

  // Line 30: Tax (21% rate for corporations)
  l30 = (): number => Math.round(this.l29() * CORPORATE_TAX_RATE)

  // Line 31: Trusts taxable at trust rates
  l31 = (): number => 0  // Trust UBTI would use trust rates

  // Line 32: Proxy tax (for 501(c)(4), (5), (6))
  l32 = (): number => 0

  // Line 33: Total tax
  l33 = (): number => this.l30() + this.l31() + this.l32()

  // Part IV: Tax and Payments

  // Line 34: Credits
  l34 = (): number => {
    return (this.f990TInfo()?.foreignTaxCredit ?? 0) + (this.f990TInfo()?.otherCredits ?? 0)
  }

  // Line 35: Tax after credits
  l35 = (): number => Math.max(0, this.l33() - this.l34())

  // Line 36: Total payments
  l36 = (): number => {
    const info = this.f990TInfo()
    if (!info) return 0
    return info.estimatedTaxPayments + info.withholdingCredit + info.priorYearOverpayment
  }

  // Line 37: Tax due
  l37 = (): number => Math.max(0, this.l35() - this.l36())

  // Line 38: Overpayment
  l38 = (): number => Math.max(0, this.l36() - this.l35())

  // Check if filing is required (gross income >= $1,000)
  filingRequired = (): boolean => this.l13() >= 1000

  fields = (): Field[] => {
    const info = this.f990TInfo()
    const activities = this.activities()

    return [
      // Header
      this.orgName(),
      this.ein(),
      this.exemptUnder(),
      info?.fiscalYearStart?.toLocaleDateString() ?? '',
      info?.fiscalYearEnd?.toLocaleDateString() ?? '',
      info?.isFinalReturn ?? false,
      info?.isAmendedReturn ?? false,
      this.numberOfActivities(),
      // First activity details
      activities[0]?.description ?? '',
      activities[0]?.naicsCode ?? '',
      // Part I: Income
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4a(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l12(),
      this.l13(),
      // Part II: Deductions
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l20(),
      this.l21(),
      this.l22(),
      this.l24(),
      this.l25(),
      this.l26(),
      this.l28(),
      this.l29(),
      // Part III: Tax
      this.l30(),
      this.l33(),
      this.l34(),
      this.l35(),
      // Part IV: Payments
      info?.estimatedTaxPayments ?? 0,
      info?.withholdingCredit ?? 0,
      info?.priorYearOverpayment ?? 0,
      this.l36(),
      this.l37(),
      this.l38()
    ]
  }
}
