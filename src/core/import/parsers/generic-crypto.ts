/**
 * Generic Cryptocurrency CSV Parser
 *
 * Allows users to import cryptocurrency transactions from any exchange
 * by mapping CSV columns to required fields.
 *
 * Supports:
 * - Custom column mapping for any exchange format
 * - Multiple transaction types (buy, sell, income, etc.)
 * - Cost basis calculation (FIFO, LIFO, HIFO, Specific ID)
 * - Form 8949 category assignment
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
import {
  CryptoTransaction,
  CryptoTransactionType,
  CostBasisMethod,
  CryptoHolding,
  calculateCostBasis,
  normalizeAssetSymbol
} from './cryptoTypes'

/**
 * Column mapping configuration for generic crypto parser
 */
export interface CryptoColumnMapping {
  timestamp: number
  transactionType: number
  asset: number
  quantity: number
  pricePerUnit?: number
  totalValue?: number
  fees?: number
  notes?: number

  // For convert transactions
  convertToAsset?: number
  convertToQuantity?: number
}

/**
 * Configuration for the generic crypto parser
 */
export interface GenericCryptoParserConfig {
  columnMapping: CryptoColumnMapping
  skipHeaderRows: number
  dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'ISO'
  costBasisMethod: CostBasisMethod
  exchangeName?: string

  // Transaction type mappings (custom labels to our types)
  transactionTypeMap?: Record<string, CryptoTransactionType>
}

/**
 * Default transaction type mappings
 */
const DEFAULT_TYPE_MAP: Record<string, CryptoTransactionType> = {
  'buy': 'buy',
  'purchase': 'buy',
  'bought': 'buy',
  'sell': 'sell',
  'sold': 'sell',
  'convert': 'convert',
  'swap': 'convert',
  'trade': 'other', // Need context to determine buy/sell
  'send': 'send',
  'withdraw': 'send',
  'withdrawal': 'send',
  'transfer out': 'send',
  'receive': 'receive',
  'deposit': 'receive',
  'transfer in': 'receive',
  'income': 'income',
  'reward': 'income',
  'staking': 'income',
  'interest': 'income',
  'earn': 'income',
  'airdrop': 'airdrop',
  'fork': 'fork',
  'mining': 'mining',
  'gift sent': 'gift_sent',
  'gift received': 'gift_received'
}

/**
 * Field definitions for column mapping UI
 */
export interface CryptoFieldDefinition {
  key: keyof CryptoColumnMapping
  label: string
  required: boolean
  description: string
}

/**
 * Available fields for mapping
 */
export const CRYPTO_FIELDS: CryptoFieldDefinition[] = [
  {
    key: 'timestamp',
    label: 'Date/Time',
    required: true,
    description: 'Transaction date and time'
  },
  {
    key: 'transactionType',
    label: 'Transaction Type',
    required: true,
    description: 'Type of transaction (buy, sell, convert, etc.)'
  },
  {
    key: 'asset',
    label: 'Asset/Symbol',
    required: true,
    description: 'Cryptocurrency symbol (BTC, ETH, etc.)'
  },
  {
    key: 'quantity',
    label: 'Quantity',
    required: true,
    description: 'Amount of cryptocurrency'
  },
  {
    key: 'pricePerUnit',
    label: 'Price Per Unit',
    required: false,
    description: 'Price per unit in USD'
  },
  {
    key: 'totalValue',
    label: 'Total Value',
    required: false,
    description: 'Total USD value of transaction'
  },
  {
    key: 'fees',
    label: 'Fees',
    required: false,
    description: 'Transaction fees in USD'
  },
  {
    key: 'notes',
    label: 'Notes/Description',
    required: false,
    description: 'Additional transaction notes'
  },
  {
    key: 'convertToAsset',
    label: 'Convert To Asset',
    required: false,
    description: 'For conversions: the asset received'
  },
  {
    key: 'convertToQuantity',
    label: 'Convert To Quantity',
    required: false,
    description: 'For conversions: quantity received'
  }
]

/**
 * Get required fields for validation
 */
export function getRequiredCryptoFields(): (keyof CryptoColumnMapping)[] {
  return CRYPTO_FIELDS.filter(f => f.required).map(f => f.key)
}

export class GenericCryptoParser extends BaseBrokerageParser {
  private config: GenericCryptoParserConfig
  private holdings: Map<string, CryptoHolding[]> = new Map()

