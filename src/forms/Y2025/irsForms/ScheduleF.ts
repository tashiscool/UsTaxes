import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Schedule F (Form 1040) - Profit or Loss From Farming
 *
 * Used to report income and expenses from farming operations.
 * Similar to Schedule C but with farming-specific categories.
 *
 * Accounting methods: Cash or Accrual
 * Can use income averaging on Schedule J
 */

export type FarmAccountingMethod = 'cash' | 'accrual'

export interface FarmIncome {
  salesLivestock: number
  salesCrops: number
  cooperativeDistributions: number
  agriculturalPayments: number
  cccLoans: number
  cropInsurance: number
  customHireIncome: number
  otherIncome: number
}

export interface FarmExpenses {
  carTruck: number
  chemicals: number
  conservation: number
  customHire: number
  depreciation: number
  employeeBenefit: number
  feed: number
  fertilizers: number
  freight: number
  fuel: number
  insurance: number
  interest: number
  labor: number
  pensionPlans: number
  rentLease: number
  repairs: number
  seeds: number
  storage: number
  supplies: number
  taxes: number
  utilities: number
  veterinary: number
  otherExpenses: number
}

export interface FarmBusiness {
  name: string
  ein?: string
  accountingMethod: FarmAccountingMethod
  income: FarmIncome
  expenses: FarmExpenses
  livestockCost?: number
  beginningInventory?: number
  endingInventory?: number
  mortgageInterest?: number
  otherInterest?: number
  vehicleRent?: number
  otherRent?: number
}

export default class ScheduleF extends F1040Attachment {
  tag: FormTag = 'f1040sf'
  sequenceIndex = 14

  isNeeded = (): boolean => {
    return this.hasFarmIncome()
  }

  hasFarmIncome = (): boolean => {
    const farm = this.farmInfo()
    return farm !== undefined && (this.grossIncome() > 0 || this.totalExpenses() > 0)
  }

  farmInfo = (): FarmBusiness | undefined => {
    return this.f1040.info.farmBusiness as FarmBusiness | undefined
  }

  accountingMethod = (): FarmAccountingMethod => {
    return this.farmInfo()?.accountingMethod ?? 'cash'
  }

  // Part I - Farm Income (Cash Method)

  // Line 1a: Sales of livestock bought for resale
  l1a = (): number => this.farmInfo()?.income?.salesLivestock ?? 0

  // Line 1b: Cost of livestock bought
  l1b = (): number => this.farmInfo()?.livestockCost ?? 0

  // Line 1c: Subtract line 1b from 1a
  l1c = (): number => Math.max(0, this.l1a() - this.l1b())

  // Line 2: Sales of livestock, produce, grains, other
  l2 = (): number => this.farmInfo()?.income?.salesCrops ?? 0

  // Line 3a: Cooperative distributions
  l3a = (): number => this.farmInfo()?.income?.cooperativeDistributions ?? 0

  // Line 3b: Taxable cooperative distributions
  l3b = (): number => this.l3a()

  // Line 4a: Agricultural program payments
  l4a = (): number => this.farmInfo()?.income?.agriculturalPayments ?? 0

  // Line 4b: Taxable agricultural payments
  l4b = (): number => this.l4a()

  // Line 5a: CCC loans reported
  l5a = (): number => this.farmInfo()?.income?.cccLoans ?? 0

  // Line 5b: CCC loans forfeited
  l5b = (): number => 0

  // Line 5c: Taxable CCC loans
  l5c = (): number => this.l5a() - this.l5b()

  // Line 6: Crop insurance proceeds
  l6 = (): number => this.farmInfo()?.income?.cropInsurance ?? 0

  // Line 7: Custom hire income
  l7 = (): number => this.farmInfo()?.income?.customHireIncome ?? 0

  // Line 8: Other farm income
  l8 = (): number => this.farmInfo()?.income?.otherIncome ?? 0

  // Line 9: Gross farm income (add lines 1c, 2, 3b, 4b, 5c, 6, 7, 8)
  l9 = (): number => sumFields([
    this.l1c(), this.l2(), this.l3b(), this.l4b(),
    this.l5c(), this.l6(), this.l7(), this.l8()
  ])

  grossIncome = (): number => this.l9()

  // Part II - Farm Expenses

  // Line 10: Car and truck expenses
  l10 = (): number => this.farmInfo()?.expenses?.carTruck ?? 0

