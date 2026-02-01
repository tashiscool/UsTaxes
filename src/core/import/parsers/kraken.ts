/**
 * Kraken Ledger CSV Parser
 *
 * Parses ledger CSV exports from Kraken cryptocurrency exchange.
 * Handles trades, deposits, withdrawals, and staking rewards.
 *
 * Typical Kraken Ledger CSV columns:
 * - txid, refid, time, type, subtype, aclass, asset
 * - amount, fee, balance
 *
 * Kraken also provides a Trades export with different columns:
 * - txid, ordertxid, pair, time, type, ordertype, price, cost, fee, vol, margin, misc, ledgers
 */

import {
  BaseBrokerageParser,
  BrokerageTransaction,
  BrokerageType,
  ParseResult,
  ParseError,
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
 * Kraken ledger column name mappings
 */
const KRAKEN_LEDGER_COLUMNS = {
  txid: ['txid', 'transaction id', 'id'],
  refid: ['refid', 'reference id', 'ref'],
  time: ['time', 'timestamp', 'datetime', 'date'],
  type: ['type', 'transaction type'],
  subtype: ['subtype', 'sub type', 'sub-type'],
  aclass: ['aclass', 'asset class', 'class'],
  asset: ['asset', 'currency', 'symbol'],
  amount: ['amount', 'quantity', 'qty'],
  fee: ['fee', 'fees'],
  balance: ['balance', 'running balance']
}

/**
 * Kraken trades column name mappings
 */
const KRAKEN_TRADES_COLUMNS = {
  txid: ['txid', 'trade id'],
  ordertxid: ['ordertxid', 'order id'],
  pair: ['pair', 'trading pair', 'market'],
  time: ['time', 'timestamp', 'datetime'],
  type: ['type', 'side', 'direction'],
  ordertype: ['ordertype', 'order type'],
  price: ['price', 'unit price'],
  cost: ['cost', 'total cost', 'total'],
  fee: ['fee', 'fees'],
  vol: ['vol', 'volume', 'quantity', 'amount'],
  margin: ['margin'],
  misc: ['misc', 'miscellaneous'],
  ledgers: ['ledgers', 'ledger ids']
}

/**
 * Maps Kraken transaction types to our internal types
 */
function mapKrakenType(
  krakenType: string,
  subtype?: string
): CryptoTransactionType {
  const type = krakenType.toLowerCase().trim()
  const sub = subtype?.toLowerCase().trim() || ''

  switch (type) {
    case 'trade':
    case 'buy':
      return 'buy'
    case 'sell':
      return 'sell'
    case 'deposit':
    case 'receive':
      return 'receive'
    case 'withdrawal':
    case 'withdraw':
    case 'send':
      return 'send'
    case 'staking':
      if (sub === 'reward' || sub === 'stakingfromspot') {
        return 'income'
      }
      return 'other'
    case 'reward':
    case 'earn':
    case 'interest':
      return 'income'
    case 'airdrop':
    case 'fork':
      return 'airdrop'
    case 'transfer':
      // Internal transfer between Kraken accounts
      return 'other'
    case 'margin':
      return 'other'
    default:
      return 'other'
  }
}

/**
 * Normalize Kraken asset symbols to standard format
 * Kraken uses prefixes like X for crypto and Z for fiat
 */
function normalizeKrakenAsset(asset: string): string {
  let normalized = asset.trim().toUpperCase()

  // Remove Kraken-specific prefixes
  if (normalized.startsWith('X') && normalized.length > 3) {
    normalized = normalized.slice(1)
  }
  if (normalized.startsWith('Z') && normalized.length > 3) {
    normalized = normalized.slice(1)
  }

  // Common Kraken naming differences
  const krakenAliases: Record<string, string> = {
    XBT: 'BTC',
    XXBT: 'BTC',
    XETH: 'ETH',
    XXRP: 'XRP',
    XLTC: 'LTC',
    XXLM: 'XLM',
    XXDG: 'DOGE',
    ZUSD: 'USD',
    ZEUR: 'EUR',
    ZGBP: 'GBP'
  }

  return krakenAliases[normalized] || normalizeAssetSymbol(normalized)
}

/**
 * Parse Kraken timestamp format
 */
function parseKrakenTimestamp(timestamp: string): Date | null {
  if (!timestamp || timestamp.trim() === '') {
    return null
  }

  // Kraken uses ISO format: 2023-01-15 10:30:45.1234
  const cleaned = timestamp.trim()

  // Try parsing directly
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) {
    return date
  }

  // Try parsing with T separator
  const withT = cleaned.replace(' ', 'T')
  const dateWithT = new Date(withT)
  if (!isNaN(dateWithT.getTime())) {
    return dateWithT
  }

  return null
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

/**
 * Determine if a pair is a sell (crypto to fiat/stablecoin)
 */
function isSellPair(pair: string, tradeType: string): boolean {
  const type = tradeType.toLowerCase()
  if (type === 'sell') return true
  if (type === 'buy') return false

  // Check if selling to fiat/stablecoin
  const quoteAsset = pair.slice(-3).toUpperCase()
  const stablecoins = ['USD', 'EUR', 'GBP', 'USDT', 'USDC', 'DAI', 'UST']
  return stablecoins.some((s) => quoteAsset.includes(s))
}

export class KrakenParser extends BaseBrokerageParser {
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
    return 'generic'
  }

  getCryptoExchangeType(): string {
    return 'kraken'
  }

  canParse(content: string, headers: string[]): boolean {
    const headerLine = headers.join(' ').toLowerCase()

    // Check for Kraken-specific patterns
    const hasKrakenMarkers =
      content.toLowerCase().includes('kraken') ||
      headerLine.includes('refid') ||
      headerLine.includes('aclass') ||
      headerLine.includes('ordertxid')

    // Check for Kraken ledger patterns
    const hasLedgerPatterns =
      headerLine.includes('txid') &&
      headerLine.includes('type') &&
      (headerLine.includes('asset') || headerLine.includes('amount'))

    // Check for Kraken trades patterns
    const hasTradesPatterns =
      headerLine.includes('pair') &&
      headerLine.includes('price') &&
      headerLine.includes('vol')

    return hasKrakenMarkers || hasLedgerPatterns || hasTradesPatterns
  }

  /**
   * Detect if content is a Ledger export or Trades export
   */
  private detectExportType(headers: string[]): 'ledger' | 'trades' {
    const headerLine = headers.join(' ').toLowerCase()

    if (
      headerLine.includes('pair') &&
      headerLine.includes('price') &&
      headerLine.includes('vol')
    ) {
      return 'trades'
    }

    return 'ledger'
  }

  /**
   * Parse Kraken ledger CSV into crypto transactions
   */
  parseLedgerTransactions(
    rows: string[][],
    headerRowIndex: number,
    actualHeaders: string[]
  ): {
    transactions: CryptoTransaction[]
    errors: ParseError[]
    warnings: string[]
  } {
    const transactions: CryptoTransaction[] = []
    const errors: ParseError[] = []
    const warnings: string[] = []

    // Map columns
    const columnMap = {
      txid: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.txid),
      refid: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.refid),
      time: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.time),
      type: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.type),
      subtype: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.subtype),
      asset: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.asset),
      amount: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.amount),
      fee: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.fee),
      balance: findColumn(actualHeaders, KRAKEN_LEDGER_COLUMNS.balance)
    }

    // Validate required columns
    if (columnMap.time < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'time',
        message: 'Could not find Time column'
      })
    }
    if (columnMap.type < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'type',
        message: 'Could not find Type column'
      })
    }
    if (columnMap.asset < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'asset',
        message: 'Could not find Asset column'
      })
    }
    if (columnMap.amount < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'amount',
        message: 'Could not find Amount column'
      })
    }

    if (errors.length > 0) {
      return { transactions, errors, warnings }
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      if (row.length === 0 || row.every((c) => c === '')) continue

      try {
        const txid = columnMap.txid >= 0 ? row[columnMap.txid] : `kraken-${i}`
        const timeStr = row[columnMap.time]
        const typeStr = row[columnMap.type]
        const subtype =
          columnMap.subtype >= 0 ? row[columnMap.subtype] : undefined
        const asset = row[columnMap.asset]
        const amountStr = row[columnMap.amount]
        const feeStr = columnMap.fee >= 0 ? row[columnMap.fee] : '0'

        if (!asset || asset.trim() === '') continue

        const timestamp = parseKrakenTimestamp(timeStr)
        if (!timestamp) {
          errors.push({
            row: i + 1,
            column: 'time',
            message: `Invalid timestamp: ${timeStr}`
          })
          continue
        }

        const amount = parseFloat(amountStr.replace(/,/g, '')) || 0
        if (amount === 0) continue

        const fee = Math.abs(parseFloat(feeStr.replace(/,/g, '')) || 0)
        const normalizedAsset = normalizeKrakenAsset(asset)
        const transactionType = mapKrakenType(typeStr, subtype)

        // Skip fiat currencies for most transaction types
        const fiatCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF']
        if (
          fiatCurrencies.includes(normalizedAsset) &&
          transactionType !== 'income'
        ) {
          continue
        }

        const transaction: CryptoTransaction = {
          id: txid,
          timestamp,
          type: transactionType,
          asset: normalizedAsset,
          quantity: Math.abs(amount),
          pricePerUnit: 0, // Ledger doesn't include price - will need to be enriched
          totalValue: 0,
          fees: fee,
          notes: subtype || undefined,
          exchange: 'Kraken',
          rawData: row
        }

        // Determine if this is a buy or sell based on amount sign for trades
        if (typeStr.toLowerCase() === 'trade') {
          if (amount > 0) {
            transaction.type = 'buy'
          } else {
            transaction.type = 'sell'
          }
        }

        transactions.push(transaction)

        // Add income tracking
        if (transactionType === 'income') {
          warnings.push(
            `Row ${i + 1}: ${normalizedAsset} staking reward of ${Math.abs(
              amount
            )} units should be reported as ordinary income`
          )
        }
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
   * Parse Kraken trades CSV into crypto transactions
   */
  parseTradesTransactions(
    rows: string[][],
    headerRowIndex: number,
    actualHeaders: string[]
  ): {
    transactions: CryptoTransaction[]
    errors: ParseError[]
    warnings: string[]
  } {
    const transactions: CryptoTransaction[] = []
    const errors: ParseError[] = []
    const warnings: string[] = []

    // Map columns
    const columnMap = {
      txid: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.txid),
      pair: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.pair),
      time: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.time),
      type: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.type),
      price: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.price),
      cost: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.cost),
      fee: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.fee),
      vol: findColumn(actualHeaders, KRAKEN_TRADES_COLUMNS.vol)
    }

    // Validate required columns
    if (columnMap.pair < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'pair',
        message: 'Could not find Pair column'
      })
    }
    if (columnMap.time < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'time',
        message: 'Could not find Time column'
      })
    }
    if (columnMap.vol < 0) {
      errors.push({
        row: headerRowIndex,
        column: 'vol',
        message: 'Could not find Volume column'
      })
    }

    if (errors.length > 0) {
      return { transactions, errors, warnings }
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]

      if (row.length === 0 || row.every((c) => c === '')) continue

      try {
        const txid =
          columnMap.txid >= 0 ? row[columnMap.txid] : `kraken-trade-${i}`
        const pair = row[columnMap.pair]
        const timeStr = row[columnMap.time]
        const typeStr = columnMap.type >= 0 ? row[columnMap.type] : ''
        const priceStr = columnMap.price >= 0 ? row[columnMap.price] : '0'
        const costStr = columnMap.cost >= 0 ? row[columnMap.cost] : '0'
        const feeStr = columnMap.fee >= 0 ? row[columnMap.fee] : '0'
        const volStr = row[columnMap.vol]

        if (!pair || pair.trim() === '') continue

        const timestamp = parseKrakenTimestamp(timeStr)
        if (!timestamp) {
          errors.push({
            row: i + 1,
            column: 'time',
            message: `Invalid timestamp: ${timeStr}`
          })
          continue
        }

        const volume = Math.abs(parseFloat(volStr.replace(/,/g, '')) || 0)
        if (volume === 0) continue

        const price = parseCurrency(priceStr)
        const cost = parseCurrency(costStr)
        const fee = parseCurrency(feeStr)

        // Parse trading pair (e.g., XBTUSDT, ETHEUR)
        // Kraken pairs are usually BASE+QUOTE without separator
        const baseAsset = normalizeKrakenAsset(
          pair.slice(0, Math.ceil(pair.length / 2))
        )
        const isSell = isSellPair(pair, typeStr)

        const transaction: CryptoTransaction = {
          id: txid,
          timestamp,
          type: isSell ? 'sell' : 'buy',
          asset: baseAsset,
          quantity: volume,
          pricePerUnit: price,
          totalValue: cost || price * volume,
          fees: fee,
          exchange: 'Kraken',
          rawData: row
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
   * Parse Kraken CSV into crypto transactions (auto-detects format)
   */
  parseCryptoTransactions(content: string): {
    transactions: CryptoTransaction[]
    errors: ParseError[]
    warnings: string[]
  } {
    const rows = this.parseCSV(content)
    if (rows.length < 2) {
      return {
        transactions: [],
        errors: [{ row: 0, message: 'CSV file is empty or has no data rows' }],
        warnings: []
      }
    }

    // Find header row
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowLower = rows[i].map((c) => c.toLowerCase())
      if (
        rowLower.some((c) => c.includes('txid') || c.includes('time')) &&
        rowLower.some(
          (c) => c.includes('type') || c.includes('pair') || c.includes('asset')
        )
      ) {
        headerRowIndex = i
        break
      }
    }

    const actualHeaders = rows[headerRowIndex].map((h) =>
      h.toLowerCase().trim()
    )
    const exportType = this.detectExportType(actualHeaders)

    if (exportType === 'trades') {
      return this.parseTradesTransactions(rows, headerRowIndex, actualHeaders)
    } else {
      return this.parseLedgerTransactions(rows, headerRowIndex, actualHeaders)
    }
  }

  /**
   * Convert crypto transactions to brokerage transactions for Form 8949
   */
  parse(content: string): ParseResult {
    const {
      transactions: cryptoTxs,
      errors,
      warnings
    } = this.parseCryptoTransactions(content)
    const brokerageTransactions: BrokerageTransaction[] = []

    // Reset holdings
    this.holdings.clear()

    // Sort by timestamp
    const sortedTxs = [...cryptoTxs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    // Process transactions
    for (const tx of sortedTxs) {
      if (
        tx.type === 'buy' ||
        tx.type === 'receive' ||
        tx.type === 'income' ||
        tx.type === 'airdrop' ||
        tx.type === 'mining'
      ) {
        // Add to holdings
        const costBasis = tx.type === 'receive' ? 0 : tx.totalValue
        const holding: CryptoHolding = {
          asset: tx.asset,
          quantity: tx.quantity,
          costBasisPerUnit: costBasis / tx.quantity,
          totalCostBasis: costBasis,
          acquiredDate: tx.timestamp,
          source: tx.exchange || 'Kraken',
          txId: tx.id
        }

        const assetHoldings = this.holdings.get(tx.asset) || []
        assetHoldings.push(holding)
        this.holdings.set(tx.asset, assetHoldings)
      } else if (tx.type === 'sell') {
        // Calculate cost basis
        const result = calculateCostBasis(
          this.holdings.get(tx.asset) || [],
          tx.quantity,
          this.costBasisMethod
        )

        if (result.error) {
          warnings.push(`${tx.asset}: ${result.error}`)
        }

        this.holdings.set(tx.asset, result.remainingHoldings)

        // Create Form 8949 entries
        for (const lot of result.lotsUsed) {
          const proceeds =
            tx.pricePerUnit * lot.quantitySold -
            tx.fees * (lot.quantitySold / tx.quantity)
          const gainLoss = proceeds - lot.costBasis

          const brokerageTx: BrokerageTransaction = {
            symbol: tx.asset,
            description: `${tx.asset} - Kraken`,
            dateAcquired: lot.acquiredDate,
            dateSold: tx.timestamp,
            proceeds,
            costBasis: lot.costBasis,
            gainLoss,
            isShortTerm: isShortTermTransaction(lot.acquiredDate, tx.timestamp),
            isCovered: false, // Crypto exchanges typically don't report to IRS
            quantity: lot.quantitySold
          }

          brokerageTransactions.push(brokerageTx)
        }
      } else if (tx.type === 'send') {
        warnings.push(
          `Row: ${tx.asset} withdrawal of ${tx.quantity} units - verify if this is a taxable event`
        )
      }
    }

    return { transactions: brokerageTransactions, errors, warnings }
  }

  /**
   * Get staking rewards summary
   */
  getStakingRewardsSummary(content: string): {
    byAsset: Map<string, number>
    total: number
  } {
    const { transactions } = this.parseCryptoTransactions(content)
    const byAsset = new Map<string, number>()
    let total = 0

    for (const tx of transactions) {
      if (tx.type === 'income') {
        const current = byAsset.get(tx.asset) || 0
        byAsset.set(tx.asset, current + tx.totalValue)
        total += tx.totalValue
      }
    }

    return { byAsset, total }
  }

  getHoldings(asset: string): CryptoHolding[] {
    return this.holdings.get(asset.toUpperCase()) || []
  }

  getAllHoldings(): Map<string, CryptoHolding[]> {
    return new Map(this.holdings)
  }
}

export const krakenParser = new KrakenParser()
