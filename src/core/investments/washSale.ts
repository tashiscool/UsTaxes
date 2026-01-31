/**
 * Wash Sale Detection and Adjustment
 *
 * Implements IRS wash sale rules:
 * - A wash sale occurs when you sell stock at a loss and buy
 *   substantially identical stock within 30 days before or after the sale
 * - The disallowed loss is added to the cost basis of the replacement stock
 */

import {
  TaxLot,
  StockTransaction,
  StockTransactionType,
  WashSaleInfo
} from 'ustaxes/core/data'
import { numberOfDaysBetween } from 'ustaxes/core/util'

// IRS wash sale window is 30 days before and after the sale
const WASH_SALE_WINDOW_DAYS = 30

/**
 * Check if two dates are within the wash sale window (61-day period)
 * The window is 30 days before, the day of sale, and 30 days after
 */
export const isWithinWashSaleWindow = (
  saleDate: Date,
  purchaseDate: Date
): boolean => {
  const daysDiff = numberOfDaysBetween(saleDate, purchaseDate)
  // Allow for both directions: purchase before or after sale
  return Math.abs(daysDiff) <= WASH_SALE_WINDOW_DAYS
}

/**
 * Find purchases that could trigger a wash sale for a given sale
 */
export const findReplacementPurchases = (
  saleTransaction: StockTransaction<Date>,
  allTransactions: StockTransaction<Date>[]
): StockTransaction<Date>[] => {
  const saleDate = saleTransaction.date
  const symbol = saleTransaction.symbol

  return allTransactions.filter(t => {
    // Must be a buy or dividend reinvestment
    if (
      t.transactionType !== StockTransactionType.Buy &&
      t.transactionType !== StockTransactionType.DividendReinvestment
    ) {
      return false
    }

    // Must be the same symbol
    if (t.symbol !== symbol) {
      return false
    }

    // Must not be the same transaction
    if (t.id === saleTransaction.id) {
      return false
    }

    // Must be within the wash sale window
    return isWithinWashSaleWindow(saleDate, t.date)
  })
}

/**
 * Find tax lots created from purchases within the wash sale window
 */
export const findReplacementLots = (
  saleTransaction: StockTransaction<Date>,
  allTransactions: StockTransaction<Date>[],
  lots: TaxLot<Date>[]
): TaxLot<Date>[] => {
  const replacementPurchases = findReplacementPurchases(saleTransaction, allTransactions)
  const replacementTransactionIds = new Set(replacementPurchases.map(t => t.id))

  return lots.filter(lot =>
    lot.sourceTransactionId &&
    replacementTransactionIds.has(lot.sourceTransactionId) &&
    lot.remainingShares > 0
  )
}

/**
 * Detect if a sale triggers the wash sale rule
 */
export const detectWashSale = (
  saleTransaction: StockTransaction<Date>,
  allTransactions: StockTransaction<Date>[],
  lots: TaxLot<Date>[]
): WashSaleInfo => {
  // Only applies if the sale resulted in a loss
  const proceeds = saleTransaction.proceeds ?? 0
  const costBasis = saleTransaction.costBasis ?? 0
  const gainLoss = proceeds - costBasis

  if (gainLoss >= 0) {
    return {
      isWashSale: false,
      disallowedLoss: 0,
      adjustmentToNewLot: 0,
      washSaleDate: saleTransaction.date,
      replacementDate: saleTransaction.date
    }
  }

  const loss = Math.abs(gainLoss)

  // Find replacement purchases
  const replacementLots = findReplacementLots(saleTransaction, allTransactions, lots)

  if (replacementLots.length === 0) {
    return {
      isWashSale: false,
      disallowedLoss: 0,
      adjustmentToNewLot: 0,
      washSaleDate: saleTransaction.date,
      replacementDate: saleTransaction.date
    }
  }

  // Find the lot that most closely matches the wash sale
  // Priority: lot purchased after sale, then lot purchased before sale
  const sortedLots = replacementLots.sort((a, b) => {
    const aDiff = numberOfDaysBetween(saleTransaction.date, a.purchaseDate)
    const bDiff = numberOfDaysBetween(saleTransaction.date, b.purchaseDate)

    // Prefer lots purchased after the sale (positive diff)
    if (aDiff >= 0 && bDiff < 0) return -1
    if (bDiff >= 0 && aDiff < 0) return 1

    // Otherwise, prefer the closest in time
    return Math.abs(aDiff) - Math.abs(bDiff)
  })

  const matchingLot = sortedLots[0]

  // Calculate disallowed loss
  // The disallowed amount is the lesser of:
  // 1. The loss on the sale
  // 2. The cost of replacement shares up to the number of shares sold
  const sharesReplaced = Math.min(
    saleTransaction.shares,
    matchingLot.remainingShares
  )
  const proportionalLoss = (loss * sharesReplaced) / saleTransaction.shares
  const disallowedLoss = Math.min(loss, proportionalLoss)

  return {
    isWashSale: true,
    matchingLotId: matchingLot.id,
    disallowedLoss,
    adjustmentToNewLot: disallowedLoss,
    washSaleDate: saleTransaction.date,
    replacementDate: matchingLot.purchaseDate
  }
}

