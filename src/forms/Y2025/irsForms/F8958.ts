import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8958 - Allocation of Tax Amounts Between Certain Individuals
 * in Community Property States
 *
 * Required for married taxpayers filing separately who live in
 * community property states:
 * - Arizona
 * - California
 * - Idaho
 * - Louisiana
 * - Nevada
 * - New Mexico
 * - Texas
 * - Washington
 * - Wisconsin
 *
 * Allocates income, deductions, and credits between spouses.
 */

export interface F8958Data {
  // Taxpayer information
  taxpayerName: string
  taxpayerSSN: string
  spouseName: string
  spouseSSN: string
  // Community property state
  communityPropertyState: string
  // Part I: Income Allocation
  // Wages (W-2)
  wagesTotal: number
  wagesAllocatedToTaxpayer: number
  wagesAllocatedToSpouse: number
  // Interest
  interestTotal: number
  interestAllocatedToTaxpayer: number
  interestAllocatedToSpouse: number
  // Dividends
  dividendsTotal: number
  dividendsAllocatedToTaxpayer: number
  dividendsAllocatedToSpouse: number
  // State/local refunds
  stateRefundsTotal: number
  stateRefundsAllocatedToTaxpayer: number
  stateRefundsAllocatedToSpouse: number
  // Business income
  businessIncomeTotal: number
  businessIncomeAllocatedToTaxpayer: number
  businessIncomeAllocatedToSpouse: number
  // Capital gains
  capitalGainsTotal: number
  capitalGainsAllocatedToTaxpayer: number
  capitalGainsAllocatedToSpouse: number
  // IRA distributions
  iraDistributionsTotal: number
  iraDistributionsAllocatedToTaxpayer: number
  iraDistributionsAllocatedToSpouse: number
  // Pensions
  pensionsTotal: number
  pensionsAllocatedToTaxpayer: number
  pensionsAllocatedToSpouse: number
  // Rental/Royalty
  rentalIncomeTotal: number
  rentalIncomeAllocatedToTaxpayer: number
  rentalIncomeAllocatedToSpouse: number
  // Other income
  otherIncomeTotal: number
  otherIncomeAllocatedToTaxpayer: number
  otherIncomeAllocatedToSpouse: number
  // Part II: Tax Withheld Allocation
  federalWithholdingTotal: number
  federalWithholdingAllocatedToTaxpayer: number
  federalWithholdingAllocatedToSpouse: number
  // Part III: Other Allocations
  estimatedTaxPaymentsTotal: number
  estimatedTaxPaymentsAllocatedToTaxpayer: number
  estimatedTaxPaymentsAllocatedToSpouse: number
}

// Community property states
const COMMUNITY_PROPERTY_STATES = [
  'AZ', 'CA', 'ID', 'LA', 'NV', 'NM', 'TX', 'WA', 'WI'
]

