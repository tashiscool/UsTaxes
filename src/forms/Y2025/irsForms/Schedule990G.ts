import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule G (Form 990) - Supplemental Information Regarding Fundraising or Gaming Activities
 *
 * Required for organizations that:
 * - Conduct fundraising events
 * - Conduct gaming activities
 * - Use professional fundraisers
 *
 * Key sections:
 * - Part I: Fundraising Activities
 * - Part II: Fundraising Events
 * - Part III: Gaming
 */

export interface FundraisingEvent {
  eventName: string
  eventType: 'gala' | 'auction' | 'dinner' | 'other'
  grossReceipts: number
  contributionsNotIncluded: number
  netIncome: number
  // Expenses
  cashPrizes: number
  noncashPrizes: number
  rentAndFacility: number
  food: number
  entertainment: number
  otherExpenses: number
}

export interface GamingActivity {
  gameType: 'bingo' | 'pullTabs' | 'poker' | 'casino' | 'other'
  grossRevenue: number
  cashPrizes: number
  noncashPrizes: number
  rentExpenses: number
  otherExpenses: number
  volunteerLabor: boolean
  percentPaidWorkers: number
}

export interface ProfessionalFundraiser {
  name: string
  address: string
  activity: string
  compensation: number
  amountRaised: number
  amountToOrganization: number
}

export interface Schedule990GData {
  // Part I: Fundraising Activities
  usedProfessionalFundraiser: boolean
  professionalFundraisers: ProfessionalFundraiser[]
  // Part II: Fundraising Events
  conductedFundraisingEvents: boolean
  fundraisingEvents: FundraisingEvent[]
  // Part III: Gaming
  conductedGaming: boolean
  gamingActivities: GamingActivity[]
  hasGamingLicense: boolean
  gamingLicenseState: string
}

export default class Schedule990G extends F1040Attachment {
  tag: FormTag = 'f990sg'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasFundraisingData()
  }

  hasFundraisingData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990GData = (): Schedule990GData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Part I: Professional Fundraisers
  usedProfessionalFundraiser = (): boolean => {
    return this.schedule990GData()?.usedProfessionalFundraiser ?? false
  }

  professionalFundraisers = (): ProfessionalFundraiser[] => {
    return this.schedule990GData()?.professionalFundraisers ?? []
  }

  totalProfessionalFundraiserFees = (): number => {
    return this.professionalFundraisers().reduce(
      (sum, f) => sum + f.compensation,
      0
    )
  }

  totalAmountRaised = (): number => {
    return this.professionalFundraisers().reduce(
      (sum, f) => sum + f.amountRaised,
      0
    )
  }

  // Part II: Fundraising Events
  conductedFundraisingEvents = (): boolean => {
    return this.schedule990GData()?.conductedFundraisingEvents ?? false
  }

  fundraisingEvents = (): FundraisingEvent[] => {
    return this.schedule990GData()?.fundraisingEvents ?? []
  }

  totalEventGrossReceipts = (): number => {
    return this.fundraisingEvents().reduce((sum, e) => sum + e.grossReceipts, 0)
  }

  totalEventExpenses = (): number => {
    return this.fundraisingEvents().reduce((sum, e) => {
      return (
        sum +
        sumFields([
          e.cashPrizes,
          e.noncashPrizes,
          e.rentAndFacility,
          e.food,
          e.entertainment,
          e.otherExpenses
        ])
      )
    }, 0)
  }

  totalEventNetIncome = (): number => {
    return this.totalEventGrossReceipts() - this.totalEventExpenses()
  }

  // Part III: Gaming
  conductedGaming = (): boolean => {
    return this.schedule990GData()?.conductedGaming ?? false
  }

  gamingActivities = (): GamingActivity[] => {
    return this.schedule990GData()?.gamingActivities ?? []
  }

  totalGamingRevenue = (): number => {
    return this.gamingActivities().reduce((sum, g) => sum + g.grossRevenue, 0)
  }

  totalGamingExpenses = (): number => {
    return this.gamingActivities().reduce((sum, g) => {
      return (
        sum +
        sumFields([
          g.cashPrizes,
          g.noncashPrizes,
          g.rentExpenses,
          g.otherExpenses
        ])
      )
    }, 0)
  }

  totalGamingNetIncome = (): number => {
    return this.totalGamingRevenue() - this.totalGamingExpenses()
  }

  fields = (): Field[] => {
    const data = this.schedule990GData()
    const fundraisers = this.professionalFundraisers()
    const events = this.fundraisingEvents()
    const gaming = this.gamingActivities()

    return [
      // Part I: Professional Fundraisers
      this.usedProfessionalFundraiser(),
      fundraisers[0]?.name ?? '',
      fundraisers[0]?.address ?? '',
      fundraisers[0]?.activity ?? '',
      fundraisers[0]?.compensation ?? 0,
      fundraisers[0]?.amountRaised ?? 0,
      this.totalProfessionalFundraiserFees(),
      this.totalAmountRaised(),
      // Part II: Fundraising Events
      this.conductedFundraisingEvents(),
      // Event 1
      events[0]?.eventName ?? '',
      events[0]?.grossReceipts ?? 0,
      events[0]?.contributionsNotIncluded ?? 0,
      events[0]?.cashPrizes ?? 0,
      events[0]?.noncashPrizes ?? 0,
      events[0]?.rentAndFacility ?? 0,
      events[0]?.food ?? 0,
      events[0]?.entertainment ?? 0,
      events[0]?.otherExpenses ?? 0,
      events[0]?.netIncome ?? 0,
      // Event 2
      events[1]?.eventName ?? '',
      events[1]?.grossReceipts ?? 0,
      events[1]?.netIncome ?? 0,
      // Totals
      this.totalEventGrossReceipts(),
      this.totalEventExpenses(),
      this.totalEventNetIncome(),
      // Part III: Gaming
      this.conductedGaming(),
      data?.hasGamingLicense ?? false,
      data?.gamingLicenseState ?? '',
      // Bingo
      gaming.find((g) => g.gameType === 'bingo')?.grossRevenue ?? 0,
      gaming.find((g) => g.gameType === 'bingo')?.cashPrizes ?? 0,
      // Pull tabs
      gaming.find((g) => g.gameType === 'pullTabs')?.grossRevenue ?? 0,
      // Other gaming
      gaming.find((g) => g.gameType === 'other')?.grossRevenue ?? 0,
      // Gaming totals
      this.totalGamingRevenue(),
      this.totalGamingExpenses(),
      this.totalGamingNetIncome()
    ]
  }
}
