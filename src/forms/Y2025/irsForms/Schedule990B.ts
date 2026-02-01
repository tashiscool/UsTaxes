import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule B (Form 990) - Schedule of Contributors
 *
 * Lists contributors who gave $5,000 or more during the tax year.
 * Required for organizations that file Form 990 or 990-EZ.
 *
 * Key sections:
 * - Part I: Contributors (individuals, corporations, trusts)
 * - Part II: Noncash Property (over $25,000)
 * - Part III: Gaming/Fundraising Events
 */

export interface Contributor {
  name: string
  address: string
  totalContributions: number
  typeOfContribution: 'person' | 'payroll' | 'noncash'
  noncashDescription?: string
  noncashFMV?: number
  dateReceived?: Date
}

export interface Schedule990BData {
  contributors: Contributor[]
  // Part II: Noncash property
  noncashContributions: {
    description: string
    dateReceived: Date
    dateOfGift: Date
    fmvOnDate: number
    methodOfValuation: string
  }[]
  // Part III: Gaming
  hasGamingActivities: boolean
  gamingGrossReceipts?: number
}

export default class Schedule990B extends F1040Attachment {
  tag: FormTag = 'f990sb'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasContributorData()
  }

  hasContributorData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990BData = (): Schedule990BData | undefined => {
    return undefined // Would be populated from organization data
  }

  contributors = (): Contributor[] => {
    return this.schedule990BData()?.contributors ?? []
  }

  // Contributors over $5,000
  majorContributors = (): Contributor[] => {
    return this.contributors().filter((c) => c.totalContributions >= 5000)
  }

  // Total contributions from major contributors
  totalMajorContributions = (): number => {
    return this.majorContributors().reduce(
      (sum, c) => sum + c.totalContributions,
      0
    )
  }

  // Noncash contributions
  noncashContributions = (): Contributor[] => {
    return this.contributors().filter((c) => c.typeOfContribution === 'noncash')
  }

  totalNoncashContributions = (): number => {
    return this.noncashContributions().reduce(
      (sum, c) => sum + (c.noncashFMV ?? 0),
      0
    )
  }

  // Gaming activities
  hasGamingActivities = (): boolean => {
    return this.schedule990BData()?.hasGamingActivities ?? false
  }

  fields = (): Field[] => {
    const contributors = this.majorContributors()
    const data = this.schedule990BData()

    return [
      // Part I: Contributors
      // Contributor 1
      contributors[0]?.name ?? '',
      contributors[0]?.address ?? '',
      contributors[0]?.totalContributions ?? 0,
      contributors[0]?.typeOfContribution === 'person',
      contributors[0]?.typeOfContribution === 'payroll',
      contributors[0]?.typeOfContribution === 'noncash',
      // Contributor 2
      contributors[1]?.name ?? '',
      contributors[1]?.address ?? '',
      contributors[1]?.totalContributions ?? 0,
      contributors[1]?.typeOfContribution === 'person',
      contributors[1]?.typeOfContribution === 'payroll',
      contributors[1]?.typeOfContribution === 'noncash',
      // Contributor 3
      contributors[2]?.name ?? '',
      contributors[2]?.address ?? '',
      contributors[2]?.totalContributions ?? 0,
      // Part II: Noncash property
      data?.noncashContributions[0]?.description ?? '',
      data?.noncashContributions[0]?.fmvOnDate ?? 0,
      data?.noncashContributions[0]?.methodOfValuation ?? '',
      // Part III: Gaming
      this.hasGamingActivities(),
      data?.gamingGrossReceipts ?? 0,
      // Totals
      this.majorContributors().length,
      this.totalMajorContributions(),
      this.totalNoncashContributions()
    ]
  }
}
