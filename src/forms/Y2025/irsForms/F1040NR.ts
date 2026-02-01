import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 1040-NR - U.S. Nonresident Alien Income Tax Return
 *
 * Used by nonresident aliens to report U.S. source income and
 * calculate U.S. tax liability. Key differences from Form 1040:
 *
 * - Only U.S. source income is taxed (not worldwide income)
 * - Different standard deduction rules (generally none available)
 * - Cannot file jointly (single or married filing separately only)
 * - May be subject to 30% withholding on FDAP income
 * - Must provide country of residence for tax treaties
 * - Limited itemized deductions
 *
 * Income types:
 * - ECI (Effectively Connected Income) - taxed at graduated rates
 * - FDAP (Fixed, Determinable, Annual, Periodic) - taxed at 30% flat rate
 *
 * Key schedules:
 * - Schedule NEC: Tax on Income Not Effectively Connected
 * - Schedule OI: Other Information
 */

export type VisaStatus =
  | 'F1'
  | 'J1'
  | 'M1'
  | 'Q1'
  | 'H1B'
  | 'L1'
  | 'O1'
  | 'TN'
  | 'other'

export interface NonresidentAlienInfo {
  // Personal Information
  countryOfCitizenship: string
  countryOfResidence: string
  visaType: VisaStatus
  dateEnteredUS: Date
  daysInUSThisYear: number
  daysInUSPriorYear?: number
  daysInUS2YearsPrior?: number
  // Tax treaty information
  claimsTaxTreaty: boolean
  treatyCountry?: string
  treatyArticle?: string
  treatyBenefitAmount?: number
  // Income types
  hasEffectivelyConnectedIncome: boolean
  hasFDAPIncome: boolean
  // For Schedule NEC
  fdapIncome?: {
    dividends: number
    interest: number
    rents: number
    royalties: number
    gambling: number
    socialSecurity: number
    capitalGains: number
    otherIncome: number
  }
}

export interface EffectivelyConnectedIncome {
  wages: number
  businessIncome: number
  capitalGains: number
  rentalIncome: number
  partnershipIncome: number
  otherIncome: number
}

export interface Form1040NRInfo {
  nonresidentInfo: NonresidentAlienInfo
  effectivelyConnectedIncome: EffectivelyConnectedIncome
  itemizedDeductions?: {
    stateTaxes: number
    charitableContributions: number
    casualtyLosses: number
    otherDeductions: number
  }
  taxWithheld: number
  estimatedTaxPayments: number
}

export default class F1040NR extends F1040Attachment {
  tag: FormTag = 'f1040nr'
  sequenceIndex = 0 // Primary form for nonresidents

  isNeeded = (): boolean => {
    return this.hasNonresidentInfo()
  }

  hasNonresidentInfo = (): boolean => {
    return this.f1040NRInfo() !== undefined
  }

  f1040NRInfo = (): Form1040NRInfo | undefined => {
    return this.f1040.info.nonresidentAlienReturn as Form1040NRInfo | undefined
  }

  nonresidentInfo = (): NonresidentAlienInfo | undefined => {
    return this.f1040NRInfo()?.nonresidentInfo
  }

  // Personal Information
  countryOfCitizenship = (): string =>
    this.nonresidentInfo()?.countryOfCitizenship ?? ''
  countryOfResidence = (): string =>
    this.nonresidentInfo()?.countryOfResidence ?? ''
  visaType = (): VisaStatus => this.nonresidentInfo()?.visaType ?? 'other'
  daysInUSThisYear = (): number => this.nonresidentInfo()?.daysInUSThisYear ?? 0

  // Substantial Presence Test calculation
  substantialPresenceDays = (): number => {
    const info = this.nonresidentInfo()
    if (!info) return 0
    // Current year: 100%, Prior year: 1/3, 2 years prior: 1/6
    return (
      info.daysInUSThisYear +
      Math.floor((info.daysInUSPriorYear ?? 0) / 3) +
      Math.floor((info.daysInUS2YearsPrior ?? 0) / 6)
    )
  }

  meetsSubstantialPresenceTest = (): boolean => {
    // Must have 31+ days current year and 183+ days calculated
    const info = this.nonresidentInfo()
    return (
      (info?.daysInUSThisYear ?? 0) >= 31 &&
      this.substantialPresenceDays() >= 183
    )
  }

  // Tax Treaty Information
  claimsTaxTreaty = (): boolean =>
    this.nonresidentInfo()?.claimsTaxTreaty ?? false
  treatyCountry = (): string => this.nonresidentInfo()?.treatyCountry ?? ''
  treatyArticle = (): string => this.nonresidentInfo()?.treatyArticle ?? ''
  treatyBenefitAmount = (): number =>
    this.nonresidentInfo()?.treatyBenefitAmount ?? 0

