import Form from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  ScheduleK1Form1065Generated,
  ScheduleK1Form1120SGenerated,
  ScheduleKItems
} from 'ustaxes/core/data'

/**
 * Schedule K-1 - Partner's/Shareholder's Share of Income
 *
 * K-1 forms are issued by pass-through entities to report each
 * owner's share of income, deductions, credits, etc.
 *
 * Schedule K-1 (Form 1065): For partners in partnerships
 * Schedule K-1 (Form 1120-S): For shareholders in S corporations
 *
 * Recipients use K-1 information to complete their own tax returns:
 * - Ordinary income → Schedule E
 * - Capital gains → Schedule D
 * - Self-employment → Schedule SE (partnerships only)
 * - Rental income → Schedule E
 * - Credits → Form 3800
 *
 * Due dates:
 * - Partnerships (1065): March 15
 * - S Corporations (1120-S): March 15
 */

/**
 * Schedule K-1 (Form 1065) - Partner's Share of Income
 */
export class ScheduleK1_1065 extends Form {
  tag: FormTag = 'f1065sk1'
  sequenceIndex = 999

  data: ScheduleK1Form1065Generated

  constructor(data: ScheduleK1Form1065Generated) {
    super()
    this.data = data
  }

  // Part I - Information About the Partnership
  partnershipName = (): string => this.data.partnershipName
  partnershipEIN = (): string => this.data.partnershipEIN
  partnershipAddress = (): string => {
    const addr = this.data.partnershipAddress
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${
      addr.zip ?? ''
    }`
  }
  irsCenter = (): string => this.data.irsCenter

  // Part II - Information About the Partner
  partnerName = (): string => this.data.partnerName
  partnerTIN = (): string => this.data.partnerTIN
  partnerType = (): string => this.data.partnerType
  isDomestic = (): boolean => this.data.domesticOrForeign === 'domestic'
  isForeign = (): boolean => this.data.domesticOrForeign === 'foreign'

  // Ownership percentages
  profitShareBeginning = (): number => this.data.profitShareBeginning
  profitShareEnd = (): number => this.data.profitShareEnd
  lossShareBeginning = (): number => this.data.lossShareBeginning
  lossShareEnd = (): number => this.data.lossShareEnd
  capitalShareBeginning = (): number => this.data.capitalShareBeginning
  capitalShareEnd = (): number => this.data.capitalShareEnd

  // Capital account analysis
  beginningCapital = (): number => this.data.beginningCapitalAccount
  capitalContributed = (): number => this.data.capitalContributed
  currentYearIncome = (): number => this.data.currentYearNetIncome
  otherChanges = (): number => this.data.otherIncreaseDecrease
  withdrawals = (): number => this.data.withdrawalsDistributions
  endingCapital = (): number => this.data.endingCapitalAccount
  capitalMethod = (): string => this.data.capitalAccountMethod

  // Share of liabilities
  recourseShare = (): number => this.data.recourseShare
  qualifiedNonrecourse = (): number => this.data.qualifiedNonrecourseShare
  nonrecourseShare = (): number => this.data.nonrecourseShare

  // Part III - Partner's Share Items (from ScheduleKItems)
  items = (): ScheduleKItems => this.data.items

  // Income
  l1 = (): number => this.items().ordinaryBusinessIncome
  l2 = (): number => this.items().netRentalRealEstateIncome
  l3 = (): number => this.items().otherNetRentalIncome
  l4 = (): number => this.items().interestIncome
  l5a = (): number => this.items().dividendIncome
  l5b = (): number => this.items().qualifiedDividends
  l6 = (): number => this.items().royalties
  l7 = (): number => this.items().netShortTermCapitalGain
  l8 = (): number => this.items().netLongTermCapitalGain
  l9a = (): number => this.items().collectibles28Gain
  l9b = (): number => this.items().unrecaptured1250Gain
  l10 = (): number => this.items().net1231Gain
  l11 = (): number => this.items().otherIncome

  // Deductions
  l12 = (): number => this.items().section179Deduction
  l13 = (): number => this.items().charitableContributions
  l13a = (): number => this.items().otherDeductions

  // Self-employment
  l14a = (): number => this.items().netEarningsSE

  // Credits
  l15a = (): number => this.items().lowIncomeHousingCredit
  l15b = (): number => this.items().otherCredits

  // Tax-exempt income
  l18a = (): number => this.items().taxExemptInterest
  l18b = (): number => this.items().otherTaxExemptIncome
  l18c = (): number => this.items().nondeductibleExpenses

  // Distributions
  l19a = (): number => this.items().cashDistributions
  l19b = (): number => this.items().propertyDistributions

  // Section 199A
  l20 = (): number => this.items().section199AQBI

  taxYear = (): number => this.data.taxYear
  isFinal = (): boolean => this.data.isFinalK1

  fields = (): Field[] => [
    // Part I
    this.partnershipName(),
    this.partnershipEIN(),
    this.partnershipAddress(),
    this.irsCenter(),
    // Part II
    this.partnerName(),
    this.partnerTIN(),
    this.partnerType(),
    this.isDomestic(),
    this.profitShareBeginning(),
    this.profitShareEnd(),
    this.lossShareBeginning(),
    this.lossShareEnd(),
    this.capitalShareBeginning(),
    this.capitalShareEnd(),
    this.beginningCapital(),
    this.capitalContributed(),
    this.currentYearIncome(),
    this.otherChanges(),
    this.withdrawals(),
    this.endingCapital(),
    this.capitalMethod(),
    this.recourseShare(),
    this.qualifiedNonrecourse(),
    this.nonrecourseShare(),
    // Part III
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5a(),
    this.l5b(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9a(),
    this.l9b(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l13a(),
    this.l14a(),
    this.l15a(),
    this.l15b(),
    this.l18a(),
    this.l18b(),
    this.l18c(),
    this.l19a(),
    this.l19b(),
    this.l20(),
    this.taxYear(),
    this.isFinal()
  ]
}

/**
 * Schedule K-1 (Form 1120-S) - Shareholder's Share of Income
 */
export class ScheduleK1_1120S extends Form {
  tag: FormTag = 'f1120ssk1'
  sequenceIndex = 999

  data: ScheduleK1Form1120SGenerated

  constructor(data: ScheduleK1Form1120SGenerated) {
    super()
    this.data = data
  }

  // Part I - Information About the Corporation
  corporationName = (): string => this.data.corporationName
  corporationEIN = (): string => this.data.corporationEIN
  corporationAddress = (): string => {
    const addr = this.data.corporationAddress
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${
      addr.zip ?? ''
    }`
  }
  irsCenter = (): string => this.data.irsCenter

