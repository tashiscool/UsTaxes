import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Schedule R (Form 990) - Related Organizations and Unrelated Partnerships
 *
 * Reports information about:
 * - Disregarded entities
 * - Related tax-exempt organizations
 * - Related organizations taxable as partnerships
 * - Related organizations taxable as corporations or trusts
 * - Transactions with related organizations
 * - Unrelated partnerships
 *
 * Required when organization has related organizations.
 */

export interface DisregardedEntity {
  name: string
  ein: string
  state: string
  primaryActivity: string
  totalIncome: number
  endOfYearAssets: number
  directControllingEntity: string
}

export interface RelatedExemptOrg {
  name: string
  ein: string
  state: string
  exemptCodeSection: string
  publicCharityStatus: string
  directControllingEntity: string
  controlled: boolean
}

export interface RelatedPartnership {
  name: string
  ein: string
  state: string
  primaryActivity: string
  legalDomicile: string
  directControllingEntity: string
  shareOfTotalIncome: number
  shareOfEndOfYearAssets: number
  disproportionateAllocations: boolean
  codeVUBI: boolean
}

export interface RelatedCorporationOrTrust {
  name: string
  ein: string
  state: string
  primaryActivity: string
  legalDomicile: string
  directControllingEntity: string
  typeOfEntity: 'ccorp' | 'scorp' | 'trust'
  shareOfTotalIncome: number
  shareOfEndOfYearAssets: number
  percentageOwnership: number
}

export interface TransactionWithRelatedOrg {
  relatedOrgName: string
  transactionType:
    | 'receipt'
    | 'gift'
    | 'rent'
    | 'loan'
    | 'services'
    | 'asset'
    | 'other'
  amountInvolved: number
  methodOfDeterminingAmount: string
}

export interface Schedule990RData {
  // Part I: Disregarded entities
  disregardedEntities: DisregardedEntity[]
  // Part II: Related tax-exempt organizations
  relatedExemptOrgs: RelatedExemptOrg[]
  // Part III: Related organizations taxable as partnerships
  relatedPartnerships: RelatedPartnership[]
  // Part IV: Related organizations taxable as corporations or trusts
  relatedCorpsAndTrusts: RelatedCorporationOrTrust[]
  // Part V: Transactions with related organizations
  transactions: TransactionWithRelatedOrg[]
  // Part VI: Unrelated partnerships
  unrelatedPartnerships: {
    name: string
    ein: string
    ownershipPercentage: number
    incomeFromPartnership: number
  }[]
}

export default class Schedule990R extends F1040Attachment {
  tag: FormTag = 'f990sr'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasRelatedOrgData()
  }

  hasRelatedOrgData = (): boolean => {
    const exemptOrg = this.f1040.info.exemptOrgReturn
    return exemptOrg !== undefined
  }

  schedule990RData = (): Schedule990RData | undefined => {
    return undefined // Would be populated from organization data
  }

  // Part I: Disregarded entities
  disregardedEntities = (): DisregardedEntity[] => {
    return this.schedule990RData()?.disregardedEntities ?? []
  }

  totalDisregardedEntityIncome = (): number => {
    return this.disregardedEntities().reduce((sum, e) => sum + e.totalIncome, 0)
  }

  totalDisregardedEntityAssets = (): number => {
    return this.disregardedEntities().reduce(
      (sum, e) => sum + e.endOfYearAssets,
      0
    )
  }

  // Part II: Related exempt organizations
  relatedExemptOrgs = (): RelatedExemptOrg[] => {
    return this.schedule990RData()?.relatedExemptOrgs ?? []
  }

  numberOfRelatedExemptOrgs = (): number => this.relatedExemptOrgs().length

  // Part III: Related partnerships
  relatedPartnerships = (): RelatedPartnership[] => {
    return this.schedule990RData()?.relatedPartnerships ?? []
  }

  totalPartnershipIncome = (): number => {
    return this.relatedPartnerships().reduce(
      (sum, p) => sum + p.shareOfTotalIncome,
      0
    )
  }

  // Part IV: Related corporations and trusts
  relatedCorpsAndTrusts = (): RelatedCorporationOrTrust[] => {
    return this.schedule990RData()?.relatedCorpsAndTrusts ?? []
  }

  totalCorpAndTrustIncome = (): number => {
    return this.relatedCorpsAndTrusts().reduce(
      (sum, c) => sum + c.shareOfTotalIncome,
      0
    )
  }

  // Part V: Transactions
  transactions = (): TransactionWithRelatedOrg[] => {
    return this.schedule990RData()?.transactions ?? []
  }

  totalTransactionAmounts = (): number => {
    return this.transactions().reduce((sum, t) => sum + t.amountInvolved, 0)
  }

  // Part VI: Unrelated partnerships
  unrelatedPartnerships = () => {
    return this.schedule990RData()?.unrelatedPartnerships ?? []
  }

  totalUnrelatedPartnershipIncome = (): number => {
    return this.unrelatedPartnerships().reduce(
      (sum, p) => sum + p.incomeFromPartnership,
      0
    )
  }

  fields = (): Field[] => {
    const disregarded = this.disregardedEntities()
    const exemptOrgs = this.relatedExemptOrgs()
    const partnerships = this.relatedPartnerships()
    const corps = this.relatedCorpsAndTrusts()
    const transactions = this.transactions()
    const unrelated = this.unrelatedPartnerships()

    return [
      // Part I: Disregarded entities
      disregarded[0]?.name ?? '',
      disregarded[0]?.ein ?? '',
      disregarded[0]?.state ?? '',
      disregarded[0]?.primaryActivity ?? '',
      disregarded[0]?.totalIncome ?? 0,
      disregarded[0]?.endOfYearAssets ?? 0,
      this.disregardedEntities().length,
      this.totalDisregardedEntityIncome(),
      this.totalDisregardedEntityAssets(),
      // Part II: Related exempt orgs
      exemptOrgs[0]?.name ?? '',
      exemptOrgs[0]?.ein ?? '',
      exemptOrgs[0]?.exemptCodeSection ?? '',
      exemptOrgs[0]?.publicCharityStatus ?? '',
      exemptOrgs[0]?.controlled ?? false,
      this.numberOfRelatedExemptOrgs(),
      // Part III: Related partnerships
      partnerships[0]?.name ?? '',
      partnerships[0]?.ein ?? '',
      partnerships[0]?.primaryActivity ?? '',
      partnerships[0]?.shareOfTotalIncome ?? 0,
      partnerships[0]?.disproportionateAllocations ?? false,
      this.relatedPartnerships().length,
      this.totalPartnershipIncome(),
      // Part IV: Related corps/trusts
      corps[0]?.name ?? '',
      corps[0]?.ein ?? '',
      corps[0]?.typeOfEntity ?? '',
      corps[0]?.shareOfTotalIncome ?? 0,
      corps[0]?.percentageOwnership ?? 0,
      this.relatedCorpsAndTrusts().length,
      this.totalCorpAndTrustIncome(),
      // Part V: Transactions
      transactions[0]?.relatedOrgName ?? '',
      transactions[0]?.transactionType ?? '',
      transactions[0]?.amountInvolved ?? 0,
      transactions[0]?.methodOfDeterminingAmount ?? '',
      this.transactions().length,
      this.totalTransactionAmounts(),
      // Part VI: Unrelated partnerships
      unrelated[0]?.name ?? '',
      unrelated[0]?.ownershipPercentage ?? 0,
      unrelated[0]?.incomeFromPartnership ?? 0,
      this.unrelatedPartnerships().length,
      this.totalUnrelatedPartnershipIncome()
    ]
  }
}
