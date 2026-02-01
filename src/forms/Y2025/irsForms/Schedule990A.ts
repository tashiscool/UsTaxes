import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule A (Form 990) - Public Charity Status and Public Support
 *
 * Determines whether an organization qualifies as a public charity or private foundation.
 * Required for all 501(c)(3) organizations filing Form 990 or 990-EZ.
 *
 * Public Charity Types:
 * - Churches and religious organizations
 * - Schools and educational organizations
 * - Hospitals and medical research organizations
 * - Organizations supporting government units
 * - Publicly supported organizations (1/3 support test)
 * - Supporting organizations (Types I, II, III)
 *
 * Public Support Tests:
 * - 509(a)(1): Gifts/grants/contributions test (1/3 public support)
 * - 509(a)(2): Gross receipts test (1/3 public support from admissions, sales, etc.)
 *
 * Mechanical Test: Organization qualifies if it meets either:
 * - 33 1/3% public support ratio, OR
 * - 10% facts and circumstances test with organizational attributes
 */

export type PublicCharityType =
  | 'church'
  | 'school'
  | 'hospital'
  | 'medicalResearch'
  | 'governmentSupport'
  | '509a1'
  | '509a2'
  | 'supportingTypeI'
  | 'supportingTypeII'
  | 'supportingTypeIII'
  | 'testingOrganization'
  | 'other'

export interface PublicSupportData {
  // Part II - Support Schedule for 509(a)(1)
  // Gifts, grants, contributions received
  giftsYear1: number
  giftsYear2: number
  giftsYear3: number
  giftsYear4: number
  giftsYear5: number
  // Membership fees received
  membershipFeesYear1: number
  membershipFeesYear2: number
  membershipFeesYear3: number
  membershipFeesYear4: number
  membershipFeesYear5: number
  // Tax revenues levied
  taxRevenuesYear1: number
  taxRevenuesYear2: number
  taxRevenuesYear3: number
  taxRevenuesYear4: number
  taxRevenuesYear5: number
  // Services or facilities furnished by government
  govtServicesYear1: number
  govtServicesYear2: number
  govtServicesYear3: number
  govtServicesYear4: number
  govtServicesYear5: number
  // Gross investment income
  investmentIncomeYear1: number
  investmentIncomeYear2: number
  investmentIncomeYear3: number
  investmentIncomeYear4: number
  investmentIncomeYear5: number
  // Net unrelated business income
  ubiYear1: number
  ubiYear2: number
  ubiYear3: number
  ubiYear4: number
  ubiYear5: number
  // Other income
  otherIncomeYear1: number
  otherIncomeYear2: number
  otherIncomeYear3: number
  otherIncomeYear4: number
  otherIncomeYear5: number
  // Unusual grants (excluded from public support calculation)
  unusualGrantsYear1: number
  unusualGrantsYear2: number
  unusualGrantsYear3: number
  unusualGrantsYear4: number
  unusualGrantsYear5: number
  // Large contributions (amount from any contributor exceeding 2%)
  largeContributorExclusions: number
}

export interface Schedule990AInfo {
  organizationType: PublicCharityType
  supportedOrganizations?: {
    name: string
    ein: string
    type: 'I' | 'II' | 'III_FI' | 'III_NFI'
  }[]
  publicSupport: PublicSupportData
  factsAndCircumstancesTest: boolean
  writtenDetermination: boolean
  yearFormed: number
}

