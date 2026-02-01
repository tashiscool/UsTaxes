import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8941 - Credit for Small Employer Health Insurance Premiums
 *
 * Allows eligible small employers to claim a tax credit for health insurance
 * premiums paid for employees. Available for employers who:
 * - Have fewer than 25 full-time equivalent employees (FTEs)
 * - Pay average annual wages below threshold ($59,100 for 2025)
 * - Pay at least 50% of employee-only premium cost
 * - Offer coverage through SHOP (Small Business Health Options Program)
 *
 * 2025 Rules:
 * - Maximum credit: 50% of premiums paid (35% for tax-exempt employers)
 * - Credit phases out as FTEs approach 25 and wages approach threshold
 * - Must purchase through SHOP Marketplace
 * - Credit available for 2 consecutive years only
 */

// 2025 parameters
const smallEmployerCreditParams = {
  maxFtes: 25, // Maximum full-time equivalents
  maxAverageWage: 59100, // Maximum average annual wage for full credit
  creditRateTaxable: 0.5, // 50% for taxable employers
  creditRateTaxExempt: 0.35, // 35% for tax-exempt employers
  minimumPremiumContribution: 0.5, // Must pay at least 50% of premiums
  fteLowerLimit: 10, // FTEs below this get full credit
  wageLowerLimit: 29550 // Wages below this get full credit (half of max)
}

export interface SmallEmployerHealthInfo {
  isTaxExempt: boolean
  totalFtes: number
  totalAnnualWages: number
  averageAnnualWage: number
  premiumsPaidForEmployees: number
  employeeOnlyPremiumCost: number // Total of lowest-cost employee-only plans
  shopPremiumsPaid: number // Premiums paid through SHOP
  percentOfPremiumPaid: number
  isFirstOrSecondYear: boolean // Credit only available for 2 years
  stateAverageSmallGroupPremium?: number
}

export default class F8941 extends F1040Attachment {
  tag: FormTag = 'f8941'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasEligibleHealthPlan() && this.l15() > 0
  }

  hasEligibleHealthPlan = (): boolean => {
    const info = this.healthInfo()
    if (!info) return false

    return (
      info.totalFtes < smallEmployerCreditParams.maxFtes &&
      info.averageAnnualWage < smallEmployerCreditParams.maxAverageWage &&
      info.percentOfPremiumPaid >=
        smallEmployerCreditParams.minimumPremiumContribution &&
      info.isFirstOrSecondYear
    )
  }

  healthInfo = (): SmallEmployerHealthInfo | undefined => {
    return this.f1040.info.smallEmployerHealth as
      | SmallEmployerHealthInfo
      | undefined
  }

  // Part I - Calculation of Credit

  // Line 1: Number of FTEs (not counting owners/partners)
  l1 = (): number => this.healthInfo()?.totalFtes ?? 0

  // Line 2: Average annual wages
  l2 = (): number => {
    const info = this.healthInfo()
    if (!info || info.totalFtes === 0) return 0
    return Math.round(info.totalAnnualWages / info.totalFtes)
  }

  // Line 3: Premiums paid for SHOP coverage
  l3 = (): number => this.healthInfo()?.shopPremiumsPaid ?? 0

  // Line 4: State average premium for small group market
  l4 = (): number => {
    // Use state average or calculate based on FTEs and family size
    return this.healthInfo()?.stateAverageSmallGroupPremium ?? this.l3()
  }

  // Line 5: Enter smaller of line 3 or line 4
  l5 = (): number => Math.min(this.l3(), this.l4())

  // Line 6: Multiply line 5 by applicable percentage (50% or 35%)
  l6 = (): number => {
    const rate = this.healthInfo()?.isTaxExempt
      ? smallEmployerCreditParams.creditRateTaxExempt
      : smallEmployerCreditParams.creditRateTaxable
    return Math.round(this.l5() * rate)
  }

  // Part II - Phase-Out Calculation

  // Line 7: FTE reduction (if FTEs > 10)
  l7 = (): number => {
    const ftes = this.l1()
    if (ftes <= smallEmployerCreditParams.fteLowerLimit) return 0

    const excessFtes = ftes - smallEmployerCreditParams.fteLowerLimit
    const fteRange =
      smallEmployerCreditParams.maxFtes -
      smallEmployerCreditParams.fteLowerLimit

    // Phase-out ratio
    return excessFtes / fteRange
  }

  // Line 8: Wage reduction (if average wages > $29,550)
  l8 = (): number => {
    const avgWage = this.l2()
    if (avgWage <= smallEmployerCreditParams.wageLowerLimit) return 0

    const excessWage = avgWage - smallEmployerCreditParams.wageLowerLimit
    const wageRange =
      smallEmployerCreditParams.maxAverageWage -
      smallEmployerCreditParams.wageLowerLimit

    // Phase-out ratio
    return Math.min(1, excessWage / wageRange)
  }

  // Line 9: Add lines 7 and 8 (combined reduction ratio)
  l9 = (): number => Math.min(1, this.l7() + this.l8())

  // Line 10: Multiply line 6 by line 9 (reduction amount)
  l10 = (): number => Math.round(this.l6() * this.l9())

  // Line 11: Subtract line 10 from line 6 (credit before limitation)
  l11 = (): number => Math.max(0, this.l6() - this.l10())

  // Part III - Tax Limitation (for taxable employers)

  // Line 12: Tax liability limitation
  l12 = (): number => {
    if (this.healthInfo()?.isTaxExempt) return 0
    // For taxable employers, credit limited by tax liability
    return this.f1040.l18()
  }

  // Line 13: Other general business credits (Form 3800)
  l13 = (): number => 0 // Simplified

  // Line 14: Subtract line 13 from line 12
  l14 = (): number => Math.max(0, this.l12() - this.l13())

  // Line 15: Credit allowed (smaller of line 11 or line 14)
  l15 = (): number => {
    if (this.healthInfo()?.isTaxExempt) {
      return this.l11() // Tax-exempt employers get full credit (refundable)
    }
    return Math.min(this.l11(), this.l14())
  }

  // Credit methods

  // Credit for taxable employers (goes to Form 3800, then Schedule 3)
  credit = (): number => {
    if (this.healthInfo()?.isTaxExempt) return 0
    return this.l15()
  }

  // Refundable credit for tax-exempt employers (goes to Form 990-T)
  taxExemptCredit = (): number => {
    if (!this.healthInfo()?.isTaxExempt) return 0
    return this.l15()
  }

  fields = (): Field[] => {
    const info = this.healthInfo()

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Employer information
      info?.isTaxExempt ?? false,
      info?.isFirstOrSecondYear ?? false,
      // Part I
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      // Part II
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      // Part III
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15()
    ]
  }
}