/**
 * Apply wash sale adjustment to a replacement lot
 * The disallowed loss is added to the cost basis of the replacement shares
 */
export const applyWashSaleAdjustment = (
  lots: TaxLot<Date>[],
  lotId: string,
  adjustmentAmount: number
): TaxLot<Date>[] => {
  return lots.map(lot => {
    if (lot.id !== lotId) return lot

    return {
      ...lot,
      adjustedCostBasis: lot.adjustedCostBasis + adjustmentAmount,
      washSaleAdjustment: lot.washSaleAdjustment + adjustmentAmount
    }
  })
}

/**
 * Calculate total wash sale disallowed losses for a tax year
 */
export const calculateWashSaleLosses = (
  transactions: StockTransaction<Date>[],
  taxYear: number
): number => {
  return transactions
    .filter(t =>
      t.transactionType === StockTransactionType.Sell &&
      t.date.getFullYear() === taxYear &&
      t.isWashSale
    )
    .reduce((total, t) => total + (t.washSaleDisallowedLoss ?? 0), 0)
}

/**
 * Get all wash sale transactions for reporting
 */
export interface WashSaleReport {
  saleDate: Date
  symbol: string
  shares: number
  proceedsPerShare: number
  costBasisPerShare: number
  lossPerShare: number
  disallowedLossPerShare: number
  replacementDate: Date
  adjustedBasisPerShare: number
}

export const getWashSaleReport = (
  transactions: StockTransaction<Date>[],
  lots: TaxLot<Date>[],
  taxYear: number
): WashSaleReport[] => {
  const washSaleTransactions = transactions.filter(t =>
    t.transactionType === StockTransactionType.Sell &&
    t.date.getFullYear() === taxYear &&
    t.isWashSale
  )

  return washSaleTransactions.map(sale => {
    // Find the replacement lot
    const replacementLot = lots.find(l =>
      l.washSaleAdjustment > 0 &&
      sale.lotSelections?.some(s => s.lotId === l.id)
    )

    const proceeds = sale.proceeds ?? 0
    const costBasis = sale.costBasis ?? 0
    const loss = costBasis - proceeds
    const disallowedLoss = sale.washSaleDisallowedLoss ?? 0

    return {
      saleDate: sale.date,
      symbol: sale.symbol,
      shares: sale.shares,
      proceedsPerShare: sale.pricePerShare,
      costBasisPerShare: costBasis / sale.shares,
      lossPerShare: loss / sale.shares,
      disallowedLossPerShare: disallowedLoss / sale.shares,
      replacementDate: replacementLot?.purchaseDate ?? sale.date,
      adjustedBasisPerShare: replacementLot
        ? replacementLot.adjustedCostBasis / replacementLot.shares
        : 0
    }
  })
}

/**
 * Check if a potential purchase would trigger a wash sale
 * given recent sales with losses
 */
export const wouldTriggerWashSale = (
  symbol: string,
  purchaseDate: Date,
  recentTransactions: StockTransaction<Date>[]
): { wouldTrigger: boolean; affectedSales: StockTransaction<Date>[] } => {
  const affectedSales = recentTransactions.filter(t => {
    // Must be a sale
    if (t.transactionType !== StockTransactionType.Sell) return false

    // Must be the same symbol
    if (t.symbol !== symbol) return false

    // Must have been a loss
    const gainLoss = (t.proceeds ?? 0) - (t.costBasis ?? 0)
    if (gainLoss >= 0) return false

    // Must be within the wash sale window
    return isWithinWashSaleWindow(t.date, purchaseDate)
  })

  return {
    wouldTrigger: affectedSales.length > 0,
    affectedSales
  }
}

/**
 * Project the holding period for a wash sale replacement lot
 * The holding period includes the period of the original shares
 */
export const getWashSaleHoldingPeriod = (
  originalPurchaseDate: Date,
  replacementPurchaseDate: Date,
  saleDate: Date
): Date => {
  // The holding period starts from the original purchase date
  // but we need to exclude the day of sale
  const originalHoldingDays = numberOfDaysBetween(originalPurchaseDate, saleDate)

  // Add the original holding period to the replacement purchase date
  const adjustedStartDate = new Date(replacementPurchaseDate)
  adjustedStartDate.setDate(adjustedStartDate.getDate() - originalHoldingDays)

  return adjustedStartDate
}
