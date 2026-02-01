import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 4797 - Sales of Business Property
 *
 * Used to report:
 * - Sale or exchange of property used in a trade or business
 * - Involuntary conversions (from casualties/thefts) of business property
 * - Disposition of noncapital assets
 * - Recapture of depreciation (Section 1245 and 1250 property)
 *
 * Key sections:
 * - Part I: Sales of property held more than 1 year (Section 1231)
 * - Part II: Ordinary gains and losses
 * - Part III: Gain from disposition of property (Sections 1245, 1250, etc.)
 * - Part IV: Recapture amounts
 */

export type PropertyType = 'real' | 'personal' | 'intangible'
export type RecaptureType =
  | 'section1245'
  | 'section1250'
  | 'section1252'
  | 'section1254'
  | 'section1255'

export interface BusinessPropertySale {
  description: string
  dateAcquired: Date
  dateSold: Date
  grossSalesPrice: number
  costOrBasis: number
  depreciation: number // Total depreciation allowed or allowable
  expenseOfSale: number
  propertyType: PropertyType
  recaptureType?: RecaptureType
  isSection1231Property: boolean
  isRelatedParty: boolean
  installmentSale: boolean
}

export default class F4797 extends F1040Attachment {
  tag: FormTag = 'f4797'
  sequenceIndex = 27

  isNeeded = (): boolean => {
    return this.hasBusinessPropertySales()
  }

  hasBusinessPropertySales = (): boolean => {
    const sales = this.businessPropertySales()
    return sales.length > 0
  }

  businessPropertySales = (): BusinessPropertySale[] => {
    return (
      (this.f1040.info.businessPropertySales as
        | BusinessPropertySale[]
        | undefined) ?? []
    )
  }

  // Separate sales by type
  section1231Sales = (): BusinessPropertySale[] => {
    return this.businessPropertySales().filter((s) => s.isSection1231Property)
  }

  ordinarySales = (): BusinessPropertySale[] => {
    return this.businessPropertySales().filter((s) => !s.isSection1231Property)
  }

  // Part I - Sales or Exchanges of Property Used in a Trade or Business
  // and Involuntary Conversions From Other Than Casualty or Theft
  // (Property held more than 1 year)

  // Line 2: Gross proceeds from sales
  l2 = (): number => {
    return this.section1231Sales().reduce(
      (sum, s) => sum + s.grossSalesPrice,
      0
    )
  }

  // Line 3: Cost or adjusted basis plus expense of sale
  l3 = (): number => {
    return this.section1231Sales().reduce((sum, s) => {
      const adjustedBasis = s.costOrBasis - s.depreciation
      return sum + adjustedBasis + s.expenseOfSale
    }, 0)
  }

  // Line 4: Gain (loss) from line 2 minus line 3
  l4 = (): number => this.l2() - this.l3()

  // Line 5: Section 1231 gain from installment sales (Form 6252)
  l5 = (): number => {
    return this.f1040.f6252?.section1231Gain() ?? 0
  }

  // Line 6: Section 1231 gain from like-kind exchanges (Form 8824)
  l6 = (): number => {
    return this.f1040.f8824?.recognizedGain() ?? 0
  }

  // Line 7: Gain from Part III (below)
  l7 = (): number => this.l31()

  // Line 8: Total gains (lines 4 + 5 + 6 + 7)
  l8 = (): number =>
    sumFields([this.l4() > 0 ? this.l4() : 0, this.l5(), this.l6(), this.l7()])

  // Line 9: Total losses
  l9 = (): number => (this.l4() < 0 ? Math.abs(this.l4()) : 0)

  // Line 10: Recapture of prior section 1231 losses (5-year lookback)
  l10 = (): number => {
    // Prior year 1231 losses must be recaptured as ordinary income
    // Simplified - would need historical data
    return this.f1040.info.priorSection1231Losses ?? 0
  }

  // Line 11: Net section 1231 gain treated as ordinary income (smaller of line 8 or line 10)
  l11 = (): number => Math.min(this.l8(), this.l10())

  // Line 12: If line 8 is more than line 10, enter excess. Otherwise enter -0-
  // This is a net section 1231 gain (treated as long-term capital gain)
  l12 = (): number => Math.max(0, this.l8() - this.l10())

  // Part II - Ordinary Gains and Losses

  // Line 13: Ordinary gains from Part I, line 11
  l13 = (): number => this.l11()

  // Line 14: Loss from Part I
  l14 = (): number => this.l9()

  // Line 15: Gain from Form 4684 line 39 (casualties/thefts)
  l15 = (): number => {
    return this.f1040.f4684?.businessCasualtyGain() ?? 0
  }

  // Line 16: Gain from Form 6781 (Section 1256 contracts)
  l16 = (): number => 0 // Not implemented

