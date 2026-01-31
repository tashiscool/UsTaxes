import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule K (Form 1065) - Partners' Distributive Share Items
 *
 * Aggregates the distributive share items for all partners in the partnership.
 * Each item on Schedule K is allocated to partners via Schedule K-1.
 *
 * Categories:
 * - Ordinary business income/loss
 * - Rental real estate income/loss
 * - Other rental income/loss
 * - Guaranteed payments
 * - Interest income
 * - Dividends (ordinary and qualified)
 * - Royalties
 * - Net short-term and long-term capital gains/losses
 * - Section 1231 gains/losses
 * - Other income/loss
 * - Section 179 deduction
 * - Charitable contributions
 * - Foreign taxes
 * - Credits
 * - Alternative minimum tax items
 * - Tax-exempt income
 * - Distributions
 */

export interface ScheduleKData {
  // Ordinary Income/Loss
  ordinaryBusinessIncome: number
  netRentalRealEstateIncome: number
  otherNetRentalIncome: number
  guaranteedPaymentsServices: number
  guaranteedPaymentsCapital: number
  // Income from Other Sources
  interestIncome: number
  ordinaryDividends: number
  qualifiedDividends: number
  royalties: number
  // Capital Gains/Losses
  netShortTermCapitalGain: number
  netLongTermCapitalGain: number
  collectiblesGain: number
  unrecapturedSection1250Gain: number
  // Section 1231
  netSection1231Gain: number
  // Other Income
  otherIncome: number
  // Deductions
  section179Deduction: number
  charitableContributions: number
  investmentInterestExpense: number
  section59eExpenditures: number
  otherDeductions: number
  // Self-Employment
  netEarningsSelfEmployment: number
  grossFarmingIncome: number
  grossNonfarmIncome: number
  // Credits
  lowIncomeHousingCreditPre2008: number
  lowIncomeHousingCreditPost2008: number
  qualifiedRehabilitationCredit: number
  otherRentalCredits: number
  foreignTaxesPaid: number
  workOpportunityCredit: number
  alcoholFuelCredit: number
  otherCredits: number
  // AMT Items
  amtAdjustments: number
  amtPreferences: number
  // Tax-Exempt Income
  taxExemptInterest: number
  otherTaxExemptIncome: number
  nondeductibleExpenses: number
  // Distributions
  propertyDistributions: number
  cashDistributions: number
  // Foreign
  foreignCountry: string
  foreignGrossIncome: number
  foreignDeductions: number
}

