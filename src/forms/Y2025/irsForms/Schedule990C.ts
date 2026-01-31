import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule C (Form 990) - Political Campaign and Lobbying Activities
 *
 * Reports political campaign intervention and lobbying expenditures.
 * Required for 501(c)(3) organizations and other exempt organizations.
 *
 * Key sections:
 * - Part I-A: Complete for 501(c)(3) organizations
 * - Part I-B: Complete for 501(c)(3) that made 501(h) election
 * - Part I-C: Complete for 501(c)(3) that did NOT make 501(h) election
 * - Part II-A: Complete for 501(c)(4), 501(c)(5), 501(c)(6)
 * - Part II-B: Complete for all organizations
 * - Part III: Information about section 527 political organizations
 */

export interface LobbyingActivity {
  description: string
  expenses: number
  hoursSpent: number
}

export interface PoliticalActivity {
  candidateName: string
  officeSought: string
  partyAffiliation: string
  amountSpent: number
}

export interface Schedule990CData {
  // Part I-A: 501(c)(3) organizations
  is501c3: boolean
  directPoliticalCampaignExpenses: number
  volunteerHours: number
  // Part I-B: 501(h) election
  made501hElection: boolean
  lobbyingNontaxable: number
  grassrootsNontaxable: number
  totalLobbyingExpenses: number
  // Part II-A: Other exempt organizations
  directLobbyingExpenses: number
  grassrootsLobbyingExpenses: number
  duesUsedForLobbying: number
  // Part II-B: All organizations
  lobbyingActivities: LobbyingActivity[]
  politicalActivities: PoliticalActivity[]
  // Part III: Section 527
  has527Relationship: boolean
  section527Organizations: {
    name: string
    ein: string
    amountPaid: number
  }[]
}

export default class Schedule990C extends F1040Attachment {
  tag: FormTag = 'f990sc'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasLobbyingData()
  }

  hasLobbyingData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990CData = (): Schedule990CData | undefined => {
    return undefined  // Would be populated from organization data
  }

  // Part I-A
  is501c3 = (): boolean => this.schedule990CData()?.is501c3 ?? false
  directPoliticalExpenses = (): number => this.schedule990CData()?.directPoliticalCampaignExpenses ?? 0

  // Part I-B: 501(h) election calculations
  made501hElection = (): boolean => this.schedule990CData()?.made501hElection ?? false
  totalLobbyingExpenses = (): number => this.schedule990CData()?.totalLobbyingExpenses ?? 0
  lobbyingNontaxable = (): number => this.schedule990CData()?.lobbyingNontaxable ?? 0
  grassrootsNontaxable = (): number => this.schedule990CData()?.grassrootsNontaxable ?? 0

  // Excess lobbying (taxable)
  excessLobbyingExpenses = (): number => {
    const total = this.totalLobbyingExpenses()
    const nontaxable = this.lobbyingNontaxable()
    return Math.max(0, total - nontaxable)
  }

  // Part II-A
  directLobbyingExpenses = (): number => this.schedule990CData()?.directLobbyingExpenses ?? 0
  grassrootsLobbyingExpenses = (): number => this.schedule990CData()?.grassrootsLobbyingExpenses ?? 0
  duesUsedForLobbying = (): number => this.schedule990CData()?.duesUsedForLobbying ?? 0

  // Total lobbying
  totalLobbyingAndPolitical = (): number => {
    return this.directLobbyingExpenses() + this.grassrootsLobbyingExpenses() + this.directPoliticalExpenses()
  }

  // Part III: Section 527
  has527Relationship = (): boolean => this.schedule990CData()?.has527Relationship ?? false

  fields = (): Field[] => {
    const data = this.schedule990CData()

    return [
      // Part I-A: 501(c)(3) organizations
      this.is501c3(),
      this.directPoliticalExpenses(),
      data?.volunteerHours ?? 0,
      // Part I-B: 501(h) election
      this.made501hElection(),
      this.lobbyingNontaxable(),
      this.grassrootsNontaxable(),
      this.totalLobbyingExpenses(),
      this.excessLobbyingExpenses(),
      // Part II-A
      this.directLobbyingExpenses(),
      this.grassrootsLobbyingExpenses(),
      this.duesUsedForLobbying(),
      this.totalLobbyingAndPolitical(),
      // Part II-B: Activities
      data?.lobbyingActivities[0]?.description ?? '',
      data?.lobbyingActivities[0]?.expenses ?? 0,
      data?.politicalActivities[0]?.candidateName ?? '',
      data?.politicalActivities[0]?.amountSpent ?? 0,
      // Part III: Section 527
      this.has527Relationship(),
      data?.section527Organizations[0]?.name ?? '',
      data?.section527Organizations[0]?.ein ?? '',
      data?.section527Organizations[0]?.amountPaid ?? 0
    ]
  }
}
