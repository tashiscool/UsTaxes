/**
 * Brokerage CSV Parser - Core parsing logic for brokerage transaction imports
 *
 * This module provides:
 * - Generic CSV parsing infrastructure
 * - Automatic brokerage format detection
 * - Transaction normalization to a common format
 * - Support for Form 8949 and Schedule D population
 */

import { Asset, AssetType } from 'ustaxes/core/data'

/**
 * Represents a parsed brokerage transaction before being converted to an Asset
 */
export interface BrokerageTransaction {
  symbol: string
  description?: string
  dateAcquired: Date
  dateSold: Date
  proceeds: number
  costBasis: number
  gainLoss: number
  washSaleDisallowed?: number
  isShortTerm: boolean
  isCovered: boolean
  adjustmentCode?: string
  adjustmentAmount?: number
  quantity?: number
}

/**
 * Supported brokerage formats
 */
export type BrokerageType =
  | 'tdAmeritrade'
  | 'schwab'
  | 'fidelity'
  | 'generic'

/**
 * Column mapping configuration for generic CSV parsing
 */
export interface ColumnMapping {
  symbol: number
  description?: number
  dateAcquired: number
  dateSold: number
  proceeds: number
  costBasis: number
  gainLoss?: number
  washSaleDisallowed?: number
  quantity?: number
  adjustmentCode?: number
  adjustmentAmount?: number
}

/**
 * Result of parsing a CSV file
 */
export interface ParseResult {
  transactions: BrokerageTransaction[]
  errors: ParseError[]
  warnings: string[]
}

/**
 * Error encountered during parsing
 */
export interface ParseError {
  row: number
  column?: string
  message: string
}

/**
 * Parser interface that all brokerage-specific parsers must implement
 */
export interface BrokerageParser {
  /**
   * Parse CSV content into transactions
   */
  parse(content: string): ParseResult

  /**
   * Check if this parser can handle the given CSV content
   */
  canParse(content: string, headers: string[]): boolean

  /**
   * Get the brokerage type
   */
  getBrokerageType(): BrokerageType
}

/**
 * Parses a date string in various common formats
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null
  }

  const cleaned = dateStr.trim()

  // MM/DD/YYYY or MM/DD/YY
  const usFormat = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (usFormat) {
    const month = parseInt(usFormat[1], 10)
    const day = parseInt(usFormat[2], 10)
    let year = parseInt(usFormat[3], 10)
    if (year < 100) {
      year += year < 50 ? 2000 : 1900
    }
    return new Date(year, month - 1, day)
  }

  // YYYY-MM-DD
  const isoFormat = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoFormat) {
    const year = parseInt(isoFormat[1], 10)
    const month = parseInt(isoFormat[2], 10)
    const day = parseInt(isoFormat[3], 10)
    return new Date(year, month - 1, day)
  }

  // Try native Date parsing as fallback
  const nativeDate = new Date(cleaned)
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate
  }

  return null
}

/**
 * Parses a currency string to a number
 */
export function parseCurrency(value: string): number {
  if (!value || value.trim() === '') {
    return 0
  }

  // Remove currency symbols, commas, spaces, and parentheses (for negative)
  let cleaned = value.trim()
    .replace(/[$,\s]/g, '')

  // Handle parentheses for negative numbers
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    return 0
  }

  return isNegative ? -num : num
}

/**
 * Determines if a transaction is short-term based on dates
 * Short-term: held for 1 year or less (365 days)
 */
export function isShortTermTransaction(dateAcquired: Date, dateSold: Date): boolean {
  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  return (dateSold.getTime() - dateAcquired.getTime()) <= oneYearMs
}

/**
 * Converts a BrokerageTransaction to an Asset for storage
 */
export function transactionToAsset(
  transaction: BrokerageTransaction
): Asset<Date> {
  const quantity = transaction.quantity ?? 1
  const openPrice = transaction.costBasis / quantity
  const closePrice = transaction.proceeds / quantity

  return {
    name: transaction.symbol + (transaction.description ? ` - ${transaction.description}` : ''),
    positionType: 'Security' as AssetType,
    openDate: transaction.dateAcquired,
    closeDate: transaction.dateSold,
    openPrice: openPrice,
    closePrice: closePrice,
    openFee: 0,
    closeFee: 0,
    quantity: quantity
  }
}

/**
 * Converts multiple transactions to Assets
 */
export function transactionsToAssets(
  transactions: BrokerageTransaction[]
): Asset<Date>[] {
  return transactions.map(transactionToAsset)
}

/**
 * Base class for CSV parsing with common utilities
 */
export abstract class BaseBrokerageParser implements BrokerageParser {
  protected parseCSV(content: string): string[][] {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      const nextChar = content[i + 1]

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          currentCell += '"'
          i++
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false
        } else {
          currentCell += char
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true
        } else if (char === ',') {
          // End of cell
          currentRow.push(currentCell.trim())
          currentCell = ''
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          // End of row
          currentRow.push(currentCell.trim())
          if (currentRow.some(cell => cell !== '')) {
            rows.push(currentRow)
          }
          currentRow = []
          currentCell = ''
          if (char === '\r') i++
        } else if (char !== '\r') {
          currentCell += char
        }
      }
    }

    // Don't forget the last cell/row
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim())
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow)
      }
    }

    return rows
  }

  protected getHeaders(rows: string[][]): string[] {
    return rows.length > 0 ? rows[0].map(h => h.toLowerCase().trim()) : []
  }

  abstract parse(content: string): ParseResult
  abstract canParse(content: string, headers: string[]): boolean
  abstract getBrokerageType(): BrokerageType
}

/**
 * Detects the brokerage type from CSV content
 */
export function detectBrokerageType(content: string): BrokerageType | null {
  const lines = content.split('\n').slice(0, 10)
  const headerLine = lines[0]?.toLowerCase() ?? ''

  // TD Ameritrade specific headers
  if (
    headerLine.includes('trade date') &&
    headerLine.includes('settlement date') &&
    (headerLine.includes('td ameritrade') || headerLine.includes('action'))
  ) {
    return 'tdAmeritrade'
  }

  // Schwab specific headers
  if (
    headerLine.includes('date acquired') &&
    headerLine.includes('date sold') &&
    (headerLine.includes('schwab') || headerLine.includes('wash sale loss disallowed'))
  ) {
    return 'schwab'
  }

  // Fidelity specific headers
  if (
    headerLine.includes('date acquired') &&
    headerLine.includes('date sold') &&
    (headerLine.includes('fidelity') || headerLine.includes('1099-b'))
  ) {
    return 'fidelity'
  }

  // Check content for brokerage mentions
  const fullContent = lines.join('\n').toLowerCase()
  if (fullContent.includes('td ameritrade')) return 'tdAmeritrade'
  if (fullContent.includes('charles schwab') || fullContent.includes('schwab')) return 'schwab'
  if (fullContent.includes('fidelity')) return 'fidelity'

  return null
}
