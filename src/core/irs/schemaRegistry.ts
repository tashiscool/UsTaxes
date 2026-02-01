/**
 * IRS MeF Schema Registry
 *
 * Maintains a registry of IRS form schemas with field definitions,
 * data types, validation rules, and calculation dependencies.
 * Based on IRS MeF schema specifications and reference data.
 */

// =============================================================================
// Data Types
// =============================================================================

/**
 * IRS standard data type patterns
 */
export enum IRSDataType {
  SSN = 'SSN', // XXX-XX-XXXX
  EIN = 'EIN', // XX-XXXXXXX
  Phone = 'Phone', // (XXX) XXX-XXXX
  Date = 'Date', // YYYY-MM-DD
  DateTime = 'DateTime', // ISO 8601
  Currency = 'Currency', // Decimal, no symbols
  Percentage = 'Percentage', // Decimal 0.XX or whole XX
  Year = 'Year', // YYYY
  State = 'State', // 2-letter code
  Country = 'Country', // Text or ISO code
  ZIP = 'ZIP', // XXXXX or XXXXX-XXXX
  Boolean = 'Boolean', // X (checkbox) or Yes/No
  String = 'String', // Free text
  Integer = 'Integer', // Whole number
  Enum = 'Enum' // Enumerated values
}

/**
 * Field validation pattern
 */
export interface FieldPattern {
  regex: RegExp
  message: string
  example: string
}

/**
 * Standard IRS field patterns
 */
export const IRS_PATTERNS: Record<IRSDataType, FieldPattern> = {
  [IRSDataType.SSN]: {
    regex: /^\d{3}-?\d{2}-?\d{4}$/,
    message: 'SSN must be 9 digits (XXX-XX-XXXX)',
    example: '123-45-6789'
  },
  [IRSDataType.EIN]: {
    regex: /^\d{2}-?\d{7}$/,
    message: 'EIN must be 9 digits (XX-XXXXXXX)',
    example: '12-3456789'
  },
  [IRSDataType.Phone]: {
    regex: /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
    message: 'Phone must be 10 digits',
    example: '(555) 123-4567'
  },
  [IRSDataType.Date]: {
    regex: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Date must be YYYY-MM-DD format',
    example: '2025-12-31'
  },
  [IRSDataType.DateTime]: {
    regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
    message: 'DateTime must be ISO 8601 format',
    example: '2025-12-31T23:59:59Z'
  },
  [IRSDataType.Currency]: {
    regex: /^-?\d+(\.\d{1,2})?$/,
    message: 'Currency must be a decimal number',
    example: '1234.56'
  },
  [IRSDataType.Percentage]: {
    regex: /^(0?\.\d+|\d+(\.\d+)?%?)$/,
    message: 'Percentage as decimal (0.XX) or whole (XX%)',
    example: '0.25 or 25%'
  },
  [IRSDataType.Year]: {
    regex: /^\d{4}$/,
    message: 'Year must be 4 digits',
    example: '2025'
  },
  [IRSDataType.State]: {
    regex: /^[A-Z]{2}$/,
    message: 'State must be 2-letter code',
    example: 'CA'
  },
  [IRSDataType.Country]: {
    regex: /^[A-Z]{2,3}$|^.+$/,
    message: 'Country code or name',
    example: 'US or United States'
  },
  [IRSDataType.ZIP]: {
    regex: /^\d{5}(-\d{4})?$/,
    message: 'ZIP code must be 5 or 9 digits',
    example: '12345 or 12345-6789'
  },
  [IRSDataType.Boolean]: {
    regex: /^(X|Yes|No|true|false|1|0)?$/i,
    message: 'Boolean indicator',
    example: 'X or Yes/No'
  },
  [IRSDataType.String]: {
    regex: /.*/,
    message: 'Free text',
    example: 'Any text'
  },
  [IRSDataType.Integer]: {
    regex: /^-?\d+$/,
    message: 'Whole number',
    example: '42'
  },
  [IRSDataType.Enum]: {
    regex: /.+/,
    message: 'Must be one of the allowed values',
    example: 'See enumeration'
  }
}

// =============================================================================
// Field Definitions
// =============================================================================

/**
 * Cardinality constraint
 */
export interface Cardinality {
  min: number
  max: number | 'unbounded'
}

/**
 * Calculation rule for computed fields
 */
export interface CalculationRule {
  /** Fields that this calculation depends on */
  dependsOn: string[]
  /** Calculation formula description */
  formula: string
  /** Function to compute the value */
  compute?: (values: Record<string, number>) => number
}

/**
 * Conditional visibility rule
 */
export interface ConditionalRule {
  /** Field that controls visibility */
  triggerField: string
  /** Value that triggers this condition */
  triggerValue: string | boolean | number
  /** What happens when triggered */
  action: 'show' | 'hide' | 'require'
}

/**
 * Form field definition
 */
