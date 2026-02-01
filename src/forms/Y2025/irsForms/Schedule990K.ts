import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule K (Form 990) - Supplemental Information on Tax-Exempt Bonds
 *
 * Reports information about tax-exempt bonds issued by or for the organization:
 * - Bond issues
 * - Proceeds
 * - Private business use
 * - Arbitrage
 * - Procedures to monitor compliance
 *
 * Required for organizations with outstanding tax-exempt bonds.
 */

export interface BondIssue {
  issuerName: string
  issuerEIN: string
  cusipNumber: string
  dateIssued: Date
  issuePriceAtIssuance: number
  purposeOfBonds: string
  // Defeased
  isDefeased: boolean
  defeasanceDate?: Date
  // On behalf of issuer
  onBehalfOfIssuer: boolean
  pooledFinancing: boolean
}

export interface BondProceeds {
  bondIssueIndex: number
  grossProceedsAtIssuance: number
  proceedsInReserve: number
  capitalExpendituresFromProceeds: number
  workingCapitalFromProceeds: number
  refundingFromProceeds: number
  issuanceCostsFromProceeds: number
  creditEnhancementFromProceeds: number
  otherSpentProceeds: number
  unspentProceeds: number
  yearOfSubstantialCompletion: number
}

export interface Schedule990KData {
  // Part I: Bond Issues
  bondIssues: BondIssue[]
  // Part II: Proceeds
  bondProceeds: BondProceeds[]
  // Part III: Private business use
  privateBusinessUsePercent: number
  privateSecurityOrPaymentPercent: number
  changeInUse: boolean
  // Part IV: Arbitrage
  hasRebateRequirement: boolean
  rebateAmountDue: number
  hasExceptionFromRebate: boolean
  // Part V: Compliance
  hasWrittenProcedures: boolean
  engagedBondCounsel: boolean
  hasComplianceOfficer: boolean
  conductsPeriodicReviews: boolean
  retainsRecords: boolean
}

export default class Schedule990K extends F1040Attachment {
  tag: FormTag = 'f990sk'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasBondData()
  }

  hasBondData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990KData = (): Schedule990KData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Part I: Bond issues
  bondIssues = (): BondIssue[] => {
    return this.schedule990KData()?.bondIssues ?? []
  }

  numberOfBondIssues = (): number => {
    return this.bondIssues().length
  }

  totalBondIssuance = (): number => {
    return this.bondIssues().reduce((sum, b) => sum + b.issuePriceAtIssuance, 0)
  }

  // Part II: Proceeds
  bondProceeds = (): BondProceeds[] => {
    return this.schedule990KData()?.bondProceeds ?? []
  }

  totalGrossProceeds = (): number => {
    return this.bondProceeds().reduce(
      (sum, p) => sum + p.grossProceedsAtIssuance,
      0
    )
  }

  totalUnspentProceeds = (): number => {
    return this.bondProceeds().reduce((sum, p) => sum + p.unspentProceeds, 0)
  }

  // Part III: Private business use
  privateBusinessUsePercent = (): number => {
    return this.schedule990KData()?.privateBusinessUsePercent ?? 0
  }

  hasChangeInUse = (): boolean => {
    return this.schedule990KData()?.changeInUse ?? false
  }

  // Part IV: Arbitrage
  hasRebateRequirement = (): boolean => {
    return this.schedule990KData()?.hasRebateRequirement ?? false
  }

  rebateAmountDue = (): number => {
    return this.schedule990KData()?.rebateAmountDue ?? 0
  }

  // Part V: Compliance
  hasWrittenProcedures = (): boolean => {
    return this.schedule990KData()?.hasWrittenProcedures ?? false
  }

  fields = (): Field[] => {
    const data = this.schedule990KData()
    const issues = this.bondIssues()
    const proceeds = this.bondProceeds()

    return [
      // Part I: Bond Issues
      issues[0]?.issuerName ?? '',
      issues[0]?.issuerEIN ?? '',
      issues[0]?.cusipNumber ?? '',
      issues[0]?.dateIssued?.toLocaleDateString() ?? '',
      issues[0]?.issuePriceAtIssuance ?? 0,
      issues[0]?.purposeOfBonds ?? '',
      issues[0]?.isDefeased ?? false,
      issues[0]?.onBehalfOfIssuer ?? false,
      issues[0]?.pooledFinancing ?? false,
      // Second issue
      issues[1]?.issuerName ?? '',
      issues[1]?.issuePriceAtIssuance ?? 0,
      // Totals
      this.numberOfBondIssues(),
      this.totalBondIssuance(),
      // Part II: Proceeds
      proceeds[0]?.grossProceedsAtIssuance ?? 0,
      proceeds[0]?.proceedsInReserve ?? 0,
      proceeds[0]?.capitalExpendituresFromProceeds ?? 0,
      proceeds[0]?.workingCapitalFromProceeds ?? 0,
      proceeds[0]?.refundingFromProceeds ?? 0,
      proceeds[0]?.issuanceCostsFromProceeds ?? 0,
      proceeds[0]?.unspentProceeds ?? 0,
      proceeds[0]?.yearOfSubstantialCompletion ?? 0,
      this.totalGrossProceeds(),
      this.totalUnspentProceeds(),
      // Part III: Private business use
      this.privateBusinessUsePercent(),
      data?.privateSecurityOrPaymentPercent ?? 0,
      this.hasChangeInUse(),
      // Part IV: Arbitrage
      this.hasRebateRequirement(),
      this.rebateAmountDue(),
      data?.hasExceptionFromRebate ?? false,
      // Part V: Compliance
      this.hasWrittenProcedures(),
      data?.engagedBondCounsel ?? false,
      data?.hasComplianceOfficer ?? false,
      data?.conductsPeriodicReviews ?? false,
      data?.retainsRecords ?? false
    ]
  }
}
