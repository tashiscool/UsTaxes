/**
 * Business Entity MeF XML Serializer
 *
 * Serializes business entity tax returns to IRS MeF-compliant XML:
 * - F1120  (Corporate Return)
 * - F1120S (S-Corporation Return)
 * - F1065  (Partnership Return)
 * - F1041  (Trust/Estate Return)
 * - F990   (Nonprofit/Exempt Organization Return)
 *
 * Each serializer produces a standalone <Return> document that conforms to
 * the IRS XML schema for the corresponding return type.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { resolveSchemaVersion } from './serializer'

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration for the business entity serializer
 */
export interface BusinessEntityConfig {
  /** Tax year being filed */
  taxYear: number
  /** Software ID assigned by IRS */
  softwareId: string
  /** Software version */
  softwareVersion: string
  /** Originator EFIN */
  originatorEFIN: string
  /** Originator type */
  originatorType: 'OnlineFiler' | 'ERO' | 'ReportingAgent'
  /** Return type being serialized */
  returnType: '1120' | '1120S' | '1065' | '1041' | '990'
  /** Whether this is a test submission */
  isTestSubmission?: boolean
  /** Schema track override */
  schemaTrack?: 'ats' | 'production'
}

/**
 * Business entity data for serialization
 *
 * This is a generalized structure. Each return type uses a relevant subset.
 */
export interface BusinessEntityData {
  // Entity identification
  entityName: string
  ein: string
  address: {
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    zip: string
    country?: string
  }
  dateIncorporated?: string
  stateOfIncorporation?: string
  principalBusinessActivity?: string
  principalProductOrService?: string
  businessActivityCode?: string

  // Tax period
  taxPeriodBeginDate?: string
  taxPeriodEndDate?: string
  isFiscalYear?: boolean

  // Accounting method
  accountingMethod?: 'Cash' | 'Accrual' | 'Other'

  // Officers / responsible parties
  officers?: Array<{
    name: string
    title: string
    ssn?: string
    percentOwned?: number
    compensationAmount?: number
  }>

  // F1120 / F1120S fields
  grossReceipts?: number
  costOfGoodsSold?: number
  grossProfit?: number
  totalDeductions?: number
  taxableIncome?: number
  totalTax?: number
  totalPayments?: number
  overpayment?: number
  amountOwed?: number

  // F1120S specific - shareholder info
  shareholderCount?: number
  shareholders?: Array<{
    name: string
    ssn: string
    percentOwned: number
    shareOfIncome: number
    shareOfDeductions: number
    shareOfCredits: number
  }>

  // F1065 specific - partner info
  partnerCount?: number
  partners?: Array<{
    name: string
    ssn: string
    percentProfit: number
    percentLoss: number
    percentCapital: number
    capitalContributions: number
    currentYearIncome: number
    withdrawals: number
    endingCapitalAccount: number
  }>

  // F1041 specific - trust/estate fields
  trustType?: 'Simple' | 'Complex' | 'Grantor' | 'Bankruptcy' | 'DecedentEstate'
  decedentName?: string
  decedentDateOfDeath?: string
  fiduciaryName?: string
  fiduciaryAddress?: {
    addressLine1: string
    city: string
    state: string
    zip: string
  }
  distributableNetIncome?: number
  incomeDistributed?: number
  incomeRetained?: number

  // F990 specific - exempt organization fields
  exemptionCode?: string
  groupReturnForAffiliates?: boolean
  websiteUrl?: string
  formOfOrganization?: 'Corporation' | 'Trust' | 'Association' | 'Other'
  yearFormed?: number
  totalRevenue?: number
  totalExpenses?: number
  revenueMinusExpenses?: number
  totalAssets?: number
  totalLiabilities?: number
  netAssets?: number

  // K-1 generation data
  k1Data?: Array<{
    recipientName: string
    recipientTin: string
    recipientType: 'Individual' | 'Corporation' | 'Partnership' | 'Trust'
    ordinaryIncome: number
    netRentalIncome: number
    otherNetRentalIncome: number
    interestIncome: number
    dividendIncome: number
    royaltyIncome: number
    netShortTermCapGain: number
    netLongTermCapGain: number
    section179Deduction: number
    otherDeductions: number
    selfEmploymentEarnings: number
  }>