export interface FieldDefinition {
  /** Field ID (unique within form) */
  id: string
  /** XML element name */
  xmlName: string
  /** Human-readable label */
  label: string
  /** Form line number (e.g., "1a", "15") */
  lineNumber?: string
  /** Data type */
  dataType: IRSDataType
  /** Whether field is required */
  required: boolean
  /** Cardinality (for repeating fields) */
  cardinality: Cardinality
  /** Allowed values for enum types */
  enumValues?: string[]
  /** Calculation rule if computed */
  calculation?: CalculationRule
  /** Conditional visibility rules */
  conditions?: ConditionalRule[]
  /** Maximum length for string fields */
  maxLength?: number
  /** Minimum value for numeric fields */
  minValue?: number
  /** Maximum value for numeric fields */
  maxValue?: number
  /** Default value */
  defaultValue?: string | number | boolean
  /** Help text / description */
  helpText?: string
  /** IRS publication reference */
  irsReference?: string
}

/**
 * Form section definition
 */
export interface SectionDefinition {
  /** Section ID */
  id: string
  /** Section title */
  title: string
  /** Section description */
  description?: string
  /** Fields in this section */
  fields: FieldDefinition[]
  /** Nested sections */
  sections?: SectionDefinition[]
  /** Whether section is repeating */
  repeating?: boolean
  /** Maximum instances if repeating */
  maxInstances?: number
}

/**
 * Schedule definition (attached to main form)
 */
export interface ScheduleDefinition {
  /** Schedule ID (e.g., "A", "B", "C") */
  id: string
  /** Full schedule name */
  name: string
  /** XML element name */
  xmlName: string
  /** Form this schedule attaches to */
  attachesTo: string
  /** Cardinality */
  cardinality: Cardinality
  /** Conditions for when schedule is required */
  requiredWhen?: ConditionalRule[]
  /** Sections in the schedule */
  sections: SectionDefinition[]
}

/**
 * Complete form definition
 */
export interface FormDefinition {
  /** Form number (e.g., "1040", "709") */
  formNumber: string
  /** Form name */
  name: string
  /** Tax year */
  taxYear: number
  /** Form version */
  version: string
  /** XML namespace */
  xmlNamespace: string
  /** Root XML element name */
  xmlRootElement: string
  /** Form sections */
  sections: SectionDefinition[]
  /** Attached schedules */
  schedules: ScheduleDefinition[]
  /** Accepted attachments */
  attachments: {
    schemaName: string
    description: string
    cardinality: Cardinality
  }[]
}

// =============================================================================
// Form Registry
// =============================================================================

/**
 * Registry of all form definitions
 */
class SchemaRegistry {
  private forms: Map<string, FormDefinition> = new Map()
  private schedules: Map<string, ScheduleDefinition> = new Map()

  /**
   * Register a form definition
   */
  registerForm(form: FormDefinition): void {
    const key = `${form.formNumber}_${form.taxYear}`
    this.forms.set(key, form)

    // Register schedules
    form.schedules.forEach((schedule) => {
      const scheduleKey = `${form.formNumber}_${schedule.id}_${form.taxYear}`
      this.schedules.set(scheduleKey, schedule)
    })
  }

  /**
   * Get a form definition
   */
  getForm(formNumber: string, taxYear: number): FormDefinition | undefined {
    return this.forms.get(`${formNumber}_${taxYear}`)
  }

  /**
   * Get a schedule definition
   */
  getSchedule(
    formNumber: string,
    scheduleId: string,
    taxYear: number
  ): ScheduleDefinition | undefined {
    return this.schedules.get(`${formNumber}_${scheduleId}_${taxYear}`)
  }

  /**
   * List all registered forms
   */
  listForms(): { formNumber: string; taxYear: number; name: string }[] {
    const result: { formNumber: string; taxYear: number; name: string }[] = []
    this.forms.forEach((form) => {
      result.push({
        formNumber: form.formNumber,
        taxYear: form.taxYear,
        name: form.name
      })
    })
    return result
  }

  /**
   * Get field definition by line number
   */
  getFieldByLine(
    formNumber: string,
    taxYear: number,
    lineNumber: string
  ): FieldDefinition | undefined {
    const form = this.getForm(formNumber, taxYear)
    if (!form) return undefined

    const searchSection = (
      sections: SectionDefinition[]
    ): FieldDefinition | undefined => {
      for (const section of sections) {
        for (const field of section.fields) {
          if (field.lineNumber === lineNumber) {
            return field
          }
        }
        if (section.sections) {
          const found = searchSection(section.sections)
          if (found) return found
        }
      }
      return undefined
    }

    return searchSection(form.sections)
  }

  /**
   * Get all calculated fields for a form
   */
  getCalculatedFields(formNumber: string, taxYear: number): FieldDefinition[] {
    const form = this.getForm(formNumber, taxYear)
    if (!form) return []

    const result: FieldDefinition[] = []

    const searchSection = (sections: SectionDefinition[]): void => {
      for (const section of sections) {
        for (const field of section.fields) {
          if (field.calculation) {
            result.push(field)
          }
        }
        if (section.sections) {
          searchSection(section.sections)
        }
      }
    }

    searchSection(form.sections)
    return result
  }

  /**
   * Build calculation dependency graph
   */
  buildDependencyGraph(
    formNumber: string,
    taxYear: number
  ): Map<string, string[]> {
    const fields = this.getCalculatedFields(formNumber, taxYear)
    const graph = new Map<string, string[]>()

    fields.forEach((field) => {
      if (field.calculation) {
        graph.set(field.id, field.calculation.dependsOn)
      }
    })

    return graph
  }

