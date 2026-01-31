import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8829 - Expenses for Business Use of Your Home
 *
 * Used to calculate the home office deduction for self-employed individuals.
 *
 * Two methods:
 * 1. Regular method - Actual expenses × business percentage
 * 2. Simplified method - $5/sq ft, max 300 sq ft ($1,500 max)
 *
 * Requirements:
 * - Regular and exclusive use for business
 * - Principal place of business
 */

export type HomeOfficeMethod = 'regular' | 'simplified'

export interface HomeOfficeInfo {
  method: HomeOfficeMethod
  totalSquareFeet: number
  businessSquareFeet: number
  daysUsedForDaycare?: number
  hoursUsedForDaycare?: number

  // Expenses (for regular method)
  mortgageInterest: number
  realEstateTaxes: number
  insurance: number
  utilities: number
  repairs: number
  otherExpenses: number

  // Depreciation
  homeValue: number
  landValue: number
  homePurchaseDate: Date
  priorDepreciation: number
}

// 2025 simplified method rate
const simplifiedRate = 5  // $5 per square foot
const maxSimplifiedSqFt = 300  // Maximum 300 square feet

export default class F8829 extends F1040Attachment {
  tag: FormTag = 'f8829'
  sequenceIndex = 66

  isNeeded = (): boolean => {
    return this.hasHomeOffice()
  }

  hasHomeOffice = (): boolean => {
    const info = this.homeOfficeInfo()
    return info !== undefined && info.businessSquareFeet > 0
  }

  homeOfficeInfo = (): HomeOfficeInfo | undefined => {
    return this.f1040.info.homeOffice as HomeOfficeInfo | undefined
  }

  // Part I - Part of Your Home Used for Business

  // Line 1: Area used regularly and exclusively for business
  l1 = (): number => this.homeOfficeInfo()?.businessSquareFeet ?? 0

  // Line 2: Total area of home
  l2 = (): number => this.homeOfficeInfo()?.totalSquareFeet ?? 0

  // Line 3: Divide line 1 by line 2 (business percentage)
  l3 = (): number => {
    if (this.l2() <= 0) return 0
    return this.l1() / this.l2()
  }

  // Simplified method calculation
  simplifiedDeduction = (): number => {
    const sqFt = Math.min(this.l1(), maxSimplifiedSqFt)
    return sqFt * simplifiedRate
  }

  // Line 4: Multiply days used for daycare by hours per day
  l4 = (): number => {
    const info = this.homeOfficeInfo()
    const days = info?.daysUsedForDaycare ?? 0
    const hours = info?.hoursUsedForDaycare ?? 0
    return days * hours
  }

  // Line 5: Total hours available for daycare (365 × 24)
  l5 = (): number => 8760

  // Line 6: Daycare percentage
  l6 = (): number => {
    if (this.l4() <= 0) return 0
    return this.l4() / this.l5()
  }

  // Line 7: Business percentage (line 3 or adjusted for daycare)
  l7 = (): number => {
    if (this.l6() > 0) {
      return this.l3() * this.l6()
    }
    return this.l3()
  }

  // Part II - Figure Your Allowable Deduction

  // Line 8: Gross income from business use of home
  l8 = (): number => {
    // From Schedule C net profit
    return this.f1040.scheduleC?.l31() ?? 0
  }

  // Line 9: Casualty losses
  l9 = (): number => 0

  // Line 10: Deductible mortgage interest
  l10 = (): number => {
    const info = this.homeOfficeInfo()
    return Math.round((info?.mortgageInterest ?? 0) * this.l7())
  }

  // Line 11: Real estate taxes
  l11 = (): number => {
    const info = this.homeOfficeInfo()
    return Math.round((info?.realEstateTaxes ?? 0) * this.l7())
  }

  // Line 12: Add lines 9, 10, 11
  l12 = (): number => sumFields([this.l9(), this.l10(), this.l11()])

  // Line 13: Subtract line 12 from line 8
  l13 = (): number => Math.max(0, this.l8() - this.l12())

  // Line 14: Excess mortgage interest
  l14 = (): number => 0

  // Line 15: Excess real estate taxes
  l15 = (): number => 0

  // Line 16: Insurance
  l16 = (): number => {
    const info = this.homeOfficeInfo()
    return Math.round((info?.insurance ?? 0) * this.l7())
  }

  // Line 17: Rent (if applicable)
  l17 = (): number => 0

  // Line 18: Repairs and maintenance
  l18 = (): number => {
    const info = this.homeOfficeInfo()
    return Math.round((info?.repairs ?? 0) * this.l7())
  }

  // Line 19: Utilities
  l19 = (): number => {
    const info = this.homeOfficeInfo()
    return Math.round((info?.utilities ?? 0) * this.l7())
  }

  // Line 20: Other expenses
  l20 = (): number => {
    const info = this.homeOfficeInfo()
    return Math.round((info?.otherExpenses ?? 0) * this.l7())
  }

  // Line 21: Add lines 14-20
  l21 = (): number => sumFields([
    this.l14(), this.l15(), this.l16(), this.l17(),
    this.l18(), this.l19(), this.l20()
  ])

  // Line 22: Allowable expenses (smaller of line 13 or 21)
  l22 = (): number => Math.min(this.l13(), this.l21())

  // Line 23: Limit (subtract line 22 from line 13)
  l23 = (): number => Math.max(0, this.l13() - this.l22())

  // Part III - Depreciation

  // Line 36: Basis of building for depreciation
  l36 = (): number => {
    const info = this.homeOfficeInfo()
    if (!info) return 0
    return Math.max(0, info.homeValue - info.landValue)
  }

  // Line 37: Business percentage of building value
  l37 = (): number => Math.round(this.l36() * this.l7())

  // Line 38: Depreciation percentage (39-year for office, 2.564%)
  l38 = (): number => 0.02564

  // Line 39: Depreciation allowable
  l39 = (): number => Math.round(this.l37() * this.l38())

  // Line 40: Carryover from prior year
  l40 = (): number => 0

  // Line 41: Allowable depreciation (limited by line 23)
  l41 = (): number => Math.min(this.l23(), this.l39() + this.l40())

  // Part IV - Carryover

  // Line 42: Operating expenses carryover
  l42 = (): number => Math.max(0, this.l21() - this.l22())

  // Line 43: Excess casualty losses carryover
  l43 = (): number => 0

  // Total deduction
  totalDeduction = (): number => {
    const method = this.homeOfficeInfo()?.method ?? 'regular'
    if (method === 'simplified') {
      return this.simplifiedDeduction()
    }
    return sumFields([this.l12(), this.l22(), this.l41()])
  }

  // To Schedule C line 30
  deductionToScheduleC = (): number => this.totalDeduction()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Method selection
    (this.homeOfficeInfo()?.method ?? 'regular') === 'simplified',
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    // Part II
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
    this.l22(),
    this.l23(),
    // Part III
    this.l36(),
    this.l37(),
    this.l38(),
    this.l39(),
    this.l40(),
    this.l41(),
    // Part IV
    this.l42(),
    this.l43()
  ]
}