  // Part II - Information About the Shareholder
  shareholderName = (): string => this.data.shareholderName
  shareholderTIN = (): string => this.data.shareholderTIN

  // Ownership percentage
  stockPercentage = (): number => this.data.percentageOfStock

  // Part III - Shareholder's Share Items
  items = (): ScheduleKItems => this.data.items

  // Income (same as partnership K-1)
  l1 = (): number => this.items().ordinaryBusinessIncome
  l2 = (): number => this.items().netRentalRealEstateIncome
  l3 = (): number => this.items().otherNetRentalIncome
  l4 = (): number => this.items().interestIncome
  l5a = (): number => this.items().dividendIncome
  l5b = (): number => this.items().qualifiedDividends
  l6 = (): number => this.items().royalties
  l7 = (): number => this.items().netShortTermCapitalGain
  l8 = (): number => this.items().netLongTermCapitalGain
  l9 = (): number => this.items().net1231Gain
  l10 = (): number => this.items().otherIncome

  // Deductions
  l11 = (): number => this.items().section179Deduction
  l12 = (): number => this.items().otherDeductions

  // Credits
  l13a = (): number => this.items().lowIncomeHousingCredit
  l13b = (): number => this.items().otherCredits

  // Tax-exempt income and distributions
  l16a = (): number => this.items().taxExemptInterest
  l16b = (): number => this.items().otherTaxExemptIncome
  l16c = (): number => this.items().nondeductibleExpenses
  l16d = (): number => this.items().cashDistributions

  // Section 199A
  l17 = (): number => this.items().section199AQBI

  // Shareholder loans
  shareholderLoans = (): number => this.data.shareholderLoans ?? 0

  taxYear = (): number => this.data.taxYear
  isFinal = (): boolean => this.data.isFinalK1

  fields = (): Field[] => [
    // Part I
    this.corporationName(),
    this.corporationEIN(),
    this.corporationAddress(),
    this.irsCenter(),
    // Part II
    this.shareholderName(),
    this.shareholderTIN(),
    this.stockPercentage(),
    // Part III
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5a(),
    this.l5b(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13a(),
    this.l13b(),
    this.l16a(),
    this.l16b(),
    this.l16c(),
    this.l16d(),
    this.l17(),
    this.shareholderLoans(),
    this.taxYear(),
    this.isFinal()
  ]
}
