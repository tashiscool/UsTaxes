/**
 * Test Data Utilities Index
 *
 * Exports all test data parsing and generation utilities for UsTaxes
 * integration testing with vendor repositories.
 */

// =============================================================================
// IRS Direct File Fact Graph Parser
// =============================================================================
export {
  parseFactGraph,
  parseMultipleFactGraphs,
  validateFactGraph
} from './factGraphParser'

export type {
  FactGraphData,
  FilerWrapper,
  W2Wrapper,
  Form1099IntWrapper,
  Form1099DivWrapper
} from './factGraphParser'

// =============================================================================
// HabuTax INI Parser
// =============================================================================
export {
  parseHabutax,
  parseMultipleHabutax,
  validateHabutax,
  getHabutaxSections
} from './habutaxParser'

export type { ParsedIni, IniSection } from './habutaxParser'

// =============================================================================
// Tax-Calculator Policy Importer
// =============================================================================
export {
  parseTaxCalculatorPolicy,
  getAllBrackets,
  generateTypeScriptConstants,
  getAvailableYears,
  compareYears
} from './taxCalculatorImporter'

export type {
  TaxParameters,
  TaxBrackets,
  DeductionAmounts,
  EITCParameters,
  CTCParameters,
  AMTParameters,
  CapitalGainsParameters,
  SocialSecurityParameters,
  MedicareParameters,
  TaxCalculatorPolicy,
  PolicyParameter
} from './taxCalculatorImporter'

// =============================================================================
// Test Data Generator
// =============================================================================
export {
  generateTestSSN,
  generateTestEIN,
  isTestSSN,
  generateTestScenario,
  generatePresetScenarios,
  generateRandomScenarios
} from './testDataGenerator'

export type {
  IncomeLevel,
  TestScenarioOptions,
  TestScenario,
  SeededRandom
} from './testDataGenerator'

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Result of parsing with validation
 */
export interface ParseResult<T> {
  success: boolean
  data?: T
  errors: string[]
}

/**
 * Wrap a parser function with validation
 */
export function parseWithValidation<T>(
  parser: (input: string) => T,
  validator: (input: string) => { isValid: boolean; errors: string[] }
): (input: string) => ParseResult<T> {
  return (input: string): ParseResult<T> => {
    const validation = validator(input)
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      }
    }

    try {
      const data = parser(input)
      return {
        success: true,
        data,
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown parsing error'
        ]
      }
    }
  }
}

/**
 * Batch process multiple files with error handling
 */
export function batchParse<T>(
  inputs: string[],
  parser: (input: string) => T
): Array<{ index: number; result: T | null; error?: string }> {
  return inputs.map((input, index) => {
    try {
      return { index, result: parser(input) }
    } catch (error) {
      return {
        index,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}

// =============================================================================
// Re-export Information type for convenience
// =============================================================================
export type { Information } from 'ustaxes/core/data'
