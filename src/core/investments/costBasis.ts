/**
 * Cost Basis Calculation Engine
 *
 * Handles tracking of tax lots, calculation of cost basis,
 * holding period determination, and gain/loss calculations.
 */

import {
  TaxLot,
  TaxLotSelection,
  StockTransaction,
  StockTransactionType,
  Investment,
  CostBasisMethod,
  GainLossSummary,
  CostBasisPortfolio
} from 'ustaxes/core/data'
import { numberOfDaysBetween } from 'ustaxes/core/util'
import { detectWashSale, applyWashSaleAdjustment } from './washSale'

// One year in days for long-term capital gains threshold
const LONG_TERM_HOLDING_PERIOD_DAYS = 365

/**
 * Generate a unique ID for a tax lot or transaction
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Determine if a holding is long-term (held more than one year)
 */
export const isLongTermHolding = (
  purchaseDate: Date,
  saleDate: Date
): boolean => {
  return numberOfDaysBetween(purchaseDate, saleDate) > LONG_TERM_HOLDING_PERIOD_DAYS
}

/**
 * Calculate the cost basis for a single lot
 */
export const calculateLotCostBasis = (
  shares: number,
  costPerShare: number,
  fees: number
): number => {
  return shares * costPerShare + fees
}

/**
 * Create a new tax lot from a purchase transaction
 */
export const createTaxLot = (
  transaction: StockTransaction<Date>,
  isMutualFund = false
): TaxLot<Date> => {
  const totalCost = calculateLotCostBasis(
    transaction.shares,
    transaction.pricePerShare,
    transaction.fees
  )

  return {
    id: generateId(),
    symbol: transaction.symbol,
    purchaseDate: transaction.date,
    shares: transaction.shares,
    costPerShare: transaction.pricePerShare,
    fees: transaction.fees,
    totalCost,
    remainingShares: transaction.shares,
    adjustedCostBasis: totalCost,
    washSaleAdjustment: 0,
    washSaleDisallowedLoss: 0,
    sourceTransactionId: transaction.id,
    isMutualFund
  }
}

/**
 * Sort lots by purchase date (oldest first for FIFO)
 */
export const sortLotsByDateAsc = (lots: TaxLot<Date>[]): TaxLot<Date>[] => {
  return [...lots].sort((a, b) =>
    a.purchaseDate.getTime() - b.purchaseDate.getTime()
  )
}

/**
 * Sort lots by purchase date (newest first for LIFO)
 */
export const sortLotsByDateDesc = (lots: TaxLot<Date>[]): TaxLot<Date>[] => {
  return [...lots].sort((a, b) =>
    b.purchaseDate.getTime() - a.purchaseDate.getTime()
  )
}

/**
 * Select lots using FIFO method
 */
export const selectLotsFIFO = (
  lots: TaxLot<Date>[],
  sharesToSell: number
): TaxLotSelection[] => {
  const sortedLots = sortLotsByDateAsc(lots.filter(l => l.remainingShares > 0))
  return selectLotsFromSorted(sortedLots, sharesToSell)
}

/**
 * Select lots using LIFO method
 */
export const selectLotsLIFO = (
  lots: TaxLot<Date>[],
  sharesToSell: number
): TaxLotSelection[] => {
  const sortedLots = sortLotsByDateDesc(lots.filter(l => l.remainingShares > 0))
  return selectLotsFromSorted(sortedLots, sharesToSell)
}

/**
 * Helper to select lots from a pre-sorted list
 */
const selectLotsFromSorted = (
  sortedLots: TaxLot<Date>[],
  sharesToSell: number
): TaxLotSelection[] => {
  const selections: TaxLotSelection[] = []
  let remainingToSell = sharesToSell

  for (const lot of sortedLots) {
    if (remainingToSell <= 0) break

    const sharesToTake = Math.min(lot.remainingShares, remainingToSell)
    selections.push({
      lotId: lot.id,
      sharesFromLot: sharesToTake
    })
    remainingToSell -= sharesToTake
  }

  return selections
}

