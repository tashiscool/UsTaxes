/**
 * CSV Format Detection Service
 *
 * Identifies which brokerage a CSV file originated from by matching header
 * patterns and content fingerprints. Returns a DetectedFormat with a
 * suggested parser name so the upload pipeline can route accordingly.
 */

export type BrokerageFormat =
  | 'schwab'
  | 'fidelity'
  | 'vanguard'
  | 'etrade'
  | 'tdameritrade'
  | 'robinhood'
  | 'coinbase'
  | 'kraken'
  | 'interactive_brokers'
  | 'merrill'
  | 'webull'
  | 'unknown'

export interface DetectedFormat {
  brokerage: BrokerageFormat
  confidence: number
  suggestedParser: string
  headerRow: number
}

interface BrokerageRule {
  brokerage: BrokerageFormat
  suggestedParser: string
  /** Required header tokens — all must be present (case-insensitive) */
  required: string[]
  /** Optional reinforcing tokens — each match adds to the confidence score */
  optional?: string[]
  /** Some brokerages embed a magic string in early rows before the header */
  magicPattern?: RegExp
  /** Which row index (0-based) the headers typically appear on */
  headerRowHint?: number
}

const RULES: BrokerageRule[] = [
  {
    brokerage: 'schwab',
    suggestedParser: 'parseSchwabCsv',
    required: ['symbol', 'quantity', 'price', 'amount'],
    optional: ['date', 'description', 'fees', 'realized gain/loss'],
    magicPattern: /schwab/i
  },
  {
    brokerage: 'fidelity',
    suggestedParser: 'parseFidelityCsv',
    required: ['settlement date', 'action', 'symbol', 'quantity', 'amount ($)'],
    optional: ['description', 'commission ($)'],
    magicPattern: /fidelity/i
  },
  {
    brokerage: 'vanguard',
    suggestedParser: 'parseVanguardCsv',
    required: [
      'trade date',
      'settlement date',
      'transaction type',
      'security description'
    ],
    optional: ['shares', 'share price', 'principal amount'],
    magicPattern: /vanguard/i
  },
  {
    brokerage: 'etrade',
    suggestedParser: 'parseEtradeCsv',
    required: ['transactiontype', 'transactiondate', 'symbol', 'netamount'],
    optional: ['description', 'quantity', 'price', 'commission'],
    magicPattern: /e\*?trade/i
  },
  {
    brokerage: 'tdameritrade',
    suggestedParser: 'parseTdAmeritraCsv',
    required: [
      'date',
      'transaction id',
      'description',
      'quantity',
      'symbol',
      'price',
      'amount'
    ],
    optional: ['commission', 'reg fee', 'type'],
    magicPattern: /td ameritrade/i
  },
  {
    brokerage: 'robinhood',
    suggestedParser: 'parseRobinhoodCsv',
    required: [
      'activity date',
      'process date',
      'settle date',
      'instrument',
      'trans code',
      'quantity',
      'price'
    ],
    optional: ['amount', 'description'],
    magicPattern: /robinhood/i
  },
  {
    brokerage: 'coinbase',
    suggestedParser: 'parseCoinbaseCsv',
    required: [
      'timestamp',
      'transaction type',
      'asset',
      'quantity transacted',
      'spot price currency',
      'spot price at transaction'
    ],
    optional: [
      'subtotal',
      'total (inclusive of fees and/or spread)',
      'fees and/or spread',
      'notes'
    ],
    magicPattern: /coinbase/i
  },
  {
    brokerage: 'kraken',
    suggestedParser: 'parseKrakenCsv',
    required: [
      'txid',
      'refid',
      'time',
      'type',
      'subtype',
      'aclass',
      'asset',
      'amount',
      'fee',
      'balance'
    ],
    optional: ['wallet'],
    magicPattern: /kraken/i
  },
  {
    brokerage: 'interactive_brokers',
    suggestedParser: 'parseIbkrCsv',
    required: [
      'clientaccountid',
      'symbol',
      'buysell',
      'quantity',
      'tradeprice'
    ],
    optional: ['assetcategory', 'currency', 'ib commission'],
    magicPattern: /interactive brokers|ibkr/i,
    headerRowHint: 1
  },
  {
    brokerage: 'merrill',
    suggestedParser: 'parseMerrillCsv',
    required: ['date', 'description', 'quantity', 'price', 'amount'],
    optional: ['type', 'cusip'],
    magicPattern: /merrill/i
  },
  {
    brokerage: 'webull',
    suggestedParser: 'parseWebullCsv',
    required: [
      'order time',
      'symbol',
      'side',
      'filled qty',
      'avg price',
      'filled amount'
    ],
    optional: ['status', 'account type'],
    magicPattern: /webull/i
  }
]

function normalizeHeaders(row: string): string[] {
  return row.split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase())
}

function scoreRule(
  rule: BrokerageRule,
  headers: string[],
  rawContent: string
): number {
  const headerSet = new Set(headers)

  const allRequired = rule.required.every((r) => headerSet.has(r))
  if (!allRequired) return 0

  let score = 0.7
  const optionalHits = (rule.optional ?? []).filter((o) =>
    headerSet.has(o)
  ).length
  score += (optionalHits / Math.max((rule.optional ?? []).length, 1)) * 0.2

  if (rule.magicPattern?.test(rawContent.slice(0, 2048))) {
    score = Math.min(score + 0.1, 1.0)
  }

  return score
}

/**
 * Scans the first 20 rows looking for a row where required header tokens match.
 * Returns the row index and the parsed headers, or null if no match found.
 */
function findHeaderRow(
  rows: string[],
  rule: BrokerageRule
): { rowIndex: number; headers: string[] } | null {
  const limit = Math.min(rows.length, 20)
  const startHint = rule.headerRowHint ?? 0

  for (let i = startHint; i < limit; i++) {
    const headers = normalizeHeaders(rows[i])
    const allRequired = rule.required.every((r) => headers.includes(r))
    if (allRequired) return { rowIndex: i, headers }
  }
  return null
}

export function detectCsvFormat(csvContent: string): DetectedFormat {
  const rows = csvContent.split(/\r?\n/).filter((r) => r.trim().length > 0)
  if (rows.length === 0) {
    return {
      brokerage: 'unknown',
      confidence: 0,
      suggestedParser: 'parseUnknownCsv',
      headerRow: 0
    }
  }

  let bestMatch: {
    rule: BrokerageRule
    score: number
    headerRow: number
  } | null = null

  for (const rule of RULES) {
    const found = findHeaderRow(rows, rule)
    if (!found) continue

    const score = scoreRule(rule, found.headers, csvContent)
    if (score > 0 && (bestMatch === null || score > bestMatch.score)) {
      bestMatch = { rule, score, headerRow: found.rowIndex }
    }
  }

  if (!bestMatch || bestMatch.score < 0.5) {
    return {
      brokerage: 'unknown',
      confidence: 0,
      suggestedParser: 'parseUnknownCsv',
      headerRow: 0
    }
  }

  return {
    brokerage: bestMatch.rule.brokerage,
    confidence: Math.round(bestMatch.score * 100) / 100,
    suggestedParser: bestMatch.rule.suggestedParser,
    headerRow: bestMatch.headerRow
  }
}