  // Schedules L, M-1, M-2 (Balance Sheet, Reconciliation)
  balanceSheet?: {
    cashBeginning: number
    cashEnd: number
    totalAssetsBeginning: number
    totalAssetsEnd: number
    totalLiabilitiesBeginning: number
    totalLiabilitiesEnd: number
    retainedEarningsBeginning: number
    retainedEarningsEnd: number
  }
}

// =============================================================================
// XML Utility Functions (local)
// =============================================================================

const IRS_EFILE_NS = 'http://www.irs.gov/efile'
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance'

function escapeXml(str: string | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0'
  return Math.round(num).toString()
}

function formatEIN(ein: string | undefined): string {
  if (!ein) return ''
  return ein.replace(/[-\s]/g, '')
}

function formatSSN(ssn: string | undefined): string {
  if (!ssn) return ''
  return ssn.replace(/[-\s]/g, '')
}

function xmlEl(
  name: string,
  content: string | number | undefined | null
): string {
  if (content === undefined || content === null || content === '') return ''
  return `<${name}>${escapeXml(String(content))}</${name}>`
}

function xmlGroup(
  name: string,
  children: string[],
  attrs?: Record<string, string>
): string {
  const filtered = children.filter((c) => c.length > 0)
  if (filtered.length === 0) return ''
  const attrStr = attrs
    ? ' ' +
      Object.entries(attrs)
        .map(([k, v]) => `${k}="${escapeXml(v)}"`)
        .join(' ')
    : ''
  return `<${name}${attrStr}>\n${filtered.join('\n')}\n</${name}>`
}

// =============================================================================
// Business Entity Serializer Class
// =============================================================================

export class BusinessEntitySerializer {
  private config: BusinessEntityConfig
  private data: BusinessEntityData

  constructor(config: BusinessEntityConfig, data: BusinessEntityData) {
    this.config = config
    this.data = data
  }

  /**
   * Serialize the business entity return to XML
   */
  serialize(): string {
    const track =
      this.config.schemaTrack ??
      (this.config.isTestSubmission ? 'ats' : 'production')
    const returnVersion = resolveSchemaVersion(this.config.taxYear, track)

    const header = this.buildReturnHeader()
    const returnData = this.buildReturnData()

    return `<?xml version="1.0" encoding="UTF-8"?>
<Return xmlns="${IRS_EFILE_NS}" xmlns:xsi="${XSI_NS}" returnVersion="${returnVersion}">
${header}
${returnData}
</Return>`
  }

  // ---------------------------------------------------------------------------
  // Return Header
  // ---------------------------------------------------------------------------

  private buildReturnHeader(): string {
    const d = this.data
    const now = new Date()

    const filerChildren = [
      xmlEl('EIN', formatEIN(d.ein)),
      xmlEl('BusinessNameLine1Txt', d.entityName),
      xmlGroup('USAddress', [
        xmlEl('AddressLine1Txt', d.address.addressLine1),
        d.address.addressLine2
          ? xmlEl('AddressLine2Txt', d.address.addressLine2)
          : '',
        xmlEl('CityNm', d.address.city),
        xmlEl('StateAbbreviationCd', d.address.state),
        xmlEl('ZIPCd', d.address.zip)
      ])
    ]

    const elements = [
      xmlEl('ReturnTs', now.toISOString()),
      xmlEl('TaxYr', this.config.taxYear),
      xmlEl(
        'TaxPeriodBeginDt',
        d.taxPeriodBeginDate ?? `${this.config.taxYear}-01-01`
      ),
      xmlEl(
        'TaxPeriodEndDt',
        d.taxPeriodEndDate ?? `${this.config.taxYear}-12-31`
      ),
      xmlEl('SoftwareId', this.config.softwareId),
      xmlEl('SoftwareVersionNum', this.config.softwareVersion),
      xmlEl('ReturnTypeCd', this.config.returnType),
      xmlGroup('OriginatorGrp', [
        xmlEl('EFIN', this.config.originatorEFIN),
        xmlEl('OriginatorTypeCd', this.config.originatorType)
      ]),
      xmlGroup('Filer', filerChildren),
      this.config.isTestSubmission ? xmlEl('TestSubmissionInd', 'X') : ''
    ]

    return xmlGroup('ReturnHeader', elements, { binaryAttachmentCnt: '0' })
  }