  constructor(config?: Partial<GenericCryptoParserConfig>) {
    super()
    this.config = {
      columnMapping: config?.columnMapping ?? {
        timestamp: -1,
        transactionType: -1,
        asset: -1,
        quantity: -1
      },
      skipHeaderRows: config?.skipHeaderRows ?? 1,
      dateFormat: config?.dateFormat ?? 'MM/DD/YYYY',
      costBasisMethod: config?.costBasisMethod ?? 'fifo',
      exchangeName: config?.exchangeName ?? 'Unknown Exchange',
      transactionTypeMap: config?.transactionTypeMap ?? DEFAULT_TYPE_MAP
    }
  }

  /**
   * Update parser configuration
   */
  setConfig(config: Partial<GenericCryptoParserConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.columnMapping) {
      this.config.columnMapping = { ...this.config.columnMapping, ...config.columnMapping }
    }
    if (config.transactionTypeMap) {
      this.config.transactionTypeMap = { ...this.config.transactionTypeMap, ...config.transactionTypeMap }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): GenericCryptoParserConfig {
    return { ...this.config }
  }

  /**
   * Update a single column mapping
   */
  setColumnMapping(field: keyof CryptoColumnMapping, columnIndex: number): void {
    this.config.columnMapping = {
      ...this.config.columnMapping,
      [field]: columnIndex
    }
  }

  /**
   * Set cost basis method
   */
  setCostBasisMethod(method: CostBasisMethod): void {
    this.config.costBasisMethod = method
  }

  getBrokerageType(): BrokerageType {
    return 'generic'
  }

