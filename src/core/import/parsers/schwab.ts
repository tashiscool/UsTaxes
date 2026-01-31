/**
 * Charles Schwab CSV Parser
 *
 * Parses CSV exports from Schwab brokerage accounts.
 * Supports the standard Gain/Loss report and 1099-B export formats.
 *
 * Typical columns:
 * - Symbol, Description
 * - Date Acquired, Date Sold
 * - Quantity, Proceeds, Cost Basis, Gain/Loss
 * - Term, Covered/Noncovered
 * - Wash Sale Loss Disallowed, Adjustment Code, Adjustment Amount
 */

import {
  BaseBrokerageParser,
  BrokerageTransaction,
  BrokerageType,
  ParseResult,
  ParseError,
  parseDate,
  parseCurrency,
  isShortTermTransaction
} from '../brokerageParser'

/**
 * Schwab column name variations
 */
const SCHWAB_COLUMN_MAPPINGS = {
  symbol: ['symbol', 'security', 'ticker'],
  description: ['description', 'security description', 'name', 'security name'],
  dateAcquired: ['date acquired', 'acquired date', 'acquisition date', 'open date'],
  dateSold: ['date sold', 'sold date', 'sale date', 'close date', 'disposal date'],
  quantity: ['quantity', 'qty', 'shares', 'units', 'number of shares'],
  proceeds: ['proceeds', 'sales proceeds', 'sale price', 'gross proceeds', 'amount'],
  costBasis: ['cost basis', 'cost', 'basis', 'adjusted cost basis', 'adjusted basis', 'original cost'],
  gainLoss: ['gain/loss', 'gain or loss', 'gain (loss)', 'realized gain/loss', 'gain/loss amount', 'short-term gain or loss', 'long-term gain or loss'],
  washSale: ['wash sale loss disallowed', 'wash sale', 'wash sale disallowed', 'wash sale adjustment', 'disallowed loss', 'wash sale loss'],
  term: ['term', 'short-term or long-term', 'holding period', 'type'],
  covered: ['covered', 'covered or noncovered', 'reporting category', 'covered/noncovered', 'box'],
  adjustmentCode: ['adjustment code', 'code', 'adj code'],
  adjustmentAmount: ['adjustment amount', 'adjustment', 'adj amount']
}

/**
 * Find column index by checking multiple possible header names
 */
function findColumn(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.includes(name))
    if (index >= 0) return index
  }
  return -1
}

export class SchwabParser extends BaseBrokerageParser {
  getBrokerageType(): BrokerageType {
    return 'schwab'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()

    // Check for Schwab-specific patterns
    const hasSchwabMarkers =
      content.toLowerCase().includes('schwab') ||
      content.toLowerCase().includes('charles schwab')

    // Check for common Schwab-specific columns
    const hasSchwabColumns =
      headerLine.includes('wash sale loss disallowed') ||
      (headerLine.includes('covered or noncovered') && headerLine.includes('date acquired'))

    // Check for expected columns
    const hasRequiredColumns =
      (headerLine.includes('date acquired') || headerLine.includes('acquired')) &&
      (headerLine.includes('date sold') || headerLine.includes('sold')) &&
      (headerLine.includes('proceeds') || headerLine.includes('sales')) &&
      (headerLine.includes('cost') || headerLine.includes('basis'))

    return hasSchwabMarkers || hasSchwabColumns || hasRequiredColumns
  }

  parse(content: string): ParseResult {
    const transactions: BrokerageTransaction[] = []
    const errors: ParseError[] = []
    const warnings: string[] = []

    const rows = this.parseCSV(content)
    if (rows.length < 2) {
      errors.push({ row: 0, message: 'CSV file is empty or has no data rows' })
      return { transactions, errors, warnings }
    }

    // Find header row (Schwab sometimes has info/disclaimer rows first)
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const rowLower = rows[i].map(c => c.toLowerCase())
      if (
        rowLower.some(c => c.includes('symbol') || c.includes('security')) &&
        rowLower.some(c => c.includes('date') && (c.includes('acquired') || c.includes('sold')))
      ) {
        headerRowIndex = i
        break
      }
    }

    const actualHeaders = rows[headerRowIndex].map(h => h.toLowerCase().trim())

