/**
 * Shared types and utilities for cryptocurrency transaction parsing
 *
 * This module provides:
 * - Common types for crypto transactions across exchanges
 * - Cost basis calculation methods (FIFO, LIFO, HIFO, Specific ID)
 * - Utility functions for crypto tax calculations
 */

/**
 * Types of cryptocurrency transactions
 */
export type CryptoTransactionType =
  | 'buy'           // Purchase with fiat
  | 'sell'          // Sale for fiat
  | 'convert'       // Swap one crypto for another
  | 'send'          // Transfer out to another wallet
  | 'receive'       // Transfer in from another wallet
  | 'income'        // Staking rewards, interest, etc.
  | 'airdrop'       // Free tokens received
  | 'mining'        // Mining rewards
  | 'gift_sent'     // Gift to another person
  | 'gift_received' // Gift received
  | 'fork'          // Tokens from blockchain fork
  | 'other'         // Unknown or other type

/**
 * Cost basis calculation methods
 */
export type CostBasisMethod =
  | 'fifo'    // First In, First Out
  | 'lifo'    // Last In, First Out
  | 'hifo'    // Highest In, First Out (minimizes gains)
  | 'spec_id' // Specific Identification

/**
 * Represents a single cryptocurrency transaction
 */
export interface CryptoTransaction {
  id: string
  timestamp: Date
  type: CryptoTransactionType
  asset: string                    // e.g., BTC, ETH
  quantity: number
  pricePerUnit: number            // USD price per unit at transaction time
  totalValue: number              // Total USD value
  fees: number                    // Transaction fees in USD
  notes?: string
  exchange?: string               // Exchange name
  txHash?: string                 // Blockchain transaction hash

  // For convert transactions
  convertFromAsset?: string
  convertFromQuantity?: number
  convertToAsset?: string
  convertToQuantity?: number

  // Original raw data for reference
  rawData?: string[]
}

/**
 * Represents a holding of cryptocurrency with cost basis info
 */
export interface CryptoHolding {
  asset: string
  quantity: number
  costBasisPerUnit: number
  totalCostBasis: number
  acquiredDate: Date
  source: string                  // Where it was acquired
  txId?: string                   // Original transaction ID
}

/**
 * Result of cost basis calculation for a sale
 */
export interface CostBasisResult {
  lotsUsed: {
    acquiredDate: Date
    quantitySold: number
    costBasis: number
    costBasisPerUnit: number
  }[]
  totalCostBasis: number
  remainingHoldings: CryptoHolding[]
  error?: string
}

/**
 * Form 8949 transaction category
 */
export type Form8949Category =
  | 'A'   // Short-term, basis reported to IRS
  | 'B'   // Short-term, basis NOT reported to IRS
  | 'C'   // Short-term, Form 1099-B not received
  | 'D'   // Long-term, basis reported to IRS
  | 'E'   // Long-term, basis NOT reported to IRS
  | 'F'   // Long-term, Form 1099-B not received

/**
 * Determines Form 8949 category based on holding period and reporting
 */
export function getForm8949Category(
  acquiredDate: Date,
  soldDate: Date,
  basisReportedToIRS: boolean
): Form8949Category {
  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  const isLongTerm = (soldDate.getTime() - acquiredDate.getTime()) > oneYearMs

  if (isLongTerm) {
    return basisReportedToIRS ? 'D' : 'E'
  } else {
    return basisReportedToIRS ? 'A' : 'B'
  }
}

/**
 * Calculate cost basis for a sale using the specified method
 */
export function calculateCostBasis(
  holdings: CryptoHolding[],
  quantityToSell: number,
  method: CostBasisMethod
): CostBasisResult {
  const result: CostBasisResult = {
    lotsUsed: [],
    totalCostBasis: 0,
    remainingHoldings: []
  }

  if (holdings.length === 0) {
    result.error = 'No holdings available to sell'
    return result
  }

  // Clone and sort holdings based on method
  let sortedHoldings = holdings.map(h => ({ ...h }))

  switch (method) {
    case 'fifo':
      // First acquired first
      sortedHoldings.sort((a, b) => a.acquiredDate.getTime() - b.acquiredDate.getTime())
      break
    case 'lifo':
      // Last acquired first
      sortedHoldings.sort((a, b) => b.acquiredDate.getTime() - a.acquiredDate.getTime())
      break
    case 'hifo':
      // Highest cost basis first (minimizes gains)
      sortedHoldings.sort((a, b) => b.costBasisPerUnit - a.costBasisPerUnit)
      break
    case 'spec_id':
      // For specific ID, caller should pre-select lots
      // Default to FIFO if not specified
      sortedHoldings.sort((a, b) => a.acquiredDate.getTime() - b.acquiredDate.getTime())
      break
  }

  let remainingToSell = quantityToSell
  const totalAvailable = sortedHoldings.reduce((sum, h) => sum + h.quantity, 0)

  if (quantityToSell > totalAvailable) {
    result.error = `Attempting to sell ${quantityToSell} but only ${totalAvailable} available`
    // Continue with what we have
    remainingToSell = totalAvailable
  }

  for (const holding of sortedHoldings) {
    if (remainingToSell <= 0) {
      // Keep remaining holdings
      result.remainingHoldings.push(holding)
      continue
    }

    if (holding.quantity <= remainingToSell) {
      // Use entire lot
      result.lotsUsed.push({
        acquiredDate: holding.acquiredDate,
        quantitySold: holding.quantity,
        costBasis: holding.totalCostBasis,
        costBasisPerUnit: holding.costBasisPerUnit
      })
      result.totalCostBasis += holding.totalCostBasis
      remainingToSell -= holding.quantity
    } else {
      // Use partial lot
      const partialCostBasis = holding.costBasisPerUnit * remainingToSell
      result.lotsUsed.push({
        acquiredDate: holding.acquiredDate,
        quantitySold: remainingToSell,
        costBasis: partialCostBasis,
        costBasisPerUnit: holding.costBasisPerUnit
      })
      result.totalCostBasis += partialCostBasis

      // Add remaining to holdings
      result.remainingHoldings.push({
        ...holding,
        quantity: holding.quantity - remainingToSell,
        totalCostBasis: holding.costBasisPerUnit * (holding.quantity - remainingToSell)
      })

      remainingToSell = 0
    }
  }

  return result
}

