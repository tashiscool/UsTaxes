import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule D (Form 990) - Supplemental Financial Statements
 *
 * Provides additional information for organizations with:
 * - Donor advised funds
 * - Conservation easements
 * - Art collections
 * - Escrow accounts
 * - Endowments
 * - Other specific asset types
 *
 * Required when Form 990 Part IV, lines 6-12b are checked.
 */

export interface DonorAdvisedFund {
  fundName: string
  sponsoringOrganization: string
  aggregateValueEOY: number
  totalContributions: number
  totalDistributions: number
}

export interface ConservationEasement {
  location: string
  dateAcquired: Date
  acreage: number
  fmvAtDonation: number
  restrictions: string
}

export interface EndowmentFund {
  beginningBalance: number
  contributions: number
  investmentEarnings: number
  grantsAndScholarships: number
  administrativeExpenses: number
  endingBalance: number
}

export interface Schedule990DData {
  // Part I: Donor Advised Funds
  hasDonorAdvisedFunds: boolean
  donorAdvisedFunds: DonorAdvisedFund[]
  // Part II: Conservation Easements
  hasConservationEasements: boolean
  conservationEasements: ConservationEasement[]
  totalEasementAcreage: number
  // Part III: Art, Historical Treasures
  hasArtCollections: boolean
  artCollectionValue: number
  artUseForExemptPurpose: boolean
  // Part IV: Escrow and Custodial Accounts
  hasEscrowAccounts: boolean
  escrowAccountBalance: number
  // Part V: Endowment Funds
  hasEndowmentFunds: boolean
  endowmentFunds: EndowmentFund
  // Part VI: Land, Buildings, Equipment
  hasBuildingsAndEquipment: boolean
  landValue: number
  buildingsValue: number
  equipmentValue: number
  // Part VII: Investments - Other Securities
  hasOtherSecurities: boolean
  otherSecuritiesValue: number
  // Part VIII: Investments - Program Related
  hasProgramRelatedInvestments: boolean
  programRelatedInvestmentsValue: number
  // Part IX: Other Assets
  hasOtherAssets: boolean
  otherAssetsValue: number
  // Part X: Other Liabilities
  hasOtherLiabilities: boolean
  otherLiabilitiesValue: number
}

export default class Schedule990D extends F1040Attachment {
  tag: FormTag = 'f990sd'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasSupplementalData()
  }

  hasSupplementalData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990DData = (): Schedule990DData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Part I: Donor Advised Funds
  hasDonorAdvisedFunds = (): boolean =>
    this.schedule990DData()?.hasDonorAdvisedFunds ?? false

  totalDonorAdvisedFundValue = (): number => {
    const funds = this.schedule990DData()?.donorAdvisedFunds ?? []
    return funds.reduce((sum, f) => sum + f.aggregateValueEOY, 0)
  }

  // Part II: Conservation Easements
  hasConservationEasements = (): boolean =>
    this.schedule990DData()?.hasConservationEasements ?? false
  totalEasementAcreage = (): number =>
    this.schedule990DData()?.totalEasementAcreage ?? 0

  // Part V: Endowment Funds
  hasEndowmentFunds = (): boolean =>
    this.schedule990DData()?.hasEndowmentFunds ?? false

  endowmentBeginningBalance = (): number => {
    return this.schedule990DData()?.endowmentFunds.beginningBalance ?? 0
  }

  endowmentEndingBalance = (): number => {
    return this.schedule990DData()?.endowmentFunds.endingBalance ?? 0
  }

  endowmentChange = (): number => {
    return this.endowmentEndingBalance() - this.endowmentBeginningBalance()
  }

  // Part VI: Fixed Assets
  totalFixedAssets = (): number => {
    const data = this.schedule990DData()
    return sumFields([
      data?.landValue,
      data?.buildingsValue,
      data?.equipmentValue
    ])
  }

  // Total supplemental assets
  totalSupplementalAssets = (): number => {
    const data = this.schedule990DData()
    return sumFields([
      this.totalDonorAdvisedFundValue(),
      data?.artCollectionValue,
      data?.escrowAccountBalance,
      this.endowmentEndingBalance(),
      this.totalFixedAssets(),
      data?.otherSecuritiesValue,
      data?.programRelatedInvestmentsValue,
      data?.otherAssetsValue
    ])
  }

  fields = (): Field[] => {
    const data = this.schedule990DData()
    const funds = data?.donorAdvisedFunds ?? []
    const easements = data?.conservationEasements ?? []

    return [
      // Part I: Donor Advised Funds
      this.hasDonorAdvisedFunds(),
      funds[0]?.fundName ?? '',
      funds[0]?.aggregateValueEOY ?? 0,
      funds[0]?.totalContributions ?? 0,
      funds[0]?.totalDistributions ?? 0,
      this.totalDonorAdvisedFundValue(),
      // Part II: Conservation Easements
      this.hasConservationEasements(),
      easements[0]?.location ?? '',
      easements[0]?.acreage ?? 0,
      easements[0]?.fmvAtDonation ?? 0,
      this.totalEasementAcreage(),
      // Part III: Art Collections
      data?.hasArtCollections ?? false,
      data?.artCollectionValue ?? 0,
      data?.artUseForExemptPurpose ?? false,
      // Part IV: Escrow Accounts
      data?.hasEscrowAccounts ?? false,
      data?.escrowAccountBalance ?? 0,
      // Part V: Endowment Funds
      this.hasEndowmentFunds(),
      this.endowmentBeginningBalance(),
      data?.endowmentFunds.contributions ?? 0,
      data?.endowmentFunds.investmentEarnings ?? 0,
      data?.endowmentFunds.grantsAndScholarships ?? 0,
      data?.endowmentFunds.administrativeExpenses ?? 0,
      this.endowmentEndingBalance(),
      // Part VI: Fixed Assets
      data?.landValue ?? 0,
      data?.buildingsValue ?? 0,
      data?.equipmentValue ?? 0,
      this.totalFixedAssets(),
      // Parts VII-X: Other
      data?.otherSecuritiesValue ?? 0,
      data?.programRelatedInvestmentsValue ?? 0,
      data?.otherAssetsValue ?? 0,
      data?.otherLiabilitiesValue ?? 0,
      // Total
      this.totalSupplementalAssets()
    ]
  }
}
