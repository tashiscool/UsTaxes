/**
 * Coinbase CSV Parser
 *
 * Parses transaction CSV exports from Coinbase.
 * Handles buy/sell/convert/send/receive transactions.
 * Calculates cost basis and maps to Form 8949 categories.
 *
 * Typical Coinbase CSV columns:
 * - Timestamp, Transaction Type, Asset, Quantity Transacted
 * - Spot Price Currency, Spot Price at Transaction, Subtotal
 * - Total (inclusive of fees), Fees, Notes
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
  calculateCostBasis
} from './cryptoTypes'

/**
 * Coinbase column name mappings
 */
const COINBASE_COLUMN_MAPPINGS = {
  timestamp: ['timestamp', 'date', 'time', 'datetime'],
  transactionType: ['transaction type', 'type', 'action'],
  asset: ['asset', 'currency', 'crypto', 'coin', 'symbol'],
  quantity: ['quantity transacted', 'quantity', 'amount', 'qty'],
  spotPrice: [
    'spot price at transaction',
    'spot price',
    'price',
    'price at transaction'
  ],
  spotPriceCurrency: ['spot price currency', 'currency'],
  subtotal: ['subtotal', 'sub total', 'amount before fees'],
  total: ['total (inclusive of fees)', 'total', 'amount with fees'],
  fees: ['fees', 'fee', 'transaction fee'],
  notes: ['notes', 'note', 'description', 'memo']
}

/**
 * Maps Coinbase transaction types to our internal types
 */
function mapTransactionType(coinbaseType: string): CryptoTransactionType {
  const type = coinbaseType.toLowerCase().trim()

  switch (type) {
    case 'buy':
    case 'advanced trade buy':
    case 'purchase':
      return 'buy'
    case 'sell':
    case 'advanced trade sell':
      return 'sell'
    case 'convert':
    case 'conversion':
    case 'swap':
      return 'convert'
    case 'send':
    case 'transfer out':
    case 'withdrawal':
      return 'send'
    case 'receive':
    case 'transfer in':
    case 'deposit':
      return 'receive'
    case 'rewards income':
    case 'staking income':
    case 'staking reward':
    case 'interest':
    case 'earn':
    case 'learning reward':
    case 'coinbase earn':
      return 'income'
    case 'fork':
    case 'airdrop':
      return 'airdrop'
    case 'mining':
      return 'mining'
    default:
      // Treat unknown types as income if they result in receiving crypto
      return 'other'
  }
}

/**
 * Find column index by checking multiple possible header names
 */
function findColumn(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex((h) => h.includes(name))
    if (index >= 0) return index
  }
  return -1
}

export class CoinbaseParser extends BaseBrokerageParser {
  private holdings: Map<string, CryptoHolding[]> = new Map()
  private costBasisMethod: CostBasisMethod = 'fifo'

  constructor(costBasisMethod: CostBasisMethod = 'fifo') {
    super()
    this.costBasisMethod = costBasisMethod
  }

  setCostBasisMethod(method: CostBasisMethod): void {
    this.costBasisMethod = method
  }

  getBrokerageType(): BrokerageType {
    return 'generic' // Using generic since we're extending the brokerage types
  }

  getCryptoExchangeType(): string {
    return 'coinbase'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()

    // Check for Coinbase-specific patterns
    const hasCoinbaseMarkers =
      content.toLowerCase().includes('coinbase') ||
      headerLine.includes('spot price at transaction') ||
      headerLine.includes('total (inclusive of fees)')

    // Check for typical Coinbase patterns
    const hasCoinbasePatterns =
      headerLine.includes('transaction type') &&
      headerLine.includes('asset') &&
      (headerLine.includes('quantity') || headerLine.includes('amount'))

    return hasCoinbaseMarkers || hasCoinbasePatterns
  }

  /**
   * Parse Coinbase CSV into crypto transactions
   */
  parseCryptoTransactions(content: string): {
    transactions: CryptoTransaction[]
    errors: ParseError[]
    warnings: string[]
  } {
    const transactions: CryptoTransaction[] = []
    const errors: ParseError[] = []
    const warnings: string[] = []

    const rows = this.parseCSV(content)
    if (rows.length < 2) {
      errors.push({ row: 0, message: 'CSV file is empty or has no data rows' })
      return { transactions, errors, warnings }
    }

    // Find header row (Coinbase sometimes has intro text before headers)
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowLower = rows[i].map((c) => c.toLowerCase())
      if (
        rowLower.some(
          (c) => c.includes('timestamp') || c.includes('transaction type')
        ) &&
        rowLower.some((c) => c.includes('asset') || c.includes('quantity'))
      ) {
        headerRowIndex = i
        break
      }
    }

    const actualHeaders = rows[headerRowIndex].map((h) =>
      h.toLowerCase().trim()
    )