  // ---------------------------------------------------------------------------
  // Return Data dispatch
  // ---------------------------------------------------------------------------

  private buildReturnData(): string {
    let formXml: string
    switch (this.config.returnType) {
      case '1120':
        formXml = this.serializeF1120()
        break
      case '1120S':
        formXml = this.serializeF1120S()
        break
      case '1065':
        formXml = this.serializeF1065()
        break
      case '1041':
        formXml = this.serializeF1041()
        break
      case '990':
        formXml = this.serializeF990()
        break
      default:
        formXml = ''
    }

    const k1Xml = this.serializeK1s()
    const scheduleL = this.serializeScheduleL()

    const allDocs = [formXml, k1Xml, scheduleL].filter((x) => x.length > 0)

    return xmlGroup('ReturnData', allDocs, {
      documentCnt: String(allDocs.length)
    })
  }

  // ---------------------------------------------------------------------------
  // F1120 - Corporate Return
  // ---------------------------------------------------------------------------

  private serializeF1120(): string {
    const d = this.data
    const elements = [
      xmlEl('BusinessActivityCd', d.businessActivityCode),
      xmlEl('PrincipalBusinessActivityTxt', d.principalBusinessActivity),
      xmlEl('PrincipalProductOrServiceTxt', d.principalProductOrService),

      // Income
      xmlEl('GrossReceiptsOrSalesAmt', formatAmount(d.grossReceipts)),
      xmlEl('CostOfGoodsSoldAmt', formatAmount(d.costOfGoodsSold)),
      xmlEl('GrossProfitAmt', formatAmount(d.grossProfit)),
      xmlEl('TotalIncomeAmt', formatAmount(d.grossReceipts)),

      // Deductions
      xmlEl('TotalDeductionsAmt', formatAmount(d.totalDeductions)),

      // Tax and Payments
      xmlEl('TaxableIncomeAmt', formatAmount(d.taxableIncome)),
      xmlEl('TotalTaxAmt', formatAmount(d.totalTax)),
      xmlEl('TotalPaymentsAmt', formatAmount(d.totalPayments)),
      xmlEl('OverpaymentAmt', formatAmount(d.overpayment)),
      xmlEl('OwedAmt', formatAmount(d.amountOwed)),

      // Officers
      this.serializeOfficers(),

      // Accounting method
      xmlEl('AccountingMethodCd', d.accountingMethod),
      xmlEl('DateIncorporated', d.dateIncorporated),
      xmlEl('StateOfIncorporationCd', d.stateOfIncorporation)
    ]

    return xmlGroup('IRS1120', elements, {
      documentId: 'IRS11200001',
      softwareId: this.config.softwareId,
      softwareVersionNum: this.config.softwareVersion
    })
  }

  // ---------------------------------------------------------------------------
  // F1120S - S-Corporation Return
  // ---------------------------------------------------------------------------

