import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule J (Form 1041) - Accumulation Distribution for Certain Complex Trusts
 *
 * Used by complex trusts that make accumulation distributions to beneficiaries.
 * This applies the "throwback rules" to tax accumulation distributions.
 *
 * Key concepts:
 * - Accumulation distribution: Distribution in excess of DNI
 * - Throwback rules: Tax as if distributed in prior years
 * - Taxes deemed distributed: Trust's taxes allocated to beneficiary
 *
 * This schedule is required when a complex trust distributes more than
 * its current year's distributable net income (DNI).
 */

export interface AccumulationYear {
  year: number
  undistributedNetIncome: number
  taxesPaid: number
  distributableNetIncome: number
}

export interface Schedule1041JData {
  // Accumulation distribution
  totalAccumulationDistribution: number
  // Prior years' undistributed income
  priorYears: AccumulationYear[]
  // Throwback calculations
  averageAnnualDistribution: number
  taxesDeemedDistributed: number
  // Beneficiary information
  beneficiaryName: string
  beneficiarySSN: string
  beneficiarySharePercent: number
}

export default class Schedule1041J extends F1040Attachment {
  tag: FormTag = 'f1041sj'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasAccumulationData()
  }

  hasAccumulationData = (): boolean => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn
    return fiduciaryReturn !== undefined
  }

  schedule1041JData = (): Schedule1041JData | undefined => {
    return undefined  // Would be populated from trust data
  }

  // Part I: Accumulation Distribution

  // Line 1: Accumulation distribution
  l1 = (): number => this.schedule1041JData()?.totalAccumulationDistribution ?? 0

  // Line 2: Undistributed net income (UNI) for earliest year
  l2 = (): number => {
    const years = this.schedule1041JData()?.priorYears ?? []
    if (years.length === 0) return 0
    return years[0]?.undistributedNetIncome ?? 0
  }

  // Line 3: Allocate to UNI for prior years
  priorYears = (): AccumulationYear[] => {
    return this.schedule1041JData()?.priorYears ?? []
  }

  // Total UNI for all prior years
  totalUNI = (): number => {
    return this.priorYears().reduce((sum, y) => sum + y.undistributedNetIncome, 0)
  }

  // Part II: Taxes Deemed Distributed

  // Taxes for each prior year
  totalTaxesPriorYears = (): number => {
    return this.priorYears().reduce((sum, y) => sum + y.taxesPaid, 0)
  }

  // Line 4: Total taxes deemed distributed
  l4 = (): number => this.schedule1041JData()?.taxesDeemedDistributed ?? 0

  // Part III: Tax Computation Using Averaging

  // Line 5: Number of throwback years
  l5 = (): number => this.priorYears().length

  // Line 6: Average annual distribution
  l6 = (): number => {
    const numYears = this.l5()
    if (numYears === 0) return 0
    return Math.round(this.l1() / numYears)
  }

  // Line 7: Compute tax on average annual distribution
  // Using simplified single-rate calculation
  l7 = (): number => {
    const avgDist = this.l6()
    // Simplified - would use actual tax rates for the years
    return Math.round(avgDist * 0.25)  // Approximate average rate
  }

  // Line 8: Multiply line 7 by line 5
  l8 = (): number => this.l7() * this.l5()

  // Line 9: Subtract taxes deemed distributed
  l9 = (): number => Math.max(0, this.l8() - this.l4())

  // Part IV: Beneficiary's Tax on Accumulation Distribution

  beneficiaryName = (): string => this.schedule1041JData()?.beneficiaryName ?? ''
  beneficiarySSN = (): string => this.schedule1041JData()?.beneficiarySSN ?? ''
  beneficiarySharePercent = (): number => this.schedule1041JData()?.beneficiarySharePercent ?? 100

  // Beneficiary's share of accumulation distribution
  beneficiaryShare = (): number => {
    return Math.round(this.l1() * (this.beneficiarySharePercent() / 100))
  }

  // Beneficiary's share of taxes deemed distributed
  beneficiaryTaxesDeemedDistributed = (): number => {
    return Math.round(this.l4() * (this.beneficiarySharePercent() / 100))
  }

  // Beneficiary's additional tax
  beneficiaryAdditionalTax = (): number => {
    return Math.round(this.l9() * (this.beneficiarySharePercent() / 100))
  }

  fields = (): Field[] => {
    const years = this.priorYears()

    return [
      // Part I: Accumulation Distribution
      this.l1(),
      this.l2(),
      // Prior years
      years[0]?.year ?? 0,
      years[0]?.undistributedNetIncome ?? 0,
      years[0]?.taxesPaid ?? 0,
      years[1]?.year ?? 0,
      years[1]?.undistributedNetIncome ?? 0,
      years[1]?.taxesPaid ?? 0,
      years[2]?.year ?? 0,
      years[2]?.undistributedNetIncome ?? 0,
      years[2]?.taxesPaid ?? 0,
      this.totalUNI(),
      this.totalTaxesPriorYears(),
      // Part II: Taxes Deemed Distributed
      this.l4(),
      // Part III: Tax Computation
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      // Part IV: Beneficiary
      this.beneficiaryName(),
      this.beneficiarySSN(),
      this.beneficiarySharePercent(),
      this.beneficiaryShare(),
      this.beneficiaryTaxesDeemedDistributed(),
      this.beneficiaryAdditionalTax()
    ]
  }
}
