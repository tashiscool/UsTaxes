import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { PersonRole } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule C (Form 1040) - Profit or Loss From Business (Sole Proprietorship)
 *
 * Used by self-employed individuals, freelancers, contractors, and gig workers
 * to report business income and expenses.
 *
 * Key sections:
 * - Part I: Income (gross receipts, returns, cost of goods sold)
 * - Part II: Expenses (advertising, car, insurance, legal, etc.)
 * - Part III: Cost of Goods Sold (for inventory-based businesses)
 * - Part IV: Information on Your Vehicle
 * - Part V: Other Expenses
 */

export type BusinessAccountingMethod = 'cash' | 'accrual' | 'other'

export interface BusinessIncome {
  grossReceipts: number
  returns: number
  otherIncome: number
}

export interface BusinessExpenses {
  advertising: number
  carAndTruck: number
  commissions: number
  contractLabor: number
  depletion: number
  depreciation: number
  employeeBenefits: number
  insurance: number
  interestMortgage: number
  interestOther: number
  legal: number
  office: number
  pensionPlans: number
  rentVehicles: number
  rentOther: number
  repairs: number
  supplies: number
  taxes: number
  travel: number
  deductibleMeals: number
  utilities: number
  wages: number
  otherExpenses: number
}

export interface CostOfGoodsSold {
  beginningInventory: number
  purchases: number
  laborCost: number
  materials: number
  otherCosts: number
  endingInventory: number
}

export interface BusinessInfo {
  name: string
  ein?: string
  address?: string
  principalBusinessCode: string  // 6-digit NAICS code
  businessDescription: string
  accountingMethod: BusinessAccountingMethod
  materialParticipation: boolean
  startedOrAcquired: boolean  // Started or acquired this year
  madePaymentsRequiring1099: boolean
  filed1099s: boolean
  income: BusinessIncome
  expenses: BusinessExpenses
  costOfGoodsSold?: CostOfGoodsSold
  vehicleMiles?: number
  homeOfficeDeduction?: number
  personRole: PersonRole
}

export default class ScheduleC extends F1040Attachment {
  tag: FormTag = 'f1040sc'
  sequenceIndex = 9

  personRole: PersonRole = PersonRole.PRIMARY

  constructor(f1040: F1040, personRole: PersonRole = PersonRole.PRIMARY) {
    super(f1040)
    this.personRole = personRole
  }

  isNeeded = (): boolean => {
    return this.hasBusinessIncome()
  }

  hasBusinessIncome = (): boolean => {
    const businesses = this.businesses()
    return businesses.length > 0 && (this.l1() > 0 || this.totalExpenses() > 0)
  }

  businesses = (): BusinessInfo[] => {
    const allBusinesses = (this.f1040.info.businesses as BusinessInfo[] | undefined) ?? []
    return allBusinesses.filter(b => b.personRole === this.personRole)
  }

  // Get first business (Schedule C handles one business per form)
  business = (): BusinessInfo | undefined => {
    return this.businesses()[0]
  }

  // Part I - Income

  // Line 1: Gross receipts or sales
  l1 = (): number => {
    return this.business()?.income?.grossReceipts ?? 0
  }

  // Line 2: Returns and allowances
  l2 = (): number => {
    return this.business()?.income?.returns ?? 0
  }

  // Line 3: Subtract line 2 from line 1
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Cost of goods sold (from line 42)
  l4 = (): number => this.l42()

  // Line 5: Gross profit (line 3 - line 4)
  l5 = (): number => this.l3() - this.l4()

  // Line 6: Other income
  l6 = (): number => {
    return this.business()?.income?.otherIncome ?? 0
  }

  // Line 7: Gross income (line 5 + line 6)
  l7 = (): number => this.l5() + this.l6()

  // Part II - Expenses

  // Line 8: Advertising
  l8 = (): number => this.business()?.expenses?.advertising ?? 0

  // Line 9: Car and truck expenses
  l9 = (): number => this.business()?.expenses?.carAndTruck ?? 0

  // Line 10: Commissions and fees
  l10 = (): number => this.business()?.expenses?.commissions ?? 0

  // Line 11: Contract labor
  l11 = (): number => this.business()?.expenses?.contractLabor ?? 0

  // Line 12: Depletion
  l12 = (): number => this.business()?.expenses?.depletion ?? 0

  // Line 13: Depreciation and section 179 expense deduction
  l13 = (): number => {
    // Get from Form 4562 if available, otherwise use direct input
    const f4562Depreciation = this.f1040.f4562?.totalDepreciation() ?? 0
    const directDepreciation = this.business()?.expenses?.depreciation ?? 0
    return f4562Depreciation > 0 ? f4562Depreciation : directDepreciation
  }

  // Line 14: Employee benefit programs
  l14 = (): number => this.business()?.expenses?.employeeBenefits ?? 0

  // Line 15: Insurance (other than health)
  l15 = (): number => this.business()?.expenses?.insurance ?? 0

  // Line 16a: Interest on mortgage
  l16a = (): number => this.business()?.expenses?.interestMortgage ?? 0

  // Line 16b: Interest on other business debt
  l16b = (): number => this.business()?.expenses?.interestOther ?? 0

  // Line 17: Legal and professional services
  l17 = (): number => this.business()?.expenses?.legal ?? 0

  // Line 18: Office expense
  l18 = (): number => this.business()?.expenses?.office ?? 0

  // Line 19: Pension and profit-sharing plans
  l19 = (): number => this.business()?.expenses?.pensionPlans ?? 0

  // Line 20a: Rent or lease - vehicles, machinery, equipment
  l20a = (): number => this.business()?.expenses?.rentVehicles ?? 0