  private serializeF1120S(): string {
    const d = this.data
    const elements = [
      xmlEl('BusinessActivityCd', d.businessActivityCode),

      // Income
      xmlEl('GrossReceiptsOrSalesAmt', formatAmount(d.grossReceipts)),
      xmlEl('CostOfGoodsSoldAmt', formatAmount(d.costOfGoodsSold)),
      xmlEl('GrossProfitAmt', formatAmount(d.grossProfit)),

      // Deductions
      xmlEl('TotalDeductionsAmt', formatAmount(d.totalDeductions)),

      // Ordinary business income
      xmlEl('OrdinaryBusinessIncomeLossAmt', formatAmount(d.taxableIncome)),

      // Tax and payments
      xmlEl('TotalTaxAmt', formatAmount(d.totalTax)),
      xmlEl('TotalPaymentsAmt', formatAmount(d.totalPayments)),
      xmlEl('OverpaymentAmt', formatAmount(d.overpayment)),
      xmlEl('OwedAmt', formatAmount(d.amountOwed)),

      // Shareholder count
      xmlEl('NumberOfShareholdersCnt', d.shareholderCount),

      // Officers
      this.serializeOfficers(),

      // Shareholder K-1 summary
      this.serializeShareholderSchedule()
    ]

    return xmlGroup('IRS1120S', elements, {
      documentId: 'IRS1120S0001',
      softwareId: this.config.softwareId,
      softwareVersionNum: this.config.softwareVersion
    })
  }

  // ---------------------------------------------------------------------------
  // F1065 - Partnership Return
  // ---------------------------------------------------------------------------

  private serializeF1065(): string {
    const d = this.data
    const elements = [
      xmlEl('BusinessActivityCd', d.businessActivityCode),
      xmlEl('PrincipalBusinessActivityTxt', d.principalBusinessActivity),

      // Income
      xmlEl('GrossReceiptsOrSalesAmt', formatAmount(d.grossReceipts)),
      xmlEl('CostOfGoodsSoldAmt', formatAmount(d.costOfGoodsSold)),
      xmlEl('GrossProfitAmt', formatAmount(d.grossProfit)),

      // Deductions
      xmlEl('TotalDeductionsAmt', formatAmount(d.totalDeductions)),

      // Ordinary business income
      xmlEl('OrdinaryBusinessIncomeLossAmt', formatAmount(d.taxableIncome)),

      // Partner count
      xmlEl('TotalPartnersCnt', d.partnerCount),

      // Partner capital account analysis
      this.serializePartnerSchedule()
    ]

    return xmlGroup('IRS1065', elements, {
      documentId: 'IRS10650001',
      softwareId: this.config.softwareId,
      softwareVersionNum: this.config.softwareVersion
    })
  }

  // ---------------------------------------------------------------------------
  // F1041 - Trust/Estate Return
  // ---------------------------------------------------------------------------

  private serializeF1041(): string {
    const d = this.data
    const elements = [
      // Trust type
      xmlEl('TrustTypeCd', d.trustType),

      // Decedent info (if estate)
      d.decedentName ? xmlEl('DecedentNm', d.decedentName) : '',
      d.decedentDateOfDeath
        ? xmlEl('DateOfDeathDt', d.decedentDateOfDeath)
        : '',

      // Fiduciary
      d.fiduciaryName ? xmlEl('FiduciaryNm', d.fiduciaryName) : '',
      d.fiduciaryAddress
        ? xmlGroup('FiduciaryAddress', [
            xmlEl('AddressLine1Txt', d.fiduciaryAddress.addressLine1),
            xmlEl('CityNm', d.fiduciaryAddress.city),
            xmlEl('StateAbbreviationCd', d.fiduciaryAddress.state),
            xmlEl('ZIPCd', d.fiduciaryAddress.zip)
          ])
        : '',

      // Income
      xmlEl('GrossReceiptsOrSalesAmt', formatAmount(d.grossReceipts)),
      xmlEl('TotalIncomeAmt', formatAmount(d.grossReceipts)),

      // Deductions
      xmlEl('TotalDeductionsAmt', formatAmount(d.totalDeductions)),

      // Distributable Net Income
      xmlEl(
        'DistributableNetIncomeAmt',
        formatAmount(d.distributableNetIncome)
      ),
      xmlEl('IncomeDistributedAmt', formatAmount(d.incomeDistributed)),
      xmlEl('IncomeRetainedByTrustAmt', formatAmount(d.incomeRetained)),

      // Tax
      xmlEl('TaxableIncomeAmt', formatAmount(d.taxableIncome)),
      xmlEl('TotalTaxAmt', formatAmount(d.totalTax)),
      xmlEl('TotalPaymentsAmt', formatAmount(d.totalPayments)),
      xmlEl('OverpaymentAmt', formatAmount(d.overpayment)),
      xmlEl('OwedAmt', formatAmount(d.amountOwed))
    ]

    return xmlGroup('IRS1041', elements, {
      documentId: 'IRS10410001',
      softwareId: this.config.softwareId,
      softwareVersionNum: this.config.softwareVersion
    })
  }

