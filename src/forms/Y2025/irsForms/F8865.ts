import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8865 - Return of U.S. Persons With Respect to Certain Foreign Partnerships
 *
 * Required for U.S. persons who:
 * Category 1: Controlled foreign partnership (>50% U.S. ownership)
 * Category 2: 10%+ interest when U.S. persons own 50%+ total
 * Category 3: Contributed property in exchange for partnership interest
 * Category 4: Had reportable events during the year
 *
 * Similar to Form 5471 but for partnerships instead of corporations.
 * Includes schedules for:
 * - Schedule A: Constructive Ownership of Partnership Interest
 * - Schedule A-1: Acquisitions/Dispositions of Partnership Interest
 * - Schedule A-2: Affiliation Schedule
 * - Schedule B: Income Statement
 * - Schedule K: Partner's Share of Income/Deductions
 * - Schedule L: Balance Sheet
 * - Schedule M: Balance Sheet Reconciliation
 * - Schedule N: Transactions Between Controlled Foreign Partnership and Partners
 * - Schedule O: Transfer of Property to Foreign Partnership
 */

export type PartnershipCategory = 1 | 2 | 3 | 4

export interface ForeignPartnershipInfo {
  name: string
  ein?: string
  referenceId: string
  countryOfOrganization: string
  dateOfOrganization: Date
  principalBusinessActivity: string
  principalBusinessCode: string
  functionalCurrency: string
  exchangeRateUsed: number
  taxYearEnd: Date
}

export interface PartnerInfo {
  name: string
  tin: string
  percentageOwned: number
  capitalContribution: number
  profitSharingRatio: number
  lossSharingRatio: number
}

export interface PartnershipIncomeStatement {
  grossReceipts: number
  costOfGoodsSold: number
  grossProfit: number
  ordinaryIncome: number
  netRentalIncome: number
  interestIncome: number
  dividends: number
  royalties: number
  netShortTermCapitalGain: number
  netLongTermCapitalGain: number
  otherIncome: number
  totalIncome: number
  salariesAndWages: number
  guaranteedPayments: number
  rent: number
  interestExpense: number
  taxes: number
  depreciation: number
  otherDeductions: number
  totalDeductions: number
  ordinaryBusinessIncome: number
}

export interface PartnershipBalanceSheet {
  cash: number
  accountsReceivable: number
  inventories: number
  otherCurrentAssets: number
  loansToPartners: number
  mortgageAndRealEstate: number
  otherInvestments: number
  buildings: number
  depreciableAssets: number
  land: number
  intangibleAssets: number
  otherAssets: number
  totalAssets: number
  accountsPayable: number
  mortgagesAndNotes: number
  otherLiabilities: number
  totalLiabilities: number
  partnersCapital: number
}

export interface Form8865Info {
  filingCategories: PartnershipCategory[]
  partnership: ForeignPartnershipInfo
  partners: PartnerInfo[]
  incomeStatement: PartnershipIncomeStatement
  balanceSheet: PartnershipBalanceSheet
  // Schedule K: Partner's distributive share
  distributiveShareOrdinaryIncome: number
  distributiveShareRentalIncome: number
  distributiveShareInterest: number
  distributiveShareDividends: number
  distributiveShareCapitalGains: number
  distributiveShareSection179: number
  distributiveShareCredits: number
  // Schedule O: Property transfers
  propertyTransfers?: {
    description: string
    dateOfTransfer: Date
    fairMarketValue: number
    costBasis: number
    gainRecognized: number
  }[]
}