export default class F8958 extends F1040Attachment {
  tag: FormTag = 'f8958'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8958Data()
  }

  hasF8958Data = (): boolean => {
    return false
  }

  f8958Data = (): F8958Data | undefined => {
    return undefined
  }

  // Is valid community property state?
  isValidCommunityPropertyState = (): boolean => {
    const state = this.f8958Data()?.communityPropertyState ?? ''
    return COMMUNITY_PROPERTY_STATES.includes(state)
  }

  // Total income
  totalIncomeToTaxpayer = (): number => {
    const data = this.f8958Data()
    if (!data) return 0
    return sumFields([
      data.wagesAllocatedToTaxpayer,
      data.interestAllocatedToTaxpayer,
      data.dividendsAllocatedToTaxpayer,
      data.stateRefundsAllocatedToTaxpayer,
      data.businessIncomeAllocatedToTaxpayer,
      data.capitalGainsAllocatedToTaxpayer,
      data.iraDistributionsAllocatedToTaxpayer,
      data.pensionsAllocatedToTaxpayer,
      data.rentalIncomeAllocatedToTaxpayer,
      data.otherIncomeAllocatedToTaxpayer
    ])
  }

  totalIncomeToSpouse = (): number => {
    const data = this.f8958Data()
    if (!data) return 0
    return sumFields([
      data.wagesAllocatedToSpouse,
      data.interestAllocatedToSpouse,
      data.dividendsAllocatedToSpouse,
      data.stateRefundsAllocatedToSpouse,
      data.businessIncomeAllocatedToSpouse,
      data.capitalGainsAllocatedToSpouse,
      data.iraDistributionsAllocatedToSpouse,
      data.pensionsAllocatedToSpouse,
      data.rentalIncomeAllocatedToSpouse,
      data.otherIncomeAllocatedToSpouse
    ])
  }

  // Allocation percentages
  taxpayerAllocationPercent = (): number => {
    const total = this.totalIncomeToTaxpayer() + this.totalIncomeToSpouse()
    if (total === 0) return 50
    return Math.round((this.totalIncomeToTaxpayer() / total) * 100)
  }

  spouseAllocationPercent = (): number => {
    return 100 - this.taxpayerAllocationPercent()
  }

  // Federal withholding allocation
  federalWithholdingToTaxpayer = (): number => {
    return this.f8958Data()?.federalWithholdingAllocatedToTaxpayer ?? 0
  }

  federalWithholdingToSpouse = (): number => {
    return this.f8958Data()?.federalWithholdingAllocatedToSpouse ?? 0
  }

  fields = (): Field[] => {
    const data = this.f8958Data()

    return [
      // Header
      data?.taxpayerName ?? '',
      data?.taxpayerSSN ?? '',
      data?.spouseName ?? '',
      data?.spouseSSN ?? '',
      data?.communityPropertyState ?? '',
      this.isValidCommunityPropertyState(),
      // Part I: Income Allocation
      // Wages
      data?.wagesTotal ?? 0,
      data?.wagesAllocatedToTaxpayer ?? 0,
      data?.wagesAllocatedToSpouse ?? 0,
      // Interest
      data?.interestTotal ?? 0,
      data?.interestAllocatedToTaxpayer ?? 0,
      data?.interestAllocatedToSpouse ?? 0,
      // Dividends
      data?.dividendsTotal ?? 0,
      data?.dividendsAllocatedToTaxpayer ?? 0,
      data?.dividendsAllocatedToSpouse ?? 0,
      // State refunds
      data?.stateRefundsTotal ?? 0,
      data?.stateRefundsAllocatedToTaxpayer ?? 0,
      data?.stateRefundsAllocatedToSpouse ?? 0,
      // Business income
      data?.businessIncomeTotal ?? 0,
      data?.businessIncomeAllocatedToTaxpayer ?? 0,
      data?.businessIncomeAllocatedToSpouse ?? 0,
      // Capital gains
      data?.capitalGainsTotal ?? 0,
      data?.capitalGainsAllocatedToTaxpayer ?? 0,
      data?.capitalGainsAllocatedToSpouse ?? 0,
      // IRA distributions
      data?.iraDistributionsTotal ?? 0,
      data?.iraDistributionsAllocatedToTaxpayer ?? 0,
      data?.iraDistributionsAllocatedToSpouse ?? 0,
      // Pensions
      data?.pensionsTotal ?? 0,
      data?.pensionsAllocatedToTaxpayer ?? 0,
      data?.pensionsAllocatedToSpouse ?? 0,
      // Rental/Royalty
      data?.rentalIncomeTotal ?? 0,
      data?.rentalIncomeAllocatedToTaxpayer ?? 0,
      data?.rentalIncomeAllocatedToSpouse ?? 0,
      // Other income
      data?.otherIncomeTotal ?? 0,
      data?.otherIncomeAllocatedToTaxpayer ?? 0,
      data?.otherIncomeAllocatedToSpouse ?? 0,
      // Totals
      this.totalIncomeToTaxpayer(),
      this.totalIncomeToSpouse(),
      this.taxpayerAllocationPercent(),
      this.spouseAllocationPercent(),
      // Part II: Withholding
      data?.federalWithholdingTotal ?? 0,
      this.federalWithholdingToTaxpayer(),
      this.federalWithholdingToSpouse(),
      // Part III: Estimated payments
      data?.estimatedTaxPaymentsTotal ?? 0,
      data?.estimatedTaxPaymentsAllocatedToTaxpayer ?? 0,
      data?.estimatedTaxPaymentsAllocatedToSpouse ?? 0
    ]
  }
}