  // ---------------------------------------------------------------------------
  // F990 - Exempt Organization Return
  // ---------------------------------------------------------------------------

  private serializeF990(): string {
    const d = this.data
    const elements = [
      // Organization info
      xmlEl('ExemptionCd', d.exemptionCode),
      xmlEl('WebsiteAddressTxt', d.websiteUrl),
      xmlEl('FormOfOrganizationCd', d.formOfOrganization),
      xmlEl('YearFormedNum', d.yearFormed),

      // Revenue
      xmlEl('TotalRevenueAmt', formatAmount(d.totalRevenue)),

      // Expenses
      xmlEl('TotalFunctionalExpensesAmt', formatAmount(d.totalExpenses)),

      // Net
      xmlEl('RevenueMinusExpensesAmt', formatAmount(d.revenueMinusExpenses)),

      // Balance sheet summary
      xmlEl('TotalAssetsEOYAmt', formatAmount(d.totalAssets)),
      xmlEl('TotalLiabilitiesEOYAmt', formatAmount(d.totalLiabilities)),
      xmlEl('NetAssetsOrFundBalancesEOYAmt', formatAmount(d.netAssets)),

      // Officers
      this.serializeOfficers()
    ]

    return xmlGroup('IRS990', elements, {
      documentId: 'IRS9900001',
      softwareId: this.config.softwareId,
      softwareVersionNum: this.config.softwareVersion
    })
  }

  // ---------------------------------------------------------------------------
  // Shared helper serializers
  // ---------------------------------------------------------------------------

  private serializeOfficers(): string {
    if (!this.data.officers || this.data.officers.length === 0) return ''

    const officerElements = this.data.officers.map((officer, idx) =>
      xmlGroup(
        'OfficerDetail',
        [
          xmlEl('PersonNm', officer.name),
          xmlEl('TitleTxt', officer.title),
          officer.ssn ? xmlEl('SSN', formatSSN(officer.ssn)) : '',
          xmlEl('PercentOfOwnershipPct', officer.percentOwned),
          xmlEl('CompensationAmt', formatAmount(officer.compensationAmount))
        ],
        { officerNum: String(idx + 1) }
      )
    )

    return xmlGroup('OfficerDirectorTrusteeGrp', officerElements)
  }

  private serializeShareholderSchedule(): string {
    if (!this.data.shareholders || this.data.shareholders.length === 0)
      return ''

    const elements = this.data.shareholders.map((sh, idx) =>
      xmlGroup(
        'ShareholderInformation',
        [
          xmlEl('ShareholderNm', sh.name),
          xmlEl('ShareholderSSN', formatSSN(sh.ssn)),
          xmlEl('PercentOfOwnershipPct', sh.percentOwned),
          xmlEl('ShareOfIncomeAmt', formatAmount(sh.shareOfIncome)),
          xmlEl('ShareOfDeductionsAmt', formatAmount(sh.shareOfDeductions)),
          xmlEl('ShareOfCreditsAmt', formatAmount(sh.shareOfCredits))
        ],
        { shareholderNum: String(idx + 1) }
      )
    )

    return xmlGroup('ShareholderSchedule', elements)
  }

