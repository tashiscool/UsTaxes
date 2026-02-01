/**
 * MeF Validation Module
 *
 * This module provides comprehensive validation for IRS e-file submissions,
 * including both XML schema validation and business rule checking.
 *
 * @module efile/validation
 */

// ============================================================================
// Exports from Schema Validator
// ============================================================================

export {
  SchemaValidator,
  ValidationSeverity,
  type ValidationError,
  type ValidationResult
} from './schemaValidator'

// ============================================================================
// Exports from Business Rules
// ============================================================================

export {
  BusinessRulesEngine,
  RuleSeverity,
  RuleCategory,
  type BusinessRuleError,
  type BusinessRule,
  type TaxReturnData,
  // Rule sets for direct access
  RULES_1040,
  RULES_SCHEDULE_A,
  RULES_SCHEDULE_C,
  RULES_SCHEDULE_SE
} from './businessRules'

// ============================================================================
// Import for convenience function
// ============================================================================

import {
  SchemaValidator,
  ValidationResult,
  ValidationSeverity
} from './schemaValidator'
import {
  BusinessRulesEngine,
  BusinessRuleError,
  RuleSeverity,
  RuleCategory,
  TaxReturnData
} from './businessRules'

// ============================================================================
// Types for Combined Validation
// ============================================================================

/**
 * Combined result from both schema and business rule validation
 */
export interface SubmissionValidationResult {
  /** Whether the submission is valid for filing */
  valid: boolean

  /** Timestamp of validation */
  timestamp: Date

  /** Tax year being validated */
  taxYear: number

  /** Schema validation results */
  schemaValidation: {
    valid: boolean
    errors: ValidationResult['errors']
    warnings: ValidationResult['warnings']
  }

  /** Business rule validation results */
  businessRules: {
    valid: boolean
    errors: BusinessRuleError[]
    warnings: BusinessRuleError[]
  }

  /** Summary statistics */
  summary: {
    totalErrors: number
    totalWarnings: number
    schemaErrors: number
    businessRuleErrors: number
    isReadyForSubmission: boolean
  }

  /** List of all blocking issues that must be resolved */
  blockingIssues: Array<{
    source: 'schema' | 'businessRule'
    code: string
    message: string
    fields?: string[]
  }>

  /** List of warnings to review */
  warningsToReview: Array<{
    source: 'schema' | 'businessRule'
    code: string
    message: string
    suggestion?: string
  }>
}

/**
 * Options for validation
 */
export interface ValidationOptions {
  /** Tax year for validation (default: current year) */
  taxYear?: number

  /** Form type being validated */
  formType?: string

  /** Whether to include informational messages */
  includeInfo?: boolean

  /** Whether to stop on first error */
  stopOnFirstError?: boolean

