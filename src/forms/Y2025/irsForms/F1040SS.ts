import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1040-SS - U.S. Self-Employment Tax Return
 * (Including the Additional Child Tax Credit for Bona Fide Residents of Puerto Rico)
 *
 * Used by residents of U.S. territories and possessions:
 * - Puerto Rico
 * - U.S. Virgin Islands
 * - Guam
 * - American Samoa
 * - Commonwealth of the Northern Mariana Islands (CNMI)
 *
 * Purpose:
 * - Report and pay self-employment tax
 * - Claim the Additional Child Tax Credit (ACTC)
 * - Not for reporting income tax (filed with territorial tax authorities)
 *
 * Parts:
 * - Part I: Total Tax and Credits
 * - Part II: Bona Fide Residents of Puerto Rico Claiming ACTC
 * - Part III: Profit or Loss from Farming (similar to Schedule F)
 * - Part IV: Profit or Loss from Business (similar to Schedule C)
 * - Part V: Self-Employment Tax (similar to Schedule SE)
 */

export type USTerritory =
  | 'PuertoRico'
  | 'VirginIslands'
  | 'Guam'
  | 'AmericanSamoa'
  | 'CNMI'

export interface TerritoryResidencyInfo {
  territory: USTerritory
  yearsOfResidence: number
  isPermanentResident: boolean
  // For Puerto Rico: additional child tax credit eligibility
  hasQualifyingChildren: boolean
  numberOfQualifyingChildren: number
}

export interface TerritoryBusinessIncome {
  // Part IV: Business (Schedule C equivalent)
  grossReceipts: number
  costOfGoodsSold: number
  grossProfit: number
  otherIncome: number
  totalIncome: number
  // Expenses
  advertising: number
  carAndTruck: number
  contractLabor: number
  depreciation: number
  insurance: number
  interest: number
  legalAndProfessional: number
  officeExpense: number
  rentOrLease: number
  repairsAndMaintenance: number
  supplies: number
  taxes: number
  travel: number
  utilities: number
  wages: number
  otherExpenses: number
  totalExpenses: number
  netProfit: number
}

export interface TerritoryFarmIncome {
  // Part III: Farming (Schedule F equivalent)
  salesOfProducts: number
  cooperativeDistributions: number
  agriculturalPayments: number
  cccLoans: number
  cropInsurance: number
  customHireIncome: number
  otherFarmIncome: number
  grossFarmIncome: number
  // Expenses
  carAndTruck: number
  chemicals: number
  conservation: number
  customHire: number
  depreciation: number
  feed: number
  fertilizers: number
  freight: number
  fuel: number
  insurance: number
  interest: number
  labor: number
  rentLease: number
  repairs: number
  seeds: number
  storage: number
  supplies: number
  taxes: number
  utilities: number
  veterinary: number
  otherExpenses: number
  totalFarmExpenses: number
  netFarmProfit: number
}

export interface Form1040SSInfo {
  residency: TerritoryResidencyInfo
  businessIncome?: TerritoryBusinessIncome
  farmIncome?: TerritoryFarmIncome
  // Self-employment tax calculation
  combinedNetEarnings: number
  // Additional Child Tax Credit (Puerto Rico residents)
  earnedIncome?: number
  actcAmount?: number
}

// 2025 Self-Employment Tax rates
const SE_TAX_RATE = 0.153 // 15.3% (12.4% Social Security + 2.9% Medicare)
const SE_SOCIAL_SECURITY_WAGE_BASE = 176100 // 2025 limit
const SE_DEDUCTION_RATE = 0.9235 // 92.35% of net earnings

export default class F1040SS extends F1040Attachment {
  tag: FormTag = 'f1040ss'
  sequenceIndex = 0 // Primary form for territory residents

  isNeeded = (): boolean => {
    return this.hasForm1040SSInfo()
  }

  hasForm1040SSInfo = (): boolean => {
    return this.f1040SSInfo() !== undefined
  }

  f1040SSInfo = (): Form1040SSInfo | undefined => {
    return this.f1040.info.territoryTaxReturn as Form1040SSInfo | undefined
  }

  // Residency Information
  residency = (): TerritoryResidencyInfo | undefined =>
    this.f1040SSInfo()?.residency

  territory = (): USTerritory => this.residency()?.territory ?? 'PuertoRico'
  yearsOfResidence = (): number => this.residency()?.yearsOfResidence ?? 0
  isPermanentResident = (): boolean =>
    this.residency()?.isPermanentResident ?? false

  isPuertoRico = (): boolean => this.territory() === 'PuertoRico'
  isVirginIslands = (): boolean => this.territory() === 'VirginIslands'
  isGuam = (): boolean => this.territory() === 'Guam'
  isAmericanSamoa = (): boolean => this.territory() === 'AmericanSamoa'
  isCNMI = (): boolean => this.territory() === 'CNMI'

  // Part IV: Business Income
  businessIncome = (): TerritoryBusinessIncome | undefined =>
    this.f1040SSInfo()?.businessIncome

  grossReceipts = (): number => this.businessIncome()?.grossReceipts ?? 0
  costOfGoodsSold = (): number => this.businessIncome()?.costOfGoodsSold ?? 0
  grossProfit = (): number => this.businessIncome()?.grossProfit ?? 0
  totalBusinessIncome = (): number => this.businessIncome()?.totalIncome ?? 0
  totalBusinessExpenses = (): number =>
    this.businessIncome()?.totalExpenses ?? 0
  netBusinessProfit = (): number => this.businessIncome()?.netProfit ?? 0

