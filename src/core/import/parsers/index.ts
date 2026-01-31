/**
 * Brokerage Parser Index
 *
 * Exports all brokerage-specific parsers and provides
 * utilities for automatic parser selection.
 */

export { TDAmeritradeParser, tdAmeritradeParser } from './tdAmeritrade'
export { SchwabParser, schwabParser } from './schwab'
export { FidelityParser, fidelityParser } from './fidelity'
export {
  GenericParser,
  genericParser,
  createGenericParser,
  GENERIC_FIELDS,
  getRequiredFields
} from './generic'
export type { GenericParserConfig, FieldDefinition } from './generic'

// Cryptocurrency parsers
export { CoinbaseParser, coinbaseParser } from './coinbase'
export { KrakenParser, krakenParser } from './kraken'
export {
  GenericCryptoParser,
  genericCryptoParser,
  createGenericCryptoParser,
  CRYPTO_FIELDS,
  getRequiredCryptoFields
} from './generic-crypto'
export type { CryptoColumnMapping, GenericCryptoParserConfig, CryptoFieldDefinition } from './generic-crypto'

// Crypto types
export * from './cryptoTypes'

import {
  BrokerageParser,
  BrokerageType,
  ParseResult,
  detectBrokerageType
} from '../brokerageParser'
import { tdAmeritradeParser } from './tdAmeritrade'
import { schwabParser } from './schwab'
import { fidelityParser } from './fidelity'
import { GenericParser, GenericParserConfig } from './generic'

/**
 * Map of brokerage types to their parsers
 */
const PARSERS: Record<Exclude<BrokerageType, 'generic'>, BrokerageParser> = {
  tdAmeritrade: tdAmeritradeParser,
  schwab: schwabParser,
  fidelity: fidelityParser
}

/**
 * Get a parser for the specified brokerage type
 */
export function getParser(brokerageType: BrokerageType): BrokerageParser {
  if (brokerageType === 'generic') {
    return new GenericParser()
  }
  return PARSERS[brokerageType]
}

/**
 * Get a parser that can handle the given CSV content
 * Returns the first matching parser, or generic as fallback
 */
export function findParser(content: string): BrokerageParser {
  const lines = content.split('\n')
  const headers = lines[0]?.split(',').map(h => h.toLowerCase().trim()) ?? []

  for (const parser of Object.values(PARSERS)) {
    if (parser.canParse(content, headers)) {
      return parser
    }
  }

  return new GenericParser()
}

/**
 * Auto-detect brokerage and parse content
 */
export function autoParseContent(content: string): {
  brokerageType: BrokerageType | null
  result: ParseResult
} {
  const detectedType = detectBrokerageType(content)

  if (detectedType && detectedType !== 'generic') {
    const parser = PARSERS[detectedType]
    return {
      brokerageType: detectedType,
      result: parser.parse(content)
    }
  }

  // Try each parser
  for (const [type, parser] of Object.entries(PARSERS)) {
    const lines = content.split('\n')
    const headers = lines[0]?.split(',').map(h => h.toLowerCase().trim()) ?? []

    if (parser.canParse(content, headers)) {
      return {
        brokerageType: type as BrokerageType,
        result: parser.parse(content)
      }
    }
  }

  // Fallback to generic (requires user mapping)
  return {
    brokerageType: null,
    result: {
      transactions: [],
      errors: [{ row: 0, message: 'Could not auto-detect brokerage format. Please select a format or use generic mapping.' }],
      warnings: []
    }
  }
}

/**
 * Parse content with a specific brokerage type
 */
export function parseWithType(
  content: string,
  brokerageType: BrokerageType,
  genericConfig?: GenericParserConfig
): ParseResult {
  if (brokerageType === 'generic') {
    const parser = new GenericParser(genericConfig)
    return parser.parse(content)
  }

  return PARSERS[brokerageType].parse(content)
}

/**
 * Get human-readable name for a brokerage type
 */
export function getBrokerageName(type: BrokerageType): string {
  const names: Record<BrokerageType, string> = {
    tdAmeritrade: 'TD Ameritrade',
    schwab: 'Charles Schwab',
    fidelity: 'Fidelity',
    generic: 'Generic / Other'
  }
  return names[type]
}

/**
 * Get all supported brokerage types
 */
export function getSupportedBrokerages(): BrokerageType[] {
  return ['tdAmeritrade', 'schwab', 'fidelity', 'generic']
}
