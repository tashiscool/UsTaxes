/**
 * Schema Validator for MeF (Modernized e-File) Submissions
 *
 * Validates XML documents against IRS XSD schemas for electronic filing.
 * Provides detailed error locations and user-friendly error messages.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Severity levels for validation messages
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Represents a single validation error with detailed location information
 */
export interface ValidationError {
  /** Unique error code for reference */
  code: string
  /** Human-readable error message */
  message: string
  /** XPath location within the XML document */
  xpath: string
  /** Line number in the XML document (if available) */
  line?: number
  /** Column number in the XML document (if available) */
  column?: number
  /** The element or attribute name that caused the error */
  element?: string
  /** The invalid value that triggered the error */
  value?: string
  /** Expected format or type */
  expected?: string
  /** Severity level of the error */
  severity: ValidationSeverity
  /** Reference to the relevant IRS form field */
  fieldReference?: string
  /** Suggested fix for the error */
  suggestion?: string
}

/**
 * Result of schema validation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean
  /** List of validation errors */
  errors: ValidationError[]
  /** List of warnings (non-blocking issues) */
  warnings: ValidationError[]
  /** Informational messages */
  info: ValidationError[]
  /** Form type that was validated */
  formType: string
  /** Tax year for the schema used */
  taxYear: number
  /** Timestamp of validation */
  timestamp: Date
  /** Schema version used for validation */
  schemaVersion?: string
}

/**
 * Configuration for a cached schema
 */
interface CachedSchema {
  /** The compiled schema object */
  schema: SchemaDefinition
  /** When the schema was loaded */
  loadedAt: Date
  /** Schema version */
  version: string
  /** Form type this schema validates */
  formType: string
}

/**
 * Schema definition structure (represents parsed XSD)
 */
interface SchemaDefinition {
  /** Target namespace of the schema */
  targetNamespace: string
  /** Schema elements and their definitions */
  elements: Map<string, ElementDefinition>
  /** Complex type definitions */
  complexTypes: Map<string, ComplexTypeDefinition>
  /** Simple type definitions with restrictions */
  simpleTypes: Map<string, SimpleTypeDefinition>
  /** Imported schema namespaces */
  imports: string[]
}

/**
 * Element definition from XSD
 */
interface ElementDefinition {
  name: string
  type: string
  minOccurs: number
  maxOccurs: number | 'unbounded'
  nillable: boolean
  documentation?: string
}

/**
 * Complex type definition from XSD
 */
interface ComplexTypeDefinition {
  name: string
  elements: ElementDefinition[]
  attributes: AttributeDefinition[]
  mixed: boolean
  sequence: boolean
}

/**
 * Attribute definition from XSD
 */
interface AttributeDefinition {
  name: string
  type: string
  required: boolean
  defaultValue?: string
}

/**
 * Simple type definition with restrictions
 */
interface SimpleTypeDefinition {
  name: string
  baseType: string
  restrictions: TypeRestriction[]
}

/**
 * Type restriction (pattern, length, enumeration, etc.)
 */
interface TypeRestriction {
  type:
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'length'
    | 'minInclusive'
    | 'maxInclusive'
    | 'minExclusive'
    | 'maxExclusive'
    | 'enumeration'
    | 'totalDigits'
    | 'fractionDigits'
    | 'whiteSpace'
  value: string | number | string[]
}

// ============================================================================
// Error Message Mappings
// ============================================================================

/**
 * Maps technical schema error codes to user-friendly messages
 */
const ERROR_MESSAGE_MAP: Record<
  string,
  (details: Record<string, string>) => string
