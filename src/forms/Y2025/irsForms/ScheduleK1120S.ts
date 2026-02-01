import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule K (Form 1120-S) - Shareholders' Pro Rata Share Items
 *
 * Aggregates the pro rata share items for all shareholders in the S corporation.
 * Each item on Schedule K is allocated to shareholders via Schedule K-1.
 *
 * Key differences from Form 1065 Schedule K:
 * - No self-employment income (S-Corp shareholders are employees)
 * - No guaranteed payments (use W-2 wages instead)
 * - Built-in gains tax consideration
 * - Excess passive income limitations
 */

export interface ScheduleK1120SData {
  // Ordinary Income/Loss
  ordinaryBusinessIncome: number
  netRentalRealEstateIncome: number
  otherNetRentalIncome: number
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
  // S-Corp Specific
  incomeTaxExpense: number
  builtInGainsTax: number
  excessPassiveIncomeTax: number
}

export default class ScheduleK1120S extends F1040Attachment {
  tag: FormTag = 'f1120ssk'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasSCorpData()
  }

  hasSCorpData = (): boolean => {
    const sCorps = this.f1040.info.sCorpOwnership
    return sCorps !== undefined && sCorps.length > 0
  }

  sCorpData = (): ScheduleK1120SData | undefined => {
    const sCorps = this.f1040.info.sCorpOwnership
    if (!sCorps || sCorps.length === 0) return undefined

    // Aggregate from S-Corp data
    return {
      ordinaryBusinessIncome: 0,
      netRentalRealEstateIncome: 0,
      otherNetRentalIncome: 0,
      interestIncome: 0,
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
      propertyDistributions: 0,
      cashDistributions: 0,
      foreignCountry: '',
      foreignGrossIncome: 0,
      foreignDeductions: 0,
      incomeTaxExpense: 0,
      builtInGainsTax: 0,
      excessPassiveIncomeTax: 0
    }
  }

  // Line 1: Ordinary business income
  l1 = (): number => this.sCorpData()?.ordinaryBusinessIncome ?? 0

  // Line 2: Net rental real estate income
  l2 = (): number => this.sCorpData()?.netRentalRealEstateIncome ?? 0

  // Line 3: Other net rental income
  l3 = (): number => this.sCorpData()?.otherNetRentalIncome ?? 0

  // Line 4: Interest income
  l4 = (): number => this.sCorpData()?.interestIncome ?? 0

  // Line 5a: Ordinary dividends
  l5a = (): number => this.sCorpData()?.ordinaryDividends ?? 0

  // Line 5b: Qualified dividends
  l5b = (): number => this.sCorpData()?.qualifiedDividends ?? 0

  // Line 6: Royalties
  l6 = (): number => this.sCorpData()?.royalties ?? 0

  // Line 7: Net short-term capital gain
  l7 = (): number => this.sCorpData()?.netShortTermCapitalGain ?? 0

  // Line 8a: Net long-term capital gain
  l8a = (): number => this.sCorpData()?.netLongTermCapitalGain ?? 0

  // Line 9: Net section 1231 gain
  l9 = (): number => this.sCorpData()?.netSection1231Gain ?? 0

  // Line 10: Other income
  l10 = (): number => this.sCorpData()?.otherIncome ?? 0

  // Line 11: Section 179 deduction
  l11 = (): number => this.sCorpData()?.section179Deduction ?? 0

  // Line 12a: Charitable contributions
  l12a = (): number => this.sCorpData()?.charitableContributions ?? 0

  // Line 13a: Foreign taxes paid
  l13a = (): number => this.sCorpData()?.foreignTaxesPaid ?? 0

  // Line 16a: Tax-exempt interest income
  l16a = (): number => this.sCorpData()?.taxExemptInterest ?? 0

  // Line 16d: Distributions
  l16d = (): number => {
    const data = this.sCorpData()
    return (data?.cashDistributions ?? 0) + (data?.propertyDistributions ?? 0)
  }

  fields = (): Field[] => {
    const data = this.sCorpData()

    return [
      // Shareholders' Pro Rata Share Items
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5a(),
      this.l5b(),
      this.l6(),
      this.l7(),
      this.l8a(),
      data?.collectiblesGain ?? 0,
      data?.unrecapturedSection1250Gain ?? 0,
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12a(),
      data?.investmentInterestExpense ?? 0,
      data?.section59eExpenditures ?? 0,
      data?.otherDeductions ?? 0,
      data?.lowIncomeHousingCreditPre2008 ?? 0,
      data?.lowIncomeHousingCreditPost2008 ?? 0,
      data?.qualifiedRehabilitationCredit ?? 0,
      data?.otherRentalCredits ?? 0,
      this.l13a(),
      data?.workOpportunityCredit ?? 0,
      data?.otherCredits ?? 0,
      data?.amtAdjustments ?? 0,
      data?.amtPreferences ?? 0,
      this.l16a(),
      data?.otherTaxExemptIncome ?? 0,
      data?.nondeductibleExpenses ?? 0,
      this.l16d(),
      // S-Corp specific taxes
      data?.builtInGainsTax ?? 0,
      data?.excessPassiveIncomeTax ?? 0
    ]
  }
}