  /**
   * Validate field value against definition
   */
  validateFieldValue(
    field: FieldDefinition,
    value: unknown
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required
    if (
      field.required &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push(`${field.label} is required`)
      return { valid: false, errors }
    }

    // Skip validation if empty and not required
    if (value === undefined || value === null || value === '') {
      return { valid: true, errors: [] }
    }

    const strValue = String(value)

    // Check pattern
    const pattern = IRS_PATTERNS[field.dataType]
    if (pattern && !pattern.regex.test(strValue)) {
      errors.push(`${field.label}: ${pattern.message}`)
    }

    // Check max length
    if (field.maxLength && strValue.length > field.maxLength) {
      errors.push(`${field.label} exceeds maximum length of ${field.maxLength}`)
    }

    // Check enum values
    if (field.dataType === IRSDataType.Enum && field.enumValues) {
      if (!field.enumValues.includes(strValue)) {
        errors.push(
          `${field.label} must be one of: ${field.enumValues.join(', ')}`
        )
      }
    }

    // Check numeric range
    if (
      field.dataType === IRSDataType.Currency ||
      field.dataType === IRSDataType.Integer
    ) {
      const numValue = Number(value)
      if (!isNaN(numValue)) {
        if (field.minValue !== undefined && numValue < field.minValue) {
          errors.push(`${field.label} must be at least ${field.minValue}`)
        }
        if (field.maxValue !== undefined && numValue > field.maxValue) {
          errors.push(`${field.label} must be at most ${field.maxValue}`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

// Singleton instance
export const schemaRegistry = new SchemaRegistry()

// =============================================================================
// Form 709 Definition (Gift Tax Return)
// =============================================================================

/**
 * Form 709 relationship types
 */
export const FORM_709_RELATIONSHIPS = [
  'Child',
  'Grandchild',
  'Spouse',
  'Sibling',
  'Parent',
  'Grandparent',
  'Niece/Nephew',
  'Other'
] as const

/**
 * Form 709 Part I - General Information
 */
const form709Part1Fields: FieldDefinition[] = [
  {
    id: 'donorFirstName',
    xmlName: 'DonorFirstNm',
    label: 'Donor First Name',
    lineNumber: '1',
    dataType: IRSDataType.String,
    required: true,
    cardinality: { min: 1, max: 1 },
    maxLength: 35
  },
  {
    id: 'donorLastName',
    xmlName: 'DonorLastNm',
    label: 'Donor Last Name',
    lineNumber: '2',
    dataType: IRSDataType.String,
    required: true,
    cardinality: { min: 1, max: 1 },
    maxLength: 35
  },
  {
    id: 'donorSSN',
    xmlName: 'DonorSSN',
    label: 'Donor SSN',
    lineNumber: '3',
    dataType: IRSDataType.SSN,
    required: true,
    cardinality: { min: 1, max: 1 },
    helpText: 'Primary identifier for the donor'
  },
  {
    id: 'donorAddress',
    xmlName: 'DonorUSAddress/AddressLine1Txt',
    label: 'Street Address',
    lineNumber: '4',
    dataType: IRSDataType.String,
    required: true,
    cardinality: { min: 1, max: 1 },
    maxLength: 35
  },
  {
    id: 'donorAptNo',
    xmlName: 'DonorUSAddress/AddressLine2Txt',
    label: 'Apt/Suite Number',
    lineNumber: '5',
    dataType: IRSDataType.String,
    required: false,
    cardinality: { min: 0, max: 1 },
    maxLength: 35
  },
  {
    id: 'donorCity',
    xmlName: 'DonorUSAddress/CityNm',
    label: 'City',
    lineNumber: '6',
    dataType: IRSDataType.String,
    required: true,
    cardinality: { min: 1, max: 1 },
    maxLength: 22
  },
  {
    id: 'donorState',
    xmlName: 'DonorUSAddress/StateAbbreviationCd',
    label: 'State',
    lineNumber: '7',
    dataType: IRSDataType.State,
    required: true,
    cardinality: { min: 1, max: 1 }
  },
  {
    id: 'donorZIP',
    xmlName: 'DonorUSAddress/ZIPCd',
    label: 'ZIP Code',
    lineNumber: '8',
    dataType: IRSDataType.ZIP,
    required: true,
    cardinality: { min: 1, max: 1 }
  },
  {
    id: 'legalResidence',
    xmlName: 'LegalResidenceStateCd',
    label: 'Legal Residence (Domicile)',
    lineNumber: '12',
    dataType: IRSDataType.State,
    required: true,
    cardinality: { min: 1, max: 1 },
    helpText: 'State of legal domicile'
  },
  {
    id: 'citizenship',
    xmlName: 'CitizenshipCountryCd',
    label: 'Citizenship',
    lineNumber: '13',
    dataType: IRSDataType.Country,
    required: true,
    cardinality: { min: 1, max: 1 },
    defaultValue: 'US'
  },
  {
    id: 'donorDeathDate',
    xmlName: 'DonorDeathDt',
    label: 'Date of Death (if deceased)',
    lineNumber: '14',
    dataType: IRSDataType.Date,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'amendedReturn',
    xmlName: 'AmendedReturnInd',
    label: 'Amended Return',
    lineNumber: '15',
    dataType: IRSDataType.Boolean,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'extensionFiled',
    xmlName: 'ExtensionFiledInd',
    label: 'Extension Filed',
    lineNumber: '16',
    dataType: IRSDataType.Boolean,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'numberOfDonees',
    xmlName: 'NumberOfDoneesCnt',
    label: 'Number of Donees',
    lineNumber: '17',
    dataType: IRSDataType.Integer,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['scheduleAGifts'],
      formula: 'Count of unique donees from Schedule A'
    }
  },
  {
    id: 'previouslyFiled709',
    xmlName: 'PreviouslyFiled709Ind',
    label: 'Previously Filed Form 709',
    lineNumber: '18a',
    dataType: IRSDataType.Boolean,
    required: true,
    cardinality: { min: 1, max: 1 },
    helpText: 'Triggers Schedule B if Yes'
  },
  {
    id: 'addressChanged',
    xmlName: 'AddressChangedInd',
    label: 'Address Changed Since Last Filing',
    lineNumber: '18b',
    dataType: IRSDataType.Boolean,
    required: false,
    cardinality: { min: 0, max: 1 },
    conditions: [
      {
        triggerField: 'previouslyFiled709',
        triggerValue: true,
        action: 'show'
      }
    ]
  },
  {
    id: 'giftsBySpouses',
    xmlName: 'GiftsBySpousesInd',
    label: 'Gifts by Spouses to Third Parties',
    lineNumber: '19',
    dataType: IRSDataType.Boolean,
    required: true,
    cardinality: { min: 1, max: 1 },
    helpText: 'Triggers Part III if Yes'
  },
  {
    id: 'dsueApplied',
    xmlName: 'DSUEAppliedInd',
    label: 'DSUE Amount Applied',
    lineNumber: '20',
    dataType: IRSDataType.Boolean,
    required: true,
    cardinality: { min: 1, max: 1 },
    helpText: 'Deceased Spousal Unused Exclusion - Triggers Schedule C if Yes'
  },
  {
    id: 'digitalAssetIncluded',
    xmlName: 'DigitalAssetIncludedInd',
    label: 'Digital Asset Included',
    lineNumber: '21',
    dataType: IRSDataType.Boolean,
    required: true,
    cardinality: { min: 1, max: 1 },
    helpText: 'New for recent tax years'
  }
]

/**
 * Form 709 Part II - Tax Computation
 */
const form709Part2Fields: FieldDefinition[] = [
  {
    id: 'currentPeriodTaxableGifts',
    xmlName: 'CurrentPeriodTaxableGiftsAmt',
    label: 'Current Period Taxable Gifts',
    lineNumber: '1',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['scheduleAPart4Line11'],
      formula: 'Schedule A, Part 4, Line 11'
    }
  },
  {
    id: 'priorPeriodTaxableGifts',
    xmlName: 'PriorPeriodTaxableGiftsAmt',
    label: 'Prior Period Taxable Gifts',
    lineNumber: '2',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['scheduleBLine3'],
      formula: 'Schedule B, Line 3'
    }
  },
  {
    id: 'totalTaxableGifts',
    xmlName: 'TotalTaxableGiftsAmt',
    label: 'Total Taxable Gifts',
    lineNumber: '3',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['currentPeriodTaxableGifts', 'priorPeriodTaxableGifts'],
      formula: 'Line 1 + Line 2',
      compute: (v) =>
        v['currentPeriodTaxableGifts'] + v['priorPeriodTaxableGifts']
    }
  },
  {
    id: 'taxOnLine3',
    xmlName: 'TaxOnTotalGiftsAmt',
    label: 'Tax on Line 3',
    lineNumber: '4',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['totalTaxableGifts'],
      formula: 'Gift tax table lookup on Line 3'
    }
  },
  {
    id: 'taxOnLine2',
    xmlName: 'TaxOnPriorGiftsAmt',
    label: 'Tax on Line 2',
    lineNumber: '5',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['priorPeriodTaxableGifts'],
      formula: 'Gift tax table lookup on Line 2'
    }
  },
  {
    id: 'taxBalance',
    xmlName: 'TaxBalanceAmt',
    label: 'Balance',
    lineNumber: '6',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['taxOnLine3', 'taxOnLine2'],
      formula: 'Line 4 - Line 5',
      compute: (v) => v['taxOnLine3'] - v['taxOnLine2']
    }
  },
  {
    id: 'applicableCreditAmount',
    xmlName: 'ApplicableCreditAmt',
    label: 'Applicable Credit Amount',
    lineNumber: '7',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['scheduleCLine5'],
      formula: 'Schedule C, Line 5 or instructions'
    }
  },
  {
    id: 'priorPeriodCreditUsed',
    xmlName: 'PriorPeriodCreditUsedAmt',
    label: 'Prior Period Credit Used',
    lineNumber: '8',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['scheduleBLine1ColC'],
      formula: 'Schedule B, Line 1, Column (c)'
    }
  },
  {
    id: 'creditBalance',
    xmlName: 'CreditBalanceAmt',
    label: 'Credit Balance',
    lineNumber: '9',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['applicableCreditAmount', 'priorPeriodCreditUsed'],
      formula: 'MAX(0, Line 7 - Line 8)',
      compute: (v) =>
        Math.max(0, v['applicableCreditAmount'] - v['priorPeriodCreditUsed'])
    }
  },
  {
    id: 'specificExemption',
    xmlName: 'SpecificExemptionAmt',
    label: '20% of Specific Exemption',
    lineNumber: '10',
    dataType: IRSDataType.Currency,
    required: false,
    cardinality: { min: 0, max: 1 },
    helpText: 'Historical gifts from 1976-1977'
  },
  {
    id: 'creditBalanceAfterExemption',
    xmlName: 'CreditBalanceAfterExemptionAmt',
    label: 'Credit Balance After Exemption',
    lineNumber: '11',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['creditBalance', 'specificExemption'],
      formula: 'MAX(0, Line 9 - Line 10)',
      compute: (v) =>
        Math.max(0, v['creditBalance'] - (v['specificExemption'] || 0))
    }
  },
  {
    id: 'applicableCredit',
    xmlName: 'ApplicableCreditAllowedAmt',
    label: 'Applicable Credit Allowed',
    lineNumber: '12',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['taxBalance', 'creditBalanceAfterExemption'],
      formula: 'MIN(Line 6, Line 11)',
      compute: (v) =>
        Math.min(v['taxBalance'], v['creditBalanceAfterExemption'])
    }
  },
  {
    id: 'foreignGiftTaxCredit',
    xmlName: 'ForeignGiftTaxCreditAmt',
    label: 'Foreign Gift Tax Credit',
    lineNumber: '13',
    dataType: IRSDataType.Currency,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'totalCredits',
    xmlName: 'TotalCreditsAmt',
    label: 'Total Credits',
    lineNumber: '14',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['applicableCredit', 'foreignGiftTaxCredit'],
      formula: 'Line 12 + Line 13',
      compute: (v) => v['applicableCredit'] + (v['foreignGiftTaxCredit'] || 0)
    }
  },
  {
    id: 'taxAfterCredits',
    xmlName: 'TaxAfterCreditsAmt',
    label: 'Tax After Credits',
    lineNumber: '15',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['taxBalance', 'totalCredits'],
      formula: 'MAX(0, Line 6 - Line 14)',
      compute: (v) => Math.max(0, v['taxBalance'] - v['totalCredits'])
    }
  },
  {
    id: 'gstTaxes',
    xmlName: 'GSTTaxesAmt',
    label: 'GST Taxes',
    lineNumber: '16',
    dataType: IRSDataType.Currency,
    required: false,
    cardinality: { min: 0, max: 1 },
    calculation: {
      dependsOn: ['scheduleDPart3ColG'],
      formula: 'Schedule D, Part 3, Column (g) total'
    }
  },
  {
    id: 'totalTax',
    xmlName: 'TotalTaxAmt',
    label: 'Total Tax',
    lineNumber: '17',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['taxAfterCredits', 'gstTaxes'],
      formula: 'Line 15 + Line 16',
      compute: (v) => v['taxAfterCredits'] + (v['gstTaxes'] || 0)
    }
  },
  {
    id: 'prepaidTax',
    xmlName: 'PrepaidTaxAmt',
    label: 'Prepaid Tax (Extension Payment)',
    lineNumber: '18',
    dataType: IRSDataType.Currency,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'taxDue',
    xmlName: 'TaxDueAmt',
    label: 'Tax Due',
    lineNumber: '19',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['totalTax', 'prepaidTax'],
      formula: 'MAX(0, Line 17 - Line 18)',
      compute: (v) => Math.max(0, v['totalTax'] - (v['prepaidTax'] || 0))
    }
  },
  {
    id: 'overpayment',
    xmlName: 'OverpaymentAmt',
    label: 'Overpayment',
    lineNumber: '20a',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['prepaidTax', 'totalTax'],
      formula: 'MAX(0, Line 18 - Line 17)',
      compute: (v) => Math.max(0, (v['prepaidTax'] || 0) - v['totalTax'])
    }
  }
]