  /** Custom business rules to add */
  customRules?: import('./businessRules').BusinessRule[]
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Validates a tax return for submission to the IRS MeF system.
 *
 * This function performs both schema validation (XML structure) and
 * business rule validation (IRS requirements) and returns a combined result.
 *
 * @param xml - The XML document to validate
 * @param returnData - The tax return data for business rule checking
 * @param options - Validation options
 * @returns Combined validation result
 *
 * @example
 * ```typescript
 * import { validateForSubmission } from 'ustaxes/efile/validation';
 *
 * const result = await validateForSubmission(
 *   xmlString,
 *   taxReturnData,
 *   { taxYear: 2024, formType: 'Form1040' }
 * );
 *
 * if (result.valid) {
 *   console.log('Return is ready for submission!');
 * } else {
 *   console.log('Issues found:');
 *   result.blockingIssues.forEach(issue => {
 *     console.log(`  - ${issue.message}`);
 *   });
 * }
 * ```
 */
export async function validateForSubmission(
  xml: string,
  returnData: TaxReturnData,
  options: ValidationOptions = {}
): Promise<SubmissionValidationResult> {
  const {
    taxYear = new Date().getFullYear(),
    formType = 'Form1040',
    includeInfo = false,
    stopOnFirstError = false,
    customRules = []
  } = options

  // Initialize validators
  const schemaValidator = new SchemaValidator(taxYear)
  const businessRulesEngine = new BusinessRulesEngine()

  // Add any custom rules
  if (customRules.length > 0) {
    businessRulesEngine.addRules(customRules)
  }

  // Run schema validation
  const schemaResult = await schemaValidator.validate(xml, formType)

  // Early exit if stop on first error and schema has errors
  if (stopOnFirstError && schemaResult.errors.length > 0) {
    return buildResult(schemaResult, [], taxYear, stopOnFirstError, includeInfo)
  }

  // Run business rule validation
  const businessRuleErrors = businessRulesEngine.check(returnData, taxYear)

  return buildResult(
    schemaResult,
    businessRuleErrors,
    taxYear,
    stopOnFirstError,
    includeInfo
  )
}

/**
 * Validates only the XML schema (no business rules)
 *
 * @param xml - The XML document to validate
 * @param formType - The form type
 * @param taxYear - The tax year
 * @returns Schema validation result
 */
export async function validateSchema(
  xml: string,
  formType: string,
  taxYear: number = new Date().getFullYear()
): Promise<ValidationResult> {
  const validator = new SchemaValidator(taxYear)
  return validator.validate(xml, formType)
}

/**
 * Validates only business rules (no schema validation)
 *
 * @param returnData - The tax return data
 * @param taxYear - The tax year
 * @returns Array of business rule errors
 */
export function validateBusinessRules(
  returnData: TaxReturnData,
  taxYear: number = new Date().getFullYear()
): BusinessRuleError[] {
  const engine = new BusinessRulesEngine()
  return engine.check(returnData, taxYear)
}

/**
 * Quick check if a return is ready for submission
 *
 * @param xml - The XML document
 * @param returnData - The tax return data
 * @param taxYear - The tax year
 * @returns true if no blocking errors exist
 */
export async function isReadyForSubmission(
  xml: string,
  returnData: TaxReturnData,
  taxYear: number = new Date().getFullYear()
): Promise<boolean> {
  const result = await validateForSubmission(xml, returnData, { taxYear })
  return result.valid
}

/**
 * Gets a summary of validation issues without full details
 *
 * @param xml - The XML document
 * @param returnData - The tax return data
 * @param taxYear - The tax year
 * @returns Validation summary
 */
export async function getValidationSummary(
  xml: string,
  returnData: TaxReturnData,
  taxYear: number = new Date().getFullYear()
): Promise<{
  isValid: boolean
  errorCount: number
  warningCount: number
  categories: string[]
}> {
  const result = await validateForSubmission(xml, returnData, { taxYear })

  const categories = new Set<string>()
  result.blockingIssues.forEach((issue) => categories.add(issue.source))
  result.warningsToReview.forEach((issue) => categories.add(issue.source))

  return {
    isValid: result.valid,
    errorCount: result.summary.totalErrors,
    warningCount: result.summary.totalWarnings,
    categories: Array.from(categories)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the combined validation result
 */
function buildResult(
  schemaResult: ValidationResult,
  businessRuleErrors: BusinessRuleError[],
  taxYear: number,
  _stopOnFirstError: boolean,
  _includeInfo: boolean
): SubmissionValidationResult {
  const schemaErrors = schemaResult.errors
  const schemaWarnings = schemaResult.warnings
  const brErrors = businessRuleErrors.filter(
    (e) => e.severity === RuleSeverity.ERROR
  )
  const brWarnings = businessRuleErrors.filter(
    (e) => e.severity === RuleSeverity.WARNING
  )

  const totalErrors = schemaErrors.length + brErrors.length
  const totalWarnings = schemaWarnings.length + brWarnings.length

  // Build blocking issues list
  const blockingIssues: SubmissionValidationResult['blockingIssues'] = []

  schemaErrors.forEach((error) => {
    blockingIssues.push({
      source: 'schema',
      code: error.code,
      message: error.message,
      fields: error.fieldReference ? [error.fieldReference] : undefined
    })
  })

  brErrors.forEach((error) => {
    blockingIssues.push({
      source: 'businessRule',
      code: error.ruleId,
      message: error.message,
      fields: error.fields
    })
  })

  // Build warnings list
  const warningsToReview: SubmissionValidationResult['warningsToReview'] = []

  schemaWarnings.forEach((warning) => {
    warningsToReview.push({
      source: 'schema',
      code: warning.code,
      message: warning.message,
      suggestion: warning.suggestion
    })
  })

  brWarnings.forEach((warning) => {
    warningsToReview.push({
      source: 'businessRule',
      code: warning.ruleId,
      message: warning.message,
      suggestion: warning.suggestion
    })
  })

  return {
    valid: totalErrors === 0,
    timestamp: new Date(),
    taxYear,
    schemaValidation: {
      valid: schemaErrors.length === 0,
      errors: schemaErrors,
      warnings: schemaWarnings
    },
    businessRules: {
      valid: brErrors.length === 0,
      errors: brErrors,
      warnings: brWarnings
    },
    summary: {
      totalErrors,
      totalWarnings,
      schemaErrors: schemaErrors.length,
      businessRuleErrors: brErrors.length,
      isReadyForSubmission: totalErrors === 0
    },
    blockingIssues,
    warningsToReview
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new SchemaValidator instance
 *
 * @param taxYear - The tax year for schema selection
 * @returns New SchemaValidator instance
 */
export function createSchemaValidator(taxYear?: number): SchemaValidator {
  return new SchemaValidator(taxYear)
}

/**
 * Creates a new BusinessRulesEngine instance
 *
 * @returns New BusinessRulesEngine instance
 */
export function createBusinessRulesEngine(): BusinessRulesEngine {
  return new BusinessRulesEngine()
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts validation errors to a printable string format
 *
 * @param result - The validation result
 * @returns Formatted string of errors
 */
export function formatValidationErrors(
  result: SubmissionValidationResult
): string {
  const lines: string[] = []

  lines.push('=== Validation Results ===')
  lines.push(`Status: ${result.valid ? 'VALID' : 'INVALID'}`)
  lines.push(`Tax Year: ${result.taxYear}`)
  lines.push(`Timestamp: ${result.timestamp.toISOString()}`)
  lines.push('')

  if (result.blockingIssues.length > 0) {
    lines.push('--- ERRORS (Must Fix) ---')
    result.blockingIssues.forEach((issue, index) => {
      lines.push(`${index + 1}. [${issue.source.toUpperCase()}] ${issue.code}`)
      lines.push(`   ${issue.message}`)
      if (issue.fields && issue.fields.length > 0) {
        lines.push(`   Fields: ${issue.fields.join(', ')}`)
      }
    })
    lines.push('')
  }

  if (result.warningsToReview.length > 0) {
    lines.push('--- WARNINGS (Review) ---')
    result.warningsToReview.forEach((warning, index) => {
      lines.push(
        `${index + 1}. [${warning.source.toUpperCase()}] ${warning.code}`
      )
      lines.push(`   ${warning.message}`)
      if (warning.suggestion) {
        lines.push(`   Suggestion: ${warning.suggestion}`)
      }
    })
    lines.push('')
  }

  lines.push('--- Summary ---')
  lines.push(`Total Errors: ${result.summary.totalErrors}`)
  lines.push(`Total Warnings: ${result.summary.totalWarnings}`)
  lines.push(
    `Ready for Submission: ${
      result.summary.isReadyForSubmission ? 'Yes' : 'No'
    }`
  )

  return lines.join('\n')
}

/**
 * Filters validation result to only show issues for specific forms
 *
 * @param result - The validation result
 * @param formTypes - Array of form types to filter by
 * @returns Filtered validation result
 */
export function filterByForms(
  result: SubmissionValidationResult,
  formTypes: string[]
): SubmissionValidationResult {
  const filteredBusinessErrors = result.businessRules.errors.filter((e) =>
    e.forms.some((f) => formTypes.includes(f))
  )
  const filteredBusinessWarnings = result.businessRules.warnings.filter((e) =>
    e.forms.some((f) => formTypes.includes(f))
  )

  const filteredBlockingIssues = result.blockingIssues.filter((issue) => {
    if (issue.source === 'businessRule') {
      const br = result.businessRules.errors.find(
        (e) => e.ruleId === issue.code
      )
      return br && br.forms.some((f) => formTypes.includes(f))
    }
    return true // Keep all schema errors
  })

  const filteredWarnings = result.warningsToReview.filter((warning) => {
    if (warning.source === 'businessRule') {
      const br = result.businessRules.warnings.find(
        (e) => e.ruleId === warning.code
      )
      return br && br.forms.some((f) => formTypes.includes(f))
    }
    return true // Keep all schema warnings
  })

  return {
    ...result,
    businessRules: {
      ...result.businessRules,
      errors: filteredBusinessErrors,
      warnings: filteredBusinessWarnings
    },
    blockingIssues: filteredBlockingIssues,
    warningsToReview: filteredWarnings,
    summary: {
      ...result.summary,
      businessRuleErrors: filteredBusinessErrors.length,
      totalErrors: result.summary.schemaErrors + filteredBusinessErrors.length,
      totalWarnings:
        result.schemaValidation.warnings.length +
        filteredBusinessWarnings.length,
      isReadyForSubmission:
        result.summary.schemaErrors + filteredBusinessErrors.length === 0
    }
  }
}

/**
 * Groups validation errors by category
 *
 * @param result - The validation result
 * @returns Errors grouped by category
 */
export function groupByCategory(
  result: SubmissionValidationResult
): Record<string, Array<SubmissionValidationResult['blockingIssues'][0]>> {
  const groups: Record<
    string,
    Array<SubmissionValidationResult['blockingIssues'][0]>
  > = {
    schema: [],
    mathematical: [],
    consistency: [],
    range: [],
    cross_form: [],
    filing_status: [],
    credit: [],
    deduction: [],
    identity: [],
    other: []
  }

  result.blockingIssues.forEach((issue) => {
    if (issue.source === 'schema') {
      groups.schema.push(issue)
    } else {
      const br = result.businessRules.errors.find(
        (e) => e.ruleId === issue.code
      )
      if (br) {
        const category = br.category.toLowerCase()
        if (groups[category]) {
          groups[category].push(issue)
        } else {
          groups.other.push(issue)
        }
      }
    }
  })

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key]
    }
  })

  return groups
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  validateForSubmission,
  validateSchema,
  validateBusinessRules,
  isReadyForSubmission,
  getValidationSummary,
  createSchemaValidator,
  createBusinessRulesEngine,
  formatValidationErrors,
  filterByForms,
  groupByCategory,
  SchemaValidator,
  BusinessRulesEngine,
  ValidationSeverity,
  RuleSeverity,
  RuleCategory
}
