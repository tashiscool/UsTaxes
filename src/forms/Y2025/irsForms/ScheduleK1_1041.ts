/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule K-1 (Form 1041) - Beneficiary's Share of Income, Deductions, Credits, etc.
 *
 * Issued by an estate or trust to each beneficiary showing their
 * share of the estate's/trust's income, deductions, and credits.
 *
 * Key Differences from K-1 (1065) and K-1 (1120-S):
 * - DNI (Distributable Net Income) limitation
 * - Separate share rules for complex trusts
 * - Allocation between income categories
 * - Tier system for distributions (simple trusts: all current income first)
 *
 * Income Types Reported:
 * - Interest income
 * - Ordinary dividends / Qualified dividends
 * - Net short-term capital gain
 * - Net long-term capital gain
 * - Annuities, royalties, other income
 * - Directly apportioned deductions
 * - Estate tax deduction on income in respect of decedent (IRD)
 * - Credits (foreign tax, etc.)
 * - AMT adjustments
 */

export interface Beneficiary {
  name: string
  tin: string
  address: string
  isForeignBeneficiary: boolean
  percentageShare: number
  isFinalK1: boolean
}

export interface K1_1041Data {
  beneficiary: Beneficiary
  // Part III: Beneficiary's Share of Current Year Income, Deductions, Credits
  // Line 1: Interest income
  interestIncome: number
  // Line 2a: Ordinary dividends
  ordinaryDividends: number
  // Line 2b: Qualified dividends
  qualifiedDividends: number
  // Line 3: Net short-term capital gain
  netShortTermCapitalGain: number
  // Line 4a: Net long-term capital gain
  netLongTermCapitalGain: number
  // Line 4b: 28% rate gain
  rate28Gain: number
  // Line 4c: Unrecaptured section 1250 gain
  unrecapturedSection1250Gain: number
  // Line 5: Other portfolio and nonbusiness income
  otherPortfolioIncome: number
  // Line 6: Ordinary business income
  ordinaryBusinessIncome: number
  // Line 7: Net rental real estate income
  netRentalRealEstateIncome: number
  // Line 8: Other rental income
  otherRentalIncome: number
  // Line 9: Directly apportioned deductions
  directlyApportionedDeductions: number
  // Line 10: Estate tax deduction
  estateTaxDeduction: number
  // Line 11: Final year deductions
  finalYearDeductions: number
  excessDeductions: number
  unusedCapitalLossCarryover: number
  netOperatingLossCarryover: number
  // Line 12: AMT adjustment
  amtAdjustment: number
  // Line 13: Credits
  foreignTaxCredit: number
  otherCredits: number
  // Line 14: Other information
  taxExemptInterest: number
  foreignCountry: string
  foreignGrossIncome: number
  foreignDeductions: number
  netInvestmentIncome: number
  grossFarmingIncome: number
}

export default class ScheduleK1_1041 extends F1040Attachment {
  tag: FormTag = 'f1041sk1'
  sequenceIndex = 999

  private beneficiaryIndex = 0

  constructor(f1040: F1040, beneficiaryIndex = 0) {
    super(f1040)
    this.beneficiaryIndex = beneficiaryIndex
  }

  isNeeded = (): boolean => {
    return this.hasFiduciaryData()
  }

  hasFiduciaryData = (): boolean => {
    return this.f1040.info.fiduciaryReturn !== undefined
  }

  k1Data = (): K1_1041Data | undefined => {
    const fiduciary = this.f1040.info.fiduciaryReturn
    if (!fiduciary) return undefined

    const beneficiaryList =
      (fiduciary as { beneficiaries?: unknown[] }).beneficiaries ?? []
    const beneficiaries = beneficiaryList as Array<Record<string, unknown>>
    if (this.beneficiaryIndex >= beneficiaries.length) return undefined

    const ben = beneficiaries[this.beneficiaryIndex]
    return {
      beneficiary: {
        name: (ben.name as string) ?? '',
        tin: (ben.tin as string) ?? '',
        address: (ben.address as string) ?? '',
        isForeignBeneficiary: false,
        percentageShare: (ben.percentageShare as number) ?? 0,
        isFinalK1:
          (fiduciary as { isFinalReturn?: boolean }).isFinalReturn ?? false
      },
      interestIncome: (ben.interestIncome as number) ?? 0,
      ordinaryDividends: (ben.ordinaryDividends as number) ?? 0,
      qualifiedDividends: (ben.qualifiedDividends as number) ?? 0,
      netShortTermCapitalGain: (ben.shortTermCapitalGain as number) ?? 0,
      netLongTermCapitalGain: (ben.longTermCapitalGain as number) ?? 0,
      rate28Gain: 0,
      unrecapturedSection1250Gain: 0,
      otherPortfolioIncome: 0,
      ordinaryBusinessIncome: (ben.ordinaryIncome as number) ?? 0,
      netRentalRealEstateIncome: 0,
      otherRentalIncome: 0,
      directlyApportionedDeductions: (ben.deductions as number) ?? 0,
      estateTaxDeduction: 0,
      finalYearDeductions: 0,
      excessDeductions: 0,
      unusedCapitalLossCarryover: 0,
      netOperatingLossCarryover: 0,
      amtAdjustment: 0,
      foreignTaxCredit: (ben.credits as number) ?? 0,
      otherCredits: 0,
      taxExemptInterest: 0,
      foreignCountry: '',
      foreignGrossIncome: 0,
      foreignDeductions: 0,
      netInvestmentIncome: 0,
      grossFarmingIncome: 0
    }
  }

