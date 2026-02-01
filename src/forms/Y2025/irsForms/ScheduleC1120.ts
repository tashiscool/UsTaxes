import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule C (Form 1120) - Dividends, Inclusions, and Special Deductions
 *
 * Used by C-Corporations to report:
 * - Dividends received from domestic and foreign corporations
 * - Dividends received deduction (DRD)
 * - Inclusions under sections 951, 951A, 965
 * - Other special deductions
 *
 * DRD Percentages (2025):
 * - 50% for less than 20% ownership
 * - 65% for 20% or more but less than 80% ownership
 * - 100% for 80% or more ownership (affiliated group)
 */

export interface DividendReceived {
  payerName: string
  payerEIN?: string
  ownershipPercentage: number
  dividendAmount: number
  isQualifiedDividend: boolean
  isForeignSource: boolean
  foreignCountry?: string
}

export interface ScheduleC1120Data {
  // Dividends from domestic corporations
  domesticDividends: DividendReceived[]
  // Dividends from foreign corporations
  foreignDividends: DividendReceived[]
  // Section 951 inclusions (Subpart F income)
  subpartFInclusions: number
  // Section 951A inclusions (GILTI)
  giltiInclusions: number
  // Section 965 transition tax
  section965Inclusions: number
  // Other inclusions
  otherInclusions: number
}

// DRD percentages based on ownership
const DRD_RATES = {
  lessThan20: 0.5, // 50% DRD
  between20And80: 0.65, // 65% DRD
  over80: 1.0 // 100% DRD (affiliated group)
}

export default class ScheduleC1120 extends F1040Attachment {
  tag: FormTag = 'f1120sc'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasDividendData()
  }

  hasDividendData = (): boolean => {
    const cCorps = this.f1040.info.cCorpOwnership
    return cCorps !== undefined && cCorps.length > 0
  }

  scheduleC1120Data = (): ScheduleC1120Data | undefined => {
    return undefined // Would be populated from entity data
  }

  // Dividends from domestic corporations

  domesticDividends = (): DividendReceived[] => {
    return this.scheduleC1120Data()?.domesticDividends ?? []
  }

  // Line 1: Dividends from less-than-20%-owned domestic corporations
  dividendsLessThan20 = (): number => {
    return this.domesticDividends()
      .filter((d) => d.ownershipPercentage < 20)
      .reduce((sum, d) => sum + d.dividendAmount, 0)
  }

  drdLessThan20 = (): number => {
    return Math.round(this.dividendsLessThan20() * DRD_RATES.lessThan20)
  }

  // Line 2: Dividends from 20%-or-more-owned domestic corporations
  dividends20To80 = (): number => {
    return this.domesticDividends()
      .filter((d) => d.ownershipPercentage >= 20 && d.ownershipPercentage < 80)
      .reduce((sum, d) => sum + d.dividendAmount, 0)
  }

  drd20To80 = (): number => {
    return Math.round(this.dividends20To80() * DRD_RATES.between20And80)
  }

  // Line 3: Dividends from wholly-owned domestic subsidiaries
  dividendsOver80 = (): number => {
    return this.domesticDividends()
      .filter((d) => d.ownershipPercentage >= 80)
      .reduce((sum, d) => sum + d.dividendAmount, 0)
  }

  drdOver80 = (): number => {
    return Math.round(this.dividendsOver80() * DRD_RATES.over80)
  }

  // Total domestic dividends
  totalDomesticDividends = (): number => {
    return (
      this.dividendsLessThan20() +
      this.dividends20To80() +
      this.dividendsOver80()
    )
  }

  // Total DRD for domestic dividends
  totalDomesticDRD = (): number => {
    return this.drdLessThan20() + this.drd20To80() + this.drdOver80()
  }

  // Foreign dividends

  foreignDividends = (): DividendReceived[] => {
    return this.scheduleC1120Data()?.foreignDividends ?? []
  }

  totalForeignDividends = (): number => {
    return this.foreignDividends().reduce((sum, d) => sum + d.dividendAmount, 0)
  }

  // Foreign-derived dividends eligible for DRD
  foreignDRD = (): number => {
    // Simplified - actual calculation is more complex
    return Math.round(this.totalForeignDividends() * 0.5)
  }

  // Inclusions

  // Section 951 - Subpart F income
  subpartFInclusions = (): number =>
    this.scheduleC1120Data()?.subpartFInclusions ?? 0

  // Section 951A - GILTI
  giltiInclusions = (): number => this.scheduleC1120Data()?.giltiInclusions ?? 0

  // Section 965 - Transition tax
  section965Inclusions = (): number =>
    this.scheduleC1120Data()?.section965Inclusions ?? 0

  // Other inclusions
  otherInclusions = (): number => this.scheduleC1120Data()?.otherInclusions ?? 0

  // Total inclusions
  totalInclusions = (): number => {
    return sumFields([
      this.subpartFInclusions(),
      this.giltiInclusions(),
      this.section965Inclusions(),
      this.otherInclusions()
    ])
  }

  // Grand totals

  // Total dividends (domestic + foreign)
  totalDividends = (): number => {
    return this.totalDomesticDividends() + this.totalForeignDividends()
  }

  // Total DRD (domestic + foreign)
  totalDRD = (): number => {
    return this.totalDomesticDRD() + this.foreignDRD()
  }

  // To Form 1120 Line 4 (Dividends)
  toForm1120Line4 = (): number => this.totalDividends() + this.totalInclusions()

  // To Form 1120 Line 29b (Special Deductions)
  toForm1120Line29b = (): number => this.totalDRD()

  fields = (): Field[] => {
    const domesticDivs = this.domesticDividends()
    const foreignDivs = this.foreignDividends()

    return [
      // Part I: Dividends from Domestic Corporations
      // Line 1: Less than 20% owned
      this.dividendsLessThan20(),
      DRD_RATES.lessThan20 * 100,
      this.drdLessThan20(),
      // Line 2: 20% or more owned
      this.dividends20To80(),
      DRD_RATES.between20And80 * 100,
      this.drd20To80(),
      // Line 3: Wholly owned (80%+)
      this.dividendsOver80(),
      DRD_RATES.over80 * 100,
      this.drdOver80(),
      // Subtotal
      this.totalDomesticDividends(),
      this.totalDomesticDRD(),

      // Part II: Dividends from Foreign Corporations
      this.totalForeignDividends(),
      this.foreignDRD(),

      // Part III: Inclusions
      this.subpartFInclusions(),
      this.giltiInclusions(),
      this.section965Inclusions(),
      this.otherInclusions(),
      this.totalInclusions(),

      // Totals
      this.totalDividends(),
      this.totalDRD(),
      this.toForm1120Line4(),
      this.toForm1120Line29b(),

      // First domestic dividend detail
      domesticDivs[0]?.payerName ?? '',
      domesticDivs[0]?.ownershipPercentage ?? 0,
      domesticDivs[0]?.dividendAmount ?? 0,
      // First foreign dividend detail
      foreignDivs[0]?.payerName ?? '',
      foreignDivs[0]?.foreignCountry ?? '',
      foreignDivs[0]?.dividendAmount ?? 0
    ]
  }
}
