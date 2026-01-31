import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule I (Form 990) - Grants and Other Assistance to Organizations,
 * Governments, and Individuals in the United States
 *
 * Reports grants and assistance provided within the U.S.:
 * - Grants to domestic organizations
 * - Grants to domestic governments
 * - Grants to individuals
 *
 * Required when organization makes significant grants.
 */

export interface DomesticGrant {
  recipientName: string
  recipientEIN: string
  recipientAddress: string
  ircSection: string
  amountOfCashGrant: number
  amountOfNoncashAssistance: number
  methodOfValuation: string
  purposeOfGrant: string
}

export interface IndividualGrant {
  typeOfRecipient: string
  numberOfRecipients: number
  amountOfCashGrant: number
  amountOfNoncashAssistance: number
  methodOfValuation: string
  purposeOfGrant: string
}

export interface Schedule990IData {
  // Part I: General information
  hasGrantProgram: boolean
  grantProceduresDescription: string
  // Part II: Grants to organizations and governments
  organizationGrants: DomesticGrant[]
  // Part III: Grants to individuals
  individualGrants: IndividualGrant[]
  // Monitoring
  monitorsGrantees: boolean
  monitoringProcedures: string
}

export default class Schedule990I extends F1040Attachment {
  tag: FormTag = 'f990si'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasGrantData()
  }

  hasGrantData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990IData = (): Schedule990IData | undefined => {
    return undefined  // Would be populated from organization data
  }

  // Part I: General
  hasGrantProgram = (): boolean => {
    return this.schedule990IData()?.hasGrantProgram ?? false
  }

  monitorsGrantees = (): boolean => {
    return this.schedule990IData()?.monitorsGrantees ?? false
  }

  // Part II: Organization grants
  organizationGrants = (): DomesticGrant[] => {
    return this.schedule990IData()?.organizationGrants ?? []
  }

  numberOfOrganizationGrants = (): number => {
    return this.organizationGrants().length
  }

  totalCashGrantsToOrganizations = (): number => {
    return this.organizationGrants().reduce((sum, g) => sum + g.amountOfCashGrant, 0)
  }

  totalNoncashGrantsToOrganizations = (): number => {
    return this.organizationGrants().reduce((sum, g) => sum + g.amountOfNoncashAssistance, 0)
  }

  totalGrantsToOrganizations = (): number => {
    return this.totalCashGrantsToOrganizations() + this.totalNoncashGrantsToOrganizations()
  }

  // Part III: Individual grants
  individualGrants = (): IndividualGrant[] => {
    return this.schedule990IData()?.individualGrants ?? []
  }

  totalIndividualRecipients = (): number => {
    return this.individualGrants().reduce((sum, g) => sum + g.numberOfRecipients, 0)
  }

  totalCashGrantsToIndividuals = (): number => {
    return this.individualGrants().reduce((sum, g) => sum + g.amountOfCashGrant, 0)
  }

  totalNoncashGrantsToIndividuals = (): number => {
    return this.individualGrants().reduce((sum, g) => sum + g.amountOfNoncashAssistance, 0)
  }

  totalGrantsToIndividuals = (): number => {
    return this.totalCashGrantsToIndividuals() + this.totalNoncashGrantsToIndividuals()
  }

  // Grand totals
  grandTotalGrants = (): number => {
    return this.totalGrantsToOrganizations() + this.totalGrantsToIndividuals()
  }

  fields = (): Field[] => {
    const data = this.schedule990IData()
    const orgGrants = this.organizationGrants()
    const indGrants = this.individualGrants()

    return [
      // Part I: General
      this.hasGrantProgram(),
      data?.grantProceduresDescription ?? '',
      this.monitorsGrantees(),
      data?.monitoringProcedures ?? '',
      // Part II: Organization grants
      orgGrants[0]?.recipientName ?? '',
      orgGrants[0]?.recipientEIN ?? '',
      orgGrants[0]?.recipientAddress ?? '',
      orgGrants[0]?.ircSection ?? '',
      orgGrants[0]?.amountOfCashGrant ?? 0,
      orgGrants[0]?.amountOfNoncashAssistance ?? 0,
      orgGrants[0]?.purposeOfGrant ?? '',
      // Second grant
      orgGrants[1]?.recipientName ?? '',
      orgGrants[1]?.amountOfCashGrant ?? 0,
      // Third grant
      orgGrants[2]?.recipientName ?? '',
      orgGrants[2]?.amountOfCashGrant ?? 0,
      // Totals
      this.numberOfOrganizationGrants(),
      this.totalCashGrantsToOrganizations(),
      this.totalNoncashGrantsToOrganizations(),
      this.totalGrantsToOrganizations(),
      // Part III: Individual grants
      indGrants[0]?.typeOfRecipient ?? '',
      indGrants[0]?.numberOfRecipients ?? 0,
      indGrants[0]?.amountOfCashGrant ?? 0,
      indGrants[0]?.amountOfNoncashAssistance ?? 0,
      indGrants[0]?.purposeOfGrant ?? '',
      // Second type
      indGrants[1]?.typeOfRecipient ?? '',
      indGrants[1]?.numberOfRecipients ?? 0,
      indGrants[1]?.amountOfCashGrant ?? 0,
      // Totals
      this.individualGrants().length,
      this.totalIndividualRecipients(),
      this.totalCashGrantsToIndividuals(),
      this.totalNoncashGrantsToIndividuals(),
      this.totalGrantsToIndividuals(),
      // Grand total
      this.grandTotalGrants()
    ]
  }
}
