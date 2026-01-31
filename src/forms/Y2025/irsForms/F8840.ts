import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8840 - Closer Connection Exception Statement for Aliens
 *
 * Filed by aliens who meet the substantial presence test but claim
 * they have a closer connection to a foreign country and should be
 * treated as nonresident aliens for US tax purposes.
 *
 * Requirements to claim the exception:
 * - Present in US less than 183 days during current year
 * - Have a tax home in a foreign country
 * - Have a closer connection to that country than to the US
 *
 * Factors considered (from regulations):
 * - Location of permanent home
 * - Location of family
 * - Location of personal belongings
 * - Social, political, cultural ties
 * - Business activities
 * - Driver's licenses
 * - Voting registration
 * - Where banking is conducted
 * - Location of church/clubs
 */

export interface CloserConnectionInfo {
  foreignCountry: string
  permanentHomeAddress: string
  permanentHomeDateEstablished: Date

  // Days of presence
  daysInUSCurrentYear: number
  daysInUSPriorYear1: number
  daysInUSPriorYear2: number

  // Closer connection factors
  familyLocation: 'us' | 'foreign' | 'both'
  personalBelongingsLocation: 'us' | 'foreign' | 'both'
  socialTiesLocation: 'us' | 'foreign' | 'both'
  businessActivitiesLocation: 'us' | 'foreign' | 'both'
  driversLicenseCountry: string
  votingRegistrationCountry: string
  bankingLocation: 'us' | 'foreign' | 'both'

  // Tax home information
  taxHomeCountry: string
  taxHomeAddress: string

  // US activities
  usVisaType?: string
  appliedForGreenCard: boolean
  hasUsPermanentHome: boolean
  usHomeAddress?: string
}

export default class F8840 extends F1040Attachment {
  tag: FormTag = 'f8840'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCloserConnectionInfo() && this.meetsPresenceRequirement()
  }

  hasCloserConnectionInfo = (): boolean => {
    return this.closerConnectionInfo() !== undefined
  }

  closerConnectionInfo = (): CloserConnectionInfo | undefined => {
    return this.f1040.info.closerConnection as CloserConnectionInfo | undefined
  }

  // Check if meets the 183-day requirement
  meetsPresenceRequirement = (): boolean => {
    const info = this.closerConnectionInfo()
    if (!info) return false
    return info.daysInUSCurrentYear < 183
  }

  // Substantial presence test calculation
  substantialPresenceCount = (): number => {
    const info = this.closerConnectionInfo()
    if (!info) return 0

    // Current year days + 1/3 of prior year + 1/6 of year before
    return info.daysInUSCurrentYear +
           Math.floor(info.daysInUSPriorYear1 / 3) +
           Math.floor(info.daysInUSPriorYear2 / 6)
  }

  meetsSubstantialPresenceTest = (): boolean => {
    return this.substantialPresenceCount() >= 183
  }

  // Part I - General Information

  // Line 1: Country where you claim closer connection
  l1 = (): string => this.closerConnectionInfo()?.foreignCountry ?? ''

  // Line 2: Address of permanent home in that country
  l2 = (): string => this.closerConnectionInfo()?.permanentHomeAddress ?? ''

  // Line 3: Date permanent home was established
  l3 = (): string => {
    return this.closerConnectionInfo()?.permanentHomeDateEstablished?.toLocaleDateString() ?? ''
  }

  // Part II - Days Present in the United States

  // Line 4: Current year days
  l4 = (): number => this.closerConnectionInfo()?.daysInUSCurrentYear ?? 0

  // Line 5: Prior year days
  l5 = (): number => this.closerConnectionInfo()?.daysInUSPriorYear1 ?? 0

  // Line 6: Second prior year days
  l6 = (): number => this.closerConnectionInfo()?.daysInUSPriorYear2 ?? 0

  // Part III - Closer Connection Test

  // Line 7: Family location
  l7US = (): boolean => this.closerConnectionInfo()?.familyLocation === 'us'
  l7Foreign = (): boolean => this.closerConnectionInfo()?.familyLocation === 'foreign'
  l7Both = (): boolean => this.closerConnectionInfo()?.familyLocation === 'both'

  // Line 8: Location of personal belongings
  l8US = (): boolean => this.closerConnectionInfo()?.personalBelongingsLocation === 'us'
  l8Foreign = (): boolean => this.closerConnectionInfo()?.personalBelongingsLocation === 'foreign'
  l8Both = (): boolean => this.closerConnectionInfo()?.personalBelongingsLocation === 'both'

  // Line 9: Social ties
  l9US = (): boolean => this.closerConnectionInfo()?.socialTiesLocation === 'us'
  l9Foreign = (): boolean => this.closerConnectionInfo()?.socialTiesLocation === 'foreign'
  l9Both = (): boolean => this.closerConnectionInfo()?.socialTiesLocation === 'both'

  // Line 10: Business activities
  l10US = (): boolean => this.closerConnectionInfo()?.businessActivitiesLocation === 'us'
  l10Foreign = (): boolean => this.closerConnectionInfo()?.businessActivitiesLocation === 'foreign'
  l10Both = (): boolean => this.closerConnectionInfo()?.businessActivitiesLocation === 'both'

  // Line 11: Driver's license country
  l11 = (): string => this.closerConnectionInfo()?.driversLicenseCountry ?? ''

  // Line 12: Voting registration
  l12 = (): string => this.closerConnectionInfo()?.votingRegistrationCountry ?? ''

  // Line 13: Banking location
  l13US = (): boolean => this.closerConnectionInfo()?.bankingLocation === 'us'
  l13Foreign = (): boolean => this.closerConnectionInfo()?.bankingLocation === 'foreign'
  l13Both = (): boolean => this.closerConnectionInfo()?.bankingLocation === 'both'

  // Part IV - Other Information

  // Line 14: US visa type
  l14 = (): string => this.closerConnectionInfo()?.usVisaType ?? ''

  // Line 15: Applied for green card?
  l15 = (): boolean => this.closerConnectionInfo()?.appliedForGreenCard ?? false

  // Line 16: Have US permanent home?
  l16 = (): boolean => this.closerConnectionInfo()?.hasUsPermanentHome ?? false

  // Line 17: US home address (if yes to line 16)
  l17 = (): string => this.closerConnectionInfo()?.usHomeAddress ?? ''

  // Part V - Tax Home

  // Line 18: Tax home country
  l18 = (): string => this.closerConnectionInfo()?.taxHomeCountry ?? ''

  // Line 19: Tax home address
  l19 = (): string => this.closerConnectionInfo()?.taxHomeAddress ?? ''

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    // Part II
    this.l4(),
    this.l5(),
    this.l6(),
    // Part III
    this.l7US(), this.l7Foreign(), this.l7Both(),
    this.l8US(), this.l8Foreign(), this.l8Both(),
    this.l9US(), this.l9Foreign(), this.l9Both(),
    this.l10US(), this.l10Foreign(), this.l10Both(),
    this.l11(),
    this.l12(),
    this.l13US(), this.l13Foreign(), this.l13Both(),
    // Part IV
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    // Part V
    this.l18(),
    this.l19()
  ]
}