/**
 * Select lots automatically based on method
 */
export const selectLotsByMethod = (
  lots: TaxLot<Date>[],
  sharesToSell: number,
  method: CostBasisMethod
): TaxLotSelection[] => {
  switch (method) {
    case CostBasisMethod.FIFO:
      return selectLotsFIFO(lots, sharesToSell)
    case CostBasisMethod.LIFO:
      return selectLotsLIFO(lots, sharesToSell)
    case CostBasisMethod.AverageCost:
      // For average cost, we still need to identify lots for record-keeping
      return selectLotsFIFO(lots, sharesToSell)
    case CostBasisMethod.SpecificID:
      // For specific ID, selections must be provided by the user
      throw new Error('Specific ID method requires manual lot selection')
    default:
      return selectLotsFIFO(lots, sharesToSell)
  }
}

/**
 * Calculate average cost per share for mutual funds
 */
export const calculateAverageCost = (lots: TaxLot<Date>[]): number => {
  const activeLots = lots.filter(l => l.remainingShares > 0)
  if (activeLots.length === 0) return 0

  const totalCost = activeLots.reduce((sum, lot) => {
    const proportionalCost = (lot.adjustedCostBasis * lot.remainingShares) / lot.shares
    return sum + proportionalCost
  }, 0)

  const totalShares = activeLots.reduce((sum, lot) => sum + lot.remainingShares, 0)
  return totalShares > 0 ? totalCost / totalShares : 0
}

/**
 * Calculate cost basis for a sale transaction
 */
export const calculateSaleCostBasis = (
  lots: TaxLot<Date>[],
  selections: TaxLotSelection[],
  method: CostBasisMethod
): number => {
  if (method === CostBasisMethod.AverageCost) {
    const avgCost = calculateAverageCost(lots)
    const totalShares = selections.reduce((sum, s) => sum + s.sharesFromLot, 0)
    return avgCost * totalShares
  }

  // For FIFO, LIFO, and Specific ID, calculate from selected lots
  return selections.reduce((total, selection) => {
    const lot = lots.find(l => l.id === selection.lotId)
    if (!lot) return total

    const costPerShareWithFees = lot.adjustedCostBasis / lot.shares
    return total + (costPerShareWithFees * selection.sharesFromLot)
  }, 0)
}

/**
 * Determine holding period for selected lots
 * Returns true if any portion is short-term
 */
export const hasShortTermPortion = (
  lots: TaxLot<Date>[],
  selections: TaxLotSelection[],
  saleDate: Date
): boolean => {
  return selections.some(selection => {
    const lot = lots.find(l => l.id === selection.lotId)
    if (!lot) return false
    return !isLongTermHolding(lot.purchaseDate, saleDate)
  })
}

/**
 * Calculate gain/loss for a sale, split by holding period
 */
export interface SaleGainLoss {
  shortTermGain: number
  shortTermCostBasis: number
  shortTermProceeds: number
  longTermGain: number
  longTermCostBasis: number
  longTermProceeds: number
  totalGain: number
  isWashSale: boolean
  washSaleDisallowedLoss: number
}

