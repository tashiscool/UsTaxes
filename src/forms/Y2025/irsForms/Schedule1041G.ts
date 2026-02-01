import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule G (Form 1041) - Tax Computation and Payments
 *
 * Used to compute the tax for estates and trusts.
 * Includes:
 * - Tax computation (using trust tax rates)
 * - Alternative minimum tax
 * - Credits
 * - Payments
 *
 * Trust Tax Rates for 2025:
 * - 10% on first $3,050
 * - 24% on $3,050 to $11,450
 * - 35% on $11,450 to $15,650
 * - 37% on income over $15,650
 */

export interface Schedule1041GData {
  // Tax computation
  taxableIncome: number
  // Schedule D tax
  hasScheduleDGain: boolean
  scheduleDTax: number
  // Alternative minimum tax
  alternativeMinimumTax: number
  // Credits
  foreignTaxCredit: number
  generalBusinessCredit: number
  otherCredits: number
  // Payments
  estimatedTaxPayments: number
  taxWithheld: number
  amountPaidWithExtension: number
  // Other taxes
  netInvestmentIncomeTax: number
  recaptureTax: number
}

// 2025 Trust Tax Brackets
const TRUST_TAX_BRACKETS = [
  { min: 0, max: 3050, rate: 0.1, base: 0 },
  { min: 3050, max: 11450, rate: 0.24, base: 305 },
  { min: 11450, max: 15650, rate: 0.35, base: 2321 },
  { min: 15650, max: Infinity, rate: 0.37, base: 3791 }
]

export default class Schedule1041G extends F1040Attachment {
  tag: FormTag = 'f1041sg'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasTaxData()
  }

  hasTaxData = (): boolean => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn
    return fiduciaryReturn !== undefined
  }

  schedule1041GData = (): Schedule1041GData | undefined => {
    return undefined // Would be populated from estate/trust data
  }

  // Compute trust tax using 2025 brackets
  computeTrustTax = (taxableIncome: number): number => {
    if (taxableIncome <= 0) return 0

    for (const bracket of TRUST_TAX_BRACKETS) {
      if (taxableIncome <= bracket.max) {
        return Math.round(
          bracket.base + (taxableIncome - bracket.min) * bracket.rate
        )
      }
    }

    // Above highest bracket
    const lastBracket = TRUST_TAX_BRACKETS[TRUST_TAX_BRACKETS.length - 1]
    return Math.round(
      lastBracket.base + (taxableIncome - lastBracket.min) * lastBracket.rate
    )
  }

  // Line 1a: Taxable income
  l1a = (): number => this.schedule1041GData()?.taxableIncome ?? 0

  // Line 1b: Tax on taxable income
  l1b = (): number => this.computeTrustTax(this.l1a())

  // Line 2: Schedule D tax (if applicable)
  l2 = (): number => {
    if (!this.schedule1041GData()?.hasScheduleDGain) return 0
    return this.schedule1041GData()?.scheduleDTax ?? 0
  }

  // Line 3: Tax (greater of 1b or 2)
  l3 = (): number => Math.max(this.l1b(), this.l2())

  // Line 4: Alternative minimum tax
  l4 = (): number => this.schedule1041GData()?.alternativeMinimumTax ?? 0

  // Line 5: Add lines 3 and 4
  l5 = (): number => this.l3() + this.l4()

  // Line 6: Recapture taxes
  l6 = (): number => this.schedule1041GData()?.recaptureTax ?? 0

  // Line 7: Net investment income tax
  l7 = (): number => this.schedule1041GData()?.netInvestmentIncomeTax ?? 0

  // Line 8: Total tax before credits
  l8 = (): number => sumFields([this.l5(), this.l6(), this.l7()])

  // Line 9: Foreign tax credit
  l9 = (): number => this.schedule1041GData()?.foreignTaxCredit ?? 0

  // Line 10: General business credit
  l10 = (): number => this.schedule1041GData()?.generalBusinessCredit ?? 0

  // Line 11: Other credits
  l11 = (): number => this.schedule1041GData()?.otherCredits ?? 0

  // Line 12: Total credits
  l12 = (): number => sumFields([this.l9(), this.l10(), this.l11()])

  // Line 13: Tax after credits
  l13 = (): number => Math.max(0, this.l8() - this.l12())

  // Line 14: Tax withheld
  l14 = (): number => this.schedule1041GData()?.taxWithheld ?? 0

  // Line 15: Estimated tax payments
  l15 = (): number => this.schedule1041GData()?.estimatedTaxPayments ?? 0

  // Line 16: Amount paid with extension
  l16 = (): number => this.schedule1041GData()?.amountPaidWithExtension ?? 0

  // Line 17: Total payments
  l17 = (): number => sumFields([this.l14(), this.l15(), this.l16()])

  // Line 18: Amount owed
  l18 = (): number => Math.max(0, this.l13() - this.l17())

  // Line 19: Overpayment
  l19 = (): number => Math.max(0, this.l17() - this.l13())

  // To Form 1041 Line 24
  toForm1041Line24 = (): number => this.l13()

  fields = (): Field[] => {
    const data = this.schedule1041GData()

    return [
      // Tax computation
      this.l1a(),
      this.l1b(),
      data?.hasScheduleDGain ?? false,
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      // Credits
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      // Payments
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      // Balance
      this.l18(),
      this.l19(),
      // To Form 1041
      this.toForm1041Line24()
    ]
  }
}