  // Effectively Connected Income (ECI)
  eci = (): EffectivelyConnectedIncome | undefined => {
    return this.f1040NRInfo()?.effectivelyConnectedIncome
  }

  eciWages = (): number => this.eci()?.wages ?? 0
  eciBusinessIncome = (): number => this.eci()?.businessIncome ?? 0
  eciCapitalGains = (): number => this.eci()?.capitalGains ?? 0
  eciRentalIncome = (): number => this.eci()?.rentalIncome ?? 0
  eciPartnershipIncome = (): number => this.eci()?.partnershipIncome ?? 0
  eciOtherIncome = (): number => this.eci()?.otherIncome ?? 0

  totalEffectivelyConnectedIncome = (): number => {
    return sumFields([
      this.eciWages(),
      this.eciBusinessIncome(),
      this.eciCapitalGains(),
      this.eciRentalIncome(),
      this.eciPartnershipIncome(),
      this.eciOtherIncome()
    ])
  }

  // Schedule NEC: FDAP Income (30% flat rate)
  fdapIncome = () => this.nonresidentInfo()?.fdapIncome

  fdapDividends = (): number => this.fdapIncome()?.dividends ?? 0
  fdapInterest = (): number => this.fdapIncome()?.interest ?? 0
  fdapRents = (): number => this.fdapIncome()?.rents ?? 0
  fdapRoyalties = (): number => this.fdapIncome()?.royalties ?? 0
  fdapGambling = (): number => this.fdapIncome()?.gambling ?? 0
  fdapSocialSecurity = (): number => this.fdapIncome()?.socialSecurity ?? 0
  fdapCapitalGains = (): number => this.fdapIncome()?.capitalGains ?? 0

  totalFDAPIncome = (): number => {
    return sumFields([
      this.fdapDividends(),
      this.fdapInterest(),
      this.fdapRents(),
      this.fdapRoyalties(),
      this.fdapGambling(),
      this.fdapSocialSecurity(),
      this.fdapCapitalGains(),
      this.fdapIncome()?.otherIncome ?? 0
    ])
  }

  // FDAP tax (30% flat rate, or treaty rate)
  fdapTaxRate = (): number => {
    if (this.claimsTaxTreaty() && this.treatyBenefitAmount() > 0) {
      // Treaty may reduce rate
      return 0.3 - this.treatyBenefitAmount() / this.totalFDAPIncome()
    }
    return 0.3
  }

  fdapTax = (): number => {
    return Math.round(this.totalFDAPIncome() * this.fdapTaxRate())
  }

  // Itemized Deductions (limited for nonresidents)
  itemizedDeductions = () => this.f1040NRInfo()?.itemizedDeductions

  totalItemizedDeductions = (): number => {
    const ded = this.itemizedDeductions()
    if (!ded) return 0
    return sumFields([
      ded.stateTaxes,
      ded.charitableContributions,
      ded.casualtyLosses,
      ded.otherDeductions
    ])
  }

  // Payments
  taxWithheld = (): number => this.f1040NRInfo()?.taxWithheld ?? 0
  estimatedTaxPayments = (): number =>
    this.f1040NRInfo()?.estimatedTaxPayments ?? 0
  totalPayments = (): number => this.taxWithheld() + this.estimatedTaxPayments()

  fields = (): Field[] => {
    const info = this.nonresidentInfo()
    const fdap = this.fdapIncome()
    const deductions = this.itemizedDeductions()

    return [
      // Header
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Schedule OI: Other Information
      this.countryOfCitizenship(),
      this.countryOfResidence(),
      this.visaType(),
      info?.dateEnteredUS.toLocaleDateString() ?? '',
      this.daysInUSThisYear(),
      this.substantialPresenceDays(),
      this.meetsSubstantialPresenceTest(),
      // Tax Treaty
      this.claimsTaxTreaty(),
      this.treatyCountry(),
      this.treatyArticle(),
      this.treatyBenefitAmount(),
      // Effectively Connected Income
      this.eciWages(),
      this.eciBusinessIncome(),
      this.eciCapitalGains(),
      this.eciRentalIncome(),
      this.eciPartnershipIncome(),
      this.eciOtherIncome(),
      this.totalEffectivelyConnectedIncome(),
      // Schedule NEC: FDAP Income
      this.fdapDividends(),
      this.fdapInterest(),
      this.fdapRents(),
      this.fdapRoyalties(),
      this.fdapGambling(),
      this.fdapSocialSecurity(),
      this.fdapCapitalGains(),
      this.totalFDAPIncome(),
      this.fdapTaxRate(),
      this.fdapTax(),
      // Itemized Deductions
      deductions?.stateTaxes ?? 0,
      deductions?.charitableContributions ?? 0,
      deductions?.casualtyLosses ?? 0,
      this.totalItemizedDeductions(),
      // Payments
      this.taxWithheld(),
      this.estimatedTaxPayments(),
      this.totalPayments()
    ]
  }
}