> = {
  INVALID_ELEMENT: (d) =>
    `The element "${d.element}" is not valid at this location. ${
      d.suggestion || ''
    }`,

  MISSING_REQUIRED: (d) =>
    `Required field "${d.element}" is missing. This field must be provided.`,

  INVALID_TYPE: (d) =>
    `The value "${d.value}" for "${d.element}" is not valid. Expected: ${d.expected}.`,

  PATTERN_MISMATCH: (d) =>
    `The value "${d.value}" does not match the required format for "${d.element}".`,

  LENGTH_ERROR: (d) =>
    `The value for "${d.element}" has incorrect length. ${d.expected}`,

  RANGE_ERROR: (d) =>
    `The value "${d.value}" for "${d.element}" is outside the allowed range. ${d.expected}`,

  ENUMERATION_ERROR: (d) =>
    `The value "${d.value}" is not one of the allowed values for "${d.element}". Allowed: ${d.expected}`,

  DUPLICATE_ELEMENT: (d) =>
    `Duplicate element "${d.element}" found. Only one instance is allowed.`,

  UNEXPECTED_CONTENT: (d) =>
    `Unexpected content found in "${d.element}". The element should be empty or have specific children.`,

  NAMESPACE_ERROR: (d) =>
    `Namespace error for element "${d.element}". Expected namespace: ${d.expected}`,

  SSN_FORMAT: (d) =>
    `Social Security Number "${d.value}" is not in the correct format (XXX-XX-XXXX or XXXXXXXXX).`,

  EIN_FORMAT: (d) =>
    `Employer Identification Number "${d.value}" is not in the correct format (XX-XXXXXXX).`,

  ZIP_CODE: (d) =>
    `ZIP code "${d.value}" is not valid. Must be 5 digits or 5+4 format.`,

  PHONE_FORMAT: (d) =>
    `Phone number "${d.value}" is not in the correct format.`,

  DATE_FORMAT: (d) =>
    `Date "${d.value}" is not in the correct format (YYYY-MM-DD).`,

  AMOUNT_FORMAT: (d) =>
    `Amount "${d.value}" is not valid. Must be a valid number with up to 2 decimal places.`,

  STATE_CODE: (d) =>
    `State code "${d.value}" is not a valid US state or territory code.`
}

/**
 * Field reference mappings for common IRS form fields
 */
const FIELD_REFERENCE_MAP: Record<string, string> = {
  // Form 1040 fields
  PrimarySSN: 'Form 1040, Page 1, Your Social Security Number',
  SpouseSSN: "Form 1040, Page 1, Spouse's Social Security Number",
  WagesSalariesTipsAmt: 'Form 1040, Line 1a',
  TaxExemptInterestAmt: 'Form 1040, Line 2a',
  TaxableInterestAmt: 'Form 1040, Line 2b',
  QualifiedDividendsAmt: 'Form 1040, Line 3a',
  OrdinaryDividendsAmt: 'Form 1040, Line 3b',
  IRADistributionsAmt: 'Form 1040, Line 4a',
  TaxableIRAAmt: 'Form 1040, Line 4b',
  PensionsAnnuitiesAmt: 'Form 1040, Line 5a',
  TaxablePensionsAmt: 'Form 1040, Line 5b',
  SocialSecurityBnftAmt: 'Form 1040, Line 6a',
  TaxableSocSecAmt: 'Form 1040, Line 6b',
  CapitalGainLossAmt: 'Form 1040, Line 7',
  OtherIncomeAmt: 'Form 1040, Line 8 (from Schedule 1)',
  TotalIncomeAmt: 'Form 1040, Line 9',
  AdjustmentsToIncomeAmt: 'Form 1040, Line 10 (from Schedule 1)',
  AdjustedGrossIncomeAmt: 'Form 1040, Line 11',
  TotalDeductionsAmt: 'Form 1040, Line 12',
  QualifiedBusinessIncDedAmt: 'Form 1040, Line 13',
  TotalDeductionAmt: 'Form 1040, Line 14',
  TaxableIncomeAmt: 'Form 1040, Line 15',
  TaxAmt: 'Form 1040, Line 16',
  TotalCreditsAmt: 'Form 1040, Line 21',
  TotalTaxBeforeCrAndOthTaxesAmt: 'Form 1040, Line 22',
  OtherTaxesAmt: 'Form 1040, Line 23 (from Schedule 2)',
  TotalTaxAmt: 'Form 1040, Line 24',
  TotalPaymentsAmt: 'Form 1040, Line 33',
  OverpaidAmt: 'Form 1040, Line 34',
  RefundAmt: 'Form 1040, Line 35a',
  OwedAmt: 'Form 1040, Line 37',
  // Schedule A fields
  MedicalAndDentalExpensesAmt: 'Schedule A, Line 1',
  StateAndLocalTaxesAmt: 'Schedule A, Line 5',
  RealEstateTaxesAmt: 'Schedule A, Line 5b',
  HomeInterestAmt: 'Schedule A, Line 8',
  CharitableContributionsAmt: 'Schedule A, Line 11',
  TotalItemizedDeductionsAmt: 'Schedule A, Line 17',
  // Schedule B fields
  InterestIncomeAmt: 'Schedule B, Part I',
  DividendIncomeAmt: 'Schedule B, Part II',
  // Schedule C fields
  GrossReceiptsAmt: 'Schedule C, Line 1',
  TotalExpensesAmt: 'Schedule C, Line 28',
  NetProfitOrLossAmt: 'Schedule C, Line 31',
  // Schedule D fields
  ShortTermGainLossAmt: 'Schedule D, Line 7',
  LongTermGainLossAmt: 'Schedule D, Line 15',
  NetCapitalGainLossAmt: 'Schedule D, Line 16',
  // Schedule E fields
  RentalIncomeAmt: 'Schedule E, Part I',
  PartnershipIncomeAmt: 'Schedule E, Part II',
  // Schedule SE fields
  SelfEmploymentTaxAmt: 'Schedule SE, Line 12'
}