export default class ScheduleK1065 extends F1040Attachment {
  tag: FormTag = 'f1065sk'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasPartnershipData()
  }

  hasPartnershipData = (): boolean => {
    const partnerships = this.f1040.info.partnershipOwnership
    return partnerships !== undefined && partnerships.length > 0
  }

  partnershipData = (): ScheduleKData | undefined => {
    // Aggregate from all partnership K-1s
    const k1s = this.f1040.info.scheduleK1Form1065s ?? []
    if (k1s.length === 0) return undefined

    return {
      ordinaryBusinessIncome: k1s.reduce((sum, k1) => sum + (k1.ordinaryBusinessIncome ?? 0), 0),
      netRentalRealEstateIncome: 0,
      otherNetRentalIncome: 0,
      guaranteedPaymentsServices: k1s.reduce((sum, k1) => sum + (k1.guaranteedPaymentsForServices ?? 0), 0),
      guaranteedPaymentsCapital: k1s.reduce((sum, k1) => sum + (k1.guaranteedPaymentsForCapital ?? 0), 0),
      interestIncome: k1s.reduce((sum, k1) => sum + (k1.interestIncome ?? 0), 0),
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      royalties: 0,
      netShortTermCapitalGain: 0,
      netLongTermCapitalGain: 0,
      collectiblesGain: 0,
      unrecapturedSection1250Gain: 0,
      netSection1231Gain: 0,
      otherIncome: 0,
      section179Deduction: 0,
      charitableContributions: 0,
      investmentInterestExpense: 0,
      section59eExpenditures: 0,
      otherDeductions: 0,
      netEarningsSelfEmployment: k1s.reduce((sum, k1) =>
        sum + (k1.selfEmploymentEarningsA ?? 0) + (k1.selfEmploymentEarningsB ?? 0) + (k1.selfEmploymentEarningsC ?? 0), 0),
      grossFarmingIncome: 0,
      grossNonfarmIncome: 0,
      lowIncomeHousingCreditPre2008: 0,
      lowIncomeHousingCreditPost2008: 0,
      qualifiedRehabilitationCredit: 0,
      otherRentalCredits: 0,
      foreignTaxesPaid: 0,
      workOpportunityCredit: 0,
      alcoholFuelCredit: 0,
      otherCredits: 0,
      amtAdjustments: 0,
      amtPreferences: 0,
      taxExemptInterest: 0,
      otherTaxExemptIncome: 0,
      nondeductibleExpenses: 0,
      propertyDistributions: k1s.reduce((sum, k1) => sum + (k1.distributionsCodeAAmount ?? 0), 0),
      cashDistributions: 0,
      foreignCountry: '',
      foreignGrossIncome: 0,
      foreignDeductions: 0
    }
  }

  // Line 1: Ordinary business income
  l1 = (): number => this.partnershipData()?.ordinaryBusinessIncome ?? 0

  // Line 2: Net rental real estate income
  l2 = (): number => this.partnershipData()?.netRentalRealEstateIncome ?? 0

  // Line 3: Other net rental income
  l3 = (): number => this.partnershipData()?.otherNetRentalIncome ?? 0

  // Line 4a: Guaranteed payments for services
  l4a = (): number => this.partnershipData()?.guaranteedPaymentsServices ?? 0

  // Line 4b: Guaranteed payments for capital
  l4b = (): number => this.partnershipData()?.guaranteedPaymentsCapital ?? 0

  // Line 4c: Total guaranteed payments
  l4c = (): number => this.l4a() + this.l4b()

  // Line 5: Interest income
  l5 = (): number => this.partnershipData()?.interestIncome ?? 0

  // Line 6a: Ordinary dividends
  l6a = (): number => this.partnershipData()?.ordinaryDividends ?? 0

  // Line 6b: Qualified dividends
  l6b = (): number => this.partnershipData()?.qualifiedDividends ?? 0

  // Line 7: Royalties
  l7 = (): number => this.partnershipData()?.royalties ?? 0

  // Line 8: Net short-term capital gain
  l8 = (): number => this.partnershipData()?.netShortTermCapitalGain ?? 0

  // Line 9a: Net long-term capital gain
  l9a = (): number => this.partnershipData()?.netLongTermCapitalGain ?? 0

  // Line 10: Net section 1231 gain
  l10 = (): number => this.partnershipData()?.netSection1231Gain ?? 0

  // Line 11: Other income
  l11 = (): number => this.partnershipData()?.otherIncome ?? 0

  // Line 12: Section 179 deduction
  l12 = (): number => this.partnershipData()?.section179Deduction ?? 0

  // Line 13a: Charitable contributions
  l13a = (): number => this.partnershipData()?.charitableContributions ?? 0

  // Line 14a: Net earnings from self-employment
  l14a = (): number => this.partnershipData()?.netEarningsSelfEmployment ?? 0

  // Line 16a: Foreign taxes paid
  l16a = (): number => this.partnershipData()?.foreignTaxesPaid ?? 0

  // Line 18a: Tax-exempt interest income
  l18a = (): number => this.partnershipData()?.taxExemptInterest ?? 0

  // Line 19a: Distributions - cash
  l19a = (): number => this.partnershipData()?.cashDistributions ?? 0

  // Line 19b: Distributions - property
  l19b = (): number => this.partnershipData()?.propertyDistributions ?? 0

  fields = (): Field[] => {
    const data = this.partnershipData()

    return [
      // Part III: Partner's Share of Current Year Income, Deductions, Credits
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4a(),
      this.l4b(),
      this.l4c(),
      this.l5(),
      this.l6a(),
      this.l6b(),
      this.l7(),
      this.l8(),
      this.l9a(),
      data?.collectiblesGain ?? 0,
      data?.unrecapturedSection1250Gain ?? 0,
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13a(),
      data?.investmentInterestExpense ?? 0,
      data?.otherDeductions ?? 0,
      this.l14a(),
      data?.grossFarmingIncome ?? 0,
      data?.grossNonfarmIncome ?? 0,
      data?.lowIncomeHousingCreditPre2008 ?? 0,
      data?.lowIncomeHousingCreditPost2008 ?? 0,
      data?.qualifiedRehabilitationCredit ?? 0,
      data?.otherRentalCredits ?? 0,
      this.l16a(),
      data?.workOpportunityCredit ?? 0,
      data?.otherCredits ?? 0,
      data?.amtAdjustments ?? 0,
      data?.amtPreferences ?? 0,
      this.l18a(),
      data?.otherTaxExemptIncome ?? 0,
      data?.nondeductibleExpenses ?? 0,
      this.l19a(),
      this.l19b()
    ]
  }
}
