/**
 * IRS MeF XML Serializer for Form 1040
 *
 * Converts UsTaxes form data to IRS-compliant XML format for electronic filing.
 * Follows IRS Modernized e-File (MeF) specifications.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type F1040 from 'ustaxes/forms/Y2024/irsForms/F1040'
import type Schedule1 from 'ustaxes/forms/Y2024/irsForms/Schedule1'
import type ScheduleA from 'ustaxes/forms/Y2024/irsForms/ScheduleA'
import type ScheduleB from 'ustaxes/forms/Y2024/irsForms/ScheduleB'
import type ScheduleC from 'ustaxes/forms/Y2024/irsForms/ScheduleC'
import type ScheduleD from 'ustaxes/forms/Y2024/irsForms/ScheduleD'
import type ScheduleE from 'ustaxes/forms/Y2024/irsForms/ScheduleE'
import type ScheduleSE from 'ustaxes/forms/Y2024/irsForms/ScheduleSE'
import type F8949 from 'ustaxes/forms/Y2024/irsForms/F8949'
import {
  FilingStatus,
  IncomeW2,
  Income1099Int,
  Income1099Div,
  Income1099B,
  Income1099R,
  PersonRole,
  AccountType
} from 'ustaxes/core/data'

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration options for the serializer
 */
export interface SerializerConfig {
  /** Tax year being filed */
  taxYear: number
  /** Software ID assigned by IRS */
  softwareId: string
  /** Software version identifier */
  softwareVersion: string
  /** Originator EFIN (Electronic Filing Identification Number) */
  originatorEFIN: string
  /** Originator type: OnlineFiler, ERO, etc. */
  originatorType:
    | 'OnlineFiler'
    | 'ERO'
    | 'ReportingAgent'
    | 'OriginatorSelfSelect'
  /** PIN type: Self-Select PIN or Practitioner PIN */
  pinType: 'SelfSelectPIN' | 'PractitionerPIN'
  /** Primary taxpayer's PIN (5 digits) */
  primaryPIN?: string
  /** Spouse's PIN (5 digits) for MFJ */
  spousePIN?: string
  /** IP address of the filing device */
  deviceIPAddress?: string
  /** Whether this is a test submission */
  isTestSubmission?: boolean
}

/**
 * XML namespace definitions for IRS e-file
 */
const XML_NAMESPACES = {
  efile: 'http://www.irs.gov/efile',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance'
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a number as IRS dollar amount (no decimals, no cents)
 */
export function formatAmount(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0'
  }
  return Math.round(num).toString()
}

/**
 * Format a number with cents (2 decimal places)
 */
export function formatAmountWithCents(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0.00'
  }
  return num.toFixed(2)
}

/**
 * Format SSN without dashes (9 digits)
 */
export function formatSSN(ssn: string | undefined): string {
  if (!ssn) return ''
  return ssn.replace(/[-\s]/g, '')
}

/**
 * Format EIN without dash
 */
export function formatEIN(ein: string | undefined): string {
  if (!ein) return ''
  return ein.replace(/[-\s]/g, '')
}

/**
 * Format date as YYYY-MM-DD for IRS
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format timestamp as ISO 8601 for IRS
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString()
}

/**
 * Escape special XML characters
 */