export default class Schedule990A extends F1040Attachment {
  tag: FormTag = 'f990sa'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasExemptOrgData()
  }

  hasExemptOrgData = (): boolean => {
    return this.f1040.info.exemptOrgReturn !== undefined
  }

  schedule990AInfo = (): Schedule990AInfo | undefined => {
    // Would be populated from exempt org data
    return undefined
  }

  organizationType = (): PublicCharityType => {
    return this.schedule990AInfo()?.organizationType ?? 'other'
  }

  // Part I - Reason for Public Charity Status
  isChurch = (): boolean => this.organizationType() === 'church'
  isSchool = (): boolean => this.organizationType() === 'school'
  isHospital = (): boolean => this.organizationType() === 'hospital'
  isMedicalResearch = (): boolean =>
    this.organizationType() === 'medicalResearch'
  isGovernmentSupport = (): boolean =>
    this.organizationType() === 'governmentSupport'
  is509a1 = (): boolean => this.organizationType() === '509a1'
  is509a2 = (): boolean => this.organizationType() === '509a2'
  isSupportingOrg = (): boolean => {
    const type = this.organizationType()
    return (
      type === 'supportingTypeI' ||
      type === 'supportingTypeII' ||
      type === 'supportingTypeIII'
    )
  }

  // Part II - Support Schedule for 509(a)(1) Organizations

  publicSupport = (): PublicSupportData | undefined =>
    this.schedule990AInfo()?.publicSupport

  // Total gifts/grants/contributions (5-year total)
  totalGifts = (): number => {
    const ps = this.publicSupport()
    if (!ps) return 0
    return sumFields([
      ps.giftsYear1,
      ps.giftsYear2,
      ps.giftsYear3,
      ps.giftsYear4,
      ps.giftsYear5
    ])
  }

  // Total membership fees (5-year total)
  totalMembershipFees = (): number => {
    const ps = this.publicSupport()
    if (!ps) return 0
    return sumFields([
      ps.membershipFeesYear1,
      ps.membershipFeesYear2,
      ps.membershipFeesYear3,
      ps.membershipFeesYear4,
      ps.membershipFeesYear5
    ])
  }

  // Total tax revenues (5-year total)
  totalTaxRevenues = (): number => {
    const ps = this.publicSupport()
    if (!ps) return 0
    return sumFields([
      ps.taxRevenuesYear1,
      ps.taxRevenuesYear2,
      ps.taxRevenuesYear3,
      ps.taxRevenuesYear4,
      ps.taxRevenuesYear5
    ])
  }

  // Total government services (5-year total)
  totalGovtServices = (): number => {
    const ps = this.publicSupport()
    if (!ps) return 0
    return sumFields([
      ps.govtServicesYear1,
      ps.govtServicesYear2,
      ps.govtServicesYear3,
      ps.govtServicesYear4,
      ps.govtServicesYear5
    ])
  }

  // Total public support
  totalPublicSupport = (): number => {
    return (
      sumFields([
        this.totalGifts(),
        this.totalMembershipFees(),
        this.totalTaxRevenues(),
        this.totalGovtServices()
      ]) - (this.publicSupport()?.largeContributorExclusions ?? 0)
    )
  }

  // Total investment income (5-year total)
  totalInvestmentIncome = (): number => {
    const ps = this.publicSupport()
    if (!ps) return 0
    return sumFields([
      ps.investmentIncomeYear1,
      ps.investmentIncomeYear2,
      ps.investmentIncomeYear3,
      ps.investmentIncomeYear4,
      ps.investmentIncomeYear5
    ])
  }

  // Total other income (5-year total)
  totalOtherIncome = (): number => {
    const ps = this.publicSupport()
    if (!ps) return 0
    return sumFields([
      ps.otherIncomeYear1,
      ps.otherIncomeYear2,
      ps.otherIncomeYear3,
      ps.otherIncomeYear4,
      ps.otherIncomeYear5
    ])
  }

  // Total support (for ratio calculation)
  totalSupport = (): number => {
    return sumFields([
      this.totalGifts(),
      this.totalMembershipFees(),
      this.totalTaxRevenues(),
      this.totalGovtServices(),
      this.totalInvestmentIncome(),
      this.totalOtherIncome()
    ])
  }

  // Public support ratio (Line 17)
  publicSupportRatio = (): number => {
    const total = this.totalSupport()
    if (total === 0) return 0
    return Math.round((this.totalPublicSupport() / total) * 10000) / 100 // Returns percentage with 2 decimal places
  }

  // Meets 33 1/3% test
  meets33PercentTest = (): boolean => {
    return this.publicSupportRatio() >= 33.33
  }

  // Meets 10% facts and circumstances test
  meets10PercentTest = (): boolean => {
    return (
      this.publicSupportRatio() >= 10 &&
      (this.schedule990AInfo()?.factsAndCircumstancesTest ?? false)
    )
  }

  // Qualifies as public charity
  qualifiesAsPublicCharity = (): boolean => {
    if (
      this.isChurch() ||
      this.isSchool() ||
      this.isHospital() ||
      this.isGovernmentSupport()
    ) {
      return true
    }
    if (this.is509a1() || this.is509a2()) {
      return this.meets33PercentTest() || this.meets10PercentTest()
    }
    if (this.isSupportingOrg()) {
      return true // Supporting org status determined differently
    }
    return false
  }

  fields = (): Field[] => {
    const info = this.schedule990AInfo()
    const ps = this.publicSupport()

    return [
      // Part I: Reason for Public Charity Status
      this.isChurch(),
      this.isSchool(),
      this.isHospital(),
      this.isMedicalResearch(),
      this.isGovernmentSupport(),
      this.is509a1(),
      this.is509a2(),
      this.isSupportingOrg(),
      // Part II: Support Schedule (509(a)(1))
      // Line 1: Gifts, grants, contributions
      ps?.giftsYear1 ?? 0,
      ps?.giftsYear2 ?? 0,
      ps?.giftsYear3 ?? 0,
      ps?.giftsYear4 ?? 0,
      ps?.giftsYear5 ?? 0,
      this.totalGifts(),
      // Line 2: Tax revenues
      this.totalTaxRevenues(),
      // Line 3: Government services
      this.totalGovtServices(),
      // Line 4: Total public support
      this.totalPublicSupport(),
      // Line 5: Large contributor exclusion
      ps?.largeContributorExclusions ?? 0,
      // Line 11: Investment income
      this.totalInvestmentIncome(),
      // Line 13: Total support
      this.totalSupport(),
      // Line 14: Public support ratio
      this.publicSupportRatio(),
      // Line 17a: 33 1/3% support test
      this.meets33PercentTest(),
      // Line 17b: 10% facts and circumstances test
      this.meets10PercentTest(),
      // Result
      this.qualifiesAsPublicCharity()
    ]
  }
}
