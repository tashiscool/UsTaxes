import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 4562 - Depreciation and Amortization
 *
 * Used to:
 * - Claim Section 179 expense deduction
 * - Claim depreciation on property placed in service
 * - Claim amortization of costs
 * - Report information on listed property (vehicles, computers)
 *
 * 2025 Section 179 limits:
 * - Maximum deduction: $1,250,000
 * - Phase-out threshold: $3,130,000
 * - SUV limit: $30,500
 */

// 2025 depreciation parameters
const depreciation = {
  section179MaxDeduction: 1250000,
  section179PhaseOutThreshold: 3130000,
  section179SuvLimit: 30500,
  // Bonus depreciation phases out:
  // 2024: 60%, 2025: 40%, 2026: 20%, 2027: 0%
  bonusDepreciationRate: 0.4 // 40% for 2025
}

export type DepreciationMethod =
  | 'MACRS'
  | 'straightLine'
  | 'section179'
  | 'bonus'
export type PropertyClass =
  | '3year'
  | '5year'
  | '7year'
  | '10year'
  | '15year'
  | '20year'
  | '25year'
  | '27.5year'
  | '39year'

export interface DepreciableAsset {
  description: string
  dateInService: Date
  cost: number
  businessUsePercent: number
  method: DepreciationMethod
  propertyClass: PropertyClass
  priorDepreciation: number
  currentYearDepreciation: number
  section179Election: number
  bonusDepreciation: number
  listedProperty: boolean
}

export default class F4562 extends F1040Attachment {
  tag: FormTag = 'f4562'
  sequenceIndex = 67

  isNeeded = (): boolean => {
    return this.hasDepreciableProperty() || this.hasSection179()
  }

  hasDepreciableProperty = (): boolean => {
    return (this.f1040.info.depreciableAssets?.length ?? 0) > 0
  }

  hasSection179 = (): boolean => {
    return this.section179Total() > 0
  }

  assets = (): DepreciableAsset[] => {
    return (
      (this.f1040.info.depreciableAssets as DepreciableAsset[] | undefined) ??
      []
    )
  }

  // Part I - Election to Expense Certain Property Under Section 179

  // Line 1: Maximum amount (2025: $1,250,000)
  l1 = (): number => depreciation.section179MaxDeduction

  // Line 2: Total cost of section 179 property placed in service
  l2 = (): number => {
    return this.assets()
      .filter((a) => a.section179Election > 0)
      .reduce((sum, a) => sum + a.cost, 0)
  }

  // Line 3: Threshold (2025: $3,130,000)
  l3 = (): number => depreciation.section179PhaseOutThreshold

  // Line 4: Subtract line 3 from line 2
  l4 = (): number => Math.max(0, this.l2() - this.l3())

  // Line 5: Subtract line 4 from line 1 (maximum section 179 available)
  l5 = (): number => Math.max(0, this.l1() - this.l4())

  // Line 6: Listed property section 179 (from Part V)
  l6 = (): number => {
    return this.assets()
      .filter((a) => a.listedProperty && a.section179Election > 0)
      .reduce((sum, a) => sum + a.section179Election, 0)
  }

  // Line 7: Total elected section 179
  l7 = (): number => {
    return this.assets()
      .filter((a) => a.section179Election > 0)
      .reduce((sum, a) => sum + a.section179Election, 0)
  }

  // Line 8: Total elected section 179 (same as line 7)
  l8 = (): number => this.l7()

  // Line 9: Tentative deduction (smaller of line 5 or 8)
  l9 = (): number => Math.min(this.l5(), this.l8())

  // Line 10: Carryover from prior years
  l10 = (): number => this.f1040.info.section179Carryover ?? 0