/**
 * Form 709 Schedule A Gift Entry
 */
const form709ScheduleAGiftFields: FieldDefinition[] = [
  {
    id: 'itemNumber',
    xmlName: 'ItemNumber',
    label: 'Item Number',
    lineNumber: 'a',
    dataType: IRSDataType.Integer,
    required: true,
    cardinality: { min: 1, max: 1 }
  },
  {
    id: 'doneeName',
    xmlName: 'DoneeNameAndAddress',
    label: 'Donee Name and Address',
    lineNumber: 'b',
    dataType: IRSDataType.String,
    required: true,
    cardinality: { min: 1, max: 1 },
    maxLength: 100
  },
  {
    id: 'doneeRelationship',
    xmlName: 'DoneeRelationshipCd',
    label: 'Relationship to Donor',
    lineNumber: 'c',
    dataType: IRSDataType.Enum,
    required: true,
    cardinality: { min: 1, max: 1 },
    enumValues: [...FORM_709_RELATIONSHIPS]
  },
  {
    id: 'giftDescription',
    xmlName: 'GiftDescriptionTxt',
    label: 'Description of Gift',
    lineNumber: 'd',
    dataType: IRSDataType.String,
    required: true,
    cardinality: { min: 1, max: 1 },
    maxLength: 500
  },
  {
    id: 'donorAdjustedBasis',
    xmlName: 'DonorAdjustedBasisAmt',
    label: "Donor's Adjusted Basis",
    lineNumber: 'e',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 }
  },
  {
    id: 'dateOfGift',
    xmlName: 'DateOfGift',
    label: 'Date of Gift',
    lineNumber: 'f',
    dataType: IRSDataType.Date,
    required: true,
    cardinality: { min: 1, max: 1 }
  },
  {
    id: 'valueAtDateOfGift',
    xmlName: 'ValueAtDateOfGiftAmt',
    label: 'Value at Date of Gift',
    lineNumber: 'g',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 }
  },
  {
    id: 'splitGiftAmount',
    xmlName: 'SplitGiftAmt',
    label: 'Split Gift Amount (1/2 of g)',
    lineNumber: 'h',
    dataType: IRSDataType.Currency,
    required: false,
    cardinality: { min: 0, max: 1 },
    calculation: {
      dependsOn: ['valueAtDateOfGift', 'giftsBySpouses'],
      formula: 'If gift splitting: valueAtDateOfGift / 2'
    }
  },
  {
    id: 'netTransfer',
    xmlName: 'NetTransferAmt',
    label: 'Net Transfer',
    lineNumber: 'i',
    dataType: IRSDataType.Currency,
    required: true,
    cardinality: { min: 1, max: 1 },
    calculation: {
      dependsOn: ['valueAtDateOfGift', 'splitGiftAmount'],
      formula: 'Column g - Column h',
      compute: (v) => v['valueAtDateOfGift'] - (v['splitGiftAmount'] || 0)
    }
  },
  {
    id: 'charitableGift',
    xmlName: 'CharitableGiftInd',
    label: 'Charitable Gift',
    lineNumber: 'k',
    dataType: IRSDataType.Boolean,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'deductibleGiftToSpouse',
    xmlName: 'DeductibleGiftToSpouseInd',
    label: 'Deductible Gift to Spouse',
    lineNumber: 'l',
    dataType: IRSDataType.Boolean,
    required: false,
    cardinality: { min: 0, max: 1 }
  },
  {
    id: 'election2652a3',
    xmlName: 'Election2652a3Ind',
    label: '2652(a)(3) Election',
    lineNumber: 'm',
    dataType: IRSDataType.Boolean,
    required: false,
    cardinality: { min: 0, max: 1 }
  }
]

