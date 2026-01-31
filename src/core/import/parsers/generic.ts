/**
 * Generic CSV Parser with User-Defined Column Mapping
 *
 * Allows users to manually map CSV columns to required fields.
 * Used when automatic brokerage detection fails or for unsupported brokerages.
 *
 * Required fields:
 * - Symbol/Description
 * - Date Acquired
 * - Date Sold
 * - Proceeds
 * - Cost Basis
 *
 * Optional fields:
 * - Quantity
 * - Gain/Loss
 * - Wash Sale Disallowed
 * - Adjustment Code
 * - Adjustment Amount
 * - Term (Short/Long)
 * - Covered/Noncovered
 */

import {
  BaseBrokerageParser,
  BrokerageTransaction,
  BrokerageType,
  ColumnMapping,
  ParseResult,
  ParseError,
  parseDate,
  parseCurrency,
  isShortTermTransaction
} from '../brokerageParser'

/**
 * Configuration for the generic parser
 */
export interface GenericParserConfig {
  columnMapping: ColumnMapping
  skipHeaderRows: number
  dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  defaultIsShortTerm?: boolean
  defaultIsCovered?: boolean
}

/**
 * Field definition for column mapping UI
 */
export interface FieldDefinition {
  key: keyof ColumnMapping
  label: string
  required: boolean
  description: string
}

/**
 * Available fields for mapping
 */
export const GENERIC_FIELDS: FieldDefinition[] = [
  {
    key: 'symbol',
    label: 'Symbol/Ticker',
    required: true,
    description: 'Stock ticker symbol (e.g., AAPL, MSFT)'
  },
  {
    key: 'description',
    label: 'Description',
    required: false,
    description: 'Security description or name'
  },
  {
    key: 'dateAcquired',
    label: 'Date Acquired',
    required: true,
    description: 'Date the security was purchased'
  },
  {
    key: 'dateSold',
    label: 'Date Sold',
    required: true,
    description: 'Date the security was sold'
  },
  {
    key: 'proceeds',
    label: 'Proceeds',
    required: true,
    description: 'Total sale proceeds (quantity x price)'
  },
  {
    key: 'costBasis',
    label: 'Cost Basis',
    required: true,
    description: 'Original purchase cost (quantity x purchase price)'
  },
  {
    key: 'gainLoss',
    label: 'Gain/Loss',
    required: false,
    description: 'Realized gain or loss (will be calculated if not provided)'
  },
  {
    key: 'quantity',
    label: 'Quantity',
    required: false,
    description: 'Number of shares sold'
  },
  {
    key: 'washSaleDisallowed',
    label: 'Wash Sale Disallowed',
    required: false,
    description: 'Wash sale loss disallowed amount'
  },
  {
    key: 'adjustmentCode',
    label: 'Adjustment Code',
    required: false,
    description: 'IRS adjustment code (e.g., W for wash sale)'
  },
  {
    key: 'adjustmentAmount',
    label: 'Adjustment Amount',
    required: false,
    description: 'Amount of basis adjustment'
  }
]

/**
 * Get required fields for validation
 */
export function getRequiredFields(): (keyof ColumnMapping)[] {
  return GENERIC_FIELDS.filter(f => f.required).map(f => f.key)
}

export class GenericParser extends BaseBrokerageParser {
  private config: GenericParserConfig

  constructor(config?: Partial<GenericParserConfig>) {
    super()
    this.config = {
      columnMapping: config?.columnMapping ?? {
        symbol: -1,
        dateAcquired: -1,
        dateSold: -1,
        proceeds: -1,
        costBasis: -1
      },
      skipHeaderRows: config?.skipHeaderRows ?? 1,
      dateFormat: config?.dateFormat ?? 'MM/DD/YYYY',
      defaultIsShortTerm: config?.defaultIsShortTerm,
      defaultIsCovered: config?.defaultIsCovered ?? true
    }
  }

