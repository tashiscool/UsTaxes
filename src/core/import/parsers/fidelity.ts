/**
 * Fidelity CSV Parser
 *
 * Parses CSV exports from Fidelity brokerage accounts.
 * Supports the standard Realized Gain/Loss report and 1099-B export formats.
 *
 * Typical columns:
 * - Symbol, Security Description
 * - Date Acquired, Date Sold
 * - Quantity, Proceeds, Cost Basis, Gain/Loss
 * - Term (Short/Long), Type (Covered/Noncovered)
 * - Wash Sale Loss Disallowed
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
 * Fidelity column name variations
 */
const FIDELITY_COLUMN_MAPPINGS = {
  symbol: ['symbol', 'ticker', 'security identifier'],
  description: ['description', 'security description', 'security name', 'name', 'investment'],
  dateAcquired: ['date acquired', 'acquired', 'acquisition date', 'purchase date', 'open date'],
  dateSold: ['date sold', 'sold', 'sale date', 'close date', 'disposal date'],
  quantity: ['quantity', 'qty', 'shares', 'units', 'share quantity'],
  proceeds: ['proceeds', 'sales proceeds', 'sale proceeds', 'gross proceeds', 'total proceeds'],
  costBasis: ['cost basis', 'cost', 'basis', 'cost per share', 'adjusted cost basis', 'total cost'],
  gainLoss: ['gain/loss', 'gain or loss', 'gain (loss)', 'realized gain/loss', 'short-term gain/loss', 'long-term gain/loss', 'total gain/loss'],
  washSale: ['wash sale loss disallowed', 'wash sale', 'wash sale adjustment', 'disallowed wash sale loss'],
  term: ['term', 'short term or long term', 'holding period', 'st/lt'],
  type: ['type', 'covered', 'covered/noncovered', '1099-b type', 'box', 'reporting category'],
  adjustmentCode: ['code', 'adjustment code', 'adj code'],
  adjustmentAmount: ['adjustment', 'adjustment amount', 'adj amount']
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

export class FidelityParser extends BaseBrokerageParser {
  getBrokerageType(): BrokerageType {
    return 'fidelity'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()

    // Check for Fidelity-specific patterns
    const hasFidelityMarkers =
      content.toLowerCase().includes('fidelity') ||
      content.toLowerCase().includes('fidelity investments')

    // Check for common Fidelity patterns in headers
    const hasFidelityPatterns =
      headerLine.includes('1099-b') ||
      (headerLine.includes('investment') && headerLine.includes('date acquired'))

    // Check for expected columns
    const hasRequiredColumns =
      (headerLine.includes('date acquired') || headerLine.includes('acquired')) &&
      (headerLine.includes('date sold') || headerLine.includes('sold')) &&
      (headerLine.includes('proceeds') || headerLine.includes('sales')) &&
      (headerLine.includes('cost') || headerLine.includes('basis'))

    return hasFidelityMarkers || hasFidelityPatterns || hasRequiredColumns
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

    // Find header row - Fidelity often has account info and disclaimers at the top
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const rowLower = rows[i].map(c => c.toLowerCase())
      // Fidelity headers often include "Symbol" or "Security Description" and date columns
      if (
        (rowLower.some(c => c.includes('symbol') || c.includes('description') || c.includes('investment')) &&
         rowLower.some(c => c.includes('acquired') || c.includes('sold'))) ||
        (rowLower.some(c => c.includes('date')) && rowLower.some(c => c.includes('proceeds')))
      ) {
        headerRowIndex = i
        break
      }
    }

    const actualHeaders = rows[headerRowIndex].map(h => h.toLowerCase().trim())

    // Map columns
    const columnMap = {
      symbol: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.symbol),
      description: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.description),
      dateAcquired: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.dateAcquired),
      dateSold: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.dateSold),
      quantity: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.quantity),
      proceeds: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.proceeds),
      costBasis: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.costBasis),
      gainLoss: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.gainLoss),
      washSale: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.washSale),
      term: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.term),
      type: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.type),
      adjustmentCode: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.adjustmentCode),
      adjustmentAmount: findColumn(actualHeaders, FIDELITY_COLUMN_MAPPINGS.adjustmentAmount)
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

      // Skip empty rows or summary/footer rows
      if (row.length === 0 || row.every(c => c === '')) continue
      if (row[0].toLowerCase().includes('total')) continue
      if (row[0].toLowerCase().includes('subtotal')) continue
      if (row[0].toLowerCase().includes('account')) continue
      if (row[0].toLowerCase().includes('***')) continue

      try {
        // Get symbol from either symbol or description column
        let symbol = columnMap.symbol >= 0 ? row[columnMap.symbol] : ''
        const description = columnMap.description >= 0 ? row[columnMap.description] : ''

        // If no symbol, try to extract from description
        if (!symbol || symbol.trim() === '') {
          // Fidelity often formats as "AAPL - APPLE INC" or "APPLE INC (AAPL)"
          const dashMatch = description.match(/^([A-Z0-9.]+)\s*-/)
          const parenMatch = description.match(/\(([A-Z0-9.]+)\)/)

          if (dashMatch) {
            symbol = dashMatch[1]
          } else if (parenMatch) {
            symbol = parenMatch[1]
          } else {
            symbol = description.slice(0, 15).trim() // Use first 15 chars
          }
        }

        if (!symbol || symbol.trim() === '') {
          continue // Skip rows without identifiable security
        }

        // Parse dates
        let dateAcquiredStr = row[columnMap.dateAcquired]
        const dateSoldStr = row[columnMap.dateSold]

        // Handle special date values
        if (dateAcquiredStr.toLowerCase().includes('various') ||
            dateAcquiredStr.toLowerCase().includes('inherited') ||
            dateAcquiredStr.toLowerCase().includes('gifted')) {
          warnings.push(`Row ${i + 1}: "${dateAcquiredStr}" date - using sale date minus 2 years as estimate for ${symbol}`)
          const saleDate = parseDate(dateSoldStr)
          if (saleDate) {
            const estimatedAcquired = new Date(saleDate)
            estimatedAcquired.setFullYear(estimatedAcquired.getFullYear() - 2)
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
          if (termValue.includes('short') || termValue === 'st') isShortTerm = true
          else if (termValue.includes('long') || termValue === 'lt') isShortTerm = false
        }

        // Determine covered status
        let isCovered = true
        if (columnMap.type >= 0) {
          const typeValue = row[columnMap.type].toLowerCase().trim()
          // Fidelity uses various markers for covered vs noncovered
          if (typeValue.includes('noncovered') || typeValue.includes('non-covered') ||
              typeValue === 'c' || typeValue === 'f' || typeValue === '3') {
            isCovered = false
          } else if (typeValue.includes('covered') ||
                     typeValue === 'a' || typeValue === 'b' ||
                     typeValue === 'd' || typeValue === 'e' ||
                     typeValue === '1' || typeValue === '2') {
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

export const fidelityParser = new FidelityParser()