export const calculateSaleGainLoss = (
  lots: TaxLot<Date>[],
  selections: TaxLotSelection[],
  saleDate: Date,
  proceeds: number,
  method: CostBasisMethod
): SaleGainLoss => {
  let shortTermCostBasis = 0
  let shortTermShares = 0
  let longTermCostBasis = 0
  let longTermShares = 0
  const totalShares = selections.reduce((sum, s) => sum + s.sharesFromLot, 0)

  if (method === CostBasisMethod.AverageCost) {
    const avgCost = calculateAverageCost(lots)
    // For average cost, use the earliest lot's date to determine holding period
    const activeLots = lots.filter(l => l.remainingShares > 0)
    const sortedActiveLots = sortLotsByDateAsc(activeLots)
    const oldestLot = sortedActiveLots.length > 0 ? sortedActiveLots[0] : undefined
    if (oldestLot && isLongTermHolding(oldestLot.purchaseDate, saleDate)) {
      longTermCostBasis = avgCost * totalShares
      longTermShares = totalShares
    } else {
      shortTermCostBasis = avgCost * totalShares
      shortTermShares = totalShares
    }
  } else {
    // Calculate for each selected lot
    for (const selection of selections) {
      const lot = lots.find(l => l.id === selection.lotId)
      if (!lot) continue

      const costPerShareWithFees = lot.adjustedCostBasis / lot.shares
      const cost = costPerShareWithFees * selection.sharesFromLot

      if (isLongTermHolding(lot.purchaseDate, saleDate)) {
        longTermCostBasis += cost
        longTermShares += selection.sharesFromLot
      } else {
        shortTermCostBasis += cost
        shortTermShares += selection.sharesFromLot
      }
    }
  }

  // Allocate proceeds proportionally
  const shortTermProceeds = totalShares > 0
    ? (proceeds * shortTermShares) / totalShares
    : 0
  const longTermProceeds = totalShares > 0
    ? (proceeds * longTermShares) / totalShares
    : 0

  const shortTermGain = shortTermProceeds - shortTermCostBasis
  const longTermGain = longTermProceeds - longTermCostBasis
  const totalGain = shortTermGain + longTermGain

  return {
    shortTermGain,
    shortTermCostBasis,
    shortTermProceeds,
    longTermGain,
    longTermCostBasis,
    longTermProceeds,
    totalGain,
    isWashSale: false,
    washSaleDisallowedLoss: 0
  }
}

/**
 * Apply a sale to lots, reducing remaining shares
 */
export const applyLotSelections = (
  lots: TaxLot<Date>[],
  selections: TaxLotSelection[]
): TaxLot<Date>[] => {
  return lots.map(lot => {
    const selection = selections.find(s => s.lotId === lot.id)
    if (!selection) return lot

    return {
      ...lot,
      remainingShares: lot.remainingShares - selection.sharesFromLot
    }
  })
}

/**
 * Handle stock split by adjusting shares and cost per share
 */
export const applyStockSplit = (
  lots: TaxLot<Date>[],
  symbol: string,
  splitRatio: number // e.g., 2 for a 2:1 split
): TaxLot<Date>[] => {
  return lots.map(lot => {
    if (lot.symbol !== symbol) return lot

    const newShares = lot.shares * splitRatio
    const newRemainingShares = lot.remainingShares * splitRatio
    const newCostPerShare = lot.costPerShare / splitRatio

    return {
      ...lot,
      shares: newShares,
      remainingShares: newRemainingShares,
      costPerShare: newCostPerShare
      // totalCost and adjustedCostBasis remain the same
    }
  })
}

/**
 * Calculate unrealized gains/losses for current holdings
 */
export const calculateUnrealizedGains = (
  lots: TaxLot<Date>[],
  currentPrice: number,
  asOfDate: Date = new Date()
): { shortTerm: number; longTerm: number; total: number } => {
  let shortTerm = 0
  let longTerm = 0

  for (const lot of lots) {
    if (lot.remainingShares <= 0) continue

    const costPerShareWithFees = lot.adjustedCostBasis / lot.shares
    const unrealizedForLot =
      (currentPrice - costPerShareWithFees) * lot.remainingShares

    if (isLongTermHolding(lot.purchaseDate, asOfDate)) {
      longTerm += unrealizedForLot
    } else {
      shortTerm += unrealizedForLot
    }
  }

  return {
    shortTerm,
    longTerm,
    total: shortTerm + longTerm
  }
}

/**
 * Get summary of gains/losses for tax year (Form 8949/Schedule D)
 */