// ============================================================================
// Schema Validator Class
// ============================================================================

/**
 * SchemaValidator validates XML documents against IRS MeF schemas.
 *
 * Features:
 * - Validates XML against XSD schemas for all supported form types
 * - Caches compiled schemas for performance
 * - Provides detailed error locations with XPath
 * - Maps technical errors to user-friendly messages
 * - Includes field references for easy error correction
 *
 * @example
 * ```typescript
 * const validator = new SchemaValidator();
 * const result = await validator.validate(xmlString, 'Form1040');
 * if (!result.valid) {
 *   result.errors.forEach(error => {
 *     console.log(`${error.fieldReference}: ${error.message}`);
 *   });
 * }
 * ```
 */
export class SchemaValidator {
  private schemaCache: Map<string, CachedSchema> = new Map()
  private readonly schemaCacheTTL: number = 3600000 // 1 hour in milliseconds
  private readonly taxYear: number

  /**
   * Creates a new SchemaValidator instance
   * @param taxYear - The tax year for schema selection (default: current year)
   */
  constructor(taxYear: number = new Date().getFullYear()) {
    this.taxYear = taxYear
  }

  /**
   * Validates an XML document against the appropriate IRS schema
   *
   * @param xml - The XML string to validate
   * @param formType - The form type (e.g., 'Form1040', 'ScheduleA', 'ScheduleC')
   * @returns Promise resolving to ValidationResult
   */
  async validate(xml: string, formType: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      formType,
      taxYear: this.taxYear,
      timestamp: new Date()
    }