export default class F8865 extends F1040Attachment {
  tag: FormTag = 'f8865'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF8865Info()
  }

  hasF8865Info = (): boolean => {
    return this.f8865Info() !== undefined
  }

  f8865Info = (): Form8865Info | undefined => {
    return this.f1040.info.foreignPartnerships?.[0] as Form8865Info | undefined
  }

  // Filing categories
  filingCategories = (): PartnershipCategory[] =>
    this.f8865Info()?.filingCategories ?? []
  isCategory = (cat: PartnershipCategory): boolean =>
    this.filingCategories().includes(cat)

  // Partnership info
  partnership = (): ForeignPartnershipInfo | undefined =>
    this.f8865Info()?.partnership

  partnershipName = (): string => this.partnership()?.name ?? ''
  partnershipEin = (): string => this.partnership()?.ein ?? ''
  partnershipReferenceId = (): string => this.partnership()?.referenceId ?? ''
  partnershipCountry = (): string =>
    this.partnership()?.countryOfOrganization ?? ''
  partnershipCurrency = (): string =>
    this.partnership()?.functionalCurrency ?? 'USD'
  exchangeRate = (): number => this.partnership()?.exchangeRateUsed ?? 1

  // Partners
  partners = (): PartnerInfo[] => this.f8865Info()?.partners ?? []

  totalPartnershipInterest = (): number => {
    return this.partners().reduce((sum, p) => sum + p.percentageOwned, 0)
  }

  // Schedule B: Income Statement
  incomeStatement = (): PartnershipIncomeStatement | undefined =>
    this.f8865Info()?.incomeStatement

  grossReceipts = (): number => this.incomeStatement()?.grossReceipts ?? 0
  costOfGoodsSold = (): number => this.incomeStatement()?.costOfGoodsSold ?? 0
  grossProfit = (): number => this.incomeStatement()?.grossProfit ?? 0
  totalIncome = (): number => this.incomeStatement()?.totalIncome ?? 0
  totalDeductions = (): number => this.incomeStatement()?.totalDeductions ?? 0
  ordinaryBusinessIncome = (): number =>
    this.incomeStatement()?.ordinaryBusinessIncome ?? 0

  // Schedule L: Balance Sheet
  balanceSheet = (): PartnershipBalanceSheet | undefined =>
    this.f8865Info()?.balanceSheet

  totalAssets = (): number => this.balanceSheet()?.totalAssets ?? 0
  totalLiabilities = (): number => this.balanceSheet()?.totalLiabilities ?? 0
  partnersCapital = (): number => this.balanceSheet()?.partnersCapital ?? 0

  // Schedule K: Distributive share items
  distributiveShareOrdinaryIncome = (): number =>
    this.f8865Info()?.distributiveShareOrdinaryIncome ?? 0
  distributiveShareRentalIncome = (): number =>
    this.f8865Info()?.distributiveShareRentalIncome ?? 0
  distributiveShareInterest = (): number =>
    this.f8865Info()?.distributiveShareInterest ?? 0
  distributiveShareDividends = (): number =>
    this.f8865Info()?.distributiveShareDividends ?? 0
  distributiveShareCapitalGains = (): number =>
    this.f8865Info()?.distributiveShareCapitalGains ?? 0
  distributiveShareSection179 = (): number =>
    this.f8865Info()?.distributiveShareSection179 ?? 0
  distributiveShareCredits = (): number =>
    this.f8865Info()?.distributiveShareCredits ?? 0

  totalDistributiveShareIncome = (): number => {
    return sumFields([
      this.distributiveShareOrdinaryIncome(),
      this.distributiveShareRentalIncome(),
      this.distributiveShareInterest(),
      this.distributiveShareDividends(),
      this.distributiveShareCapitalGains()
    ])
  }

  // Schedule O: Property transfers
  hasPropertyTransfers = (): boolean => {
    return (this.f8865Info()?.propertyTransfers?.length ?? 0) > 0
  }

  totalPropertyTransferValue = (): number => {
    return (
      this.f8865Info()?.propertyTransfers?.reduce(
        (sum, t) => sum + t.fairMarketValue,
        0
      ) ?? 0
    )
  }

  totalGainRecognized = (): number => {
    return (
      this.f8865Info()?.propertyTransfers?.reduce(
        (sum, t) => sum + t.gainRecognized,
        0
      ) ?? 0
    )
  }

  fields = (): Field[] => {
    const pship = this.partnership()
    const income = this.incomeStatement()
    const balance = this.balanceSheet()
    const partners = this.partners()

    return [
      // Header
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Categories
      this.isCategory(1),
      this.isCategory(2),
      this.isCategory(3),
      this.isCategory(4),
      // Partnership Info
      this.partnershipName(),
      this.partnershipEin(),
      this.partnershipReferenceId(),
      this.partnershipCountry(),
      pship?.dateOfOrganization.toLocaleDateString() ?? '',
      pship?.principalBusinessActivity ?? '',
      pship?.principalBusinessCode ?? '',
      this.partnershipCurrency(),
      this.exchangeRate(),
      // Schedule A: First partner
      partners[0]?.name ?? '',
      partners[0]?.tin ?? '',
      partners[0]?.percentageOwned ?? 0,
      partners[0]?.profitSharingRatio ?? 0,
      partners[0]?.lossSharingRatio ?? 0,
      // Schedule B: Income
      this.grossReceipts(),
      this.costOfGoodsSold(),
      this.grossProfit(),
      income?.ordinaryIncome ?? 0,
      income?.interestIncome ?? 0,
      income?.dividends ?? 0,
      this.totalIncome(),
      income?.salariesAndWages ?? 0,
      income?.guaranteedPayments ?? 0,
      income?.rent ?? 0,
      this.totalDeductions(),
      this.ordinaryBusinessIncome(),
      // Schedule L: Balance Sheet
      balance?.cash ?? 0,
      balance?.accountsReceivable ?? 0,
      this.totalAssets(),
      this.totalLiabilities(),
      this.partnersCapital(),
      // Schedule K: Distributive Share
      this.distributiveShareOrdinaryIncome(),
      this.distributiveShareRentalIncome(),
      this.distributiveShareInterest(),
      this.distributiveShareDividends(),
      this.distributiveShareCapitalGains(),
      this.distributiveShareSection179(),
      this.distributiveShareCredits(),
      this.totalDistributiveShareIncome(),
      // Schedule O
      this.hasPropertyTransfers(),
      this.totalPropertyTransferValue(),
      this.totalGainRecognized()
    ]
  }
}