export const calculateGainLossSummary = (
  transactions: StockTransaction<Date>[],
  taxYear: number
): GainLossSummary => {
  const summary: GainLossSummary = {
    shortTermProceeds: 0,
    shortTermCostBasis: 0,
    shortTermGainLoss: 0,
    shortTermWashSaleAdjustment: 0,
    longTermProceeds: 0,
    longTermCostBasis: 0,
    longTermGainLoss: 0,
    longTermWashSaleAdjustment: 0
  }

  const salesInYear = transactions.filter(t =>
    t.transactionType === StockTransactionType.Sell &&
    t.date.getFullYear() === taxYear
  )

  for (const sale of salesInYear) {
    if (sale.isShortTerm) {
      summary.shortTermProceeds += sale.proceeds ?? 0
      summary.shortTermCostBasis += sale.costBasis ?? 0
      summary.shortTermGainLoss += sale.gainLoss ?? 0
      summary.shortTermWashSaleAdjustment += sale.washSaleDisallowedLoss ?? 0
    } else {
      summary.longTermProceeds += sale.proceeds ?? 0
      summary.longTermCostBasis += sale.costBasis ?? 0
      summary.longTermGainLoss += sale.gainLoss ?? 0
      summary.longTermWashSaleAdjustment += sale.washSaleDisallowedLoss ?? 0
    }
  }

  return summary
}

/**
 * Create an investment from a list of lots and transactions
 */
export const createInvestment = (
  symbol: string,
  lots: TaxLot<Date>[],
  transactions: StockTransaction<Date>[],
  isMutualFund = false,
  name?: string,
  currentPrice?: number
): Investment<Date> => {
  const activeLots = lots.filter(l => l.remainingShares > 0)
  const totalShares = activeLots.reduce((sum, l) => sum + l.remainingShares, 0)
  const totalCostBasis = activeLots.reduce((sum, l) => {
    const proportionalCost = (l.adjustedCostBasis * l.remainingShares) / l.shares
    return sum + proportionalCost
  }, 0)
  const averageCostPerShare = totalShares > 0 ? totalCostBasis / totalShares : 0

  let unrealizedGainLoss: number | undefined
  if (currentPrice !== undefined) {
    const { total } = calculateUnrealizedGains(lots, currentPrice)
    unrealizedGainLoss = total
  }

  return {
    symbol,
    name,
    isMutualFund,
    lots,
    transactions,
    totalShares,
    totalCostBasis,
    averageCostPerShare,
    currentPrice,
    unrealizedGainLoss,
    defaultCostBasisMethod: isMutualFund
      ? CostBasisMethod.AverageCost
      : CostBasisMethod.FIFO
  }
}

/**
 * Process a buy transaction and add to portfolio
 */
export const processBuyTransaction = (
  portfolio: CostBasisPortfolio<Date>,
  transaction: StockTransaction<Date>
): CostBasisPortfolio<Date> => {
  const newLot = createTaxLot(transaction)

  // Find existing investment for this symbol
  const existingInvestmentIndex = portfolio.investments.findIndex(
    i => i.symbol === transaction.symbol
  )

  if (existingInvestmentIndex >= 0) {
    // Add lot to existing investment
    const investment = portfolio.investments[existingInvestmentIndex]
    const updatedLots = [...investment.lots, newLot]
    const updatedTransactions = [...investment.transactions, transaction]
    const updatedInvestment = createInvestment(
      investment.symbol,
      updatedLots,
      updatedTransactions,
      investment.isMutualFund,
      investment.name,
      investment.currentPrice
    )

    const updatedInvestments = [...portfolio.investments]
    updatedInvestments[existingInvestmentIndex] = updatedInvestment

    return {
      ...portfolio,
      investments: updatedInvestments,
      lastUpdated: new Date()
    }
  } else {
    // Create new investment
    const newInvestment = createInvestment(
      transaction.symbol,
      [newLot],
      [transaction]
    )

    return {
      ...portfolio,
      investments: [...portfolio.investments, newInvestment],
      lastUpdated: new Date()
    }
  }
}

