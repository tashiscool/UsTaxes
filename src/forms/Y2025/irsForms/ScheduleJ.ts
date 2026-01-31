import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { computeOrdinaryTax } from './TaxTable'
import { FilingStatus } from 'ustaxes/core/data'
import { FarmBusiness, FarmIncome } from './ScheduleF'

/**
 * Schedule J (Form 1040) - Income Averaging for Farmers and Fishermen
 *
 * Allows farmers and fishermen to average their farm/fishing income
 * over the prior 3 years to reduce tax on fluctuating income.
 *
 * Eligible income:
 * - Net farm income (Schedule F)
 * - Fishing income (Schedule C for fishing)
 * - Gain from sale of farm assets
 *
 * Cannot use if:
 * - Using farm optional method for self-employment tax
 * - Had farming losses in any of the 3 prior years used for averaging
 */

export interface PriorYearTaxInfo {
  year: number
  taxableIncome: number
  tax: number
  filingStatus: FilingStatus
}

export default class ScheduleJ extends F1040Attachment {
  tag: FormTag = 'f1040sj'
  sequenceIndex = 20

  isNeeded = (): boolean => {
    return this.hasEligibleFarmIncome() && this.electsIncomeAveraging()
  }

  hasEligibleFarmIncome = (): boolean => {
    // Check if there's farm income from Schedule F
    const farm = this.f1040.info.farmBusiness as FarmBusiness | undefined
    return farm?.income !== undefined
  }

  electsIncomeAveraging = (): boolean => {
    return this.f1040.info.electFarmIncomeAveraging ?? false
  }

  priorYearTax = (yearsBack: number): PriorYearTaxInfo | undefined => {
    return this.f1040.info.priorYearTaxInfo?.[yearsBack - 1]
  }

  // Part I - Election To Average Farm Income

  // Line 1: Elected farm income
  l1 = (): number => {
    // Farm income from Schedule F or Schedule C (fishing)
    const farm = this.f1040.info.farmBusiness as FarmBusiness | undefined
    const farmIncome: FarmIncome = farm?.income ?? {
      salesLivestock: 0,
      salesCrops: 0,
      cooperativeDistributions: 0,
      agriculturalPayments: 0,
      cccLoans: 0,
      cropInsurance: 0,
      customHireIncome: 0,
      otherIncome: 0
    }
    const values = Object.values(farmIncome) as number[]
    return values.reduce((a, b) => a + b, 0)
  }

  // Part II - Computation of Tax Using Income Averaging

  // Base year (current year)
  // Line 2a: Taxable income (Form 1040 line 15)
  l2a = (): number => this.f1040.l15()

  // Line 2b: Elected farm income (from line 1)
  l2b = (): number => this.l1()

  // Line 2c: Subtract line 2b from line 2a
  l2c = (): number => Math.max(0, this.l2a() - this.l2b())

  // Line 2d: Tax on line 2c
  l2d = (): number => {
    return computeOrdinaryTax(this.f1040.info.taxPayer.filingStatus, this.l2c())
  }

  // Prior year 1 (1 year back)
  // Line 3a: Taxable income from prior year 1
  l3a = (): number => this.priorYearTax(1)?.taxableIncome ?? 0

  // Line 3b: 1/3 of elected farm income
  l3b = (): number => Math.round(this.l2b() / 3)

  // Line 3c: Add lines 3a and 3b
  l3c = (): number => this.l3a() + this.l3b()

  // Line 3d: Tax on line 3c
  l3d = (): number => {
    const fs = this.priorYearTax(1)?.filingStatus ?? this.f1040.info.taxPayer.filingStatus
    return computeOrdinaryTax(fs, this.l3c())
  }

  // Line 3e: Tax from prior year 1 return
  l3e = (): number => this.priorYearTax(1)?.tax ?? 0

  // Line 3f: Subtract line 3e from line 3d
  l3f = (): number => Math.max(0, this.l3d() - this.l3e())

  // Prior year 2 (2 years back)
  // Line 4a: Taxable income from prior year 2
  l4a = (): number => this.priorYearTax(2)?.taxableIncome ?? 0

  // Line 4b: 1/3 of elected farm income
  l4b = (): number => Math.round(this.l2b() / 3)

  // Line 4c: Add lines 4a and 4b
  l4c = (): number => this.l4a() + this.l4b()

  // Line 4d: Tax on line 4c
  l4d = (): number => {
    const fs = this.priorYearTax(2)?.filingStatus ?? this.f1040.info.taxPayer.filingStatus
    return computeOrdinaryTax(fs, this.l4c())
  }

  // Line 4e: Tax from prior year 2 return
  l4e = (): number => this.priorYearTax(2)?.tax ?? 0

  // Line 4f: Subtract line 4e from line 4d
  l4f = (): number => Math.max(0, this.l4d() - this.l4e())

  // Prior year 3 (3 years back)
  // Line 5a: Taxable income from prior year 3
  l5a = (): number => this.priorYearTax(3)?.taxableIncome ?? 0

  // Line 5b: 1/3 of elected farm income
  l5b = (): number => Math.round(this.l2b() / 3)

  // Line 5c: Add lines 5a and 5b
  l5c = (): number => this.l5a() + this.l5b()

  // Line 5d: Tax on line 5c
  l5d = (): number => {
    const fs = this.priorYearTax(3)?.filingStatus ?? this.f1040.info.taxPayer.filingStatus
    return computeOrdinaryTax(fs, this.l5c())
  }

  // Line 5e: Tax from prior year 3 return
  l5e = (): number => this.priorYearTax(3)?.tax ?? 0

  // Line 5f: Subtract line 5e from line 5d
  l5f = (): number => Math.max(0, this.l5d() - this.l5e())

  // Line 6: Add lines 2d, 3f, 4f, and 5f (tax using income averaging)
  l6 = (): number => {
    return this.l2d() + this.l3f() + this.l4f() + this.l5f()
  }

  // Tax from income averaging (to Form 1040 line 16)
  tax = (): number => this.l6()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    // Part II - Base year
    this.l2a(),
    this.l2b(),
    this.l2c(),
    this.l2d(),
    // Prior year 1
    this.l3a(),
    this.l3b(),
    this.l3c(),
    this.l3d(),
    this.l3e(),
    this.l3f(),
    // Prior year 2
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l4d(),
    this.l4e(),
    this.l4f(),
    // Prior year 3
    this.l5a(),
    this.l5b(),
    this.l5c(),
    this.l5d(),
    this.l5e(),
    this.l5f(),
    // Total
    this.l6()
  ]
}
