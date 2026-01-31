/**
 * Payroll Import Module Index
 *
 * Exports all payroll/W-2 import parsers and utilities
 */

// Types
export * from './types'

// Parsers
export { ADPParser, adpParser } from './adp'
export { PaychexParser, paychexParser } from './paychex'
export { GustoParser, gustoParser } from './gusto'

import { PayrollParser, PayrollParseResult, W2ImportData } from './types'
import { adpParser } from './adp'
import { paychexParser } from './paychex'
import { gustoParser } from './gusto'

/**
 * Supported payroll providers
 */
export type PayrollProvider = 'adp' | 'paychex' | 'gusto' | 'generic'

/**
 * Map of providers to parsers
 */
const PARSERS: Record<Exclude<PayrollProvider, 'generic'>, PayrollParser> = {
  adp: adpParser,
  paychex: paychexParser,
  gusto: gustoParser
}

/**
 * Get parser for a specific provider
 */
export function getPayrollParser(provider: PayrollProvider): PayrollParser | null {
  if (provider === 'generic') return null
  return PARSERS[provider]
}

/**
 * Auto-detect payroll provider from CSV content
 */
export function detectPayrollProvider(content: string): PayrollProvider | null {
  const lines = content.split('\n').slice(0, 10)
  const headers = lines[0]?.split(',').map(h => h.toLowerCase().trim()) ?? []

  for (const [provider, parser] of Object.entries(PARSERS)) {
    if (parser.canParse(content, headers)) {
      return provider as PayrollProvider
    }
  }

  return null
}

/**
 * Parse content with auto-detection
 */
export function autoParsePayroll(content: string): {
  provider: PayrollProvider | null
  result: PayrollParseResult
} {
  const provider = detectPayrollProvider(content)

  if (provider && provider !== 'generic') {
    const parser = PARSERS[provider]
    return {
      provider,
      result: parser.parse(content)
    }
  }

  return {
    provider: null,
    result: {
      w2s: [],
      errors: [{ row: 0, message: 'Could not auto-detect payroll provider format' }],
      warnings: []
    }
  }
}

/**
 * Parse content with specific provider
 */
export function parseWithProvider(
  content: string,
  provider: PayrollProvider
): PayrollParseResult {
  if (provider === 'generic') {
    return {
      w2s: [],
      errors: [{ row: 0, message: 'Generic provider requires manual column mapping' }],
      warnings: []
    }
  }

  return PARSERS[provider].parse(content)
}

/**
 * Get human-readable provider name
 */
export function getProviderName(provider: PayrollProvider): string {
  const names: Record<PayrollProvider, string> = {
    adp: 'ADP',
    paychex: 'Paychex',
    gusto: 'Gusto',
    generic: 'Other / Generic'
  }
  return names[provider]
}

/**
 * Get all supported providers
 */
export function getSupportedProviders(): PayrollProvider[] {
  return ['adp', 'paychex', 'gusto', 'generic']
}

/**
 * Validate W2 data for completeness
 */
export function validateW2Data(w2: W2ImportData): string[] {
  const issues: string[] = []

  if (!w2.employerEIN) {
    issues.push('Missing employer EIN')
  }
  if (!w2.employerName) {
    issues.push('Missing employer name')
  }
  if (w2.wages <= 0) {
    issues.push('Wages must be greater than zero')
  }
  if (w2.federalWithholding < 0) {
    issues.push('Federal withholding cannot be negative')
  }

  // Check for common data issues
  if (w2.ssWages && w2.ssWages > 160200) { // 2023 SS wage base
    issues.push('Social Security wages exceed the annual wage base')
  }

  if (w2.stateTax && w2.stateTax > 0 && !w2.stateCode) {
    issues.push('State tax withheld but no state code specified')
  }

  return issues
}