  // Line 17: Ordinary gain from installment sales (Form 6252 line 25 or 36)
  l17 = (): number => {
    return this.f1040.f6252?.ordinaryGain() ?? 0
  }

  // Line 18a: Ordinary gain from like-kind exchanges
  l18a = (): number => 0

  // Line 18b: Recapture of section 179 deduction
  l18b = (): number => {
    // When business use drops below 50%, Section 179 must be recaptured
    return this.f1040.info.section179Recapture ?? 0
  }

  // Line 19: Total (add lines 13-18b)
  l19 = (): number => {
    return sumFields([
      this.l13(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18a(),
      this.l18b()
    ])
  }

  // Line 20: Total losses (add lines 14, etc.)
  l20 = (): number => this.l14()

  // Line 21: Combine lines 19 and 20
  l21 = (): number => this.l19() - this.l20()

  // Part III - Gain From Disposition of Property Under Sections 1245, 1250, 1252, 1254, and 1255

  // Process sales with depreciation recapture
  recaptureSales = (): BusinessPropertySale[] => {
    return this.businessPropertySales().filter((s) => s.depreciation > 0)
  }

  // Line 22: Description of property (aggregate)
  l22Description = (): string => {
    return this.recaptureSales()
      .map((s) => s.description)
      .join('; ')
  }

  // Line 22a: Date acquired
  l22a = (): Date | undefined => this.recaptureSales()[0]?.dateAcquired

  // Line 22b: Date sold
  l22b = (): Date | undefined => this.recaptureSales()[0]?.dateSold

  // Line 23: Gross sales price
  l23 = (): number => {
    return this.recaptureSales().reduce((sum, s) => sum + s.grossSalesPrice, 0)
  }

  // Line 24: Cost or other basis plus expense of sale
  l24 = (): number => {
    return this.recaptureSales().reduce(
      (sum, s) => sum + s.costOrBasis + s.expenseOfSale,
      0
    )
  }

  // Line 25: Depreciation allowed or allowable
  l25 = (): number => {
    return this.recaptureSales().reduce((sum, s) => sum + s.depreciation, 0)
  }

  // Line 26: Adjusted basis (line 24 minus line 25)
  l26 = (): number => this.l24() - this.l25()

  // Line 27: Total gain (line 23 minus line 26)
  l27 = (): number => Math.max(0, this.l23() - this.l26())

  // Line 28: Section 1245 recapture (smaller of line 25 or line 27)
  // For personal property, all depreciation is recaptured as ordinary income
  l28 = (): number => {
    const section1245Sales = this.recaptureSales().filter(
      (s) => s.recaptureType === 'section1245' || s.propertyType === 'personal'
    )
    const depreciation = section1245Sales.reduce(
      (sum, s) => sum + s.depreciation,
      0
    )
    const gain = section1245Sales.reduce((sum, s) => {
      const adjustedBasis = s.costOrBasis - s.depreciation
      return (
        sum + Math.max(0, s.grossSalesPrice - adjustedBasis - s.expenseOfSale)
      )
    }, 0)
    return Math.min(depreciation, gain)
  }

  // Line 29: Section 1250 recapture (real property - excess depreciation)
  // For real property, only excess depreciation over straight-line is recaptured
  l29 = (): number => {
    // Simplified - straight-line is typically used for real property after 1986
    // So Section 1250 recapture is usually 0
    return 0
  }

  // Line 30: Other recapture amounts (sections 1252, 1254, 1255)
  l30 = (): number => 0

  // Line 31: Add lines 28, 29, and 30 (total recapture as ordinary income)
  l31 = (): number => sumFields([this.l28(), this.l29(), this.l30()])

  // Line 32: Remaining gain (line 27 minus line 31)
  // This is section 1231 gain
  l32 = (): number => Math.max(0, this.l27() - this.l31())

  // Part IV - Recapture Amounts Under Sections 179 and 280F(b)(2)

  // Line 33: Section 179 expense deduction recapture
  l33 = (): number => this.l18b()

  // Summary amounts for other forms

  // Ordinary income to Schedule 1 or other schedules
  ordinaryIncome = (): number => (this.l21() > 0 ? this.l21() : 0)

  // Ordinary loss to Schedule 1 or other schedules
  ordinaryLoss = (): number => (this.l21() < 0 ? Math.abs(this.l21()) : 0)

  // Section 1231 gain to Schedule D
  section1231Gain = (): number => this.l12()

  // Amounts required by Schedule EIC / Pub 596
  // These are the gains that need to be reported for EIC calculation

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    // Part II
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18a(),
    this.l18b(),
    this.l19(),
    this.l20(),
    this.l21(),
    // Part III
    this.l22Description(),
    this.l22a()?.toLocaleDateString() ?? '',
    this.l22b()?.toLocaleDateString() ?? '',
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    // Part IV
    this.l33()
  ]
}