  getCryptoExchangeType(): string {
    return 'generic'
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canParse(_content: string, _headers: string[]): boolean {
    // Generic parser can always be used as a fallback
    return true
  }

  /**
   * Validate column mapping
   */
  validateMapping(): string[] {
    const errors: string[] = []
    const required = getRequiredCryptoFields()

    for (const field of required) {
      const columnIndex = this.config.columnMapping[field]
      if (columnIndex === undefined || columnIndex < 0) {
        const fieldDef = CRYPTO_FIELDS.find(f => f.key === field)
        errors.push(`${fieldDef?.label ?? field} column is not mapped`)
      }
    }

    return errors
  }

  /**
   * Map raw transaction type string to our internal type
   */
  private mapTransactionType(rawType: string): CryptoTransactionType {
    const normalized = rawType.toLowerCase().trim()

    // Check custom mappings first
    if (this.config.transactionTypeMap) {
      for (const [key, value] of Object.entries(this.config.transactionTypeMap)) {
        if (normalized === key.toLowerCase() || normalized.includes(key.toLowerCase())) {
          return value
        }
      }
    }

    // Fall back to default mappings
    for (const [key, value] of Object.entries(DEFAULT_TYPE_MAP)) {
      if (normalized === key.toLowerCase() || normalized.includes(key.toLowerCase())) {
        return value
      }
    }

    return 'other'
  }

  /**
   * Parse date based on configured format
   */
  private parseConfiguredDate(dateStr: string): Date | null {
    const cleaned = dateStr.trim()

    switch (this.config.dateFormat) {
      case 'DD/MM/YYYY': {
        const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
        if (match) {
          const day = parseInt(match[1], 10)
          const month = parseInt(match[2], 10)
          let year = parseInt(match[3], 10)
          if (year < 100) year += year < 50 ? 2000 : 1900
          return new Date(year, month - 1, day)
        }
        break
      }
      case 'YYYY-MM-DD': {
        const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
        if (match) {
          return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
        }
        break
      }
      case 'ISO': {
        const date = new Date(cleaned)
        if (!isNaN(date.getTime())) return date
        break
      }
      default: // MM/DD/YYYY
        return parseDate(cleaned)
    }

    // Try standard parsing as fallback
    return parseDate(cleaned)
  }

  /**
   * Parse crypto transactions from CSV
   */
  parseCryptoTransactions(content: string): {
    transactions: CryptoTransaction[]
    errors: ParseError[]
    warnings: string[]
  } {
    const transactions: CryptoTransaction[] = []
    const errors: ParseError[] = []
    const warnings: string[] = []

    // Validate mapping
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

    // Parse data rows
    for (let i = this.config.skipHeaderRows; i < rows.length; i++) {
      const row = rows[i]

      if (row.length === 0 || row.every(c => c === '')) continue

      // Skip summary rows
      const firstCell = row[0].toLowerCase()
      if (firstCell.includes('total') || firstCell.includes('subtotal')) continue

      try {
        // Get required fields
        const timestampStr = mapping.timestamp < row.length ? row[mapping.timestamp] : ''
        const typeStr = mapping.transactionType < row.length ? row[mapping.transactionType] : ''
        const assetStr = mapping.asset < row.length ? row[mapping.asset] : ''
        const quantityStr = mapping.quantity < row.length ? row[mapping.quantity] : ''

        if (!assetStr || assetStr.trim() === '') continue

        // Parse timestamp
        const timestamp = this.parseConfiguredDate(timestampStr)
        if (!timestamp) {
          errors.push({ row: i + 1, column: 'timestamp', message: `Invalid date: ${timestampStr}` })
          continue
        }

        // Parse quantity
        const quantity = Math.abs(parseFloat(quantityStr.replace(/[,\s]/g, '')) || 0)
        if (quantity === 0) {
          warnings.push(`Row ${i + 1}: Zero quantity, skipping`)
          continue
        }

        // Parse transaction type
        const transactionType = this.mapTransactionType(typeStr)

        // Parse optional fields
        const pricePerUnit = mapping.pricePerUnit !== undefined && mapping.pricePerUnit >= 0 && mapping.pricePerUnit < row.length
          ? parseCurrency(row[mapping.pricePerUnit])
          : 0

        const totalValue = mapping.totalValue !== undefined && mapping.totalValue >= 0 && mapping.totalValue < row.length
          ? parseCurrency(row[mapping.totalValue])
          : (pricePerUnit * quantity)

        const fees = mapping.fees !== undefined && mapping.fees >= 0 && mapping.fees < row.length
          ? parseCurrency(row[mapping.fees])
          : 0

        const notes = mapping.notes !== undefined && mapping.notes >= 0 && mapping.notes < row.length
          ? row[mapping.notes]
          : undefined

        const normalizedAsset = normalizeAssetSymbol(assetStr)

        const transaction: CryptoTransaction = {
          id: `generic-${i}`,
          timestamp,
          type: transactionType,
          asset: normalizedAsset,
          quantity,
          pricePerUnit: pricePerUnit || (totalValue / quantity) || 0,
          totalValue: totalValue || (pricePerUnit * quantity) || 0,
          fees,
          notes,
          exchange: this.config.exchangeName,
          rawData: row
        }

        // Handle convert transactions
        if (transactionType === 'convert') {
          if (mapping.convertToAsset !== undefined && mapping.convertToAsset >= 0 && mapping.convertToAsset < row.length) {
            transaction.convertFromAsset = normalizedAsset
            transaction.convertFromQuantity = quantity
            transaction.convertToAsset = normalizeAssetSymbol(row[mapping.convertToAsset])
          }
          if (mapping.convertToQuantity !== undefined && mapping.convertToQuantity >= 0 && mapping.convertToQuantity < row.length) {
            transaction.convertToQuantity = Math.abs(parseFloat(row[mapping.convertToQuantity].replace(/[,\s]/g, '')) || 0)
          }
        }

        transactions.push(transaction)

        // Add income warnings
        if (transactionType === 'income' || transactionType === 'airdrop' || transactionType === 'mining') {
          warnings.push(`Row ${i + 1}: ${normalizedAsset} ${transactionType} of $${transaction.totalValue.toFixed(2)} should be reported as ordinary income`)
        }
      } catch (e) {
        errors.push({ row: i + 1, message: `Error parsing row: ${e instanceof Error ? e.message : String(e)}` })
      }
    }

    return { transactions, errors, warnings }
  }

  /**
   * Convert crypto transactions to brokerage transactions for Form 8949
   */
  parse(content: string): ParseResult {
    const { transactions: cryptoTxs, errors, warnings } = this.parseCryptoTransactions(content)
    const brokerageTransactions: BrokerageTransaction[] = []

    // Reset holdings
    this.holdings.clear()

    // Sort by timestamp
    const sortedTxs = [...cryptoTxs].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    )

    // Process transactions
    for (const tx of sortedTxs) {
      if (tx.type === 'buy' || tx.type === 'receive' || tx.type === 'income' ||
          tx.type === 'airdrop' || tx.type === 'mining' || tx.type === 'gift_received') {
        // Add to holdings
        const costBasis = tx.type === 'receive' || tx.type === 'gift_received' ? 0 : tx.totalValue
        const holding: CryptoHolding = {
          asset: tx.asset,
          quantity: tx.quantity,
          costBasisPerUnit: costBasis / tx.quantity,
          totalCostBasis: costBasis,
          acquiredDate: tx.timestamp,
          source: tx.exchange || 'Unknown',
          txId: tx.id
        }

        const assetHoldings = this.holdings.get(tx.asset) || []
        assetHoldings.push(holding)
        this.holdings.set(tx.asset, assetHoldings)
      } else if (tx.type === 'sell' || tx.type === 'gift_sent') {
        // Calculate cost basis
        const result = calculateCostBasis(
          this.holdings.get(tx.asset) || [],
          tx.quantity,
          this.config.costBasisMethod
        )

        if (result.error) {
          warnings.push(`${tx.asset}: ${result.error}`)
        }

        this.holdings.set(tx.asset, result.remainingHoldings)

        // Create Form 8949 entries (gifts sent don't get proceeds)
        for (const lot of result.lotsUsed) {
          const proceeds = tx.type === 'gift_sent' ? 0 :
            (tx.pricePerUnit * lot.quantitySold) - (tx.fees * (lot.quantitySold / tx.quantity))
          const gainLoss = proceeds - lot.costBasis

          const brokerageTx: BrokerageTransaction = {
            symbol: tx.asset,
            description: `${tx.asset ?? 'Unknown'} - ${this.config.exchangeName ?? 'Exchange'}`,
            dateAcquired: lot.acquiredDate,
            dateSold: tx.timestamp,
            proceeds,
            costBasis: lot.costBasis,
            gainLoss,
            isShortTerm: isShortTermTransaction(lot.acquiredDate, tx.timestamp),
            isCovered: false,
            quantity: lot.quantitySold
          }

          brokerageTransactions.push(brokerageTx)
        }
      } else if (tx.type === 'convert') {
        // Process conversion as sell + buy
        if (tx.convertFromAsset && tx.convertFromQuantity) {
          const result = calculateCostBasis(
            this.holdings.get(tx.convertFromAsset) || [],
            tx.convertFromQuantity,
            this.config.costBasisMethod
          )

          this.holdings.set(tx.convertFromAsset, result.remainingHoldings)

          for (const lot of result.lotsUsed) {
            const proceeds = tx.totalValue * (lot.quantitySold / tx.convertFromQuantity)
            const gainLoss = proceeds - lot.costBasis

            const brokerageTx: BrokerageTransaction = {
              symbol: tx.convertFromAsset,
              description: `${tx.convertFromAsset} converted to ${tx.convertToAsset || 'unknown'}`,
              dateAcquired: lot.acquiredDate,
              dateSold: tx.timestamp,
              proceeds,
              costBasis: lot.costBasis,
              gainLoss,
              isShortTerm: isShortTermTransaction(lot.acquiredDate, tx.timestamp),
              isCovered: false,
              quantity: lot.quantitySold
            }

            brokerageTransactions.push(brokerageTx)
          }

          // Add new holding for converted asset
          if (tx.convertToAsset && tx.convertToQuantity) {
            const newHolding: CryptoHolding = {
              asset: tx.convertToAsset,
              quantity: tx.convertToQuantity,
              costBasisPerUnit: tx.totalValue / tx.convertToQuantity,
              totalCostBasis: tx.totalValue,
              acquiredDate: tx.timestamp,
              source: `${this.config.exchangeName ?? 'Exchange'} Convert`
            }

            const assetHoldings = this.holdings.get(tx.convertToAsset) || []
            assetHoldings.push(newHolding)
            this.holdings.set(tx.convertToAsset, assetHoldings)
          }
        }
      } else if (tx.type === 'send') {
        warnings.push(`Row: ${tx.asset} send of ${tx.quantity} - verify if taxable`)
      }
    }

    return { transactions: brokerageTransactions, errors, warnings }
  }

  /**
   * Get CSV headers from content
   */
  getHeaders(content: string): string[] {
    const rows = this.parseCSV(content)
    if (rows.length === 0) return []
    return rows[0]
  }

  /**
   * Get preview rows for mapping UI
   */
  getPreviewRows(content: string, limit = 5): string[][] {
    const rows = this.parseCSV(content)
    return rows.slice(0, Math.min(rows.length, limit + 1))
  }

  getHoldings(asset: string): CryptoHolding[] {
    return this.holdings.get(asset.toUpperCase()) || []
  }

  getAllHoldings(): Map<string, CryptoHolding[]> {
    return new Map(this.holdings)
  }
}

/**
 * Create a new generic crypto parser
 */
export function createGenericCryptoParser(config?: Partial<GenericCryptoParserConfig>): GenericCryptoParser {
  return new GenericCryptoParser(config)
}

export const genericCryptoParser = new GenericCryptoParser()