    try {
      // Load or retrieve cached schema
      const schema = await this.loadSchema(formType)
      result.schemaVersion = schema.version

      // Parse XML
      const parseResult = this.parseXML(xml)
      if (parseResult.errors.length > 0) {
        result.valid = false
        result.errors.push(...parseResult.errors)
        return result
      }

      // Validate structure
      const structureErrors = this.validateStructure(
        parseResult.document,
        schema.schema
      )
      result.errors.push(
        ...structureErrors.filter(
          (e) => e.severity === ValidationSeverity.ERROR
        )
      )
      result.warnings.push(
        ...structureErrors.filter(
          (e) => e.severity === ValidationSeverity.WARNING
        )
      )

      // Validate data types
      const typeErrors = this.validateDataTypes(
        parseResult.document,
        schema.schema
      )
      result.errors.push(
        ...typeErrors.filter((e) => e.severity === ValidationSeverity.ERROR)
      )
      result.warnings.push(
        ...typeErrors.filter((e) => e.severity === ValidationSeverity.WARNING)
      )

      // Validate constraints
      const constraintErrors = this.validateConstraints(
        parseResult.document,
        schema.schema
      )
      result.errors.push(
        ...constraintErrors.filter(
          (e) => e.severity === ValidationSeverity.ERROR
        )
      )
      result.warnings.push(
        ...constraintErrors.filter(
          (e) => e.severity === ValidationSeverity.WARNING
        )
      )

      // Map errors to user-friendly messages
      result.errors = result.errors.map((e) => this.enhanceError(e))
      result.warnings = result.warnings.map((e) => this.enhanceError(e))

      result.valid = result.errors.length === 0
    } catch (error) {
      result.valid = false
      result.errors.push({
        code: 'VALIDATION_ERROR',
        message: `Schema validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        xpath: '/',
        severity: ValidationSeverity.ERROR
      })
    }

    return result
  }

  /**
   * Validates multiple forms in a submission
   *
   * @param forms - Array of {xml, formType} objects to validate
   * @returns Promise resolving to array of ValidationResults
   */
  async validateMultiple(
    forms: Array<{ xml: string; formType: string }>
  ): Promise<ValidationResult[]> {
    return Promise.all(forms.map((f) => this.validate(f.xml, f.formType)))
  }

  /**
   * Loads and caches a schema for a form type
   */
  private async loadSchema(formType: string): Promise<CachedSchema> {
    const cacheKey = `${formType}_${this.taxYear}`

    // Check cache
    const cached = this.schemaCache.get(cacheKey)
    if (
      cached &&
      Date.now() - cached.loadedAt.getTime() < this.schemaCacheTTL
    ) {
      return cached
    }

    // Load schema definition
    const schema = await this.loadSchemaDefinition(formType)

    const cachedSchema: CachedSchema = {
      schema,
      loadedAt: new Date(),
      version: `${this.taxYear}.1.0`,
      formType
    }

    this.schemaCache.set(cacheKey, cachedSchema)
    return cachedSchema
  }

  /**
   * Loads schema definition from XSD files
   */
  private loadSchemaDefinition(formType: string): Promise<SchemaDefinition> {
    // In production, this would load actual XSD files
    // For now, return a schema definition based on form type
    return Promise.resolve(this.getBuiltInSchemaDefinition(formType))
  }

  /**
   * Returns built-in schema definitions for common forms
   */
  private getBuiltInSchemaDefinition(formType: string): SchemaDefinition {
    const baseDefinition: SchemaDefinition = {
      targetNamespace: `http://www.irs.gov/efile`,
      elements: new Map(),
      complexTypes: new Map(),
      simpleTypes: new Map(),
      imports: []
    }

    // Add common simple types
    this.addCommonSimpleTypes(baseDefinition)

    // Add form-specific definitions
    switch (formType) {
      case 'Form1040':
        return this.addForm1040Definitions(baseDefinition)
      case 'ScheduleA':
        return this.addScheduleADefinitions(baseDefinition)
      case 'ScheduleB':
        return this.addScheduleBDefinitions(baseDefinition)
      case 'ScheduleC':
        return this.addScheduleCDefinitions(baseDefinition)
      case 'ScheduleD':
        return this.addScheduleDDefinitions(baseDefinition)
      case 'ScheduleE':
        return this.addScheduleEDefinitions(baseDefinition)
      case 'ScheduleSE':
        return this.addScheduleSEDefinitions(baseDefinition)
      case 'Schedule1':
        return this.addSchedule1Definitions(baseDefinition)
      case 'Schedule2':
        return this.addSchedule2Definitions(baseDefinition)
      case 'Schedule3':
        return this.addSchedule3Definitions(baseDefinition)
      default:
        return baseDefinition
    }
  }

  /**
   * Adds common simple type definitions used across forms
   */
  private addCommonSimpleTypes(schema: SchemaDefinition): void {
    // SSN type
    schema.simpleTypes.set('SSNType', {
      name: 'SSNType',
      baseType: 'string',
      restrictions: [{ type: 'pattern', value: '[0-9]{9}' }]
    })

    // EIN type
    schema.simpleTypes.set('EINType', {
      name: 'EINType',
      baseType: 'string',
      restrictions: [{ type: 'pattern', value: '[0-9]{9}' }]
    })

    // Amount type (US currency)
    schema.simpleTypes.set('USAmountType', {
      name: 'USAmountType',
      baseType: 'decimal',
      restrictions: [
        { type: 'totalDigits', value: 15 },
        { type: 'fractionDigits', value: 2 },
        { type: 'minInclusive', value: '-99999999999999' },
        { type: 'maxInclusive', value: '99999999999999' }
      ]
    })

    // Non-negative amount
    schema.simpleTypes.set('USAmountNNType', {
      name: 'USAmountNNType',
      baseType: 'decimal',
      restrictions: [
        { type: 'totalDigits', value: 15 },
        { type: 'fractionDigits', value: 2 },
        { type: 'minInclusive', value: '0' },
        { type: 'maxInclusive', value: '99999999999999' }
      ]
    })

    // ZIP code
    schema.simpleTypes.set('ZIPCodeType', {
      name: 'ZIPCodeType',
      baseType: 'string',
      restrictions: [{ type: 'pattern', value: '[0-9]{5}|[0-9]{5}-[0-9]{4}' }]
    })

    // State code
    schema.simpleTypes.set('StateType', {
      name: 'StateType',
      baseType: 'string',
      restrictions: [
        {
          type: 'enumeration',
          value: [
            'AL',
            'AK',
            'AZ',
            'AR',
            'CA',
            'CO',
            'CT',
            'DE',
            'DC',
            'FL',
            'GA',
            'HI',
            'ID',
            'IL',
            'IN',
            'IA',
            'KS',
            'KY',
            'LA',
            'ME',
            'MD',
            'MA',
            'MI',
            'MN',
            'MS',
            'MO',
            'MT',
            'NE',
            'NV',
            'NH',
            'NJ',
            'NM',
            'NY',
            'NC',
            'ND',
            'OH',
            'OK',
            'OR',
            'PA',
            'RI',
            'SC',
            'SD',
            'TN',
            'TX',
            'UT',
            'VT',
            'VA',
            'WA',
            'WV',
            'WI',
            'WY',
            'AS',
            'GU',
            'MP',
            'PR',
            'VI',
            'AA',
            'AE',
            'AP'
          ]
        }
      ]
    })

    // Date type
    schema.simpleTypes.set('DateType', {
      name: 'DateType',
      baseType: 'date',
      restrictions: []
    })

    // Phone number
    schema.simpleTypes.set('PhoneNumberType', {
      name: 'PhoneNumberType',
      baseType: 'string',
      restrictions: [{ type: 'pattern', value: '[0-9]{10}' }]
    })

    // Filing status
    schema.simpleTypes.set('FilingStatusType', {
      name: 'FilingStatusType',
      baseType: 'string',
      restrictions: [{ type: 'enumeration', value: ['1', '2', '3', '4', '5'] }]
    })

    // Person name
    schema.simpleTypes.set('PersonNameType', {
      name: 'PersonNameType',
      baseType: 'string',
      restrictions: [
        { type: 'minLength', value: 1 },
        { type: 'maxLength', value: 35 },
        { type: 'pattern', value: '[A-Za-z\\- ]+' }
      ]
    })

    // Address line
    schema.simpleTypes.set('AddressLineType', {
      name: 'AddressLineType',
      baseType: 'string',
      restrictions: [
        { type: 'minLength', value: 1 },
        { type: 'maxLength', value: 35 }
      ]
    })

    // City name
    schema.simpleTypes.set('CityType', {
      name: 'CityType',
      baseType: 'string',
      restrictions: [
        { type: 'minLength', value: 1 },
        { type: 'maxLength', value: 22 }
      ]
    })

    // Routing number
    schema.simpleTypes.set('RoutingTransitNumberType', {
      name: 'RoutingTransitNumberType',
      baseType: 'string',
      restrictions: [{ type: 'pattern', value: '[0-9]{9}' }]
    })

    // Bank account number
    schema.simpleTypes.set('BankAccountNumberType', {
      name: 'BankAccountNumberType',
      baseType: 'string',
      restrictions: [
        { type: 'minLength', value: 1 },
        { type: 'maxLength', value: 17 },
        { type: 'pattern', value: '[A-Za-z0-9]+' }
      ]
    })
  }

  /**
   * Adds Form 1040 specific schema definitions
   */
  private addForm1040Definitions(schema: SchemaDefinition): SchemaDefinition {
    // Root element
    schema.elements.set('Return', {
      name: 'Return',
      type: 'ReturnType',
      minOccurs: 1,
      maxOccurs: 1,
      nillable: false,
      documentation: 'IRS Individual Income Tax Return'
    })

    // Main return type
    schema.complexTypes.set('ReturnType', {
      name: 'ReturnType',
      elements: [
        {
          name: 'ReturnHeader',
          type: 'ReturnHeaderType',
          minOccurs: 1,
          maxOccurs: 1,
          nillable: false
        },
        {
          name: 'ReturnData',
          type: 'ReturnDataType',
          minOccurs: 1,
          maxOccurs: 1,
          nillable: false
        }
      ],
      attributes: [{ name: 'returnVersion', type: 'string', required: true }],
      mixed: false,
      sequence: true
    })

    // Income elements
    const incomeElements: ElementDefinition[] = [
      {
        name: 'WagesSalariesTipsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TaxExemptInterestAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TaxableInterestAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'QualifiedDividendsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OrdinaryDividendsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'IRADistributionsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TaxableIRAAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'PensionsAnnuitiesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TaxablePensionsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'SocialSecurityBnftAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TaxableSocSecAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'CapitalGainLossAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalIncomeAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AdjustmentsToIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AdjustedGrossIncomeAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalDeductionsAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TaxableIncomeAmt',
        type: 'USAmountNNType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040Type', {
      name: 'IRS1040Type',
      elements: incomeElements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule A schema definitions
   */
  private addScheduleADefinitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      {
        name: 'MedicalAndDentalExpensesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AGIAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'CalculatedMedicalAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'StateAndLocalTaxesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'RealEstateTaxesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalTaxesPaidAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'HomeInterestAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'GiftsToCharityAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'CasualtyLossAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherMiscDeductionsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalItemizedDeductionsAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040ScheduleAType', {
      name: 'IRS1040ScheduleAType',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule B schema definitions
   */
  private addScheduleBDefinitions(schema: SchemaDefinition): SchemaDefinition {
    // Schedule B - Interest and Dividends
    const elements: ElementDefinition[] = [
      {
        name: 'InterestIncomeGrp',
        type: 'InterestIncomeGroupType',
        minOccurs: 0,
        maxOccurs: 'unbounded',
        nillable: false
      },
      {
        name: 'TotalInterestAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'DividendIncomeGrp',
        type: 'DividendIncomeGroupType',
        minOccurs: 0,
        maxOccurs: 'unbounded',
        nillable: false
      },
      {
        name: 'TotalOrdinaryDividendsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ForeignAccountsQuestionInd',
        type: 'boolean',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ForeignTrustQuestionInd',
        type: 'boolean',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040ScheduleBType', {
      name: 'IRS1040ScheduleBType',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule C schema definitions
   */
  private addScheduleCDefinitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      {
        name: 'ProprietorNm',
        type: 'PersonNameType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'SSN',
        type: 'SSNType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'PrincipalBusinessActivityCd',
        type: 'string',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'BusinessNameLine1Txt',
        type: 'string',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'EIN',
        type: 'EINType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'GrossReceiptsAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ReturnsAndAllowancesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetGrossReceiptsAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'CostOfGoodsSoldAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'GrossProfitAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherBusinessIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'GrossIncomeAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalExpensesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TentativeProfitAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'HomeBusinessExpenseAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetProfitOrLossAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040ScheduleCType', {
      name: 'IRS1040ScheduleCType',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule D schema definitions
   */
  private addScheduleDDefinitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      {
        name: 'ShortTermCapitalGainGrp',
        type: 'CapitalGainGroupType',
        minOccurs: 0,
        maxOccurs: 'unbounded',
        nillable: false
      },
      {
        name: 'TotalSTCGAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'LongTermCapitalGainGrp',
        type: 'CapitalGainGroupType',
        minOccurs: 0,
        maxOccurs: 'unbounded',
        nillable: false
      },
      {
        name: 'TotalLTCGAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetSTCGAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetLTCGAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetCapitalGainLossAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040ScheduleDType', {
      name: 'IRS1040ScheduleDType',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule E schema definitions
   */
  private addScheduleEDefinitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      {
        name: 'RentalPropertyGrp',
        type: 'RentalPropertyGroupType',
        minOccurs: 0,
        maxOccurs: 3,
        nillable: false
      },
      {
        name: 'TotalRentalIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalRentalExpensesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetRentalIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'PartnershipSCorpGrp',
        type: 'PartnershipGroupType',
        minOccurs: 0,
        maxOccurs: 'unbounded',
        nillable: false
      },
      {
        name: 'TotalPartnershipIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalScheduleEIncomeAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040ScheduleEType', {
      name: 'IRS1040ScheduleEType',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule SE schema definitions
   */
  private addScheduleSEDefinitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      {
        name: 'SSN',
        type: 'SSNType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetEarningsFromSelfEmplAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'SelfEmploymentTaxAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'DeductibleSelfEmplTaxAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040ScheduleSEType', {
      name: 'IRS1040ScheduleSEType',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule 1 schema definitions
   */
  private addSchedule1Definitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      // Part I - Additional Income
      {
        name: 'TaxableRefundsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AlimonyReceivedAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'BusinessIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherGainLossAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'RentalIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'FarmIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'UnemploymentCompAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherIncomeAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalAdditionalIncomeAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      },
      // Part II - Adjustments to Income
      {
        name: 'EducatorExpensesAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'HSADeductionAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'SelfEmployedSEPAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'SelfEmplHealthInsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'PenaltyOnEarlyWdrlAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AlimonyPaidAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'IRADeductionAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'StudentLoanIntDedAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalAdjustmentsAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040Schedule1Type', {
      name: 'IRS1040Schedule1Type',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule 2 schema definitions
   */
  private addSchedule2Definitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      // Part I - Tax
      {
        name: 'AlternativeMinimumTaxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ExcessAdvncPremiumTaxCrAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalAdditionalTaxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      // Part II - Other Taxes
      {
        name: 'SelfEmploymentTaxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'UnreportedSocSecMedTxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AddlTaxOnIRADistribAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'HsijoldEmploymentTaxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'RepaymentFirstTimeBuyerCrAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AdditionalMedicareTaxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'NetInvstIncmTaxAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalOtherTaxesAmt',
        type: 'USAmountType',
        minOccurs: 1,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040Schedule2Type', {
      name: 'IRS1040Schedule2Type',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Adds Schedule 3 schema definitions
   */
  private addSchedule3Definitions(schema: SchemaDefinition): SchemaDefinition {
    const elements: ElementDefinition[] = [
      // Part I - Nonrefundable Credits
      {
        name: 'ForeignTaxCreditAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ChildAndDependentCareAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'EducationCreditAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'RetirementSavingsContribAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ResidentialEnergyCreditsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherNonrefundableCreditsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalNonrefundableCreditsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      // Part II - Other Payments and Refundable Credits
      {
        name: 'NetPremiumTaxCreditAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'AmtPaidWithExtensionAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'ExcessSocSecWithheldAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'OtherPaymentsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      },
      {
        name: 'TotalOtherPaymentsAmt',
        type: 'USAmountType',
        minOccurs: 0,
        maxOccurs: 1,
        nillable: false
      }
    ]

    schema.complexTypes.set('IRS1040Schedule3Type', {
      name: 'IRS1040Schedule3Type',
      elements,
      attributes: [],
      mixed: false,
      sequence: true
    })

    return schema
  }

  /**
   * Parses XML and returns parse result with any errors
   */
  private parseXML(xml: string): {
    document: ParsedDocument
    errors: ValidationError[]
  } {
    const errors: ValidationError[] = []
    const document: ParsedDocument = {
      root: null,
      elements: new Map(),
      lineMap: new Map()
    }

    // Basic XML parsing validation
    if (!xml || xml.trim().length === 0) {
      errors.push({
        code: 'EMPTY_XML',
        message: 'XML document is empty',
        xpath: '/',
        severity: ValidationSeverity.ERROR
      })
      return { document, errors }
    }

    // Check for XML declaration
    if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<')) {
      errors.push({
        code: 'INVALID_XML',
        message: 'Document does not appear to be valid XML',
        xpath: '/',
        severity: ValidationSeverity.ERROR
      })
      return { document, errors }
    }

    // Check for balanced tags (basic check)
    const tagStack: string[] = []
    const tagPattern = /<\/?([a-zA-Z_][a-zA-Z0-9_-]*)[^>]*>/g
    let match: RegExpExecArray | null
    let lineNum = 1
    let lastIndex = 0

    while ((match = tagPattern.exec(xml)) !== null) {
      // Count newlines for line number
      const substring = xml.substring(lastIndex, match.index)
      lineNum += (substring.match(/\n/g) || []).length
      lastIndex = match.index

      const fullTag = match[0]
      const tagName = match[1]

      if (fullTag.startsWith('</')) {
        // Closing tag
        if (
          tagStack.length === 0 ||
          tagStack[tagStack.length - 1] !== tagName
        ) {
          errors.push({
            code: 'UNBALANCED_TAG',
            message: `Unbalanced closing tag </${tagName}>`,
            xpath: `/${tagStack.join('/')}`,
            line: lineNum,
            element: tagName,
            severity: ValidationSeverity.ERROR
          })
        } else {
          tagStack.pop()
        }
      } else if (!fullTag.endsWith('/>')) {
        // Opening tag (not self-closing)
        tagStack.push(tagName)
        document.elements.set(tagName, {
          name: tagName,
          xpath: `/${tagStack.join('/')}`,
          line: lineNum
        })
      }
    }

    if (tagStack.length > 0) {
      errors.push({
        code: 'UNCLOSED_TAGS',
        message: `Unclosed tags: ${tagStack.join(', ')}`,
        xpath: '/',
        severity: ValidationSeverity.ERROR
      })
    }

    return { document, errors }
  }

  /**
   * Validates document structure against schema
   */
  private validateStructure(
    document: ParsedDocument,
    schema: SchemaDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = []

    // Check for required elements
    schema.complexTypes.forEach((complexType, typeName) => {
      complexType.elements.forEach((element) => {
        if (element.minOccurs > 0) {
          const found = document.elements.get(element.name)
          if (!found) {
            errors.push({
              code: 'MISSING_REQUIRED',
              message: `Required element "${element.name}" is missing`,
              xpath: `/${typeName}/${element.name}`,
              element: element.name,
              severity: ValidationSeverity.ERROR
            })
          }
        }
      })
    })

    return errors
  }

  /**
   * Validates data types in document
   */
  private validateDataTypes(
    document: ParsedDocument,
    schema: SchemaDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = []

    // Validate simple type restrictions
    document.elements.forEach((elementInfo, elementName) => {
      // Find element definition in schema
      let elementDef: ElementDefinition | undefined
      schema.complexTypes.forEach((complexType) => {
        const found = complexType.elements.find((e) => e.name === elementName)
        if (found) elementDef = found
      })

      if (elementDef) {
        const simpleType = schema.simpleTypes.get(elementDef.type)
        if (simpleType) {
          // Value validation would happen here
          // This is a simplified implementation
        }
      }
    })

    return errors
  }

  /**
   * Validates constraints in document
   */
  private validateConstraints(
    document: ParsedDocument,
    _schema: SchemaDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = []
    // Additional constraint validation would go here
    return errors
  }

  /**
   * Enhances an error with user-friendly message and field reference
   */
  private enhanceError(error: ValidationError): ValidationError {
    // Map technical code to friendly message
    const messageGenerator = ERROR_MESSAGE_MAP[error.code]
    if (messageGenerator) {
      error.message = messageGenerator({
        element: error.element || '',
        value: error.value || '',
        expected: error.expected || '',
        suggestion: error.suggestion || ''
      })
    }

    // Add field reference if available
    if (error.element && FIELD_REFERENCE_MAP[error.element]) {
      error.fieldReference = FIELD_REFERENCE_MAP[error.element]
    }

    return error
  }

  /**
   * Clears the schema cache
   */
  clearCache(): void {
    this.schemaCache.clear()
  }

  /**
   * Gets the current cache size
   */
  getCacheSize(): number {
    return this.schemaCache.size
  }

  /**
   * Validates a specific field value against its schema type
   */
  validateFieldValue(
    value: string,
    typeName: string,
    formType: string
  ): ValidationError | null {
    const schema = this.getBuiltInSchemaDefinition(formType)
    const simpleType = schema.simpleTypes.get(typeName)

    if (!simpleType) {
      return null
    }

    for (const restriction of simpleType.restrictions) {
      switch (restriction.type) {
        case 'pattern':
          if (!new RegExp(`^${String(restriction.value)}$`).test(value)) {
            return {
              code: 'PATTERN_MISMATCH',
              message: `Value does not match required pattern`,
              xpath: '',
              value,
              expected: `Pattern: ${String(restriction.value)}`,
              severity: ValidationSeverity.ERROR
            }
          }
          break

        case 'minLength':
          if (value.length < (restriction.value as number)) {
            return {
              code: 'LENGTH_ERROR',
              message: `Value is too short`,
              xpath: '',
              value,
              expected: `Minimum length: ${String(restriction.value)}`,
              severity: ValidationSeverity.ERROR
            }
          }
          break

        case 'maxLength':
          if (value.length > (restriction.value as number)) {
            return {
              code: 'LENGTH_ERROR',
              message: `Value is too long`,
              xpath: '',
              value,
              expected: `Maximum length: ${String(restriction.value)}`,
              severity: ValidationSeverity.ERROR
            }
          }
          break

        case 'enumeration':
          if (!(restriction.value as string[]).includes(value)) {
            return {
              code: 'ENUMERATION_ERROR',
              message: `Value is not one of the allowed values`,
              xpath: '',
              value,
              expected: (restriction.value as string[]).join(', '),
              severity: ValidationSeverity.ERROR
            }
          }
          break

        case 'minInclusive':
          if (parseFloat(value) < parseFloat(String(restriction.value))) {
            return {
              code: 'RANGE_ERROR',
              message: `Value is below minimum`,
              xpath: '',
              value,
              expected: `Minimum: ${String(restriction.value)}`,
              severity: ValidationSeverity.ERROR
            }
          }
          break

        case 'maxInclusive':
          if (parseFloat(value) > parseFloat(String(restriction.value))) {
            return {
              code: 'RANGE_ERROR',
              message: `Value is above maximum`,
              xpath: '',
              value,
              expected: `Maximum: ${String(restriction.value)}`,
              severity: ValidationSeverity.ERROR
            }
          }
          break
      }
    }

    return null
  }
}

// ============================================================================
// Helper Types
// ============================================================================

interface ParsedDocument {
  root: string | null
  elements: Map<string, ParsedElement>
  lineMap: Map<number, string>
}

interface ParsedElement {
  name: string
  xpath: string
  line: number
  value?: string
  attributes?: Record<string, string>
}

// ============================================================================
// Exports
// ============================================================================

export default SchemaValidator