/**
 * Process a sell transaction
 */
export const processSellTransaction = (
  portfolio: CostBasisPortfolio<Date>,
  transaction: StockTransaction<Date>,
  lotSelections?: TaxLotSelection[],
  method?: CostBasisMethod
): CostBasisPortfolio<Date> => {
  const investmentIndex = portfolio.investments.findIndex(
    i => i.symbol === transaction.symbol
  )

  if (investmentIndex < 0) {
    throw new Error(`No holdings found for symbol ${transaction.symbol}`)
  }

  const investment = portfolio.investments[investmentIndex]
  const sellMethod = method ?? investment.defaultCostBasisMethod

  // Select lots if not provided
  const selections = lotSelections ?? selectLotsByMethod(
    investment.lots,
    transaction.shares,
    sellMethod
  )

  // Calculate proceeds
  const proceeds = transaction.pricePerShare * transaction.shares - transaction.fees

  // Calculate gain/loss
  const gainLossResult = calculateSaleGainLoss(
    investment.lots,
    selections,
    transaction.date,
    proceeds,
    sellMethod
  )

  // Check for wash sales
  const allTransactions = [...investment.transactions, transaction]
  const washSaleInfo = detectWashSale(
    transaction,
    allTransactions,
    investment.lots
  )

  // Update the transaction with calculated values
  const updatedTransaction: StockTransaction<Date> = {
    ...transaction,
    proceeds,
    costBasis: gainLossResult.shortTermCostBasis + gainLossResult.longTermCostBasis,
    lotSelections: selections,
    gainLoss: gainLossResult.totalGain,
    isShortTerm: gainLossResult.shortTermCostBasis > 0 && gainLossResult.longTermCostBasis === 0,
    isWashSale: washSaleInfo.isWashSale,
    washSaleDisallowedLoss: washSaleInfo.disallowedLoss
  }

  // Apply selections to reduce lot shares
  let updatedLots = applyLotSelections(investment.lots, selections)

  // Apply wash sale adjustments if needed
  if (washSaleInfo.isWashSale && washSaleInfo.matchingLotId) {
    updatedLots = applyWashSaleAdjustment(
      updatedLots,
      washSaleInfo.matchingLotId,
      washSaleInfo.disallowedLoss
    )
  }

  const updatedTransactions = [...investment.transactions, updatedTransaction]
  const updatedInvestment = createInvestment(
    investment.symbol,
    updatedLots,
    updatedTransactions,
    investment.isMutualFund,
    investment.name,
    investment.currentPrice
  )

  const updatedInvestments = [...portfolio.investments]
  updatedInvestments[investmentIndex] = updatedInvestment

  return {
    ...portfolio,
    investments: updatedInvestments,
    lastUpdated: new Date()
  }
}

/**
 * Get tax lot preview for sale planning
 */
export interface TaxLotPreview {
  lot: TaxLot<Date>
  isLongTerm: boolean
  unrealizedGain: number
  daysHeld: number
  daysUntilLongTerm: number
}

export const getTaxLotPreviews = (
  lots: TaxLot<Date>[],
  currentPrice: number,
  asOfDate: Date = new Date()
): TaxLotPreview[] => {
  return lots
    .filter(l => l.remainingShares > 0)
    .map(lot => {
      const daysHeld = numberOfDaysBetween(lot.purchaseDate, asOfDate)
      const isLongTerm = daysHeld > LONG_TERM_HOLDING_PERIOD_DAYS
      const costPerShare = lot.adjustedCostBasis / lot.shares
      const unrealizedGain = (currentPrice - costPerShare) * lot.remainingShares
      const daysUntilLongTerm = isLongTerm
        ? 0
        : LONG_TERM_HOLDING_PERIOD_DAYS - daysHeld + 1

      return {
        lot,
        isLongTerm,
        unrealizedGain,
        daysHeld,
        daysUntilLongTerm
      }
    })
}
