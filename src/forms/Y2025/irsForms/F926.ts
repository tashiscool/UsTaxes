import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 926 - Return by a U.S. Transferor of Property to a Foreign Corporation
 *
 * Required when a U.S. person transfers property to a foreign corporation
 * in exchange for stock or securities, or as a contribution to capital.
 *
 * Applies to transfers under:
 * - Section 351 (Transfer to controlled corporation)
 * - Section 354 (Reorganization exchanges)
 * - Section 356 (Boot in reorganization)
 * - Section 361 (Corporate reorganizations)
 * - Section 332 (Liquidation of subsidiary)
 * - Other transfers to foreign corporations
 *
 * Exceptions (reduced reporting):
 * - Transfers of cash only, with aggregate value ≤ $100,000
 * - Transfers of property with FMV ≤ $100,000 (stock) and no intangibles
 *
 * Due Date: Due with transferor's income tax return
 * Penalties: 10% of FMV of property transferred (up to $100,000)
 */

export type PropertyType = 'cash' | 'stock' | 'securities' | 'tangibleProperty' | 'intangibleProperty' | 'activeBusinessAssets' | 'inventory' | 'installmentObligation' | 'foreignCurrencyAssets' | 'other'
export type TransferSection = '351' | '354' | '356' | '361' | '332' | '367' | 'other'

export interface TransferredProperty {
  description: string
  propertyType: PropertyType
  dateAcquired: Date
  dateOfTransfer: Date
  fairMarketValue: number
  adjustedBasis: number
  gainRecognized: number
  isDepreciableProperty: boolean
  isIntangible: boolean
  isTaintedAsset: boolean
  usefulLife?: number
}

export interface ForeignCorporationInfo {
  name: string
  ein?: string
  address: string
  countryOfIncorporation: string
  dateOfIncorporation: Date
  isControlledForeignCorp: boolean
  isPassiveForeignInvestmentCo: boolean
  principalBusinessActivity: string
  naicsCode: string
}

export interface StockReceived {
  numberOfShares: number
  shareClass: string
  fairMarketValue: number
  percentageOwnership: number
  isVotingStock: boolean
  isPreferredStock: boolean
}

export interface Form926Info {
  // Transferor Information
  transferorName: string
  transferorTIN: string
  transferorAddress: string
  taxYear: number
  // Foreign Corporation
  foreignCorporation: ForeignCorporationInfo
  // Transfer Details
  transferSection: TransferSection
  isExchangeTransfer: boolean
  isContributionToCapital: boolean
  // Property Transferred
  propertyTransferred: TransferredProperty[]
  // Stock Received
  stockReceived: StockReceived[]
  // Control
  hadControlBefore: boolean
  hasControlAfter: boolean
  controlPercentageBefore: number
  controlPercentageAfter: number
  // Recognition and Gain
  totalGainRecognized: number
  gainTreatedAsSubpartF: boolean
  gainTreatedAsDividend: boolean
  // Section 367 Analysis
  hasGainRecognitionAgreement: boolean
  graExpirationDate?: Date
  isActiveTradeOrBusiness: boolean
  hasIntangibleProperty: boolean
  hasComplianceAgreement: boolean
}

// Reporting threshold
const REDUCED_REPORTING_THRESHOLD = 100000