/**
 * Create Form 709 definition for a specific tax year
 */
export function createForm709Definition(taxYear: number): FormDefinition {
  return {
    formNumber: '709',
    name: 'United States Gift (and Generation-Skipping Transfer) Tax Return',
    taxYear,
    version: '1.0',
    xmlNamespace: 'http://www.irs.gov/efile',
    xmlRootElement: 'IRS709',
    sections: [
      {
        id: 'part1',
        title: 'Part I - General Information',
        fields: form709Part1Fields
      },
      {
        id: 'part2',
        title: 'Part II - Tax Computation',
        fields: form709Part2Fields
      },
      {
        id: 'part3',
        title: "Part III - Spouse's Consent on Gifts to Third Parties",
        description: 'Complete if gifts were made by spouses',
        fields: [
          {
            id: 'consentingSpouseName',
            xmlName: 'ConsentingSpouseNm',
            label: 'Consenting Spouse Name',
            lineNumber: '1',
            dataType: IRSDataType.String,
            required: false,
            cardinality: { min: 0, max: 1 },
            conditions: [
              {
                triggerField: 'giftsBySpouses',
                triggerValue: true,
                action: 'require'
              }
            ]
          },
          {
            id: 'consentingSpouseSSN',
            xmlName: 'ConsentingSpouseSSN',
            label: 'Consenting Spouse SSN',
            lineNumber: '2',
            dataType: IRSDataType.SSN,
            required: false,
            cardinality: { min: 0, max: 1 },
            conditions: [
              {
                triggerField: 'giftsBySpouses',
                triggerValue: true,
                action: 'require'
              }
            ]
          }
        ]
      }
    ],
    schedules: [
      {
        id: 'A',
        name: 'Schedule A - Computation of Taxable Gifts',
        xmlName: 'IRS709ScheduleA',
        attachesTo: '709',
        cardinality: { min: 1, max: 1 },
        sections: [
          {
            id: 'part1',
            title: 'Part 1 - Gifts Subject Only to Gift Tax',
            fields: [],
            sections: [
              {
                id: 'gifts',
                title: 'Gift Entries',
                fields: form709ScheduleAGiftFields,
                repeating: true,
                maxInstances: 100
              }
            ]
          },
          {
            id: 'part2',
            title:
              'Part 2 - Direct Skips (Subject to Both Gift Tax and GST Tax)',
            fields: [],
            sections: [
              {
                id: 'directSkips',
                title: 'Direct Skip Entries',
                fields: form709ScheduleAGiftFields,
                repeating: true,
                maxInstances: 100
              }
            ]
          },
          {
            id: 'part3',
            title: 'Part 3 - Indirect Skips and Other Transfers in Trust',
            fields: [],
            sections: [
              {
                id: 'indirectSkips',
                title: 'Indirect Skip Entries',
                fields: form709ScheduleAGiftFields,
                repeating: true,
                maxInstances: 100
              }
            ]
          },
          {
            id: 'part4',
            title: 'Part 4 - Taxable Gift Reconciliation',
            fields: [
              {
                id: 'totalPart1',
                xmlName: 'TotalPart1Amt',
                label: 'Total from Part 1',
                lineNumber: '1',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'totalPart2',
                xmlName: 'TotalPart2Amt',
                label: 'Total from Part 2',
                lineNumber: '2',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'totalPart3',
                xmlName: 'TotalPart3Amt',
                label: 'Total from Part 3',
                lineNumber: '3',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'totalGifts',
                xmlName: 'TotalGiftsAmt',
                label: 'Total Gifts',
                lineNumber: '4',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: ['totalPart1', 'totalPart2', 'totalPart3'],
                  formula: 'Line 1 + Line 2 + Line 3',
                  compute: (v) =>
                    v['totalPart1'] + v['totalPart2'] + v['totalPart3']
                }
              },
              {
                id: 'annualExclusionPerDonee',
                xmlName: 'AnnualExclusionPerDoneeAmt',
                label: 'Annual Exclusion Per Donee',
                lineNumber: '5',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                defaultValue: 18000 // 2025 limit
              },
              {
                id: 'totalAnnualExclusions',
                xmlName: 'TotalAnnualExclusionsAmt',
                label: 'Total Annual Exclusions',
                lineNumber: '6',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'giftsAfterExclusions',
                xmlName: 'GiftsAfterExclusionsAmt',
                label: 'Gifts After Exclusions',
                lineNumber: '7',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: ['totalGifts', 'totalAnnualExclusions'],
                  formula: 'Line 4 - Line 6',
                  compute: (v) => v['totalGifts'] - v['totalAnnualExclusions']
                }
              },
              {
                id: 'maritalDeduction',
                xmlName: 'MaritalDeductionAmt',
                label: 'Marital Deduction',
                lineNumber: '8',
                dataType: IRSDataType.Currency,
                required: false,
                cardinality: { min: 0, max: 1 }
              },
              {
                id: 'charitableDeduction',
                xmlName: 'CharitableDeductionAmt',
                label: 'Charitable Deduction',
                lineNumber: '9',
                dataType: IRSDataType.Currency,
                required: false,
                cardinality: { min: 0, max: 1 }
              },
              {
                id: 'totalDeductions',
                xmlName: 'TotalDeductionsAmt',
                label: 'Total Deductions',
                lineNumber: '10',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: ['maritalDeduction', 'charitableDeduction'],
                  formula: 'Line 8 + Line 9',
                  compute: (v) =>
                    (v['maritalDeduction'] || 0) +
                    (v['charitableDeduction'] || 0)
                }
              },
              {
                id: 'taxableGifts',
                xmlName: 'TaxableGiftsAmt',
                label: 'Taxable Gifts',
                lineNumber: '11',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: ['giftsAfterExclusions', 'totalDeductions'],
                  formula: 'Line 7 - Line 10',
                  compute: (v) =>
                    v['giftsAfterExclusions'] - v['totalDeductions']
                }
              }
            ]
          }
        ]
      },
      {
        id: 'B',
        name: 'Schedule B - Gifts From Prior Periods',
        xmlName: 'IRS709ScheduleB',
        attachesTo: '709',
        cardinality: { min: 0, max: 1 },
        requiredWhen: [
          {
            triggerField: 'previouslyFiled709',
            triggerValue: true,
            action: 'require'
          }
        ],
        sections: [
          {
            id: 'priorGifts',
            title: 'Prior Period Gifts',
            fields: [
              {
                id: 'calendarYear',
                xmlName: 'CalendarYearOrQuarter',
                label: 'Calendar Year/Quarter',
                lineNumber: 'a',
                dataType: IRSDataType.String,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'irsOfficeFiled',
                xmlName: 'IrsOfficeWhereFiledTxt',
                label: 'IRS Office Where Filed',
                lineNumber: 'b',
                dataType: IRSDataType.String,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'creditUsed',
                xmlName: 'ApplicableCreditUsedAmt',
                label: 'Applicable Credit Used',
                lineNumber: 'c',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'specificExemption',
                xmlName: 'SpecificExemptionAmt',
                label: 'Specific Exemption (pre-1977)',
                lineNumber: 'd',
                dataType: IRSDataType.Currency,
                required: false,
                cardinality: { min: 0, max: 1 }
              },
              {
                id: 'taxableGiftsAmount',
                xmlName: 'TaxableGiftsAmt',
                label: 'Taxable Gifts Amount',
                lineNumber: 'e',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              }
            ],
            repeating: true,
            maxInstances: 50
          }
        ]
      },
      {
        id: 'C',
        name: 'Schedule C - DSUE Amount and Restored Exclusion',
        xmlName: 'IRS709ScheduleC',
        attachesTo: '709',
        cardinality: { min: 0, max: 1 },
        requiredWhen: [
          {
            triggerField: 'dsueApplied',
            triggerValue: true,
            action: 'require'
          }
        ],
        sections: [
          {
            id: 'dsue',
            title: 'DSUE Calculation',
            fields: [
              {
                id: 'basicExclusionAmount',
                xmlName: 'BasicExclusionAmt',
                label: 'Basic Exclusion Amount',
                lineNumber: '1',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                defaultValue: 13610000 // 2024 amount
              },
              {
                id: 'totalDSUE',
                xmlName: 'TotalDSUEAmt',
                label: 'Total DSUE from Parts 1 & 2',
                lineNumber: '2',
                dataType: IRSDataType.Currency,
                required: false,
                cardinality: { min: 0, max: 1 }
              },
              {
                id: 'restoredExclusionAmount',
                xmlName: 'RestoredExclusionAmt',
                label: 'Restored Exclusion Amount',
                lineNumber: '3',
                dataType: IRSDataType.Currency,
                required: false,
                cardinality: { min: 0, max: 1 }
              },
              {
                id: 'totalExclusion',
                xmlName: 'TotalExclusionAmt',
                label: 'Total (Lines 1+2+3)',
                lineNumber: '4',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: [
                    'basicExclusionAmount',
                    'totalDSUE',
                    'restoredExclusionAmount'
                  ],
                  formula: 'Line 1 + Line 2 + Line 3',
                  compute: (v) =>
                    v['basicExclusionAmount'] +
                    (v['totalDSUE'] || 0) +
                    (v['restoredExclusionAmount'] || 0)
                }
              },
              {
                id: 'applicableCreditOnLine4',
                xmlName: 'ApplicableCreditOnLine4Amt',
                label: 'Applicable Credit',
                lineNumber: '5',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: ['totalExclusion'],
                  formula: 'Gift tax table lookup on Line 4'
                }
              }
            ]
          }
        ]
      },
      {
        id: 'D',
        name: 'Schedule D - Generation-Skipping Transfer Tax',
        xmlName: 'IRS709ScheduleD',
        attachesTo: '709',
        cardinality: { min: 0, max: 1 },
        sections: [
          {
            id: 'part1',
            title: 'Part 1 - Generation-Skipping Transfers',
            fields: [],
            repeating: true
          },
          {
            id: 'part2',
            title: 'Part 2 - GST Exemption Reconciliation',
            fields: [
              {
                id: 'maxGSTExemption',
                xmlName: 'MaxGSTExemptionAmt',
                label: 'Maximum GST Exemption',
                lineNumber: '1',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                defaultValue: 13610000 // 2024 amount
              },
              {
                id: 'priorGSTExemptionUsed',
                xmlName: 'PriorGSTExemptionUsedAmt',
                label: 'Prior GST Exemption Used',
                lineNumber: '2',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              },
              {
                id: 'exemptionAvailable',
                xmlName: 'ExemptionAvailableAmt',
                label: 'Exemption Available',
                lineNumber: '3',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 },
                calculation: {
                  dependsOn: ['maxGSTExemption', 'priorGSTExemptionUsed'],
                  formula: 'Line 1 - Line 2',
                  compute: (v) =>
                    v['maxGSTExemption'] - v['priorGSTExemptionUsed']
                }
              }
            ]
          },
          {
            id: 'part3',
            title: 'Part 3 - Tax Computation',
            fields: [
              {
                id: 'totalGSTTax',
                xmlName: 'TotalGSTTaxAmt',
                label: 'Total GST Tax',
                lineNumber: 'g',
                dataType: IRSDataType.Currency,
                required: true,
                cardinality: { min: 1, max: 1 }
              }
            ]
          }
        ]
      }
    ],
    attachments: [
      {
        schemaName: 'IRSPayment',
        description: 'IRS Payment Schema',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'ApplicableCreditStatement',
        description: 'Historical credit reconciliation',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'ElectionOutQTIPTreatmentStmt',
        description: 'QTIP election out statement',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'NoticeOfAllocationStatement',
        description: 'GST exemption allocation notice',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'Section2632bElectionOutStatement',
        description: 'GST automatic allocation opt-out',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'Section2632cElectionStatement',
        description: 'GST election statement',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'Section529c2BElectionStatement',
        description: '529 plan 5-year election',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'ValuationDiscountStatement',
        description: 'Discount valuation explanation',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'AddressChangeStmt',
        description: 'Address change notification',
        cardinality: { min: 0, max: 1 }
      },
      {
        schemaName: 'BinaryAttachment',
        description: 'PDF/other attachments',
        cardinality: { min: 0, max: 'unbounded' }
      },
      {
        schemaName: 'GeneralDependencyMedium',
        description: 'General supporting documents',
        cardinality: { min: 0, max: 'unbounded' }
      },
      {
        schemaName: 'IRS712',
        description: 'Life Insurance Statement',
        cardinality: { min: 0, max: 'unbounded' }
      }
    ]
  }
}

// Register Form 709 for 2025
schemaRegistry.registerForm(createForm709Definition(2025))

export default schemaRegistry
