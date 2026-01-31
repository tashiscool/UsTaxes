import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule I (Form 1041) - Alternative Minimum Tax - Estates and Trusts
 *
 * Computes the alternative minimum tax (AMT) for estates and trusts.
 *
 * Key calculations:
 * - AMT income adjustments
 * - AMT exemption amount
 * - Tentative minimum tax
 * - AMT
 *
 * 2025 AMT Exemption for Trusts/Estates: $30,550
 * (Phase out begins at $102,450)
 */

// 2025 AMT Constants for Trusts/Estates
const AMT_EXEMPTION = 30550
const AMT_PHASEOUT_START = 102450
const AMT_RATE_26 = 0.26
const AMT_RATE_28 = 0.28
const AMT_28_THRESHOLD = 220700

export interface Schedule1041IData {
  // Adjustments and preferences
  taxableIncome: number
  // Add back
  interestOnPrivateActivityBonds: number
  depreciationAdjustment: number
  passiveLossAdjustment: number
  deductionForDNI: number
  netOperatingLossDeduction: number
  // Other
  otherAdjustments: number
  taxPreferenceItems: number
  // AMT foreign tax credit
  amtForeignTaxCredit: number
}

export default class Schedule1041I extends F1040Attachment {
  tag: FormTag = 'f1041si'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasAMTData()
  }

  hasAMTData = (): boolean => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn
    return fiduciaryReturn !== undefined
  }

  schedule1041IData = (): Schedule1041IData | undefined => {
    return undefined  // Would be populated from estate/trust data
  }

  // Part I: Estate's or Trust's Share of AMT Items

  // Line 1: Taxable income from Form 1041 line 23
  l1 = (): number => this.schedule1041IData()?.taxableIncome ?? 0

  // Line 2: Interest on private activity bonds
  l2 = (): number => this.schedule1041IData()?.interestOnPrivateActivityBonds ?? 0

  // Line 3: Depreciation adjustment
  l3 = (): number => this.schedule1041IData()?.depreciationAdjustment ?? 0

  // Line 4: Passive loss adjustment
  l4 = (): number => this.schedule1041IData()?.passiveLossAdjustment ?? 0

  // Line 5: Deduction for distributions to beneficiaries for DNI
  l5 = (): number => this.schedule1041IData()?.deductionForDNI ?? 0

  // Line 6: Net operating loss deduction
  l6 = (): number => this.schedule1041IData()?.netOperatingLossDeduction ?? 0

  // Line 7: Other adjustments
  l7 = (): number => this.schedule1041IData()?.otherAdjustments ?? 0

  // Line 8: Tax preference items
  l8 = (): number => this.schedule1041IData()?.taxPreferenceItems ?? 0

  // Line 9: Alternative tax net operating loss deduction
  l9 = (): number => 0  // Calculated from prior year losses

  // Line 10: Alternative minimum taxable income
  l10 = (): number => {
    return sumFields([
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8()
    ]) - this.l9()
  }

  // Part II: Income Distribution Deduction on a Minimum Tax Basis
  // Simplified - would require detailed calculations

  // Line 11: AMTI from line 10
  l11 = (): number => this.l10()

  // Part III: Exemption Amount

  // Line 22: AMTI (from line 11 or line 21)
  l22 = (): number => this.l11()

  // Line 23: Exemption amount
  l23 = (): number => {
    const amti = this.l22()
    if (amti <= AMT_PHASEOUT_START) return AMT_EXEMPTION

    // Phase out exemption (25 cents per dollar over threshold)
    const excess = amti - AMT_PHASEOUT_START
    const reduction = Math.round(excess * 0.25)
    return Math.max(0, AMT_EXEMPTION - reduction)
  }

  // Line 24: AMTI minus exemption
  l24 = (): number => Math.max(0, this.l22() - this.l23())

  // Part IV: Tentative Minimum Tax

  // Line 25: Compute tax on line 24
  computeAMT = (): number => {
    const amount = this.l24()
    if (amount <= 0) return 0

    if (amount <= AMT_28_THRESHOLD) {
      return Math.round(amount * AMT_RATE_26)
    } else {
      return Math.round(AMT_28_THRESHOLD * AMT_RATE_26 + (amount - AMT_28_THRESHOLD) * AMT_RATE_28)
    }
  }

  l25 = (): number => this.computeAMT()

  // Line 26: AMT foreign tax credit
  l26 = (): number => this.schedule1041IData()?.amtForeignTaxCredit ?? 0

  // Line 27: Tentative minimum tax
  l27 = (): number => Math.max(0, this.l25() - this.l26())

  // Line 28: Regular tax (from Schedule G)
  l28 = (): number => 0  // Would come from Schedule G

  // Line 29: Alternative minimum tax
  l29 = (): number => Math.max(0, this.l27() - this.l28())

  // To Form 1041 Schedule G Line 4
  toScheduleGLine4 = (): number => this.l29()

  fields = (): Field[] => {
    return [
      // Part I: Adjustments
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      // Part II: Distribution deduction
      this.l11(),
      // Part III: Exemption
      this.l22(),
      this.l23(),
      this.l24(),
      // Part IV: Tax
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      // To Schedule G
      this.toScheduleGLine4()
    ]
  }
}