  private serializePartnerSchedule(): string {
    if (!this.data.partners || this.data.partners.length === 0) return ''

    const elements = this.data.partners.map((p, idx) =>
      xmlGroup(
        'PartnerInformation',
        [
          xmlEl('PartnerNm', p.name),
          xmlEl('PartnerSSN', formatSSN(p.ssn)),
          xmlEl('ProfitSharingPct', p.percentProfit),
          xmlEl('LossSharingPct', p.percentLoss),
          xmlEl('CapitalSharingPct', p.percentCapital),
          xmlEl(
            'CapitalContributionsAmt',
            formatAmount(p.capitalContributions)
          ),
          xmlEl('CurrentYearIncomeAmt', formatAmount(p.currentYearIncome)),
          xmlEl('WithdrawalsAmt', formatAmount(p.withdrawals)),
          xmlEl('EndingCapitalAccountAmt', formatAmount(p.endingCapitalAccount))
        ],
        { partnerNum: String(idx + 1) }
      )
    )

    return xmlGroup('PartnerCapitalAccountAnalysis', elements)
  }

  private serializeK1s(): string {
    if (!this.data.k1Data || this.data.k1Data.length === 0) return ''

    const k1Elements = this.data.k1Data.map((k1, idx) =>
      xmlGroup(
        'K1',
        [
          xmlEl('RecipientNm', k1.recipientName),
          xmlEl('RecipientTIN', formatSSN(k1.recipientTin)),
          xmlEl('RecipientTypeCd', k1.recipientType),
          xmlEl('OrdinaryBusinessIncomeAmt', formatAmount(k1.ordinaryIncome)),
          xmlEl(
            'NetRentalRealEstateIncomeAmt',
            formatAmount(k1.netRentalIncome)
          ),
          xmlEl(
            'OtherNetRentalIncomeAmt',
            formatAmount(k1.otherNetRentalIncome)
          ),
          xmlEl('InterestIncomeAmt', formatAmount(k1.interestIncome)),
          xmlEl('DividendIncomeAmt', formatAmount(k1.dividendIncome)),
          xmlEl('RoyaltyIncomeAmt', formatAmount(k1.royaltyIncome)),
          xmlEl(
            'NetShortTermCapitalGainAmt',
            formatAmount(k1.netShortTermCapGain)
          ),
          xmlEl(
            'NetLongTermCapitalGainAmt',
            formatAmount(k1.netLongTermCapGain)
          ),
          xmlEl('Section179DeductionAmt', formatAmount(k1.section179Deduction)),
          xmlEl('OtherDeductionsAmt', formatAmount(k1.otherDeductions)),
          xmlEl(
            'SelfEmploymentEarningsAmt',
            formatAmount(k1.selfEmploymentEarnings)
          )
        ],
        { k1Num: String(idx + 1) }
      )
    )

    const formTag =
      this.config.returnType === '1120S'
        ? 'ScheduleK1Form1120S'
        : this.config.returnType === '1065'
        ? 'ScheduleK1Form1065'
        : 'ScheduleK1'

    return xmlGroup(formTag, k1Elements, {
      documentId: `${formTag}0001`
    })
  }

  private serializeScheduleL(): string {
    const bs = this.data.balanceSheet
    if (!bs) return ''

    const elements = [
      xmlEl('CashBOYAmt', formatAmount(bs.cashBeginning)),
      xmlEl('CashEOYAmt', formatAmount(bs.cashEnd)),
      xmlEl('TotalAssetsBOYAmt', formatAmount(bs.totalAssetsBeginning)),
      xmlEl('TotalAssetsEOYAmt', formatAmount(bs.totalAssetsEnd)),
      xmlEl(
        'TotalLiabilitiesBOYAmt',
        formatAmount(bs.totalLiabilitiesBeginning)
      ),
      xmlEl('TotalLiabilitiesEOYAmt', formatAmount(bs.totalLiabilitiesEnd)),
      xmlEl(
        'RetainedEarningsBOYAmt',
        formatAmount(bs.retainedEarningsBeginning)
      ),
      xmlEl('RetainedEarningsEOYAmt', formatAmount(bs.retainedEarningsEnd))
    ]

    return xmlGroup('ScheduleL', elements, {
      documentId: 'ScheduleL0001'
    })
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBusinessEntitySerializer(
  config: BusinessEntityConfig,
  data: BusinessEntityData
): BusinessEntitySerializer {
  return new BusinessEntitySerializer(config, data)
}

export default BusinessEntitySerializer
