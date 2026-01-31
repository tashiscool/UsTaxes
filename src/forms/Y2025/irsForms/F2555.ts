import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 2555 - Foreign Earned Income Exclusion
 *
 * Allows US citizens and resident aliens living abroad to exclude
 * foreign earned income from US taxation.
 *
 * Key concepts:
 * - Foreign Earned Income Exclusion (FEIE): Up to $130,000 for 2025
 * - Foreign Housing Exclusion/Deduction: Additional exclusion for housing costs
 * - Bona Fide Residence Test: Full tax year as bona fide resident of foreign country
 * - Physical Presence Test: Present in foreign country 330 days in 12-month period
 *
 * 2025 Limits:
 * - Maximum exclusion: $130,000 (indexed for inflation)
 * - Housing exclusion base: 16% of exclusion ($20,800)
 * - Housing maximum: Varies by location (30% default = $39,000)
 */

// 2025 parameters
const feieParams = {
  maxExclusion: 130000,           // Maximum foreign earned income exclusion
  housingBasePercent: 0.16,       // 16% base housing amount
  housingMaxPercent: 0.30,        // 30% default maximum housing
  dailyExclusionRate: 130000 / 365  // Daily proration rate
}

export interface ForeignEarnedIncomeData {
  foreignCountry: string
  foreignAddress: string
  employerName?: string
  employerAddress?: string
  employerIsForeign: boolean
  foreignEarnedWages: number
  foreignEarnedSelfEmployment: number
  foreignHousingAmount: number
  qualifyingTest: 'bonaFideResident' | 'physicalPresence'
  taxHomeCountry: string
  residenceStartDate?: Date
  residenceEndDate?: Date
  physicalPresenceDays?: number
  physicalPresenceStartDate?: Date
  physicalPresenceEndDate?: Date
}

export default class F2555 extends F1040Attachment {
  tag: FormTag = 'f2555'
  sequenceIndex = 34

  isNeeded = (): boolean => {
    return this.hasForeignEarnedIncome()
  }

  hasForeignEarnedIncome = (): boolean => {
    const fei = this.foreignEarnedIncomeData()
    return fei !== undefined &&
      ((fei.foreignEarnedWages ?? 0) > 0 || (fei.foreignEarnedSelfEmployment ?? 0) > 0)
  }

  foreignEarnedIncomeData = (): ForeignEarnedIncomeData | undefined => {
    return this.f1040.info.foreignEarnedIncome as ForeignEarnedIncomeData | undefined
  }

  // Calculate qualifying days for proration
  qualifyingDays = (): number => {
    const data = this.foreignEarnedIncomeData()
    if (!data) return 0

    if (data.qualifyingTest === 'bonaFideResident') {
      // Full year for bona fide resident (or partial if started/ended mid-year)
      if (data.residenceStartDate && data.residenceEndDate) {
        const start = new Date(Math.max(
          new Date(data.residenceStartDate).getTime(),
          new Date(2025, 0, 1).getTime()
        ))
        const end = new Date(Math.min(
          new Date(data.residenceEndDate).getTime(),
          new Date(2025, 11, 31).getTime()
        ))
        return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      }
      return 365  // Full year
    } else {
      // Physical presence test
      return data.physicalPresenceDays ?? 0
    }
  }

  // Part I - General Information (simplified)

  // Part II - Taxpayers Qualifying Under Bona Fide Residence Test
  qualifiesBonaFide = (): boolean => {
    return this.foreignEarnedIncomeData()?.qualifyingTest === 'bonaFideResident'
  }

  // Part III - Taxpayers Qualifying Under Physical Presence Test
  qualifiesPhysicalPresence = (): boolean => {
    return this.foreignEarnedIncomeData()?.qualifyingTest === 'physicalPresence'
  }

  // Part IV - All Taxpayers

  // Line 19: Date bona fide residence began (for bona fide test)
  // Line 20: Date bona fide residence ended

  // Part V - All Taxpayers (Tax Home Test)
  taxHomeCountry = (): string => {
    return this.foreignEarnedIncomeData()?.taxHomeCountry ?? ''
  }

  // Part VI - Figure Your Foreign Earned Income Exclusion

  // Line 1: Reserved

  // Line 2: Reserved

  // Line 3: Reserved (used by Capital Gain Worksheet)
  l3 = (): number | undefined => undefined

  // Line 19: Total foreign earned income
  l19 = (): number => {
    const data = this.foreignEarnedIncomeData()
    if (!data) return 0
    return (data.foreignEarnedWages ?? 0) + (data.foreignEarnedSelfEmployment ?? 0)
  }

  // Line 20-23: Employer-provided amounts (simplified)