  // Line 20b: Rent or lease - other business property
  l20b = (): number => this.business()?.expenses?.rentOther ?? 0

  // Line 21: Repairs and maintenance
  l21 = (): number => this.business()?.expenses?.repairs ?? 0

  // Line 22: Supplies
  l22 = (): number => this.business()?.expenses?.supplies ?? 0

  // Line 23: Taxes and licenses
  l23 = (): number => this.business()?.expenses?.taxes ?? 0

  // Line 24a: Travel (not meals)
  l24a = (): number => this.business()?.expenses?.travel ?? 0

  // Line 24b: Deductible meals (50% or 100% for certain)
  l24b = (): number => this.business()?.expenses?.deductibleMeals ?? 0

  // Line 25: Utilities
  l25 = (): number => this.business()?.expenses?.utilities ?? 0

  // Line 26: Wages (less employment credits)
  l26 = (): number => this.business()?.expenses?.wages ?? 0

  // Line 27a: Other expenses (from line 48)
  l27a = (): number => this.business()?.expenses?.otherExpenses ?? 0

  // Line 27b: Reserved for future use
  l27b = (): number => 0

  // Line 28: Total expenses before expenses for business use of home
  l28 = (): number => {
    return sumFields([
      this.l8(), this.l9(), this.l10(), this.l11(), this.l12(), this.l13(),
      this.l14(), this.l15(), this.l16a(), this.l16b(), this.l17(), this.l18(),
      this.l19(), this.l20a(), this.l20b(), this.l21(), this.l22(), this.l23(),
      this.l24a(), this.l24b(), this.l25(), this.l26(), this.l27a()
    ])
  }

  totalExpenses = (): number => this.l28()

  // Line 29: Tentative profit or loss (line 7 - line 28)
  l29 = (): number => this.l7() - this.l28()

  // Line 30: Expenses for business use of home (Form 8829)
  l30 = (): number => {
    return this.f1040.f8829?.deductionToScheduleC() ??
           this.business()?.homeOfficeDeduction ?? 0
  }

  // Line 31: Net profit or (loss) (line 29 - line 30)
  l31 = (): number => this.l29() - this.l30()

  // Net profit flows to:
  // - Schedule 1, line 3 (as part of business income)
  // - Schedule SE, line 2 (for self-employment tax)

  netProfit = (): number => this.l31()

  // Part III - Cost of Goods Sold

  // Line 33: Inventory method
  inventoryMethod = (): string => 'cost'  // cost, lower of cost or market, other

  // Line 35: Inventory at beginning of year
  l35 = (): number => this.business()?.costOfGoodsSold?.beginningInventory ?? 0

  // Line 36: Purchases less cost of items withdrawn for personal use
  l36 = (): number => this.business()?.costOfGoodsSold?.purchases ?? 0

  // Line 37: Cost of labor
  l37 = (): number => this.business()?.costOfGoodsSold?.laborCost ?? 0

  // Line 38: Materials and supplies
  l38 = (): number => this.business()?.costOfGoodsSold?.materials ?? 0

  // Line 39: Other costs
  l39 = (): number => this.business()?.costOfGoodsSold?.otherCosts ?? 0

  // Line 40: Add lines 35-39
  l40 = (): number => {
    return sumFields([this.l35(), this.l36(), this.l37(), this.l38(), this.l39()])
  }

  // Line 41: Inventory at end of year
  l41 = (): number => this.business()?.costOfGoodsSold?.endingInventory ?? 0

  // Line 42: Cost of goods sold (line 40 - line 41)
  l42 = (): number => Math.max(0, this.l40() - this.l41())

  // Part IV - Vehicle Information
  vehicleMiles = (): number => this.business()?.vehicleMiles ?? 0

  // Information helpers
  businessName = (): string => this.business()?.name ?? ''
  businessEin = (): string => this.business()?.ein ?? ''
  principalBusinessCode = (): string => this.business()?.principalBusinessCode ?? ''
  businessDescription = (): string => this.business()?.businessDescription ?? ''
  accountingMethod = (): BusinessAccountingMethod => this.business()?.accountingMethod ?? 'cash'

  // For Schedule 8812 earned income calculation
  statutoryEmployeeIncome = (): number => 0  // Box 13 on W-2 if statutory employee

  // Creates additional copies if multiple businesses
  copies = (): ScheduleC[] => {
    const businesses = this.businesses()
    if (businesses.length <= 1) return []

    // Return additional Schedule C forms for additional businesses
    // (Skip first one as it's handled by main instance)
    return businesses.slice(1).map((_, index) => {
      const copy = new ScheduleC(this.f1040, this.personRole)
      // Would need to set business index - simplified here
      return copy
    })
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Business info
    this.businessName(),
    this.businessEin(),
    this.principalBusinessCode(),
    this.businessDescription(),
    // Accounting method checkboxes
    this.accountingMethod() === 'cash',
    this.accountingMethod() === 'accrual',
    this.accountingMethod() === 'other',
    // Participation
    this.business()?.materialParticipation ?? false,
    // 1099 questions
    this.business()?.madePaymentsRequiring1099 ?? false,
    this.business()?.filed1099s ?? false,
    // Part I - Income
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    // Part II - Expenses
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16a(),
    this.l16b(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20a(),
    this.l20b(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24a(),
    this.l24b(),
    this.l25(),
    this.l26(),
    this.l27a(),
    this.l27b(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    // Part III - Cost of Goods Sold
    this.l35(),
    this.l36(),
    this.l37(),
    this.l38(),
    this.l39(),
    this.l40(),
    this.l41(),
    this.l42()
  ]
}