export default class F926 extends F1040Attachment {
  tag: FormTag = 'f926'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm926Info()
  }

  hasForm926Info = (): boolean => {
    return this.f926Info() !== undefined
  }

  f926Info = (): Form926Info | undefined => {
    return this.f1040.info.foreignTransferReturn as Form926Info | undefined
  }

  // Foreign Corporation
  foreignCorp = (): ForeignCorporationInfo | undefined => this.f926Info()?.foreignCorporation
  corpName = (): string => this.foreignCorp()?.name ?? ''
  corpCountry = (): string => this.foreignCorp()?.countryOfIncorporation ?? ''
  isCFC = (): boolean => this.foreignCorp()?.isControlledForeignCorp ?? false
  isPFIC = (): boolean => this.foreignCorp()?.isPassiveForeignInvestmentCo ?? false

  // Property Transferred
  propertyTransferred = (): TransferredProperty[] => this.f926Info()?.propertyTransferred ?? []
  numberOfTransfers = (): number => this.propertyTransferred().length

  totalFMV = (): number => {
    return this.propertyTransferred().reduce((sum, p) => sum + p.fairMarketValue, 0)
  }

  totalBasis = (): number => {
    return this.propertyTransferred().reduce((sum, p) => sum + p.adjustedBasis, 0)
  }

  totalGain = (): number => {
    return this.propertyTransferred().reduce((sum, p) => sum + p.gainRecognized, 0)
  }

  // Property by type
  cashTransferred = (): number => {
    return this.propertyTransferred()
      .filter(p => p.propertyType === 'cash')
      .reduce((sum, p) => sum + p.fairMarketValue, 0)
  }

  stockTransferred = (): number => {
    return this.propertyTransferred()
      .filter(p => p.propertyType === 'stock' || p.propertyType === 'securities')
      .reduce((sum, p) => sum + p.fairMarketValue, 0)
  }

  intangiblesTransferred = (): number => {
    return this.propertyTransferred()
      .filter(p => p.isIntangible)
      .reduce((sum, p) => sum + p.fairMarketValue, 0)
  }

  taintedAssetsTransferred = (): number => {
    return this.propertyTransferred()
      .filter(p => p.isTaintedAsset)
      .reduce((sum, p) => sum + p.fairMarketValue, 0)
  }

  // Stock Received
  stockReceived = (): StockReceived[] => this.f926Info()?.stockReceived ?? []

  totalStockFMV = (): number => {
    return this.stockReceived().reduce((sum, s) => sum + s.fairMarketValue, 0)
  }

  totalOwnershipPercentage = (): number => {
    return this.stockReceived().reduce((sum, s) => sum + s.percentageOwnership, 0)
  }

  // Control Analysis
  hadControlBefore = (): boolean => this.f926Info()?.hadControlBefore ?? false
  hasControlAfter = (): boolean => this.f926Info()?.hasControlAfter ?? false
  controlPercentageBefore = (): number => this.f926Info()?.controlPercentageBefore ?? 0
  controlPercentageAfter = (): number => this.f926Info()?.controlPercentageAfter ?? 0

  // Section 367 Analysis
  hasGRA = (): boolean => this.f926Info()?.hasGainRecognitionAgreement ?? false
  isActiveTradeOrBusiness = (): boolean => this.f926Info()?.isActiveTradeOrBusiness ?? false
  hasIntangibles = (): boolean => this.f926Info()?.hasIntangibleProperty ?? false

  // Reduced Reporting Check
  qualifiesForReducedReporting = (): boolean => {
    if (this.hasIntangibles()) return false
    if (this.cashTransferred() > REDUCED_REPORTING_THRESHOLD) return false
    if (this.totalFMV() > REDUCED_REPORTING_THRESHOLD) return false
    return true
  }

  fields = (): Field[] => {
    const info = this.f926Info()
    const corp = this.foreignCorp()
    const props = this.propertyTransferred()
    const stocks = this.stockReceived()

    return [
      // Transferor Information
      info?.transferorName ?? '',
      info?.transferorTIN ?? '',
      info?.transferorAddress ?? '',
      info?.taxYear ?? 2025,
      // Foreign Corporation
      this.corpName(),
      corp?.ein ?? '',
      corp?.address ?? '',
      this.corpCountry(),
      corp?.dateOfIncorporation?.toLocaleDateString() ?? '',
      this.isCFC(),
      this.isPFIC(),
      corp?.principalBusinessActivity ?? '',
      corp?.naicsCode ?? '',
      // Transfer Type
      info?.transferSection ?? '',
      info?.isExchangeTransfer ?? false,
      info?.isContributionToCapital ?? false,
      // Property Summary
      this.numberOfTransfers(),
      this.cashTransferred(),
      this.stockTransferred(),
      this.intangiblesTransferred(),
      this.taintedAssetsTransferred(),
      this.totalFMV(),
      this.totalBasis(),
      this.totalGain(),
      // First Property
      props[0]?.description ?? '',
      props[0]?.propertyType ?? '',
      props[0]?.fairMarketValue ?? 0,
      props[0]?.adjustedBasis ?? 0,
      props[0]?.gainRecognized ?? 0,
      // Stock Received
      stocks[0]?.numberOfShares ?? 0,
      stocks[0]?.shareClass ?? '',
      this.totalStockFMV(),
      this.totalOwnershipPercentage(),
      // Control
      this.hadControlBefore(),
      this.hasControlAfter(),
      this.controlPercentageBefore(),
      this.controlPercentageAfter(),
      // Section 367
      this.hasGRA(),
      info?.graExpirationDate?.toLocaleDateString() ?? '',
      this.isActiveTradeOrBusiness(),
      this.hasIntangibles(),
      info?.hasComplianceAgreement ?? false,
      // Recognition
      info?.totalGainRecognized ?? 0,
      info?.gainTreatedAsSubpartF ?? false,
      info?.gainTreatedAsDividend ?? false,
      // Reduced Reporting
      this.qualifiesForReducedReporting()
    ]
  }
}
