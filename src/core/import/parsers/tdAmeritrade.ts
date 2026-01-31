/**
 * TD Ameritrade CSV Parser
 *
 * Parses CSV exports from TD Ameritrade brokerage accounts.
 * Supports the standard Gain/Loss report format.
 *
 * Typical columns:
 * - Symbol, Security Description
 * - Date Acquired, Date Sold
 * - Quantity, Proceeds, Cost Basis, Gain/Loss
 * - Term (Short/Long), Covered/Noncovered
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
 * TD Ameritrade column name variations
 */
const TD_COLUMN_MAPPINGS = {
  symbol: ['symbol', 'ticker', 'security symbol'],
  description: ['description', 'security description', 'security name', 'name'],
  dateAcquired: ['date acquired', 'acquisition date', 'open date', 'purchase date', 'acquired'],
  dateSold: ['date sold', 'sale date', 'close date', 'sold', 'disposal date'],
  quantity: ['quantity', 'qty', 'shares', 'units'],
  proceeds: ['proceeds', 'sales proceeds', 'sale proceeds', 'gross proceeds'],
  costBasis: ['cost basis', 'cost', 'basis', 'adjusted cost basis', 'adj cost basis'],
  gainLoss: ['gain/loss', 'gain or loss', 'gain loss', 'gain (loss)', 'realized gain/loss', 'total gain/loss'],
  washSale: ['wash sale loss disallowed', 'wash sale', 'wash sale adjustment', 'disallowed loss'],
  term: ['term', 'holding period', 'short term or long term'],
  covered: ['covered', 'covered/noncovered', 'covered indicator', 'reporting category']
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

export class TDAmeritradeParser extends BaseBrokerageParser {
  getBrokerageType(): BrokerageType {
    return 'tdAmeritrade'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()

    // Check for TD-specific patterns
    const hasTDMarkers =
      content.toLowerCase().includes('td ameritrade') ||
      content.toLowerCase().includes('ameritrade')

    // Check for expected columns
    const hasRequiredColumns =
      (headerLine.includes('date acquired') || headerLine.includes('acquisition')) &&
      (headerLine.includes('date sold') || headerLine.includes('sale date')) &&
      (headerLine.includes('proceeds') || headerLine.includes('sales')) &&
      (headerLine.includes('cost') || headerLine.includes('basis'))

    return hasTDMarkers || hasRequiredColumns
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

    // Find header row (may not be first row)
    let headerRowIndex = 0

    // Sometimes TD Ameritrade has info rows before headers
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowLower = rows[i].map(c => c.toLowerCase())
      if (
        rowLower.some(c => c.includes('symbol') || c.includes('security')) &&
        rowLower.some(c => c.includes('date') || c.includes('acquired'))
      ) {
        headerRowIndex = i
        break
      }
    }

    const actualHeaders = rows[headerRowIndex].map(h => h.toLowerCase().trim())

    // Map columns
    const columnMap = {
      symbol: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.symbol),
      description: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.description),
      dateAcquired: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.dateAcquired),
      dateSold: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.dateSold),
      quantity: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.quantity),
      proceeds: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.proceeds),
      costBasis: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.costBasis),
      gainLoss: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.gainLoss),
      washSale: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.washSale),
      term: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.term),
      covered: findColumn(actualHeaders, TD_COLUMN_MAPPINGS.covered)
    }

    // Validate required columns
    if (columnMap.symbol < 0) {
      errors.push({ row: headerRowIndex, column: 'symbol', message: 'Could not find Symbol column' })
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

      try {
        const symbol = row[columnMap.symbol] ?? ''
        if (!symbol || symbol.trim() === '') {
          continue // Skip rows without a symbol
        }

        const dateAcquired = parseDate(row[columnMap.dateAcquired])
        const dateSold = parseDate(row[columnMap.dateSold])

        if (!dateAcquired) {
          errors.push({ row: i + 1, column: 'dateAcquired', message: `Invalid date acquired: ${row[columnMap.dateAcquired]}` })
          continue
        }

        if (!dateSold) {
          errors.push({ row: i + 1, column: 'dateSold', message: `Invalid date sold: ${row[columnMap.dateSold]}` })
          continue
        }

        const proceeds = parseCurrency(row[columnMap.proceeds])
        const costBasis = parseCurrency(row[columnMap.costBasis])
        const gainLoss = columnMap.gainLoss >= 0
          ? parseCurrency(row[columnMap.gainLoss])
          : proceeds - costBasis

        const quantity = columnMap.quantity >= 0
          ? parseFloat(row[columnMap.quantity]) || 1
          : 1

        const washSaleDisallowed = columnMap.washSale >= 0
          ? parseCurrency(row[columnMap.washSale])
          : undefined

        // Determine short-term vs long-term
        let isShortTerm = isShortTermTransaction(dateAcquired, dateSold)
        if (columnMap.term >= 0) {
          const termValue = row[columnMap.term].toLowerCase()
          if (termValue.includes('short')) isShortTerm = true
          else if (termValue.includes('long')) isShortTerm = false
        }

        // Determine covered status
        let isCovered = true
        if (columnMap.covered >= 0) {
          const coveredValue = row[columnMap.covered].toLowerCase()
          isCovered = coveredValue.includes('covered') && !coveredValue.includes('non')
        }

        const transaction: BrokerageTransaction = {
          symbol: symbol.trim(),
          description: columnMap.description >= 0 ? row[columnMap.description] : undefined,
          dateAcquired,
          dateSold,
          proceeds,
          costBasis,
          gainLoss,
          washSaleDisallowed: washSaleDisallowed && washSaleDisallowed !== 0 ? Math.abs(washSaleDisallowed) : undefined,
          isShortTerm,
          isCovered,
          quantity
        }

        transactions.push(transaction)

        // Add warning for wash sales
        if (washSaleDisallowed && washSaleDisallowed !== 0) {
          warnings.push(`Row ${i + 1}: Wash sale disallowed amount of $${Math.abs(washSaleDisallowed).toFixed(2)} for ${symbol}`)
        }
      } catch (e) {
        errors.push({ row: i + 1, message: `Error parsing row: ${e instanceof Error ? e.message : String(e)}` })
      }
    }

    return { transactions, errors, warnings }
  }
}

export const tdAmeritradeParser = new TDAmeritradeParser()
