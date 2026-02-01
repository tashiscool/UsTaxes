import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule F (Form 990) - Statement of Activities Outside the United States
 *
 * Reports activities conducted outside the U.S., including:
 * - Grants and assistance to foreign organizations
 * - Grants and assistance to foreign individuals
 * - Program services conducted outside the U.S.
 * - Investments in foreign entities
 * - Foreign offices
 *
 * Required when organization has foreign activities.
 */

export interface ForeignGrant {
  regionOrCountry: string
  purposeOfGrant: string
  amountOfCashGrant: number
  mannerOfCashDisbursement: string
  amountOfNoncashAssistance: number
  descriptionOfNoncash: string
  methodOfValuation: string
}

export interface ForeignOffice {
  country: string
  numberOfEmployees: number
  typeOfActivities: string
  totalExpenditures: number
}

export interface Schedule990FData {
  // General information
  hasForeignActivities: boolean
  numberOfCountries: number
  // Part I: Grants to organizations
  grantsToOrganizations: ForeignGrant[]
  totalGrantsToOrganizations: number
  // Part II: Grants to individuals
  grantsToIndividuals: ForeignGrant[]
  totalGrantsToIndividuals: number
  // Part III: Activities and employees
  foreignOffices: ForeignOffice[]
  totalForeignEmployees: number
  // Part IV: Foreign investments
  foreignInvestments: {
    country: string
    investmentType: string
    amount: number
  }[]
  // Part V: Partnerships
  foreignPartnerships: {
    name: string
    country: string
    ownershipPercent: number
  }[]
}

export default class Schedule990F extends F1040Attachment {
  tag: FormTag = 'f990sf'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForeignActivityData()
  }

  hasForeignActivityData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990FData = (): Schedule990FData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Foreign activities
  hasForeignActivities = (): boolean => {
    return this.schedule990FData()?.hasForeignActivities ?? false
  }

  numberOfCountries = (): number => {
    return this.schedule990FData()?.numberOfCountries ?? 0
  }

  // Part I: Grants to organizations
  grantsToOrganizations = (): ForeignGrant[] => {
    return this.schedule990FData()?.grantsToOrganizations ?? []
  }

  totalGrantsToOrganizations = (): number => {
    return this.grantsToOrganizations().reduce(
      (sum, g) => sum + g.amountOfCashGrant + g.amountOfNoncashAssistance,
      0
    )
  }

  // Part II: Grants to individuals
  grantsToIndividuals = (): ForeignGrant[] => {
    return this.schedule990FData()?.grantsToIndividuals ?? []
  }

  totalGrantsToIndividuals = (): number => {
    return this.grantsToIndividuals().reduce(
      (sum, g) => sum + g.amountOfCashGrant + g.amountOfNoncashAssistance,
      0
    )
  }

  // Part III: Foreign offices
  foreignOffices = (): ForeignOffice[] => {
    return this.schedule990FData()?.foreignOffices ?? []
  }

  totalForeignEmployees = (): number => {
    return this.foreignOffices().reduce(
      (sum, o) => sum + o.numberOfEmployees,
      0
    )
  }

  totalForeignExpenditures = (): number => {
    return this.foreignOffices().reduce(
      (sum, o) => sum + o.totalExpenditures,
      0
    )
  }

  // Part IV: Foreign investments
  totalForeignInvestments = (): number => {
    const investments = this.schedule990FData()?.foreignInvestments ?? []
    return investments.reduce((sum, i) => sum + i.amount, 0)
  }

  // Grand total foreign activities
  totalForeignActivities = (): number => {
    return sumFields([
      this.totalGrantsToOrganizations(),
      this.totalGrantsToIndividuals(),
      this.totalForeignExpenditures(),
      this.totalForeignInvestments()
    ])
  }

  fields = (): Field[] => {
    const data = this.schedule990FData()
    const orgGrants = this.grantsToOrganizations()
    const indGrants = this.grantsToIndividuals()
    const offices = this.foreignOffices()
    const investments = data?.foreignInvestments ?? []

    return [
      // General
      this.hasForeignActivities(),
      this.numberOfCountries(),
      // Part I: Grants to organizations
      orgGrants[0]?.regionOrCountry ?? '',
      orgGrants[0]?.purposeOfGrant ?? '',
      orgGrants[0]?.amountOfCashGrant ?? 0,
      orgGrants[0]?.amountOfNoncashAssistance ?? 0,
      orgGrants[1]?.regionOrCountry ?? '',
      orgGrants[1]?.amountOfCashGrant ?? 0,
      this.grantsToOrganizations().length,
      this.totalGrantsToOrganizations(),
      // Part II: Grants to individuals
      indGrants[0]?.regionOrCountry ?? '',
      indGrants[0]?.purposeOfGrant ?? '',
      indGrants[0]?.amountOfCashGrant ?? 0,
      this.grantsToIndividuals().length,
      this.totalGrantsToIndividuals(),
      // Part III: Foreign offices
      offices[0]?.country ?? '',
      offices[0]?.numberOfEmployees ?? 0,
      offices[0]?.typeOfActivities ?? '',
      offices[0]?.totalExpenditures ?? 0,
      this.foreignOffices().length,
      this.totalForeignEmployees(),
      this.totalForeignExpenditures(),
      // Part IV: Investments
      investments[0]?.country ?? '',
      investments[0]?.investmentType ?? '',
      investments[0]?.amount ?? 0,
      this.totalForeignInvestments(),
      // Total
      this.totalForeignActivities()
    ]
  }
}