/**
 * Calculate unrealized gains/losses for current holdings
 */
export function calculateUnrealizedGains(
  holdings: CryptoHolding[],
  currentPrices: Map<string, number>
): {
  asset: string
  quantity: number
  costBasis: number
  currentValue: number
  unrealizedGain: number
  unrealizedGainPercent: number
}[] {
  const results: {
    asset: string
    quantity: number
    costBasis: number
    currentValue: number
    unrealizedGain: number
    unrealizedGainPercent: number
  }[] = []

  // Group by asset
  const byAsset = new Map<string, CryptoHolding[]>()
  for (const holding of holdings) {
    const existing = byAsset.get(holding.asset) || []
    existing.push(holding)
    byAsset.set(holding.asset, existing)
  }

  for (const [asset, assetHoldings] of byAsset) {
    const totalQuantity = assetHoldings.reduce((sum, h) => sum + h.quantity, 0)
    const totalCostBasis = assetHoldings.reduce((sum, h) => sum + h.totalCostBasis, 0)
    const currentPrice = currentPrices.get(asset) || 0
    const currentValue = totalQuantity * currentPrice
    const unrealizedGain = currentValue - totalCostBasis

    results.push({
      asset,
      quantity: totalQuantity,
      costBasis: totalCostBasis,
      currentValue,
      unrealizedGain,
      unrealizedGainPercent: totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : 0
    })
  }

  return results
}

/**
 * Parse common cryptocurrency symbols to standard format
 */
export function normalizeAssetSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase()

  // Common aliases
  const aliases: Record<string, string> = {
    'BITCOIN': 'BTC',
    'ETHEREUM': 'ETH',
    'LITECOIN': 'LTC',
    'RIPPLE': 'XRP',
    'CARDANO': 'ADA',
    'POLKADOT': 'DOT',
    'DOGECOIN': 'DOGE',
    'SOLANA': 'SOL',
    'POLYGON': 'MATIC',
    'AVALANCHE': 'AVAX',
    'CHAINLINK': 'LINK',
    'UNISWAP': 'UNI'
  }

  return aliases[normalized] || normalized
}

/**
 * Format cryptocurrency quantity with appropriate decimal places
 */
export function formatCryptoQuantity(quantity: number, asset: string): string {
  // Common crypto decimal conventions
  const decimals: Record<string, number> = {
    'BTC': 8,
    'ETH': 8,
    'USDT': 2,
    'USDC': 2,
    'DAI': 2
  }

  const decimalPlaces = decimals[asset.toUpperCase()] ?? 6
  return quantity.toFixed(decimalPlaces)
}

/**
 * Validate if a string looks like a valid crypto asset symbol
 */
export function isValidAssetSymbol(symbol: string): boolean {
  // Asset symbols are typically 2-10 uppercase letters/numbers
  return /^[A-Z0-9]{2,10}$/.test(symbol.trim().toUpperCase())
}

/**
 * Calculate total income from staking, rewards, airdrops, etc.
 */
export function calculateCryptoIncome(
  transactions: CryptoTransaction[]
): {
  stakingRewards: number
  miningIncome: number
  airdropValue: number
  otherIncome: number
  totalIncome: number
} {
  let stakingRewards = 0
  let miningIncome = 0
  let airdropValue = 0
  let otherIncome = 0

  for (const tx of transactions) {
    switch (tx.type) {
      case 'income':
        stakingRewards += tx.totalValue
        break
      case 'mining':
        miningIncome += tx.totalValue
        break
      case 'airdrop':
      case 'fork':
        airdropValue += tx.totalValue
        break
      case 'gift_received':
        // Gifts received are not income, but tracked for cost basis
        break
      default:
        if (tx.type === 'receive' && tx.totalValue > 0) {
          // Received crypto with value might be income
          otherIncome += tx.totalValue
        }
    }
  }

  return {
    stakingRewards,
    miningIncome,
    airdropValue,
    otherIncome,
    totalIncome: stakingRewards + miningIncome + airdropValue + otherIncome
  }
}
