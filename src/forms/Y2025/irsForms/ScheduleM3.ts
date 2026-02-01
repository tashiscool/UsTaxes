import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule M-3 - Net Income (Loss) Reconciliation
 *
 * Required for corporations, partnerships, and S-corporations with
 * total assets of $10 million or more (or $50 million for partnerships).
 *
 * More detailed than Schedule M-1, provides line-by-line reconciliation
 * of financial statement income to taxable income.
 *
 * Parts:
 * - Part I: Financial Information and Net Income (Loss) Reconciliation
 * - Part II: Reconciliation of Net Income (Loss) per Income Statement
 * - Part III: Reconciliation of Net Income (Loss) per Tax Return
 */

export type EntityTypeM3 = 'partnership' | 'scorp' | 'ccorp'

export interface FinancialStatementInfo {
  // Part I: Financial Information
  hasConsolidatedFS: boolean
  consolidatedGroupName?: string
  filerIncludedInConsolidated: boolean
  mixedGroup: boolean
  dormantSubsidiaries: boolean
  // Income statement type
  incomeStatementType: 'GAAP' | 'IFRS' | 'section704' | 'taxBasis' | 'other'
  // Net income per income statement
  worldwideConsolidatedNetIncome: number
  // Adjustments
  nonIncludibleForeignEntities: number
  nonIncludibleUSEntities: number
  otherAdjustments: number
  // Net income of includible entities
  netIncomeOfIncludibleEntities: number
}

export interface IncomeReconciliationItem {
  description: string
  incomeStatementAmount: number
  temporaryDifference: number
  permanentDifference: number
  taxReturnAmount: number
}

export interface ExpenseReconciliationItem {
  description: string
  incomeStatementAmount: number
  temporaryDifference: number
  permanentDifference: number
  taxReturnAmount: number
}

export interface ScheduleM3Data {
  entityType: EntityTypeM3
  taxYear: number
  financialInfo: FinancialStatementInfo
  // Part II: Income Items
  incomeItems: IncomeReconciliationItem[]
  // Part III: Expense/Deduction Items
  expenseItems: ExpenseReconciliationItem[]
}

// Asset thresholds for M-3 requirement
const M3_THRESHOLDS = {
  partnership: 50000000, // $50 million
  scorp: 10000000, // $10 million
  ccorp: 10000000 // $10 million
}