  beneficiaryName = (): string => this.k1Data()?.beneficiary.name ?? ''
  beneficiaryTin = (): string => this.k1Data()?.beneficiary.tin ?? ''
  percentageShare = (): number =>
    this.k1Data()?.beneficiary.percentageShare ?? 0

  // Line 1: Interest income
  l1 = (): number => this.k1Data()?.interestIncome ?? 0

  // Line 2a: Ordinary dividends
  l2a = (): number => this.k1Data()?.ordinaryDividends ?? 0

  // Line 2b: Qualified dividends
  l2b = (): number => this.k1Data()?.qualifiedDividends ?? 0

  // Line 3: Net short-term capital gain
  l3 = (): number => this.k1Data()?.netShortTermCapitalGain ?? 0

  // Line 4a: Net long-term capital gain
  l4a = (): number => this.k1Data()?.netLongTermCapitalGain ?? 0

  // Line 5: Other portfolio income
  l5 = (): number => this.k1Data()?.otherPortfolioIncome ?? 0

  // Line 6: Ordinary business income
  l6 = (): number => this.k1Data()?.ordinaryBusinessIncome ?? 0

  // Line 7: Net rental real estate income
  l7 = (): number => this.k1Data()?.netRentalRealEstateIncome ?? 0

  // Line 8: Other rental income
  l8 = (): number => this.k1Data()?.otherRentalIncome ?? 0

  // Line 9: Directly apportioned deductions
  l9 = (): number => this.k1Data()?.directlyApportionedDeductions ?? 0

  // Line 10: Estate tax deduction
  l10 = (): number => this.k1Data()?.estateTaxDeduction ?? 0

  // Line 11: Final year deductions
  l11 = (): number => {
    const data = this.k1Data()
    if (!data) return 0
    return sumFields([
      data.finalYearDeductions,
      data.excessDeductions,
      data.unusedCapitalLossCarryover,
      data.netOperatingLossCarryover
    ])
  }

  // Line 12: AMT adjustment
  l12 = (): number => this.k1Data()?.amtAdjustment ?? 0

  // Line 13: Credits
  l13 = (): number => {
    const data = this.k1Data()
    if (!data) return 0
    return data.foreignTaxCredit + data.otherCredits
  }

  // Total income
  totalIncome = (): number => {
    return sumFields([
      this.l1(),
      this.l2a(),
      this.l3(),
      this.l4a(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8()
    ])
  }

  fields = (): Field[] => {
    const data = this.k1Data()
    const ben = data?.beneficiary

    return [
      // Part I: Information About the Estate or Trust
      // (This would come from the fiduciary return)

      // Part II: Information About the Beneficiary
      ben?.name ?? '',
      ben?.tin ?? '',
      ben?.address ?? '',
      ben?.isForeignBeneficiary ?? false,
      ben?.percentageShare ?? 0,
      ben?.isFinalK1 ?? false,

      // Part III: Beneficiary's Share of Current Year Income, Deductions, Credits
      // Line 1: Interest income
      this.l1(),
      // Line 2a: Ordinary dividends
      this.l2a(),
      // Line 2b: Qualified dividends
      this.l2b(),
      // Line 3: Net short-term capital gain
      this.l3(),
      // Line 4a: Net long-term capital gain
      this.l4a(),
      // Line 4b: 28% rate gain
      data?.rate28Gain ?? 0,
      // Line 4c: Unrecaptured section 1250 gain
      data?.unrecapturedSection1250Gain ?? 0,
      // Line 5: Other portfolio income
      this.l5(),
      // Line 6: Ordinary business income
      this.l6(),
      // Line 7: Net rental real estate income
      this.l7(),
      // Line 8: Other rental income
      this.l8(),
      // Line 9: Directly apportioned deductions
      this.l9(),
      // Line 10: Estate tax deduction
      this.l10(),
      // Line 11: Final year deductions
      this.l11(),
      data?.excessDeductions ?? 0,
      data?.unusedCapitalLossCarryover ?? 0,
      data?.netOperatingLossCarryover ?? 0,
      // Line 12: AMT adjustment
      this.l12(),
      // Line 13: Credits
      data?.foreignTaxCredit ?? 0,
      data?.otherCredits ?? 0,
      // Line 14: Other information
      data?.taxExemptInterest ?? 0,
      data?.netInvestmentIncome ?? 0,
      // Total income
      this.totalIncome()
    ]
  }

  // Generate copies for each beneficiary
  copies = (): ScheduleK1_1041[] => {
    const fiduciary = this.f1040.info.fiduciaryReturn
    if (!fiduciary) return []

    const beneficiaryList =
      (fiduciary as { beneficiaries?: unknown[] }).beneficiaries ?? []
    const beneficiaries = beneficiaryList as Array<Record<string, unknown>>
    if (beneficiaries.length <= 1) return []

    // Create copies for additional beneficiaries (first one is this instance)
    return beneficiaries
      .slice(1)
      .map((_, index) => new ScheduleK1_1041(this.f1040, index + 1))
  }
}