  // Line 11: Chemicals
  l11 = (): number => this.farmInfo()?.expenses?.chemicals ?? 0

  // Line 12: Conservation expenses
  l12 = (): number => this.farmInfo()?.expenses?.conservation ?? 0

  // Line 13: Custom hire
  l13 = (): number => this.farmInfo()?.expenses?.customHire ?? 0

  // Line 14: Depreciation (from Form 4562)
  l14 = (): number => this.farmInfo()?.expenses?.depreciation ?? 0

  // Line 15: Employee benefit programs
  l15 = (): number => this.farmInfo()?.expenses?.employeeBenefit ?? 0

  // Line 16: Feed
  l16 = (): number => this.farmInfo()?.expenses?.feed ?? 0

  // Line 17: Fertilizers and lime
  l17 = (): number => this.farmInfo()?.expenses?.fertilizers ?? 0

  // Line 18: Freight and trucking
  l18 = (): number => this.farmInfo()?.expenses?.freight ?? 0

  // Line 19: Gasoline, fuel, oil
  l19 = (): number => this.farmInfo()?.expenses?.fuel ?? 0

  // Line 20: Insurance (other than health)
  l20 = (): number => this.farmInfo()?.expenses?.insurance ?? 0

  // Line 21: Interest (a: mortgage, b: other)
  l21a = (): number => this.farmInfo()?.mortgageInterest ?? 0
  l21b = (): number => this.farmInfo()?.otherInterest ?? 0
  l21 = (): number => this.l21a() + this.l21b()

  // Line 22: Labor hired
  l22 = (): number => this.farmInfo()?.expenses?.labor ?? 0

  // Line 23: Pension and profit-sharing plans
  l23 = (): number => this.farmInfo()?.expenses?.pensionPlans ?? 0

  // Line 24: Rent or lease (a: vehicles, b: other)
  l24a = (): number => this.farmInfo()?.vehicleRent ?? 0
  l24b = (): number => this.farmInfo()?.otherRent ?? 0
  l24 = (): number => this.l24a() + this.l24b()

  // Line 25: Repairs and maintenance
  l25 = (): number => this.farmInfo()?.expenses?.repairs ?? 0

  // Line 26: Seeds and plants
  l26 = (): number => this.farmInfo()?.expenses?.seeds ?? 0

  // Line 27: Storage and warehousing
  l27 = (): number => this.farmInfo()?.expenses?.storage ?? 0

  // Line 28: Supplies
  l28 = (): number => this.farmInfo()?.expenses?.supplies ?? 0

  // Line 29: Taxes
  l29 = (): number => this.farmInfo()?.expenses?.taxes ?? 0

  // Line 30: Utilities
  l30 = (): number => this.farmInfo()?.expenses?.utilities ?? 0

  // Line 31: Veterinary, breeding, medicine
  l31 = (): number => this.farmInfo()?.expenses?.veterinary ?? 0

  // Line 32: Other expenses
  l32 = (): number => this.farmInfo()?.expenses?.otherExpenses ?? 0

  // Line 33: Total expenses
  l33 = (): number => sumFields([
    this.l10(), this.l11(), this.l12(), this.l13(), this.l14(),
    this.l15(), this.l16(), this.l17(), this.l18(), this.l19(),
    this.l20(), this.l21(), this.l22(), this.l23(), this.l24(),
    this.l25(), this.l26(), this.l27(), this.l28(), this.l29(),
    this.l30(), this.l31(), this.l32()
  ])

  totalExpenses = (): number => this.l33()

  // Line 34: Net farm profit or loss
  l34 = (): number => this.l9() - this.l33()

  // To Schedule 1 line 6 or Schedule E
  netProfit = (): number => this.l34()

  // Check if at risk (Line 35)
  l35 = (): boolean => {
    // Simplified - assume all investment is at risk
    return true
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.farmInfo()?.name ?? '',
    this.farmInfo()?.ein ?? '',
    this.accountingMethod() === 'cash',
    this.accountingMethod() === 'accrual',
    // Part I
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l2(),
    this.l3a(),
    this.l3b(),
    this.l4a(),
    this.l4b(),
    this.l5a(),
    this.l5b(),
    this.l5c(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    // Part II
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
    this.l21a(),
    this.l21b(),
    this.l22(),
    this.l23(),
    this.l24a(),
    this.l24b(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33(),
    this.l34(),
    this.l35()
  ]
}