    // Map columns
    const columnMap = {
      timestamp: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.timestamp),
      transactionType: findColumn(
        actualHeaders,
        COINBASE_COLUMN_MAPPINGS.transactionType
      ),
      asset: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.asset),
      quantity: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.quantity),
      spotPrice: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.spotPrice),
      subtotal: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.subtotal),
      total: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.total),
      fees: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.fees),
      notes: findColumn(actualHeaders, COINBASE_COLUMN_MAPPINGS.notes)
    }

    // Validate required columns
    if (columnMap.timestamp < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'timestamp',
        message: 'Could not find Timestamp column'
      })
    }
    if (columnMap.transactionType < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'transactionType',
        message: 'Could not find Transaction Type column'
      })
    }
    if (columnMap.asset < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'asset',
        message: 'Could not find Asset column'
      })
    }
    if (columnMap.quantity < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'quantity',
        message: 'Could not find Quantity column'
      })
    }

    if (errors.length > 0) {
      return { transactions, errors, warnings }
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      // Skip empty rows
      if (row.length === 0 || row.every((c) => c === '')) continue

      try {
        const timestampStr = row[columnMap.timestamp]
        const transactionTypeStr = row[columnMap.transactionType]
        const asset = row[columnMap.asset]
        const quantityStr = row[columnMap.quantity]

        if (!asset || asset.trim() === '') continue

        // Parse timestamp
        const timestamp = parseDate(timestampStr)
        if (!timestamp) {
          // Try parsing ISO format with time
          const isoMatch = timestampStr.match(/^(\d{4})-(\d{2})-(\d{2})T?/)
          if (isoMatch) {
            const parsedDate = new Date(timestampStr)
            if (!isNaN(parsedDate.getTime())) {
              // Use parsed date
            } else {
              errors.push({
                row: i + 1,
                column: 'timestamp',
                message: `Invalid timestamp: ${timestampStr}`
              })
              continue
            }
          } else {
            errors.push({
              row: i + 1,
              column: 'timestamp',
              message: `Invalid timestamp: ${timestampStr}`
            })
            continue
          }
        }

        const quantity = Math.abs(
          parseFloat(quantityStr.replace(/,/g, '')) || 0
        )
        if (quantity === 0) {
          warnings.push(`Row ${i + 1}: Zero quantity for ${asset}, skipping`)
          continue
        }

        const transactionType = mapTransactionType(transactionTypeStr)

        // Parse monetary values
        const spotPrice =
          columnMap.spotPrice >= 0 ? parseCurrency(row[columnMap.spotPrice]) : 0
        const subtotal =
          columnMap.subtotal >= 0 ? parseCurrency(row[columnMap.subtotal]) : 0
        const total =
          columnMap.total >= 0 ? parseCurrency(row[columnMap.total]) : subtotal
        const fees =
          columnMap.fees >= 0 ? parseCurrency(row[columnMap.fees]) : 0
        const notes = columnMap.notes >= 0 ? row[columnMap.notes] : undefined

        // Calculate price per unit if not provided
        const pricePerUnit = spotPrice || (total ? total / quantity : 0)

        const transaction: CryptoTransaction = {
          id: `coinbase-${i}`,
          timestamp: timestamp || new Date(timestampStr),
          type: transactionType,
          asset: asset.trim().toUpperCase(),
          quantity,
          pricePerUnit,
          totalValue: total || subtotal || quantity * pricePerUnit,
          fees,
          notes,
          exchange: 'Coinbase',
          rawData: row
        }

        // Handle convert transactions - they involve two assets
        if (transactionType === 'convert' && notes) {
          const convertMatch = notes.match(
            /Converted\s+([\d.]+)\s+(\w+)\s+to\s+([\d.]+)\s+(\w+)/i
          )
          if (convertMatch) {
            transaction.convertFromAsset = convertMatch[2].toUpperCase()
            transaction.convertFromQuantity = parseFloat(convertMatch[1])
            transaction.convertToAsset = convertMatch[4].toUpperCase()
            transaction.convertToQuantity = parseFloat(convertMatch[3])
          }
        }

        transactions.push(transaction)
      } catch (e) {
        errors.push({
          row: i + 1,
          message: `Error parsing row: ${
            e instanceof Error ? e.message : String(e)
          }`
        })
      }
    }

    return { transactions, errors, warnings }
  }

  /**
   * Convert crypto transactions to brokerage transactions for Form 8949
   * This calculates cost basis for sells using the specified method
   */
  parse(content: string): ParseResult {
    const {
      transactions: cryptoTxs,
      errors,
      warnings
    } = this.parseCryptoTransactions(content)
    const brokerageTransactions: BrokerageTransaction[] = []

    // Reset holdings for fresh calculation
    this.holdings.clear()

    // Sort transactions by timestamp
    const sortedTxs = [...cryptoTxs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    // Process transactions to build holdings and generate Form 8949 entries
    for (const tx of sortedTxs) {
      if (
        tx.type === 'buy' ||
        tx.type === 'receive' ||
        tx.type === 'income' ||
        tx.type === 'airdrop' ||
        tx.type === 'mining'
      ) {
        // Add to holdings
        const holding: CryptoHolding = {
          asset: tx.asset,
          quantity: tx.quantity,
          costBasisPerUnit: tx.type === 'receive' ? 0 : tx.pricePerUnit,
          totalCostBasis: tx.type === 'receive' ? 0 : tx.totalValue,
          acquiredDate: tx.timestamp,
          source: tx.exchange || 'Coinbase'
        }

        const assetHoldings = this.holdings.get(tx.asset) || []
        assetHoldings.push(holding)
        this.holdings.set(tx.asset, assetHoldings)

        // Income transactions should also be reported as income
        if (
          tx.type === 'income' ||
          tx.type === 'airdrop' ||
          tx.type === 'mining'
        ) {
          warnings.push(
            `Row: ${tx.asset} ${tx.type} of $${tx.totalValue.toFixed(
              2
            )} should be reported as ordinary income`
          )
        }
      } else if (tx.type === 'sell') {
        // Calculate cost basis and create Form 8949 entry
        const result = calculateCostBasis(
          this.holdings.get(tx.asset) || [],
          tx.quantity,
          this.costBasisMethod
        )

        if (result.error) {
          warnings.push(`${tx.asset}: ${result.error}`)
        }

        // Update holdings
        this.holdings.set(tx.asset, result.remainingHoldings)

        // Create brokerage transaction for each lot sold
        for (const lot of result.lotsUsed) {
          const proceeds =
            tx.pricePerUnit * lot.quantitySold -
            tx.fees * (lot.quantitySold / tx.quantity)
          const gainLoss = proceeds - lot.costBasis

          const brokerageTx: BrokerageTransaction = {
            symbol: tx.asset,
            description: `${tx.asset} - Coinbase`,
            dateAcquired: lot.acquiredDate,
            dateSold: tx.timestamp,
            proceeds,
            costBasis: lot.costBasis,
            gainLoss,
            isShortTerm: isShortTermTransaction(lot.acquiredDate, tx.timestamp),
            isCovered: true, // Crypto is generally not covered, but we track it
            quantity: lot.quantitySold
          }

          brokerageTransactions.push(brokerageTx)
        }
      } else if (tx.type === 'convert') {
        // Treat convert as a sell of one asset and buy of another
        if (tx.convertFromAsset && tx.convertFromQuantity) {
          // Sell the "from" asset
          const result = calculateCostBasis(
            this.holdings.get(tx.convertFromAsset) || [],
            tx.convertFromQuantity,
            this.costBasisMethod
          )

          this.holdings.set(tx.convertFromAsset, result.remainingHoldings)

          for (const lot of result.lotsUsed) {
            const proceeds =
              tx.totalValue * (lot.quantitySold / tx.convertFromQuantity)
            const gainLoss = proceeds - lot.costBasis

            const brokerageTx: BrokerageTransaction = {
              symbol: tx.convertFromAsset,
              description: `${tx.convertFromAsset} converted to ${
                tx.convertToAsset || 'unknown'
              } - Coinbase`,
              dateAcquired: lot.acquiredDate,
              dateSold: tx.timestamp,
              proceeds,
              costBasis: lot.costBasis,
              gainLoss,
              isShortTerm: isShortTermTransaction(
                lot.acquiredDate,
                tx.timestamp
              ),
              isCovered: true,
              quantity: lot.quantitySold
            }

            brokerageTransactions.push(brokerageTx)
          }

          // Buy the "to" asset
          if (tx.convertToAsset && tx.convertToQuantity) {
            const newHolding: CryptoHolding = {
              asset: tx.convertToAsset,
              quantity: tx.convertToQuantity,
              costBasisPerUnit: tx.totalValue / tx.convertToQuantity,
              totalCostBasis: tx.totalValue,
              acquiredDate: tx.timestamp,
              source: 'Coinbase Convert'
            }

            const assetHoldings = this.holdings.get(tx.convertToAsset) || []
            assetHoldings.push(newHolding)
            this.holdings.set(tx.convertToAsset, assetHoldings)
          }
        }
      } else if (tx.type === 'send') {
        // Sending crypto may be a taxable event (treat as sell at current value)
        // Or it could be a transfer to another wallet (not taxable)
        warnings.push(
          `Row: ${tx.asset} send of ${tx.quantity} units - verify if this is a gift, payment, or wallet transfer`
        )
      }
    }

    return { transactions: brokerageTransactions, errors, warnings }
  }

  /**
   * Get current holdings for a specific asset
   */
  getHoldings(asset: string): CryptoHolding[] {
    return this.holdings.get(asset.toUpperCase()) || []
  }

  /**
   * Get all current holdings
   */
  getAllHoldings(): Map<string, CryptoHolding[]> {
    return new Map(this.holdings)
  }
}

export const coinbaseParser = new CoinbaseParser()