    // Map columns
    const columnMap = {
      symbol: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.symbol),
      description: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.description),
      dateAcquired: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.dateAcquired),
      dateSold: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.dateSold),
      quantity: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.quantity),
      proceeds: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.proceeds),
      costBasis: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.costBasis),
      gainLoss: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.gainLoss),
      washSale: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.washSale),
      term: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.term),
      covered: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.covered),
      adjustmentCode: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.adjustmentCode),
      adjustmentAmount: findColumn(actualHeaders, SCHWAB_COLUMN_MAPPINGS.adjustmentAmount)
    }

    // Validate required columns
    if (columnMap.symbol < 0 && columnMap.description < 0) {
      errors.push({ row: headerRowIndex, column: 'symbol', message: 'Could not find Symbol or Description column' })
    }
    if (columnMap.dateAcquired < 0) {
      errors.push({ row: headerRowIndex, column: 'dateAcquired', message: 'Could not find Date Acquired column' })
    }
    if (columnMap.dateSold < 0) {
      errors.push({ row: headerRowIndex, column: 'dateSold', message: 'Could not find Date Sold column' })
    }
    if (columnMap.proceeds < 0) {
      errors.push({ row: headerRowIndex, column: 'proceeds', message: 'Could not find Proceeds column' })
    }
    if (columnMap.costBasis < 0) {
      errors.push({ row: headerRowIndex, column: 'costBasis', message: 'Could not find Cost Basis column' })
    }

    if (errors.length > 0) {
      return { transactions, errors, warnings }
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      // Skip empty rows or summary rows
      if (row.length === 0 || row.every(c => c === '')) continue
      if (row[0].toLowerCase().includes('total')) continue
      if (row[0].toLowerCase().includes('subtotal')) continue
      if (row[0].toLowerCase().includes('grand total')) continue

      try {
        // Get symbol from either symbol or description column
        let symbol = columnMap.symbol >= 0 ? row[columnMap.symbol] : ''
        const description = columnMap.description >= 0 ? row[columnMap.description] : ''

        // If no symbol, try to extract from description
        if (!symbol || symbol.trim() === '') {
          // Try to get symbol from parentheses in description: "APPLE INC (AAPL)"
          const symbolMatch = description.match(/\(([A-Z]+)\)/)
          if (symbolMatch) {
            symbol = symbolMatch[1]
          } else {
            symbol = description.slice(0, 20) // Use first 20 chars of description
          }
        }

        if (!symbol || symbol.trim() === '') {
          continue // Skip rows without identifiable security
        }

        // Parse dates - Schwab sometimes uses "Various" for multiple lots
        let dateAcquiredStr = row[columnMap.dateAcquired]
        const dateSoldStr = row[columnMap.dateSold]

        // Handle "Various" dates (multiple lots combined)
        if (dateAcquiredStr.toLowerCase() === 'various') {
          warnings.push(`Row ${i + 1}: "Various" date acquired - using sale date minus 1 year as estimate for ${symbol}`)
          const saleDate = parseDate(dateSoldStr)
          if (saleDate) {
            const estimatedAcquired = new Date(saleDate)
            estimatedAcquired.setFullYear(estimatedAcquired.getFullYear() - 1)
            dateAcquiredStr = `${estimatedAcquired.getMonth() + 1}/${estimatedAcquired.getDate()}/${estimatedAcquired.getFullYear()}`
          }
        }

        const dateAcquired = parseDate(dateAcquiredStr)
        const dateSold = parseDate(dateSoldStr)

        if (!dateAcquired) {
          errors.push({ row: i + 1, column: 'dateAcquired', message: `Invalid date acquired: ${dateAcquiredStr}` })
          continue
        }

        if (!dateSold) {
          errors.push({ row: i + 1, column: 'dateSold', message: `Invalid date sold: ${dateSoldStr}` })
          continue
        }

        const proceeds = parseCurrency(row[columnMap.proceeds])
        const costBasis = parseCurrency(row[columnMap.costBasis])
        const gainLoss = columnMap.gainLoss >= 0
          ? parseCurrency(row[columnMap.gainLoss])
          : proceeds - costBasis

        const quantity = columnMap.quantity >= 0
          ? parseFloat(row[columnMap.quantity].replace(/,/g, '')) || 1
          : 1

        const washSaleDisallowed = columnMap.washSale >= 0
          ? parseCurrency(row[columnMap.washSale])
          : undefined

        const adjustmentCode = columnMap.adjustmentCode >= 0 && row[columnMap.adjustmentCode]
          ? row[columnMap.adjustmentCode].trim()
          : undefined

        const adjustmentAmount = columnMap.adjustmentAmount >= 0
          ? parseCurrency(row[columnMap.adjustmentAmount])
          : undefined

        // Determine short-term vs long-term
        let isShortTerm = isShortTermTransaction(dateAcquired, dateSold)
        if (columnMap.term >= 0) {
          const termValue = row[columnMap.term].toLowerCase()
          if (termValue.includes('short')) isShortTerm = true
          else if (termValue.includes('long')) isShortTerm = false
        }

        // Determine covered status from box number or covered column
        let isCovered = true
        if (columnMap.covered >= 0) {
          const coveredValue = row[columnMap.covered].toLowerCase().trim()
          // Schwab uses A/B/C for covered short-term, D/E/F for covered long-term
          // Noncovered is typically labeled explicitly
          if (coveredValue === 'c' || coveredValue === 'f' || coveredValue.includes('noncovered') || coveredValue.includes('non-covered')) {
            isCovered = false
          } else if (coveredValue === 'a' || coveredValue === 'd' || coveredValue.includes('covered')) {
            isCovered = true
          }
        }

        const transaction: BrokerageTransaction = {
          symbol: symbol.trim().toUpperCase(),
          description: description || undefined,
          dateAcquired,
          dateSold,
          proceeds,
          costBasis,
          gainLoss,
          washSaleDisallowed: washSaleDisallowed && washSaleDisallowed !== 0 ? Math.abs(washSaleDisallowed) : undefined,
          isShortTerm,
          isCovered,
          quantity,
          adjustmentCode: adjustmentCode || undefined,
          adjustmentAmount: adjustmentAmount && adjustmentAmount !== 0 ? adjustmentAmount : undefined
        }

        transactions.push(transaction)

        // Add warning for wash sales
        if (washSaleDisallowed && washSaleDisallowed !== 0) {
          warnings.push(`Row ${i + 1}: Wash sale disallowed amount of $${Math.abs(washSaleDisallowed).toFixed(2)} for ${symbol}`)
        }

        // Add warning for adjustments
        if (adjustmentCode) {
          warnings.push(`Row ${i + 1}: Adjustment code "${adjustmentCode}" for ${symbol}` +
            (adjustmentAmount ? ` with amount $${adjustmentAmount.toFixed(2)}` : ''))
        }
      } catch (e) {
        errors.push({ row: i + 1, message: `Error parsing row: ${e instanceof Error ? e.message : String(e)}` })
      }
    }

    return { transactions, errors, warnings }
  }
}

export const schwabParser = new SchwabParser()