  // Part III: Farm Income
  farmIncome = (): TerritoryFarmIncome | undefined =>
    this.f1040SSInfo()?.farmIncome

  grossFarmIncome = (): number => this.farmIncome()?.grossFarmIncome ?? 0
  totalFarmExpenses = (): number => this.farmIncome()?.totalFarmExpenses ?? 0
  netFarmProfit = (): number => this.farmIncome()?.netFarmProfit ?? 0

  // Part V: Self-Employment Tax Calculation
  combinedNetEarnings = (): number => {
    return (
      this.f1040SSInfo()?.combinedNetEarnings ??
      this.netBusinessProfit() + this.netFarmProfit()
    )
  }

  // Line 4: Net earnings from self-employment (92.35% of combined)
  netEarningsFromSE = (): number => {
    return Math.round(this.combinedNetEarnings() * SE_DEDUCTION_RATE)
  }

  // Social Security portion (12.4% up to wage base)
  socialSecurityWages = (): number => {
    return Math.min(this.netEarningsFromSE(), SE_SOCIAL_SECURITY_WAGE_BASE)
  }

  socialSecurityTax = (): number => {
    return Math.round(this.socialSecurityWages() * 0.124)
  }

  // Medicare portion (2.9% on all earnings)
  medicareTax = (): number => {
    return Math.round(this.netEarningsFromSE() * 0.029)
  }

  // Additional Medicare Tax (0.9% on earnings over $200,000)
  additionalMedicareTax = (): number => {
    const threshold = 200000
    if (this.netEarningsFromSE() > threshold) {
      return Math.round((this.netEarningsFromSE() - threshold) * 0.009)
    }
    return 0
  }

  // Total self-employment tax
  selfEmploymentTax = (): number => {
    return (
      this.socialSecurityTax() +
      this.medicareTax() +
      this.additionalMedicareTax()
    )
  }

  // Deductible portion of SE tax (50%)
  deductibleSETax = (): number => {
    return Math.round((this.socialSecurityTax() + this.medicareTax()) / 2)
  }

  // Part II: Additional Child Tax Credit (Puerto Rico only)
  hasQualifyingChildren = (): boolean =>
    this.residency()?.hasQualifyingChildren ?? false
  numberOfQualifyingChildren = (): number =>
    this.residency()?.numberOfQualifyingChildren ?? 0

  earnedIncome = (): number =>
    this.f1040SSInfo()?.earnedIncome ?? this.combinedNetEarnings()

  // ACTC calculation (simplified)
  calculateACTC = (): number => {
    if (!this.isPuertoRico() || !this.hasQualifyingChildren()) return 0
    // 2025 ACTC is refundable portion of Child Tax Credit
    // Maximum $1,700 per qualifying child
    const maxACTC = this.numberOfQualifyingChildren() * 1700
    // Phase in based on earned income
    const earnedIncomeThreshold = 2500
    if (this.earnedIncome() <= earnedIncomeThreshold) return 0
    const phaseInAmount = Math.round(
      (this.earnedIncome() - earnedIncomeThreshold) * 0.15
    )
    return Math.min(maxACTC, phaseInAmount)
  }

  actcAmount = (): number => {
    return this.f1040SSInfo()?.actcAmount ?? this.calculateACTC()
  }

  // Total tax and credits
  totalTax = (): number => this.selfEmploymentTax()
  totalCredits = (): number => this.actcAmount()
  amountOwed = (): number => Math.max(0, this.totalTax() - this.totalCredits())
  refundDue = (): number => Math.max(0, this.totalCredits() - this.totalTax())

  fields = (): Field[] => {
    const business = this.businessIncome()
    const farm = this.farmIncome()

    return [
      // Header
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Territory checkboxes
      this.isPuertoRico(),
      this.isVirginIslands(),
      this.isGuam(),
      this.isAmericanSamoa(),
      this.isCNMI(),
      // Part IV: Business Income
      this.grossReceipts(),
      this.costOfGoodsSold(),
      this.grossProfit(),
      this.totalBusinessIncome(),
      business?.advertising ?? 0,
      business?.carAndTruck ?? 0,
      business?.depreciation ?? 0,
      business?.insurance ?? 0,
      business?.wages ?? 0,
      this.totalBusinessExpenses(),
      this.netBusinessProfit(),
      // Part III: Farm Income
      this.grossFarmIncome(),
      farm?.feed ?? 0,
      farm?.fertilizers ?? 0,
      farm?.labor ?? 0,
      this.totalFarmExpenses(),
      this.netFarmProfit(),
      // Part V: Self-Employment Tax
      this.combinedNetEarnings(),
      this.netEarningsFromSE(),
      this.socialSecurityWages(),
      this.socialSecurityTax(),
      this.medicareTax(),
      this.additionalMedicareTax(),
      this.selfEmploymentTax(),
      this.deductibleSETax(),
      // Part II: ACTC (Puerto Rico)
      this.hasQualifyingChildren(),
      this.numberOfQualifyingChildren(),
      this.earnedIncome(),
      this.actcAmount(),
      // Summary
      this.totalTax(),
      this.totalCredits(),
      this.amountOwed(),
      this.refundDue()
    ]
  }
}