  // Line 11: Business income limitation
  // Note: To avoid circular dependency with ScheduleC and F8829, we calculate
  // business income BEFORE depreciation and home office deductions, as per IRS
  // instructions (Section 179 limited to business income before Section 179)
  l11 = (): number => {
    // Get Schedule C income WITHOUT depreciation (l13) or home office (l30)
    // to avoid circular dependencies through F4562 and F8829
    const schedC = this.f1040.scheduleC
    if (!schedC) return 0

    // Calculate Schedule C income before depreciation and home office
    // l7 = gross income, then subtract expenses EXCEPT l13 (depreciation) and l30
    const grossIncome = schedC.l7()
    const expensesExcludingDepreciationAndHomeOffice =
      (schedC.l8?.() ?? 0) +
      (schedC.l9?.() ?? 0) +
      (schedC.l10?.() ?? 0) +
      (schedC['l11']?.() ?? 0) + // Contract labor (not this form's l11)
      (schedC.l12?.() ?? 0) +
      // Skip l13 (depreciation) to avoid F4562 circular call
      (schedC.l14?.() ?? 0) +
      (schedC.l15?.() ?? 0) +
      (schedC.l16a?.() ?? 0) +
      (schedC.l16b?.() ?? 0) +
      (schedC.l17?.() ?? 0) +
      (schedC.l18?.() ?? 0) +
      (schedC.l19?.() ?? 0) +
      (schedC.l20a?.() ?? 0) +
      (schedC.l20b?.() ?? 0) +
      (schedC.l21?.() ?? 0) +
      (schedC.l22?.() ?? 0) +
      (schedC.l23?.() ?? 0) +
      (schedC.l24a?.() ?? 0) +
      (schedC.l24b?.() ?? 0) +
      (schedC.l25?.() ?? 0) +
      (schedC.l26?.() ?? 0) +
      (schedC.l27a?.() ?? 0)
    // Skip l30 (home office) to avoid F8829 circular call

    const schedCIncome = grossIncome - expensesExcludingDepreciationAndHomeOffice
    const scheduleFIncome = 0 // Add if Schedule F exists
    return Math.max(0, schedCIncome + scheduleFIncome)
  }

  // Line 12: Section 179 expense deduction (smaller of line 9+10 or 11)
  l12 = (): number => Math.min(this.l9() + this.l10(), this.l11())

  // Line 13: Carryforward to next year
  l13 = (): number => Math.max(0, this.l9() + this.l10() - this.l12())

  section179Total = (): number => this.l12()

  // Part II - Special Depreciation Allowance and Other Depreciation

  // Line 14: Special depreciation allowance (bonus depreciation)
  l14 = (): number => {
    return this.assets()
      .filter((a) => a.bonusDepreciation > 0)
      .reduce((sum, a) => sum + a.bonusDepreciation, 0)
  }

  // Line 15: Property subject to section 168(f)(1) election
  l15 = (): number => 0

  // Line 16: Other depreciation
  l16 = (): number => {
    return this.assets()
      .filter((a) => a.method !== 'section179' && a.bonusDepreciation === 0)
      .reduce((sum, a) => sum + a.currentYearDepreciation, 0)
  }

  // Part III - MACRS Depreciation

  // Line 17: MACRS depreciation for assets placed in service this year
  l17 = (): number => {
    const currentYearAssets = this.assets().filter((a) => {
      const year = a.dateInService.getFullYear()
      return year === 2025
    })
    return currentYearAssets.reduce(
      (sum, a) => sum + a.currentYearDepreciation,
      0
    )
  }

  // Line 18: Assets placed in service prior years
  l18 = (): number => {
    const priorYearAssets = this.assets().filter((a) => {
      const year = a.dateInService.getFullYear()
      return year < 2025
    })
    return priorYearAssets.reduce(
      (sum, a) => sum + a.currentYearDepreciation,
      0
    )
  }

  // Line 19: Listed property (from Part V)
  l19 = (): number => {
    return this.assets()
      .filter((a) => a.listedProperty)
      .reduce((sum, a) => sum + a.currentYearDepreciation, 0)
  }

  // Line 20: Total depreciation (add Part III lines)
  l20 = (): number => sumFields([this.l17(), this.l18(), this.l19()])

  // Line 21: Add lines 12, 14, 15, 16, and 20
  l21 = (): number =>
    sumFields([this.l12(), this.l14(), this.l15(), this.l16(), this.l20()])

  // Line 22: Total depreciation (for assets used in business)
  l22 = (): number => this.l21()

  totalDepreciation = (): number => this.l22()

  // Part V - Listed Property (Vehicles, Computers, etc.)

  listedPropertyAssets = (): DepreciableAsset[] => {
    return this.assets().filter((a) => a.listedProperty)
  }

  // Part VI - Amortization

  // Line 40: Amortization of costs beginning this year
  l40 = (): number => this.f1040.info.amortizationCostsCurrentYear ?? 0

  // Line 41: Amortization of costs beginning before this year
  l41 = (): number => this.f1040.info.amortizationCostsPriorYears ?? 0

  // Line 42: Total amortization
  l42 = (): number => this.l40() + this.l41()

  totalAmortization = (): number => this.l42()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
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
    // Part II
    this.l14(),
    this.l15(),
    this.l16(),
    // Part III
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    // Part VI
    this.l40(),
    this.l41(),
    this.l42()
  ]
}