  /**
   * Update the parser configuration
   */
  setConfig(config: Partial<GenericParserConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get the current configuration
   */
  getConfig(): GenericParserConfig {
    return { ...this.config }
  }

  /**
   * Update a single column mapping
   */
  setColumnMapping(field: keyof ColumnMapping, columnIndex: number): void {
    this.config.columnMapping = {
      ...this.config.columnMapping,
      [field]: columnIndex
    }
  }

  getBrokerageType(): BrokerageType {
    return 'generic'
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canParse(_content: string, _headers: string[]): boolean {
    // Generic parser can always be used as a fallback
    return true
  }

  /**
   * Validate that required columns are mapped
   */
  validateMapping(): string[] {
    const errors: string[] = []
    const required = getRequiredFields()

    for (const field of required) {
      const columnIndex = this.config.columnMapping[field]
      if (columnIndex === undefined || columnIndex < 0) {
        const fieldDef = GENERIC_FIELDS.find(f => f.key === field)
        errors.push(`${fieldDef?.label ?? field} column is not mapped`)
      }
    }

    return errors
  }

  parse(content: string): ParseResult {
    const transactions: BrokerageTransaction[] = []
    const errors: ParseError[] = []
    const warnings: string[] = []

    // Validate column mapping first
    const mappingErrors = this.validateMapping()
    if (mappingErrors.length > 0) {
      mappingErrors.forEach(msg => errors.push({ row: 0, message: msg }))
      return { transactions, errors, warnings }
    }

    const rows = this.parseCSV(content)
    if (rows.length <= this.config.skipHeaderRows) {
      errors.push({ row: 0, message: 'CSV file has no data rows after skipping headers' })
      return { transactions, errors, warnings }
    }

    const mapping = this.config.columnMapping

    // Parse data rows (skip header rows)
    for (let i = this.config.skipHeaderRows; i < rows.length; i++) {
      const row = rows[i]

      // Skip empty rows
      if (row.length === 0 || row.every(c => c === '')) continue

      // Skip summary/total rows
      const firstCell = row[0].toLowerCase()
      if (firstCell.includes('total') || firstCell.includes('subtotal')) continue

      try {
        // Get symbol
        let symbol = mapping.symbol >= 0 && mapping.symbol < row.length
          ? row[mapping.symbol]
          : ''

        // Try description if symbol is empty
        if ((!symbol || symbol.trim() === '') && mapping.description !== undefined &&
            mapping.description >= 0 && mapping.description < row.length) {
          symbol = row[mapping.description]
        }

        if (!symbol || symbol.trim() === '') {
          continue // Skip rows without identifiable security
        }

        // Parse dates
        const dateAcquiredStr = mapping.dateAcquired < row.length ? row[mapping.dateAcquired] : ''
        const dateSoldStr = mapping.dateSold < row.length ? row[mapping.dateSold] : ''

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

        // Parse monetary values
        const proceeds = parseCurrency(mapping.proceeds < row.length ? row[mapping.proceeds] : '')
        const costBasis = parseCurrency(mapping.costBasis < row.length ? row[mapping.costBasis] : '')

        // Calculate or parse gain/loss
        let gainLoss: number
        if (mapping.gainLoss !== undefined && mapping.gainLoss >= 0 && mapping.gainLoss < row.length) {
          gainLoss = parseCurrency(row[mapping.gainLoss])
        } else {
          gainLoss = proceeds - costBasis
        }

        // Parse optional quantity
        let quantity = 1
        if (mapping.quantity !== undefined && mapping.quantity >= 0 && mapping.quantity < row.length) {
          const parsedQty = parseFloat(row[mapping.quantity].replace(/,/g, ''))
          if (!isNaN(parsedQty) && parsedQty > 0) {
            quantity = parsedQty
          }
        }

        // Parse optional wash sale
        let washSaleDisallowed: number | undefined
        if (mapping.washSaleDisallowed !== undefined && mapping.washSaleDisallowed >= 0 &&
            mapping.washSaleDisallowed < row.length) {
          const washSaleValue = parseCurrency(row[mapping.washSaleDisallowed])
          if (washSaleValue !== 0) {
            washSaleDisallowed = Math.abs(washSaleValue)
          }
        }

        // Parse optional adjustment fields
        let adjustmentCode: string | undefined
        let adjustmentAmount: number | undefined

        if (mapping.adjustmentCode !== undefined && mapping.adjustmentCode >= 0 &&
            mapping.adjustmentCode < row.length) {
          const code = row[mapping.adjustmentCode].trim()
          if (code) adjustmentCode = code
        }

        if (mapping.adjustmentAmount !== undefined && mapping.adjustmentAmount >= 0 &&
            mapping.adjustmentAmount < row.length) {
          const amount = parseCurrency(row[mapping.adjustmentAmount])
          if (amount !== 0) adjustmentAmount = amount
        }

        // Determine short-term vs long-term
        let isShortTerm: boolean
        if (this.config.defaultIsShortTerm !== undefined) {
          isShortTerm = this.config.defaultIsShortTerm
        } else {
          isShortTerm = isShortTermTransaction(dateAcquired, dateSold)
        }

        // Get description if separate from symbol
        let description: string | undefined
        if (mapping.description !== undefined && mapping.description >= 0 &&
            mapping.description < row.length && mapping.description !== mapping.symbol) {
          description = row[mapping.description]
        }

        const transaction: BrokerageTransaction = {
          symbol: symbol.trim().toUpperCase(),
          description,
          dateAcquired,
          dateSold,
          proceeds,
          costBasis,
          gainLoss,
          washSaleDisallowed,
          isShortTerm,
          isCovered: this.config.defaultIsCovered ?? true,
          quantity,
          adjustmentCode,
          adjustmentAmount
        }

        transactions.push(transaction)

        // Add warning for wash sales
        if (washSaleDisallowed) {
          warnings.push(`Row ${i + 1}: Wash sale disallowed amount of $${washSaleDisallowed.toFixed(2)} for ${symbol}`)
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

/**
 * Create a new generic parser instance
 */
export function createGenericParser(config?: Partial<GenericParserConfig>): GenericParser {
  return new GenericParser(config)
}

/**
 * Default generic parser instance
 */
export const genericParser = new GenericParser()