export default class ScheduleM3 extends F1040Attachment {
  tag: FormTag = 'schedulem3'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasM3Data() && this.meetsAssetThreshold()
  }

  hasM3Data = (): boolean => {
    const partnerships = this.f1040.info.partnershipOwnership
    const sCorps = this.f1040.info.sCorpOwnership
    const cCorps = this.f1040.info.cCorpOwnership
    return (
      (partnerships !== undefined && partnerships.length > 0) ||
      (sCorps !== undefined && sCorps.length > 0) ||
      (cCorps !== undefined && cCorps.length > 0)
    )
  }

  meetsAssetThreshold = (): boolean => {
    // Would check total assets against threshold
    return false // Default to not required
  }

  m3Data = (): ScheduleM3Data | undefined => {
    return undefined // Would be populated from entity data
  }

  entityType = (): EntityTypeM3 => this.m3Data()?.entityType ?? 'ccorp'

  // Part I: Financial Information

  financialInfo = (): FinancialStatementInfo | undefined =>
    this.m3Data()?.financialInfo

  // Line 1: Worldwide consolidated net income
  l1 = (): number => this.financialInfo()?.worldwideConsolidatedNetIncome ?? 0

  // Line 2: Remove non-includible foreign entities
  l2 = (): number => this.financialInfo()?.nonIncludibleForeignEntities ?? 0

  // Line 3: Remove non-includible US entities
  l3 = (): number => this.financialInfo()?.nonIncludibleUSEntities ?? 0

  // Line 4: Other adjustments
  l4 = (): number => this.financialInfo()?.otherAdjustments ?? 0

  // Line 5: Net income of includible entities
  l5 = (): number => this.l1() - this.l2() - this.l3() + this.l4()

  // Part II: Income Items

  incomeItems = (): IncomeReconciliationItem[] =>
    this.m3Data()?.incomeItems ?? []

  totalIncomeStatementIncome = (): number => {
    return this.incomeItems().reduce(
      (sum, item) => sum + item.incomeStatementAmount,
      0
    )
  }

  totalIncomeTemporaryDiff = (): number => {
    return this.incomeItems().reduce(
      (sum, item) => sum + item.temporaryDifference,
      0
    )
  }

  totalIncomePermanentDiff = (): number => {
    return this.incomeItems().reduce(
      (sum, item) => sum + item.permanentDifference,
      0
    )
  }

  totalTaxReturnIncome = (): number => {
    return this.incomeItems().reduce(
      (sum, item) => sum + item.taxReturnAmount,
      0
    )
  }

  // Part III: Expense Items

  expenseItems = (): ExpenseReconciliationItem[] =>
    this.m3Data()?.expenseItems ?? []

  totalExpenseStatementAmount = (): number => {
    return this.expenseItems().reduce(
      (sum, item) => sum + item.incomeStatementAmount,
      0
    )
  }

  totalExpenseTemporaryDiff = (): number => {
    return this.expenseItems().reduce(
      (sum, item) => sum + item.temporaryDifference,
      0
    )
  }

  totalExpensePermanentDiff = (): number => {
    return this.expenseItems().reduce(
      (sum, item) => sum + item.permanentDifference,
      0
    )
  }

  totalTaxReturnExpenses = (): number => {
    return this.expenseItems().reduce(
      (sum, item) => sum + item.taxReturnAmount,
      0
    )
  }

  // Net income per tax return
  netIncomePerTaxReturn = (): number => {
    return this.totalTaxReturnIncome() - this.totalTaxReturnExpenses()
  }

  fields = (): Field[] => {
    const data = this.m3Data()
    const fi = this.financialInfo()
    const incomeItems = this.incomeItems()
    const expenseItems = this.expenseItems()

    return [
      // Part I: Financial Information
      fi?.hasConsolidatedFS ?? false,
      fi?.consolidatedGroupName ?? '',
      fi?.filerIncludedInConsolidated ?? false,
      fi?.incomeStatementType ?? 'GAAP',
      // Lines 1-5
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      // Part II: Income Items (first 5)
      incomeItems[0]?.description ?? '',
      incomeItems[0]?.incomeStatementAmount ?? 0,
      incomeItems[0]?.temporaryDifference ?? 0,
      incomeItems[0]?.permanentDifference ?? 0,
      incomeItems[0]?.taxReturnAmount ?? 0,
      incomeItems[1]?.description ?? '',
      incomeItems[1]?.taxReturnAmount ?? 0,
      incomeItems[2]?.description ?? '',
      incomeItems[2]?.taxReturnAmount ?? 0,
      // Income totals
      this.totalIncomeStatementIncome(),
      this.totalIncomeTemporaryDiff(),
      this.totalIncomePermanentDiff(),
      this.totalTaxReturnIncome(),
      // Part III: Expense Items (first 5)
      expenseItems[0]?.description ?? '',
      expenseItems[0]?.incomeStatementAmount ?? 0,
      expenseItems[0]?.temporaryDifference ?? 0,
      expenseItems[0]?.permanentDifference ?? 0,
      expenseItems[0]?.taxReturnAmount ?? 0,
      expenseItems[1]?.description ?? '',
      expenseItems[1]?.taxReturnAmount ?? 0,
      // Expense totals
      this.totalExpenseStatementAmount(),
      this.totalExpenseTemporaryDiff(),
      this.totalExpensePermanentDiff(),
      this.totalTaxReturnExpenses(),
      // Net income per tax return
      this.netIncomePerTaxReturn()
    ]
  }
}
