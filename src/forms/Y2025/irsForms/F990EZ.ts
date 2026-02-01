import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 990-EZ - Short Form Return of Organization Exempt From Income Tax
 *
 * Simplified version of Form 990 for smaller organizations.
 *
 * Eligibility (must meet ALL):
 * - Gross receipts less than $200,000
 * - Total assets less than $500,000
 * - Not a sponsoring organization of a donor advised fund
 * - Not a controlling organization described in section 512(b)(13)
 * - Not a private foundation
 *
 * Due Date: 15th day of 5th month after fiscal year end
 */

export interface Form990EZInfo {
  // Organization Information
  orgName: string
  ein: string
  address: string
  city: string
  state: string
  zip: string
  website?: string
  exemptionType: string
  groupExemptionNumber?: string
  // Fiscal Year
  fiscalYearStart: Date
  fiscalYearEnd: Date
  isFinalReturn: boolean
  isAmendedReturn: boolean
  // Part I: Revenue, Expenses, and Changes in Net Assets
  contributions: number
  programServiceRevenue: number
  membershipDues: number
  investmentIncome: number
  saleOfAssets: number
  specialEventsGross: number
  specialEventsExpenses: number
  otherRevenue: number
  // Expenses
  grantsAndSimilar: number
  benefitsPaid: number
  salariesAndCompensation: number
  professionalFees: number
  occupancy: number
  printing: number
  otherExpenses: number
  // Part II: Balance Sheets
  beginningCash: number
  endingCash: number
  beginningLandBuildings: number
  endingLandBuildings: number
  beginningOtherAssets: number
  endingOtherAssets: number
  beginningLiabilities: number
  endingLiabilities: number
  // Part III: Program Service Accomplishments
  primaryExemptPurpose: string
  programAccomplishments: {
    description: string
    expenses: number
    grants: number
  }[]
  // Part IV: Officers, Directors, Trustees
  officers: {
    name: string
    title: string
    hoursPerWeek: number
    compensation: number
  }[]
}