export function escapeXml(str: string | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Convert filing status to IRS code
 */
function filingStatusToCode(status: FilingStatus): string {
  const statusMap: Record<FilingStatus, string> = {
    [FilingStatus.S]: '1',
    [FilingStatus.MFJ]: '2',
    [FilingStatus.MFS]: '3',
    [FilingStatus.HOH]: '4',
    [FilingStatus.W]: '5'
  }
  return statusMap[status] || '1'
}

/**
 * Convert filing status to IRS text description
 */
function filingStatusToText(status: FilingStatus): string {
  const statusMap: Record<FilingStatus, string> = {
    [FilingStatus.S]: 'Single',
    [FilingStatus.MFJ]: 'Married filing jointly',
    [FilingStatus.MFS]: 'Married filing separately',
    [FilingStatus.HOH]: 'Head of household',
    [FilingStatus.W]: 'Qualifying surviving spouse'
  }
  return statusMap[status] || 'Single'
}

/**
 * Build XML element with optional attributes
 */
function xmlElement(
  name: string,
  content: string | number | undefined | null,
  attributes?: Record<string, string>
): string {
  if (content === undefined || content === null || content === '') {
    return ''
  }

  const attrStr = attributes
    ? ' ' +
      Object.entries(attributes)
        .map(([k, v]) => `${k}="${escapeXml(v)}"`)
        .join(' ')
    : ''

  return `<${name}${attrStr}>${escapeXml(String(content))}</${name}>`
}

/**
 * Build XML element with child elements
 */
function xmlContainer(
  name: string,
  children: string[],
  attributes?: Record<string, string>
): string {
  const filteredChildren = children.filter((c) => c.length > 0)
  if (filteredChildren.length === 0) {
    return ''
  }

  const attrStr = attributes
    ? ' ' +
      Object.entries(attributes)
        .map(([k, v]) => `${k}="${escapeXml(v)}"`)
        .join(' ')
    : ''

  return `<${name}${attrStr}>\n${filteredChildren.join('\n')}\n</${name}>`
}

// =============================================================================
// Form1040Serializer Class
// =============================================================================

/**
 * Main serializer class for converting F1040 to IRS MeF XML
 */
export class Form1040Serializer {
  private f1040: F1040
  private config: SerializerConfig

  constructor(f1040: F1040, config: SerializerConfig) {
    this.f1040 = f1040
    this.config = config
  }

  /**
   * Serialize the complete Form 1040 return to XML
   */
  serialize(): string {
    const header = this.buildReturnHeader()
    const returnData = this.buildReturnData()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Return xmlns="${XML_NAMESPACES.efile}" xmlns:xsi="${XML_NAMESPACES.xsi}" returnVersion="${this.config.taxYear}v5.0">
${header}
${returnData}
</Return>`

    return xml
  }

  /**
   * Build the ReturnHeader element with filing metadata
   */
  buildReturnHeader(): string {
    const now = new Date()
    const info = this.f1040.info
    const primary = info.taxPayer.primaryPerson

    const filerElements = [
      xmlElement('PrimarySSN', formatSSN(primary.ssid)),
      info.taxPayer.spouse
        ? xmlElement('SpouseSSN', formatSSN(info.taxPayer.spouse.ssid))
        : '',
      xmlElement('NameLine1Txt', `${primary.firstName} ${primary.lastName}`),
      info.taxPayer.spouse
        ? xmlElement(
            'SpouseNameLine1Txt',
            `${info.taxPayer.spouse.firstName} ${info.taxPayer.spouse.lastName}`
          )
        : '',
      this.buildAddress(primary.address)
    ]

    const elements = [
      xmlElement('ReturnTs', formatTimestamp(now)),
      xmlElement('TaxYr', this.config.taxYear),
      xmlElement('TaxPeriodBeginDt', `${this.config.taxYear}-01-01`),
      xmlElement('TaxPeriodEndDt', `${this.config.taxYear}-12-31`),
      xmlElement('SoftwareId', this.config.softwareId),
      xmlElement('SoftwareVersionNum', this.config.softwareVersion),
      xmlElement(
        'OriginatorGrp',
        xmlContainer('OriginatorGrp', [
          xmlElement('EFIN', this.config.originatorEFIN),
          xmlElement('OriginatorTypeCd', this.config.originatorType)
        ])
      ),
      xmlElement(
        'SelfSelectPINGrp',
        xmlContainer('SelfSelectPINGrp', [
          xmlElement('PrimaryBirthDt', formatDate(primary.dateOfBirth)),
          this.config.primaryPIN
            ? xmlElement('PrimaryPINEnteredByCd', this.config.primaryPIN)
            : '',
          info.taxPayer.spouse && this.config.spousePIN
            ? xmlElement('SpousePINEnteredByCd', this.config.spousePIN)
            : ''
        ])
      ),
      xmlElement('ReturnTypeCd', '1040'),
      xmlContainer('Filer', filerElements),
      this.config.deviceIPAddress
        ? xmlElement(
            'IPAddress',
            xmlContainer('IPAddress', [
              xmlElement('IPv4AddressTxt', this.config.deviceIPAddress)
            ])
          )
        : '',
      this.config.isTestSubmission ? xmlElement('TestSubmissionInd', 'X') : ''
    ]

    return xmlContainer('ReturnHeader', elements, {
      binaryAttachmentCnt: '0'
    })
  }

  /**
   * Build address element
   */
  private buildAddress(address: {
    address: string
    aptNo?: string
    city: string
    state?: string
    zip?: string
    foreignCountry?: string
    province?: string
    postalCode?: string
  }): string {
    if (address.foreignCountry) {
      return xmlContainer('ForeignAddress', [
        xmlElement('AddressLine1Txt', address.address),
        address.aptNo
          ? xmlElement('AddressLine2Txt', `Apt ${address.aptNo}`)
          : '',
        xmlElement('CityNm', address.city),
        xmlElement('ProvinceOrStateNm', address.province || ''),
        xmlElement('CountryCd', address.foreignCountry),
        xmlElement('ForeignPostalCd', address.postalCode || '')
      ])
    }

    return xmlContainer('USAddress', [
      xmlElement('AddressLine1Txt', address.address),
      address.aptNo
        ? xmlElement('AddressLine2Txt', `Apt ${address.aptNo}`)
        : '',
      xmlElement('CityNm', address.city),
      xmlElement('StateAbbreviationCd', address.state || ''),
      xmlElement('ZIPCd', address.zip || '')
    ])
  }

  /**
   * Build the main ReturnData element
   */
  buildReturnData(): string {
    const elements = [
      this.buildIRS1040(),
      this.serializeSchedule1(),
      this.serializeScheduleA(),
      this.serializeScheduleB(),
      this.serializeScheduleC(),
      this.serializeScheduleD(),
      this.serializeScheduleE(),
      this.serializeScheduleSE(),
      ...this.serializeW2s(),
      ...this.serialize1099s(),
      ...this.serializeForm8949s()
    ]

    return xmlContainer(
      'ReturnData',
      elements.filter((e) => e.length > 0),
      {
        documentCnt: String(elements.filter((e) => e.length > 0).length)
      }
    )
  }

  /**
   * Build the main IRS1040 form element
   */
  private buildIRS1040(): string {
    const elements = [
      this.buildFiler(),
      this.buildFilingStatus(),
      this.buildDependents(),
      this.buildIncome(),
      this.buildAdjustments(),
      this.buildDeductions(),
      this.buildTaxAndCredits(),
      this.buildPayments(),
      this.buildRefundOrAmountOwed(),
      this.buildThirdPartyDesignee(),
      this.buildSignature()
    ]

    return xmlContainer('IRS1040', elements, {
      documentId: 'IRS10400001',
      referenceDocumentId: '',
      softwareId: this.config.softwareId,
      softwareVersionNum: this.config.softwareVersion
    })
  }

  /**
   * Build Filer identification section
   */
  buildFiler(): string {
    const info = this.f1040.info
    const primary = info.taxPayer.primaryPerson

    const elements = [
      xmlElement('PrimarySSN', formatSSN(primary.ssid)),
      xmlElement(
        'PrimaryNameControlTxt',
        primary.lastName.substring(0, 4).toUpperCase()
      ),
      info.taxPayer.spouse
        ? xmlElement('SpouseSSN', formatSSN(info.taxPayer.spouse.ssid))
        : '',
      info.taxPayer.spouse
        ? xmlElement(
            'SpouseNameControlTxt',
            info.taxPayer.spouse.lastName.substring(0, 4).toUpperCase()
          )
        : '',
      xmlContainer('PrimaryNm', [
        xmlElement('PersonFirstNm', primary.firstName),
        xmlElement('PersonLastNm', primary.lastName)
      ]),
      info.taxPayer.spouse
        ? xmlContainer('SpouseNm', [
            xmlElement('PersonFirstNm', info.taxPayer.spouse.firstName),
            xmlElement('PersonLastNm', info.taxPayer.spouse.lastName)
          ])
        : '',
      this.buildAddress(primary.address),
      info.taxPayer.contactPhoneNumber
        ? xmlElement(
            'PhoneNum',
            info.taxPayer.contactPhoneNumber.replace(/[-\s()]/g, '')
          )
        : '',
      info.taxPayer.contactEmail
        ? xmlElement('EmailAddressTxt', info.taxPayer.contactEmail)
        : ''
    ]

    return xmlContainer('Filer', elements)
  }

  /**
   * Build filing status section
   */
  private buildFilingStatus(): string {
    const status = this.f1040.info.taxPayer.filingStatus

    return xmlContainer('IndividualReturnFilingStatusCd', [
      xmlElement('FilingStatusCd', filingStatusToCode(status)),
      xmlElement('FilingStatusDesc', filingStatusToText(status))
    ])
  }

  /**
   * Build dependents section
   */
  private buildDependents(): string {
    const dependents = this.f1040.info.taxPayer.dependents

    if (dependents.length === 0) {
      return ''
    }

    const depElements = dependents.map((dep, idx) =>
      xmlContainer(
        'DependentDetail',
        [
          xmlElement('DependentFirstNm', dep.firstName),
          xmlElement('DependentLastNm', dep.lastName),
          xmlElement(
            'DependentNameControlTxt',
            dep.lastName.substring(0, 4).toUpperCase()
          ),
          xmlElement('DependentSSN', formatSSN(dep.ssid)),
          xmlElement(
            'DependentRelationshipCd',
            this.mapRelationship(dep.relationship)
          ),
          xmlElement(
            'EligibleForChildTaxCreditInd',
            this.f1040.qualifyingDependents.qualifiesChild(dep) ? 'X' : ''
          ),
          xmlElement(
            'EligibleForODCInd',
            this.f1040.qualifyingDependents.qualifiesOther(dep) ? 'X' : ''
          )
        ],
        { dependentId: `DEP${String(idx + 1).padStart(4, '0')}` }
      )
    )

    return xmlContainer('DependentInformationGrp', depElements)
  }

  /**
   * Map relationship string to IRS code
   */
  private mapRelationship(relationship: string): string {
    const relationshipMap: Record<string, string> = {
      son: 'SON',
      daughter: 'DAUGHTER',
      stepson: 'STEPSON',
      stepdaughter: 'STEPDAUGHTER',
      'foster child': 'FOSTER CHILD',
      grandchild: 'GRANDCHILD',
      sibling: 'SIBLING',
      parent: 'PARENT',
      grandparent: 'GRANDPARENT',
      niece: 'NIECE',
      nephew: 'NEPHEW',
      other: 'OTHER'
    }
    return relationshipMap[relationship.toLowerCase()] || 'OTHER'
  }

  /**
   * Build income section (Lines 1-9)
   */
  buildIncome(): string {
    const elements = [
      // Line 1 - Wages, salaries, tips
      xmlElement('WagesSalariesAndTipsAmt', formatAmount(this.f1040.l1z())),
      xmlElement('WagesAmt', formatAmount(this.f1040.l1a())),
      xmlElement('HouseholdEmployeeWagesAmt', formatAmount(this.f1040.l1b())),
      xmlElement('TipIncomeAmt', formatAmount(this.f1040.l1c())),
      xmlElement(
        'MedicaidWaiverPymtNotRptW2Amt',
        formatAmount(this.f1040.l1d())
      ),
      xmlElement('TaxableDependentCareBnftAmt', formatAmount(this.f1040.l1e())),
      xmlElement(
        'EmployerProvidedAdoptionBnftAmt',
        formatAmount(this.f1040.l1f())
      ),
      xmlElement('Form8919WagesNotW2Amt', formatAmount(this.f1040.l1g())),
      xmlElement('OtherEarnedIncomeAmt', formatAmount(this.f1040.l1h())),

      // Line 2 - Interest
      xmlElement('TaxExemptInterestAmt', formatAmount(this.f1040.l2a())),
      xmlElement('TaxableInterestAmt', formatAmount(this.f1040.l2b())),

      // Line 3 - Dividends
      xmlElement('QualifiedDividendsAmt', formatAmount(this.f1040.l3a())),
      xmlElement('OrdinaryDividendsAmt', formatAmount(this.f1040.l3b())),

      // Line 4 - IRA distributions
      xmlElement('IRADistributionsAmt', formatAmount(this.f1040.l4a())),
      xmlElement('TaxableIRAAmt', formatAmount(this.f1040.l4b())),

      // Line 5 - Pensions and annuities
      xmlElement('PensionsAnnuitiesAmt', formatAmount(this.f1040.l5a())),
      xmlElement('TotalTaxablePensionsAmt', formatAmount(this.f1040.l5b())),

      // Line 6 - Social Security benefits
      xmlElement('SocSecBnftAmt', formatAmount(this.f1040.l6a())),
      xmlElement('TaxableSocSecAmt', formatAmount(this.f1040.l6b())),
      this.f1040.l6c() ? xmlElement('SocSecBnftTreatedAsTaxableInd', 'X') : '',

      // Line 7 - Capital gain or loss
      this.f1040.l7Box() ? xmlElement('CapitalDistributionInd', 'X') : '',
      xmlElement('CapitalGainLossAmt', formatAmount(this.f1040.l7())),

      // Line 8 - Additional income from Schedule 1
      xmlElement('AdditionalIncomeAmt', formatAmount(this.f1040.l8())),

      // Line 9 - Total income
      xmlElement('TotalIncomeAmt', formatAmount(this.f1040.l9()))
    ]

    return xmlContainer('IncomeSection', elements)
  }

  /**
   * Build adjustments section
   */
  buildAdjustments(): string {
    const elements = [
      // Line 10 - Adjustments from Schedule 1
      xmlElement('TotalAdjustmentsAmt', formatAmount(this.f1040.l10())),

      // Line 11 - AGI
      xmlElement('AdjustedGrossIncomeAmt', formatAmount(this.f1040.l11()))
    ]

    return xmlContainer('AdjustmentsSection', elements)
  }

  /**
   * Build deductions section (Lines 12-15)
   */
  buildDeductions(): string {
    const scheduleA = this.f1040.scheduleA
    const isItemized = scheduleA.isNeeded()

    const elements = [
      // Line 12 - Standard or itemized deduction
      xmlElement(
        'TotalItemizedOrStandardDedAmt',
        formatAmount(this.f1040.l12())
      ),
      isItemized
        ? xmlElement('ItemizedDeductionsInd', 'X')
        : xmlElement('StandardDeductionInd', 'X'),

      // Line 13 - Qualified business income deduction
      xmlElement(
        'QualifiedBusinessIncomeDedAmt',
        formatAmount(this.f1040.l13())
      ),

      // Line 14 - Total deductions
      xmlElement('TotalDeductionsAmt', formatAmount(this.f1040.l14())),

      // Line 15 - Taxable income
      xmlElement('TaxableIncomeAmt', formatAmount(this.f1040.l15()))
    ]

    return xmlContainer('DeductionsSection', elements)
  }

  /**
   * Build tax and credits section (Lines 16-24)
   */
  buildTaxAndCredits(): string {
    const elements = [
      // Line 16 - Tax
      xmlElement('TaxAmt', formatAmount(this.f1040.l16())),
      this.f1040.f8814Box() ? xmlElement('Form8814Ind', 'X') : '',
      this.f1040.f4972Box() ? xmlElement('Form4972Ind', 'X') : '',
      this.f1040.otherFormBox() ? xmlElement('OtherTaxFormInd', 'X') : '',
      this.f1040.otherFormName()
        ? xmlElement('OtherTaxFormNm', this.f1040.otherFormName())
        : '',

      // Line 17 - Schedule 2 taxes
      xmlElement('AdditionalTaxAmt', formatAmount(this.f1040.l17())),

      // Line 18 - Total tax before credits
      xmlElement(
        'TotalTaxBeforeCrAndOthTaxesAmt',
        formatAmount(this.f1040.l18())
      ),

      // Line 19 - Child tax credit / other dependent credit
      xmlElement('ChildTaxCreditAmt', formatAmount(this.f1040.l19())),

      // Line 20 - Schedule 3 credits
      xmlElement('OtherTaxCreditsAmt', formatAmount(this.f1040.l20())),

      // Line 21 - Total credits
      xmlElement('TotalCreditsAmt', formatAmount(this.f1040.l21())),

      // Line 22 - Tax after credits
      xmlElement('TaxLessCreditsAmt', formatAmount(this.f1040.l22())),

      // Line 23 - Other taxes from Schedule 2
      xmlElement('OtherTaxesAmt', formatAmount(this.f1040.l23())),

      // Line 24 - Total tax
      xmlElement('TotalTaxAmt', formatAmount(this.f1040.l24()))
    ]

    return xmlContainer('TaxAndCreditsSection', elements)
  }

  /**
   * Build payments section (Lines 25-33)
   */
  buildPayments(): string {
    const elements = [
      // Line 25 - Withholding
      xmlElement('WithholdingTaxAmt', formatAmount(this.f1040.l25d())),
      xmlElement('FormW2WithheldTaxAmt', formatAmount(this.f1040.l25a())),
      xmlElement('Form1099WithheldTaxAmt', formatAmount(this.f1040.l25b())),
      xmlElement('OtherWithheldTaxAmt', formatAmount(this.f1040.l25c())),

      // Line 26 - Estimated tax payments
      xmlElement('EstimatedTaxPaymentsAmt', formatAmount(this.f1040.l26())),

      // Line 27 - Earned Income Credit
      xmlElement('EarnedIncomeCreditAmt', formatAmount(this.f1040.l27())),

      // Line 28 - Additional child tax credit
      xmlElement('AdditionalChildTaxCreditAmt', formatAmount(this.f1040.l28())),

      // Line 29 - American Opportunity Credit
      xmlElement(
        'AmericanOpportunityCreditAmt',
        formatAmount(this.f1040.l29())
      ),

      // Line 30 - Recovery Rebate Credit (if applicable)
      xmlElement('RecoveryRebateCreditAmt', formatAmount(this.f1040.l30())),

      // Line 31 - Schedule 3 refundable credits
      xmlElement('RefundableCreditsAmt', formatAmount(this.f1040.l31())),

      // Line 32 - Total other payments and refundable credits
      xmlElement(
        'TotalOtherPaymentsRfdblCrAmt',
        formatAmount(this.f1040.l32())
      ),

      // Line 33 - Total payments
      xmlElement('TotalPaymentsAmt', formatAmount(this.f1040.l33()))
    ]

    return xmlContainer('PaymentsSection', elements)
  }

  /**
   * Build refund or amount owed section (Lines 34-38)
   */
  buildRefundOrAmountOwed(): string {
    const info = this.f1040.info
    const refundInfo = info.refund

    const elements = [
      // Line 34 - Overpayment
      xmlElement('OverpaidAmt', formatAmount(this.f1040.l34())),

      // Line 35 - Amount to be refunded
      xmlElement('RefundAmt', formatAmount(this.f1040.l35a())),

      // Direct deposit information
      refundInfo
        ? xmlContainer('RoutingAndAccountGrp', [
            xmlElement('RoutingTransitNum', refundInfo.routingNumber),
            xmlElement(
              'BankAccountTypeCd',
              refundInfo.accountType === AccountType.checking
                ? 'Checking'
                : 'Savings'
            ),
            xmlElement('DepositorAccountNum', refundInfo.accountNumber)
          ])
        : '',

      // Line 36 - Amount applied to estimated tax
      xmlElement('AppliedToEsTaxAmt', formatAmount(this.f1040.l36())),

      // Line 37 - Amount owed
      xmlElement('OwedAmt', formatAmount(this.f1040.l37())),

      // Line 38 - Estimated tax penalty
      xmlElement('EsPenaltyAmt', formatAmount(this.f1040.l38()))
    ]

    return xmlContainer('RefundSection', elements)
  }

  /**
   * Build third party designee section
   */
  private buildThirdPartyDesignee(): string {
    // Not implemented - return empty by default
    return ''
  }

  /**
   * Build signature section
   */
  private buildSignature(): string {
    const now = new Date()
    const primary = this.f1040.info.taxPayer.primaryPerson
    const primaryOccupation = this.f1040.occupation(PersonRole.PRIMARY)

    const elements = [
      xmlElement('PrimarySignatureDt', formatDate(now)),
      xmlElement('PrimaryOccupationTxt', primaryOccupation || 'Unknown'),
      this.config.primaryPIN
        ? xmlElement('PrimaryPINEnteredByCd', this.config.primaryPIN)
        : '',
      xmlElement('IdentityProtectionPIN', '') // If applicable
    ]

    if (
      this.f1040.info.taxPayer.spouse &&
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ
    ) {
      const spouseOccupation = this.f1040.occupation(PersonRole.SPOUSE)
      elements.push(
        xmlElement('SpouseSignatureDt', formatDate(now)),
        xmlElement('SpouseOccupationTxt', spouseOccupation || 'Unknown'),
        this.config.spousePIN
          ? xmlElement('SpousePINEnteredByCd', this.config.spousePIN)
          : ''
      )
    }

    return xmlContainer('SignatureSection', elements)
  }

  // ===========================================================================
  // Schedule Serializers
  // ===========================================================================

  /**
   * Serialize Schedule 1 (Additional Income and Adjustments)
   */
  serializeSchedule1(): string {
    const schedule1 = this.f1040.schedule1
    if (!schedule1.isNeeded()) {
      return ''
    }

    const elements = [
      // Part I - Additional Income
      xmlElement('AlimonyReceivedAmt', formatAmount(schedule1.l1())),
      xmlElement('BusinessIncomeLossAmt', formatAmount(schedule1.l3())),
      xmlElement('OtherGainLossAmt', formatAmount(schedule1.l4())),
      xmlElement('RentalRealEstateIncomeLossAmt', formatAmount(schedule1.l5())),
      xmlElement('FarmIncomeLossAmt', formatAmount(schedule1.l6())),
      xmlElement('UnemploymentCompAmt', formatAmount(schedule1.l7())),
      xmlElement('OtherIncomeAmt', formatAmount(schedule1.l9())),
      xmlElement('TotalAdditionalIncomeAmt', formatAmount(schedule1.l10())),

      // Part II - Adjustments
      xmlElement('EducatorExpensesAmt', formatAmount(schedule1.l11())),
      xmlElement(
        'BusnExpnsReservistsAndOthersAmt',
        formatAmount(schedule1.l12())
      ),
      xmlElement('HealthSavingsAccountDedAmt', formatAmount(schedule1.l13())),
      xmlElement('MovingExpensesAmt', formatAmount(schedule1.l14())),
      xmlElement('DeductibleSelfEmplmnttaxAmt', formatAmount(schedule1.l15())),
      xmlElement(
        'SelfEmployedSepSimpleQlfyPlnAmt',
        formatAmount(schedule1.l16())
      ),
      xmlElement('SelfEmpldHealthInsDedAmt', formatAmount(schedule1.l17())),
      xmlElement(
        'PnltyOnErlyWthdrwOfSavingsAmt',
        formatAmount(schedule1.l18())
      ),
      xmlElement('AlimonyPaidAmt', formatAmount(schedule1.l19a())),
      xmlElement('IRADeductionAmt', formatAmount(schedule1.l20())),
      xmlElement('StudentLoanIntDedAmt', formatAmount(schedule1.l21())),
      xmlElement('OtherAdjustmentsTotalAmt', formatAmount(schedule1.l25())),
      xmlElement('TotalAdjustmentsAmt', formatAmount(schedule1.l26()))
    ]

    return xmlContainer('IRS1040Schedule1', elements, {
      documentId: 'IRS1040Schedule10001'
    })
  }

  /**
   * Serialize Schedule A (Itemized Deductions)
   */
  serializeScheduleA(): string {
    const scheduleA = this.f1040.scheduleA
    if (!scheduleA.isNeeded()) {
      return ''
    }

    const elements = [
      // Medical and Dental
      xmlElement('MedicalAndDentalExpensesAmt', formatAmount(scheduleA.l1())),
      xmlElement('AGIAmt', formatAmount(scheduleA.l2())),
      xmlElement('CalculatedMedicalAllowanceAmt', formatAmount(scheduleA.l3())),
      xmlElement('MedicalAndDentalDedAmt', formatAmount(scheduleA.l4())),

      // Taxes
      scheduleA.l5aSalesTax()
        ? xmlElement('StateAndLocalSalesTaxInd', 'X')
        : '',
      xmlElement('StateAndLocalTaxAmt', formatAmount(scheduleA.l5a())),
      xmlElement('RealEstateTaxesAmt', formatAmount(scheduleA.l5b())),
      xmlElement('PersonalPropertyTaxesAmt', formatAmount(scheduleA.l5c())),
      xmlElement('TotalStateAndLocalTaxAmt', formatAmount(scheduleA.l5d())),
      xmlElement('StateAndLocalTaxDedAmt', formatAmount(scheduleA.l5e())),
      xmlElement('OtherTaxesAmt', formatAmount(scheduleA.l6())),
      xmlElement('TotalTaxesPaidAmt', formatAmount(scheduleA.l7())),

      // Interest
      scheduleA.l8AllMortgageLoan()
        ? xmlElement('HomeAcqAndHomeEqLoanIntInd', 'X')
        : '',
      xmlElement('HomeMortgageInterestAmt', formatAmount(scheduleA.l8a())),
      xmlElement(
        'HomeMtgIntNotRptOnForm1098Amt',
        formatAmount(scheduleA.l8b())
      ),
      xmlElement(
        'PointsNotReportedOnForm1098Amt',
        formatAmount(scheduleA.l8c())
      ),
      xmlElement('TotalHomeMortgageInterestAmt', formatAmount(scheduleA.l8e())),
      xmlElement('InvestmentInterestAmt', formatAmount(scheduleA.l9())),
      xmlElement('TotalInterestPaidAmt', formatAmount(scheduleA.l10())),

      // Gifts to Charity
      xmlElement('GiftsByCashOrCheckAmt', formatAmount(scheduleA.l11())),
      xmlElement('OtherThanByCashOrCheckAmt', formatAmount(scheduleA.l12())),
      xmlElement('CarryoverPriorYearAmt', formatAmount(scheduleA.l13())),
      xmlElement('TotalGiftsToCharityAmt', formatAmount(scheduleA.l14())),

      // Casualty and Theft Losses
      xmlElement('CasualtyOrTheftLossesAmt', formatAmount(scheduleA.l15())),

      // Other Itemized Deductions
      xmlElement('OtherItemizedDedAmt', formatAmount(scheduleA.l16())),

      // Total
      xmlElement('TotalItemizedDeductionsAmt', formatAmount(scheduleA.l17()))
    ]

    return xmlContainer('IRS1040ScheduleA', elements, {
      documentId: 'IRS1040ScheduleA0001'
    })
  }

  /**
   * Serialize Schedule B (Interest and Dividends)
   */
  serializeScheduleB(): string {
    const scheduleB = this.f1040.scheduleB
    if (!scheduleB.isNeeded()) {
      return ''
    }

    // Build interest payer list
    const interestPayers = scheduleB
      .l1Fields()
      .map((payer, idx) =>
        xmlContainer(
          'InterestIncomeDetail',
          [
            xmlElement('InterestPayerNm', payer.payer),
            xmlElement('InterestAmt', formatAmount(payer.amount))
          ],
          { payerNum: String(idx + 1) }
        )
      )

    // Build dividend payer list
    const dividendPayers = scheduleB
      .l5Fields()
      .map((payer, idx) =>
        xmlContainer(
          'DividendIncomeDetail',
          [
            xmlElement('DividendPayerNm', payer.payer),
            xmlElement('DividendAmt', formatAmount(payer.amount))
          ],
          { payerNum: String(idx + 1) }
        )
      )

    const elements = [
      // Part I - Interest
      ...interestPayers,
      xmlElement('TotalInterestAmt', formatAmount(scheduleB.l2())),
      xmlElement('ExcludableSavingsBondIntAmt', formatAmount(scheduleB.l3())),
      xmlElement('TaxableInterestAmt', formatAmount(scheduleB.l4())),

      // Part II - Dividends
      ...dividendPayers,
      xmlElement('TotalDividendsAmt', formatAmount(scheduleB.l6())),

      // Part III - Foreign Accounts
      xmlElement(
        'ForeignAccountsQuestionInd',
        scheduleB.foreignAccount() ? 'Yes' : 'No'
      ),
      scheduleB.fincenForm() ? xmlElement('FinCENForm114Ind', 'X') : '',
      scheduleB.fincenCountry()
        ? xmlElement('ForeignCountryNm', scheduleB.fincenCountry())
        : '',
      xmlElement(
        'ForeignTrustQuestionInd',
        scheduleB.foreignTrust() ? 'Yes' : 'No'
      )
    ]

    return xmlContainer('IRS1040ScheduleB', elements, {
      documentId: 'IRS1040ScheduleB0001'
    })
  }

  /**
   * Serialize Schedule C (Profit or Loss from Business)
   */
  serializeScheduleC(): string {
    const scheduleC = this.f1040.scheduleC
    if (!scheduleC) {
      return ''
    }

    // Schedule C is currently minimal in the codebase
    const elements = [
      xmlElement('GrossReceiptsOrSalesAmt', formatAmount(scheduleC.l1())),
      xmlElement('NetProfitOrLossAmt', formatAmount(scheduleC.l31()))
    ]

    return xmlContainer('IRS1040ScheduleC', elements, {
      documentId: 'IRS1040ScheduleC0001'
    })
  }

  /**
   * Serialize Schedule D (Capital Gains and Losses)
   */
  serializeScheduleD(): string {
    const scheduleD = this.f1040.scheduleD
    if (!scheduleD.isNeeded()) {
      return ''
    }

    const elements = [
      // Part I - Short-term
      xmlElement(
        'ShortTermGainOrLossFromF8949Amt',
        formatAmount(scheduleD.l1ah())
      ),
      xmlElement(
        'ShortTermGainOrLossFromF8949BAmt',
        formatAmount(scheduleD.l1bh())
      ),
      xmlElement(
        'ShortTermGainOrLoss8949Line2Amt',
        formatAmount(scheduleD.l2h())
      ),
      xmlElement(
        'ShortTermGainOrLoss8949Line3Amt',
        formatAmount(scheduleD.l3h())
      ),
      xmlElement(
        'ShortTermCapGainPassThruEntAmt',
        formatAmount(scheduleD.l4())
      ),
      xmlElement('NetShortTermCapGainOrLossAmt', formatAmount(scheduleD.l5())),
      xmlElement('ShortTermCapGainCarryoverAmt', formatAmount(scheduleD.l6())),
      xmlElement('NetShortTermGainOrLossAmt', formatAmount(scheduleD.l7())),

      // Part II - Long-term
      xmlElement(
        'LongTermGainOrLossFromF8949Amt',
        formatAmount(scheduleD.l8ah())
      ),
      xmlElement(
        'LongTermGainOrLossFromF8949DAmt',
        formatAmount(scheduleD.l8bh())
      ),
      xmlElement(
        'LongTermGainOrLoss8949Line9Amt',
        formatAmount(scheduleD.l9h())
      ),
      xmlElement(
        'LongTermGainOrLoss8949Line10Amt',
        formatAmount(scheduleD.l10h())
      ),
      xmlElement('Form2439Box1aAmt', formatAmount(scheduleD.l11())),
      xmlElement(
        'LongTermCapGainPassThruEntAmt',
        formatAmount(scheduleD.l12())
      ),
      xmlElement('CapGainDistributionsAmt', formatAmount(scheduleD.l13())),
      xmlElement('LongTermCapGainCarryoverAmt', formatAmount(scheduleD.l14())),
      xmlElement('NetLongTermGainOrLossAmt', formatAmount(scheduleD.l15())),

      // Part III
      xmlElement('NetCapitalGainOrLossAmt', formatAmount(scheduleD.l16())),
      scheduleD.l17()
        ? xmlElement('BothGainsInd', 'X')
        : xmlElement('BothNotGainsInd', 'X'),
      xmlElement('Collectibles28PercentGainAmt', formatAmount(scheduleD.l18())),
      xmlElement(
        'UnrecapturedSection1250GainAmt',
        formatAmount(scheduleD.l19())
      ),
      xmlElement('CapGainOrLossAmt', formatAmount(scheduleD.l21()))
    ]

    return xmlContainer('IRS1040ScheduleD', elements, {
      documentId: 'IRS1040ScheduleD0001'
    })
  }

  /**
   * Serialize Schedule E (Rental Real Estate, Royalties, Partnerships)
   */
  serializeScheduleE(): string {
    const scheduleE = this.f1040.scheduleE
    if (!scheduleE.isNeeded()) {
      return ''
    }

    // Build property information
    const propertyElements = this.f1040.info.realEstate
      .slice(0, 3)
      .map((property, idx) => {
        const l3 = scheduleE.l3()
        const l20 = scheduleE.l20()
        const l21 = scheduleE.l21()

        return xmlContainer(
          'PropertyRealEstAndRoyaltyGrp',
          [
            xmlElement('PropertyTypeCd', String(property.propertyType)),
            xmlElement(
              'PropertyAddressTxt',
              scheduleE.addressString(property.address)
            ),
            xmlElement('FairRentalDaysCnt', property.rentalDays),
            xmlElement('PersonalUseDaysCnt', property.personalUseDays),
            xmlElement(
              'QualifiedJointVentureInd',
              property.qualifiedJointVenture ? 'X' : ''
            ),
            xmlElement('RentsReceivedAmt', formatAmount(l3[idx])),
            xmlElement('TotalExpensesAmt', formatAmount(l20[idx])),
            xmlElement('RentalNetIncomeOrLossAmt', formatAmount(l21[idx]))
          ],
          { propertyNum: String(idx + 1) }
        )
      })

    // Build K-1 partnership/S-corp information
    const k1Elements = this.f1040.info.scheduleK1Form1065s
      .slice(0, 4)
      .map((k1, idx) =>
        xmlContainer(
          'PartnershipOrSCorpGrp',
          [
            xmlElement('PartnershipOrSCorpNm', k1.partnershipName),
            xmlElement('PartnershipOrSCorpTypeCd', k1.partnerOrSCorp),
            xmlElement('ForeignPartnershipInd', k1.isForeign ? 'X' : ''),
            xmlElement('PartnershipOrSCorpEIN', formatEIN(k1.partnershipEin)),
            xmlElement(
              'PassiveIncomeOrLossAmt',
              k1.isPassive ? formatAmount(k1.ordinaryBusinessIncome) : ''
            ),
            xmlElement(
              'NonpassiveIncomeOrLossAmt',
              !k1.isPassive ? formatAmount(k1.ordinaryBusinessIncome) : ''
            )
          ],
          { k1Num: String(idx + 1) }
        )
      )

    const elements = [
      ...propertyElements,
      xmlElement(
        'TotalRentalRealEstateIncomeAmt',
        formatAmount(scheduleE.l24())
      ),
      xmlElement('TotalRentalRealEstateLossAmt', formatAmount(scheduleE.l25())),
      xmlElement('NetRentalIncomeOrLossAmt', formatAmount(scheduleE.l26())),

      // Part II - Partnerships and S Corporations
      ...k1Elements,
      xmlElement(
        'TotalPartnershipSCorpIncomeAmt',
        formatAmount(scheduleE.l30())
      ),
      xmlElement('TotalPartnershipSCorpLossAmt', formatAmount(scheduleE.l31())),
      xmlElement(
        'NetPartnershipSCorpIncLossAmt',
        formatAmount(scheduleE.l32())
      ),

      // Total
      xmlElement(
        'TotalSupplmntalIncomeOrLossAmt',
        formatAmount(scheduleE.l41())
      )
    ]

    return xmlContainer('IRS1040ScheduleE', elements, {
      documentId: 'IRS1040ScheduleE0001'
    })
  }

  /**
   * Serialize Schedule SE (Self-Employment Tax)
   */
  serializeScheduleSE(): string {
    const scheduleSE = this.f1040.scheduleSE
    if (!scheduleSE.isNeeded()) {
      return ''
    }

    const elements = [
      xmlElement('NetFarmProfitLossAmt', formatAmount(scheduleSE.l1a())),
      xmlElement(
        'ConservationReserveProgPymtAmt',
        formatAmount(scheduleSE.l1b())
      ),
      xmlElement('NetProfitOrLossFromSchCAmt', formatAmount(scheduleSE.l2())),
      xmlElement('CombinedSEIncomeAmt', formatAmount(scheduleSE.l3())),
      xmlElement('MinimumProfitForSETaxAmt', formatAmount(scheduleSE.l4a())),
      xmlElement('ChurchEmployeeIncomeAmt', formatAmount(scheduleSE.l4b())),
      xmlElement(
        'CombinedSelfEmploymentIncAmt',
        formatAmount(scheduleSE.l4c())
      ),
      xmlElement('OptionalMethodAmt', formatAmount(scheduleSE.l5a())),
      xmlElement('OptionalMethod9235Amt', formatAmount(scheduleSE.l5b())),
      xmlElement('TotalNetEarningsSEAmt', formatAmount(scheduleSE.l6())),
      xmlElement('MaxSocSecWageBaseAmt', formatAmount(scheduleSE.l7())),
      xmlElement('TotalSocSecWagesAndTipsAmt', formatAmount(scheduleSE.l8a())),
      xmlElement(
        'UnreportedTipsSubjToMedTaxAmt',
        formatAmount(scheduleSE.l8b())
      ),
      xmlElement('WageSubjectToSocSecTaxAmt', formatAmount(scheduleSE.l8c())),
      xmlElement(
        'TotalWagesAndUnreportedTipsAmt',
        formatAmount(scheduleSE.l8d())
      ),
      xmlElement(
        'SubtractFromSocSecWageBaseAmt',
        formatAmount(scheduleSE.l9())
      ),
      xmlElement('SocSecTaxAmt', formatAmount(scheduleSE.l10())),
      xmlElement('MedicareTaxAmt', formatAmount(scheduleSE.l11())),
      xmlElement('SelfEmploymentTaxAmt', formatAmount(scheduleSE.l12())),
      xmlElement('DeductibleSelfEmplmnttaxAmt', formatAmount(scheduleSE.l13()))
    ]

    return xmlContainer('IRS1040ScheduleSE', elements, {
      documentId: 'IRS1040ScheduleSE0001'
    })
  }

  // ===========================================================================
  // Attachment Serializers
  // ===========================================================================

  /**
   * Serialize all W-2 forms
   */
  serializeW2s(): string[] {
    return this.f1040.validW2s().map((w2, idx) => this.serializeW2(w2, idx))
  }

  /**
   * Serialize a single W-2 form
   */
  serializeW2(w2: IncomeW2, index: number): string {
    const elements = [
      // Employee information
      xmlElement(
        'EmployeeSSN',
        formatSSN(
          w2.personRole === PersonRole.PRIMARY
            ? this.f1040.info.taxPayer.primaryPerson.ssid
            : this.f1040.info.taxPayer.spouse?.ssid
        )
      ),
      xmlElement(
        'EmployeeNm',
        w2.personRole === PersonRole.PRIMARY
          ? `${this.f1040.info.taxPayer.primaryPerson.firstName} ${this.f1040.info.taxPayer.primaryPerson.lastName}`
          : `${this.f1040.info.taxPayer.spouse?.firstName ?? ''} ${
              this.f1040.info.taxPayer.spouse?.lastName ?? ''
            }`
      ),

      // Employer information
      w2.employer?.EIN
        ? xmlElement('EmployerEIN', formatEIN(w2.employer.EIN))
        : '',
      w2.employer?.employerName
        ? xmlElement('EmployerName', w2.employer.employerName)
        : '',
      w2.employer?.address ? this.buildAddress(w2.employer.address) : '',

      // Box 1 - Wages, tips, other compensation
      xmlElement('WagesAmt', formatAmount(w2.income)),

      // Box 2 - Federal income tax withheld
      xmlElement('WithholdingAmt', formatAmount(w2.fedWithholding)),

      // Box 3 - Social security wages
      xmlElement('SocialSecurityWagesAmt', formatAmount(w2.ssWages)),

      // Box 4 - Social security tax withheld
      xmlElement('SocialSecurityTaxAmt', formatAmount(w2.ssWithholding)),

      // Box 5 - Medicare wages and tips
      xmlElement('MedicareWagesAndTipsAmt', formatAmount(w2.medicareIncome)),

      // Box 6 - Medicare tax withheld
      xmlElement(
        'MedicareTaxWithheldAmt',
        formatAmount(w2.medicareWithholding)
      ),

      // State information
      w2.state ? xmlElement('StateAbbreviationCd', w2.state) : '',
      xmlElement('StateWagesAmt', formatAmount(w2.stateWages)),
      xmlElement('StateIncomeTaxAmt', formatAmount(w2.stateWithholding))
    ]

    return xmlContainer('IRSW2', elements, {
      documentId: `IRSW2${String(index + 1).padStart(4, '0')}`
    })
  }

  /**
   * Serialize all 1099 forms
   */
  serialize1099s(): string[] {
    const results: string[] = []

    // 1099-INT forms
    this.f1040.f1099Ints().forEach((f1099, idx) => {
      results.push(this.serialize1099Int(f1099, idx))
    })

    // 1099-DIV forms
    this.f1040.f1099Divs().forEach((f1099, idx) => {
      results.push(this.serialize1099Div(f1099, idx))
    })

    // 1099-B forms
    this.f1040.f1099Bs().forEach((f1099, idx) => {
      results.push(this.serialize1099B(f1099, idx))
    })

    // 1099-R forms
    this.f1040.f1099rs().forEach((f1099, idx) => {
      results.push(this.serialize1099R(f1099, idx))
    })

    return results
  }

  /**
   * Serialize 1099-INT form
   */
  private serialize1099Int(f1099: Income1099Int, index: number): string {
    const elements = [
      xmlElement('PayerNm', f1099.payer),
      xmlElement(
        'RecipientSSN',
        formatSSN(
          f1099.personRole === PersonRole.PRIMARY
            ? this.f1040.info.taxPayer.primaryPerson.ssid
            : this.f1040.info.taxPayer.spouse?.ssid
        )
      ),
      xmlElement('InterestIncomeAmt', formatAmount(f1099.form.income))
    ]

    return xmlContainer('IRS1099INT', elements, {
      documentId: `IRS1099INT${String(index + 1).padStart(4, '0')}`
    })
  }

  /**
   * Serialize 1099-DIV form
   */
  private serialize1099Div(f1099: Income1099Div, index: number): string {
    const elements = [
      xmlElement('PayerNm', f1099.payer),
      xmlElement(
        'RecipientSSN',
        formatSSN(
          f1099.personRole === PersonRole.PRIMARY
            ? this.f1040.info.taxPayer.primaryPerson.ssid
            : this.f1040.info.taxPayer.spouse?.ssid
        )
      ),
      xmlElement(
        'TotalOrdinaryDividendsAmt',
        formatAmount(f1099.form.dividends)
      ),
      xmlElement(
        'QualifiedDividendsAmt',
        formatAmount(f1099.form.qualifiedDividends)
      ),
      xmlElement(
        'TotalCapitalGainDistriAmt',
        formatAmount(f1099.form.totalCapitalGainsDistributions)
      )
    ]

    return xmlContainer('IRS1099DIV', elements, {
      documentId: `IRS1099DIV${String(index + 1).padStart(4, '0')}`
    })
  }

  /**
   * Serialize 1099-B form
   */
  private serialize1099B(f1099: Income1099B, index: number): string {
    const elements = [
      xmlElement('PayerNm', f1099.payer),
      xmlElement(
        'RecipientSSN',
        formatSSN(
          f1099.personRole === PersonRole.PRIMARY
            ? this.f1040.info.taxPayer.primaryPerson.ssid
            : this.f1040.info.taxPayer.spouse?.ssid
        )
      ),
      xmlElement(
        'ShortTermProceedsAmt',
        formatAmount(f1099.form.shortTermProceeds)
      ),
      xmlElement(
        'ShortTermCostBasisAmt',
        formatAmount(f1099.form.shortTermCostBasis)
      ),
      xmlElement(
        'LongTermProceedsAmt',
        formatAmount(f1099.form.longTermProceeds)
      ),
      xmlElement(
        'LongTermCostBasisAmt',
        formatAmount(f1099.form.longTermCostBasis)
      )
    ]

    return xmlContainer('IRS1099B', elements, {
      documentId: `IRS1099B${String(index + 1).padStart(4, '0')}`
    })
  }

  /**
   * Serialize 1099-R form
   */
  private serialize1099R(f1099: Income1099R, index: number): string {
    const elements = [
      xmlElement('PayerNm', f1099.payer),
      xmlElement(
        'RecipientSSN',
        formatSSN(
          f1099.personRole === PersonRole.PRIMARY
            ? this.f1040.info.taxPayer.primaryPerson.ssid
            : this.f1040.info.taxPayer.spouse?.ssid
        )
      ),
      xmlElement(
        'GrossDistributionAmt',
        formatAmount(f1099.form.grossDistribution)
      ),
      xmlElement('TaxableAmt', formatAmount(f1099.form.taxableAmount)),
      xmlElement(
        'FederalIncomeTaxWithheldAmt',
        formatAmount(f1099.form.federalIncomeTaxWithheld)
      ),
      xmlElement('DistributionCd', f1099.form.planType)
    ]

    return xmlContainer('IRS1099R', elements, {
      documentId: `IRS1099R${String(index + 1).padStart(4, '0')}`
    })
  }

  /**
   * Serialize all Form 8949 instances
   */
  serializeForm8949s(): string[] {
    return this.f1040.f8949s
      .filter((f8949) => f8949.isNeeded())
      .map((f8949, idx) => this.serializeForm8949(f8949, idx))
  }

  /**
   * Serialize Form 8949 (Sales and Dispositions of Capital Assets)
   */
  serializeForm8949(f8949: F8949, index: number): string {
    // Build short-term transaction details
    const shortTermElements = f8949
      .shortTermSales()
      .map((sale, idx) =>
        xmlContainer(
          'ShortTermCapitalGainAndLossGrp',
          [
            xmlElement('PropertyDescriptionTxt', sale.name),
            xmlElement('DateAcquiredTxt', formatDate(sale.openDate)),
            xmlElement('DateSoldTxt', formatDate(sale.closeDate)),
            xmlElement(
              'SalesPriceAmt',
              formatAmount(sale.closePrice * sale.quantity)
            ),
            xmlElement(
              'CostOrOtherBasisAmt',
              formatAmount(sale.openPrice * sale.quantity)
            ),
            xmlElement('AdjustmentToGainOrLossAmt', ''),
            xmlElement(
              'GainOrLossAmt',
              formatAmount((sale.closePrice - sale.openPrice) * sale.quantity)
            )
          ],
          { transactionNum: String(idx + 1) }
        )
      )

    // Build long-term transaction details
    const longTermElements = f8949
      .longTermSales()
      .map((sale, idx) =>
        xmlContainer(
          'LongTermCapitalGainAndLossGrp',
          [
            xmlElement('PropertyDescriptionTxt', sale.name),
            xmlElement('DateAcquiredTxt', formatDate(sale.openDate)),
            xmlElement('DateSoldTxt', formatDate(sale.closeDate)),
            xmlElement(
              'SalesPriceAmt',
              formatAmount(sale.closePrice * sale.quantity)
            ),
            xmlElement(
              'CostOrOtherBasisAmt',
              formatAmount(sale.openPrice * sale.quantity)
            ),
            xmlElement('AdjustmentToGainOrLossAmt', ''),
            xmlElement(
              'GainOrLossAmt',
              formatAmount((sale.closePrice - sale.openPrice) * sale.quantity)
            )
          ],
          { transactionNum: String(idx + 1) }
        )
      )

    const elements = [
      // Part I - Short-term
      f8949.part1BoxA() ? xmlElement('ShortTermBoxAInd', 'X') : '',
      f8949.part1BoxB() ? xmlElement('ShortTermBoxBInd', 'X') : '',
      f8949.part1BoxC() ? xmlElement('ShortTermBoxCInd', 'X') : '',
      ...shortTermElements,
      xmlElement(
        'ShortTermTotalProceedsAmt',
        formatAmount(f8949.shortTermTotalProceeds())
      ),
      xmlElement(
        'ShortTermTotalCostBasisAmt',
        formatAmount(f8949.shortTermTotalCost())
      ),
      xmlElement(
        'ShortTermTotalAdjustmentsAmt',
        formatAmount(f8949.shortTermTotalAdjustments())
      ),
      xmlElement(
        'ShortTermTotalGainOrLossAmt',
        formatAmount(f8949.shortTermTotalGain())
      ),

      // Part II - Long-term
      f8949.part2BoxD() ? xmlElement('LongTermBoxDInd', 'X') : '',
      f8949.part2BoxE() ? xmlElement('LongTermBoxEInd', 'X') : '',
      f8949.part2BoxF() ? xmlElement('LongTermBoxFInd', 'X') : '',
      ...longTermElements,
      xmlElement(
        'LongTermTotalProceedsAmt',
        formatAmount(f8949.longTermTotalProceeds())
      ),
      xmlElement(
        'LongTermTotalCostBasisAmt',
        formatAmount(f8949.longTermTotalCost())
      ),
      xmlElement(
        'LongTermTotalAdjustmentsAmt',
        formatAmount(f8949.longTermTotalAdjustments())
      ),
      xmlElement(
        'LongTermTotalGainOrLossAmt',
        formatAmount(f8949.longTermTotalGain())
      )
    ]

    return xmlContainer('IRS8949', elements, {
      documentId: `IRS8949${String(index + 1).padStart(4, '0')}`
    })
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Form1040Serializer instance
 */
export function createSerializer(
  f1040: F1040,
  config: SerializerConfig
): Form1040Serializer {
  return new Form1040Serializer(f1040, config)
}

export default Form1040Serializer