  // Line 24: Your foreign earned income
  l24 = (): number => this.l19()

  // Line 25: Spouse's foreign earned income (for MFJ)
  l25 = (): number => {
    // Simplified - would need spouse's Form 2555
    return 0
  }

  // Line 26: Add lines 24 and 25
  l26 = (): number => this.l24() + this.l25()

  // Part VII - Figure Your Housing Exclusion

  // Line 27: Qualified housing expenses
  l27 = (): number => {
    return this.foreignEarnedIncomeData()?.foreignHousingAmount ?? 0
  }

  // Line 28: Base housing amount (16% of max exclusion, prorated)
  l28 = (): number => {
    const days = this.qualifyingDays()
    const baseAmount = feieParams.maxExclusion * feieParams.housingBasePercent
    return Math.round(baseAmount * (days / 365))
  }

  // Line 29: Subtract line 28 from line 27
  l29 = (): number => Math.max(0, this.l27() - this.l28())

  // Line 30: Housing limit (varies by location - using default 30%)
  l30 = (): number => {
    const days = this.qualifyingDays()
    const maxHousing = feieParams.maxExclusion * feieParams.housingMaxPercent
    return Math.round(maxHousing * (days / 365))
  }

  // Line 31: Subtract line 28 from line 30
  l31 = (): number => Math.max(0, this.l30() - this.l28())

  // Line 32: Enter smaller of line 29 or line 31
  l32 = (): number => Math.min(this.l29(), this.l31())

  // Line 33: Enter smaller of line 26 or line 32 (housing exclusion)
  l33 = (): number => Math.min(this.l26(), this.l32())

  // Part VIII - Figure Your Foreign Earned Income Exclusion

  // Line 34: Subtract line 33 from line 26
  l34 = (): number => this.l26() - this.l33()

  // Line 35: Maximum foreign earned income exclusion (prorated)
  l35 = (): number => {
    const days = this.qualifyingDays()
    return Math.round(feieParams.maxExclusion * (days / 365))
  }

  // Line 36: Foreign earned income exclusion for AMT (Form 6251)
  l36 = (): number => {
    // Enter the smaller of line 34 or line 35
    return Math.min(this.l34(), this.l35())
  }

  // Part IX - Housing Deduction (for self-employed)

  // Line 37-41: Housing deduction calculation for self-employed

  // Line 42: Housing deduction (for Form 6251)
  l42 = (): number => {
    // If self-employed, can claim as deduction instead of exclusion
    const data = this.foreignEarnedIncomeData()
    if (!data || data.foreignEarnedSelfEmployment === 0) return 0

    // Calculate portion attributable to self-employment
    const selfEmploymentRatio = data.foreignEarnedSelfEmployment / this.l19()
    const housingDeduction = Math.round(this.l33() * selfEmploymentRatio)

    return housingDeduction
  }

  // Line 43: Add lines 36 and 42 (total exclusion/deduction)
  l43 = (): number => this.l36() + this.l42()

  // Line 44: Foreign earned income minus exclusions
  l44 = (): number => Math.max(0, this.l19() - this.l43())

  // Line 45: Total exclusion for 8812 and education credits
  l45 = (): number => this.l36()

  // Line 50: For Form 6251 and 8812
  l50 = (): number => this.l43()

  // Summary methods

  // Foreign earned income exclusion (goes to Form 1040 line 1d adjustment)
  foreignEarnedIncomeExclusion = (): number => this.l36()

  // Housing exclusion
  housingExclusion = (): number => this.l33()

  // Housing deduction (for self-employed - goes to Schedule 1)
  housingDeduction = (): number => this.l42()

  // Total exclusion
  totalExclusion = (): number => this.l43()

  fields = (): Field[] => {
    const data = this.foreignEarnedIncomeData()

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Part I - General Information
      data?.foreignCountry ?? '',
      data?.foreignAddress ?? '',
      // Part II/III - Qualifying Test
      this.qualifiesBonaFide(),
      this.qualifiesPhysicalPresence(),
      data?.physicalPresenceDays ?? 0,
      // Part IV/V
      this.taxHomeCountry(),
      // Part VI - Foreign Earned Income
      this.l19(),
      this.l24(),
      this.l25(),
      this.l26(),
      // Part VII - Housing
      this.l27(),
      this.l28(),
      this.l29(),
      this.l30(),
      this.l31(),
      this.l32(),
      this.l33(),
      // Part VIII - Exclusion
      this.l34(),
      this.l35(),
      this.l36(),
      // Part IX - Housing Deduction
      this.l42(),
      this.l43(),
      this.l44(),
      this.l45(),
      this.l50()
    ]
  }
}
