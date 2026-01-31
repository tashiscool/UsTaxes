import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule M-1 - Reconciliation of Income (Loss) per Books With Income (Loss) per Return
 *
 * Used by Form 1065 (Partnerships), Form 1120 (C-Corps), and Form 1120-S (S-Corps)
 * to reconcile financial statement income with tax return income.
 *
 * Required unless:
 * - Total assets < $250,000 AND answer "Yes" to question 4 of Schedule B
 *
 * Key reconciling items:
 * - Federal income tax expense (C-Corps)
 * - Excess of capital losses over capital gains
 * - Income recorded on books not on return (tax-exempt interest, etc.)
 * - Expenses recorded on books not deducted on return (meals, fines, etc.)
 * - Income on return not recorded on books (prepaid income, etc.)
 * - Deductions on return not charged to books (depreciation, etc.)
 */

export interface ScheduleM1Data {
  // Line 1: Net income (loss) per books
  netIncomePerBooks: number

  // Additions (Lines 2-5)
  // Line 2: Federal income tax per books (C-Corps only)
  federalIncomeTaxPerBooks: number
  // Line 3: Excess of capital losses over capital gains
  excessCapitalLosses: number
  // Line 4: Income recorded on books not included on return
  incomeRecordedNotOnReturn: number
  taxExemptInterest: number
  // Line 5: Expenses recorded on books not deducted on return
  expensesRecordedNotDeducted: number
  mealsAndEntertainment: number
  travelExpensesDisallowed: number
  finesAndPenalties: number
  politicalContributions: number
  lifeInsurancePremiums: number
  otherNondeductibleExpenses: number

  // Subtractions (Lines 7-9)
  // Line 7: Income included on return not recorded on books
  incomeOnReturnNotOnBooks: number
  prepaidIncome: number
  // Line 8: Deductions on return not charged to books
  deductionsOnReturnNotOnBooks: number
  depreciationDifference: number
  amortizationDifference: number
  depletionDifference: number
}

export type EntityTypeM1 = 'partnership' | 'scorp' | 'ccorp'

export default class ScheduleM1 extends F1040Attachment {
  tag: FormTag = 'schedulem1'
  sequenceIndex = 999
  entityType: EntityTypeM1 = 'partnership'

  isNeeded = (): boolean => {
    return this.hasM1Data()
  }

  hasM1Data = (): boolean => {
    const partnerships = this.f1040.info.partnershipOwnership
    const sCorps = this.f1040.info.sCorpOwnership
    const cCorps = this.f1040.info.cCorpOwnership
    return (
      (partnerships !== undefined && partnerships.length > 0) ||
      (sCorps !== undefined && sCorps.length > 0) ||
      (cCorps !== undefined && cCorps.length > 0)
    )
  }

  m1Data = (): ScheduleM1Data | undefined => {
    // Would be populated from entity data
    return undefined
  }

  // Line 1: Net income (loss) per books
  l1 = (): number => this.m1Data()?.netIncomePerBooks ?? 0

  // Line 2: Federal income tax per books (C-Corps only)
  l2 = (): number => {
    if (this.entityType !== 'ccorp') return 0
    return this.m1Data()?.federalIncomeTaxPerBooks ?? 0
  }

  // Line 3: Excess of capital losses over capital gains
  l3 = (): number => this.m1Data()?.excessCapitalLosses ?? 0

  // Line 4: Income recorded on books not included on return
  l4 = (): number => {
    const data = this.m1Data()
    if (!data) return 0
    return sumFields([
      data.incomeRecordedNotOnReturn,
      data.taxExemptInterest
    ])
  }

  // Line 5: Expenses recorded on books not deducted on return
  l5 = (): number => {
    const data = this.m1Data()
    if (!data) return 0
    return sumFields([
      data.expensesRecordedNotDeducted,
      data.mealsAndEntertainment,
      data.travelExpensesDisallowed,
      data.finesAndPenalties,
      data.politicalContributions,
      data.lifeInsurancePremiums,
      data.otherNondeductibleExpenses
    ])
  }

  // Line 6: Add lines 1 through 5
  l6 = (): number => sumFields([this.l1(), this.l2(), this.l3(), this.l4(), this.l5()])

  // Line 7: Income included on return not recorded on books
  l7 = (): number => {
    const data = this.m1Data()
    if (!data) return 0
    return sumFields([
      data.incomeOnReturnNotOnBooks,
      data.prepaidIncome
    ])
  }

  // Line 8: Deductions on return not charged to books
  l8 = (): number => {
    const data = this.m1Data()
    if (!data) return 0
    return sumFields([
      data.deductionsOnReturnNotOnBooks,
      data.depreciationDifference,
      data.amortizationDifference,
      data.depletionDifference
    ])
  }

  // Line 9: Add lines 7 and 8
  l9 = (): number => this.l7() + this.l8()

  // Line 10: Income (loss) per return (line 6 minus line 9)
  l10 = (): number => this.l6() - this.l9()

  // Common M-1 adjustment descriptions
  getAdjustmentDescriptions = (): string[] => {
    const descriptions: string[] = []
    const data = this.m1Data()
    if (!data) return descriptions

    if (data.mealsAndEntertainment > 0) {
      descriptions.push(`Meals and entertainment: $${data.mealsAndEntertainment}`)
    }
    if (data.finesAndPenalties > 0) {
      descriptions.push(`Fines and penalties: $${data.finesAndPenalties}`)
    }
    if (data.politicalContributions > 0) {
      descriptions.push(`Political contributions: $${data.politicalContributions}`)
    }
    if (data.lifeInsurancePremiums > 0) {
      descriptions.push(`Life insurance premiums: $${data.lifeInsurancePremiums}`)
    }
    if (data.depreciationDifference !== 0) {
      descriptions.push(`Depreciation difference: $${data.depreciationDifference}`)
    }

    return descriptions
  }

  fields = (): Field[] => {
    const data = this.m1Data()

    return [
      // Line 1: Net income (loss) per books
      this.l1(),
      // Line 2: Federal income tax (C-Corps only)
      this.l2(),
      // Line 3: Excess of capital losses over capital gains
      this.l3(),
      // Line 4: Income recorded on books not on return
      this.l4(),
      data?.taxExemptInterest ?? 0,
      // Line 5: Expenses recorded on books not deducted
      this.l5(),
      data?.mealsAndEntertainment ?? 0,
      data?.finesAndPenalties ?? 0,
      data?.politicalContributions ?? 0,
      data?.lifeInsurancePremiums ?? 0,
      data?.otherNondeductibleExpenses ?? 0,
      // Line 6: Total (add lines 1-5)
      this.l6(),
      // Line 7: Income on return not recorded on books
      this.l7(),
      data?.prepaidIncome ?? 0,
      // Line 8: Deductions on return not charged to books
      this.l8(),
      data?.depreciationDifference ?? 0,
      data?.amortizationDifference ?? 0,
      // Line 9: Add lines 7 and 8
      this.l9(),
      // Line 10: Income (loss) per return
      this.l10()
    ]
  }
}