export default class F990EZ extends F1040Attachment {
  tag: FormTag = 'f990ez'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm990EZInfo()
  }

  hasForm990EZInfo = (): boolean => {
    return this.f990EZInfo() !== undefined
  }

  f990EZInfo = (): Form990EZInfo | undefined => {
    return this.f1040.info.exemptOrgReturnEZ as Form990EZInfo | undefined
  }

  // Organization Info
  orgName = (): string => this.f990EZInfo()?.orgName ?? ''
  ein = (): string => this.f990EZInfo()?.ein ?? ''

  // Part I: Revenue

  // Line 1: Contributions, gifts, grants
  l1 = (): number => this.f990EZInfo()?.contributions ?? 0

  // Line 2: Program service revenue
  l2 = (): number => this.f990EZInfo()?.programServiceRevenue ?? 0

  // Line 3: Membership dues
  l3 = (): number => this.f990EZInfo()?.membershipDues ?? 0

  // Line 4: Investment income
  l4 = (): number => this.f990EZInfo()?.investmentIncome ?? 0

  // Line 5a: Gross amount from sale of assets
  l5a = (): number => this.f990EZInfo()?.saleOfAssets ?? 0

  // Line 6a: Special events gross revenue
  l6a = (): number => this.f990EZInfo()?.specialEventsGross ?? 0

  // Line 6b: Special events expenses
  l6b = (): number => this.f990EZInfo()?.specialEventsExpenses ?? 0

  // Line 6c: Net income from special events
  l6c = (): number => this.l6a() - this.l6b()

  // Line 8: Other revenue
  l8 = (): number => this.f990EZInfo()?.otherRevenue ?? 0

  // Line 9: Total revenue
  l9 = (): number => {
    return sumFields([
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5a(),
      this.l6c(),
      this.l8()
    ])
  }

  // Part I: Expenses

  // Line 10: Grants and similar amounts paid
  l10 = (): number => this.f990EZInfo()?.grantsAndSimilar ?? 0

  // Line 11: Benefits paid to or for members
  l11 = (): number => this.f990EZInfo()?.benefitsPaid ?? 0

  // Line 12: Salaries, other compensation
  l12 = (): number => this.f990EZInfo()?.salariesAndCompensation ?? 0

  // Line 13: Professional fees
  l13 = (): number => this.f990EZInfo()?.professionalFees ?? 0

  // Line 14: Occupancy, rent, utilities
  l14 = (): number => this.f990EZInfo()?.occupancy ?? 0

  // Line 15: Printing, publications, postage
  l15 = (): number => this.f990EZInfo()?.printing ?? 0

  // Line 16: Other expenses
  l16 = (): number => this.f990EZInfo()?.otherExpenses ?? 0

  // Line 17: Total expenses
  l17 = (): number => {
    return sumFields([
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16()
    ])
  }

  // Line 18: Excess or deficit
  l18 = (): number => this.l9() - this.l17()

  // Line 19: Net assets beginning of year
  l19 = (): number => {
    const info = this.f990EZInfo()
    if (!info) return 0
    return (
      info.beginningCash +
      info.beginningLandBuildings +
      info.beginningOtherAssets -
      info.beginningLiabilities
    )
  }

  // Line 21: Net assets end of year
  l21 = (): number => {
    const info = this.f990EZInfo()
    if (!info) return 0
    return (
      info.endingCash +
      info.endingLandBuildings +
      info.endingOtherAssets -
      info.endingLiabilities
    )
  }

  // Part II: Balance Sheets

  // Total assets beginning
  totalAssetsBOY = (): number => {
    const info = this.f990EZInfo()
    if (!info) return 0
    return (
      info.beginningCash +
      info.beginningLandBuildings +
      info.beginningOtherAssets
    )
  }

  // Total assets end
  totalAssetsEOY = (): number => {
    const info = this.f990EZInfo()
    if (!info) return 0
    return info.endingCash + info.endingLandBuildings + info.endingOtherAssets
  }

  // Check if eligible for 990-EZ
  isEligible = (): boolean => {
    return this.l9() < 200000 && this.totalAssetsEOY() < 500000
  }

  fields = (): Field[] => {
    const info = this.f990EZInfo()
    const officers = info?.officers ?? []
    const programs = info?.programAccomplishments ?? []

    return [
      // Header
      this.orgName(),
      this.ein(),
      info?.address ?? '',
      `${info?.city ?? ''}, ${info?.state ?? ''} ${info?.zip ?? ''}`,
      info?.website ?? '',
      info?.exemptionType ?? '',
      info?.fiscalYearStart.toLocaleDateString() ?? '',
      info?.fiscalYearEnd.toLocaleDateString() ?? '',
      info?.isFinalReturn ?? false,
      info?.isAmendedReturn ?? false,
      // Part I: Revenue
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5a(),
      this.l6a(),
      this.l6b(),
      this.l6c(),
      this.l8(),
      this.l9(),
      // Part I: Expenses
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l21(),
      // Part II: Balance Sheets
      info?.beginningCash ?? 0,
      info?.endingCash ?? 0,
      info?.beginningLandBuildings ?? 0,
      info?.endingLandBuildings ?? 0,
      this.totalAssetsBOY(),
      this.totalAssetsEOY(),
      info?.beginningLiabilities ?? 0,
      info?.endingLiabilities ?? 0,
      // Part III: Program Service
      info?.primaryExemptPurpose ?? '',
      programs[0]?.description ?? '',
      programs[0]?.expenses ?? 0,
      // Part IV: Officers
      officers[0]?.name ?? '',
      officers[0]?.title ?? '',
      officers[0]?.hoursPerWeek ?? 0,
      officers[0]?.compensation ?? 0
    ]
  }
}
