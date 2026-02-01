/**
 * W-2 Template - Field definitions for W-2 Wage and Tax Statement
 *
 * Defines known field positions and labels for extracting data from W-2 forms.
 */

import {
  FieldDefinition,
  ExtractedField,
  extractAllFields,
  extractByBoxNumber
} from '../fieldExtractor'
import { OCRResult } from '../ocrEngine'
import { IncomeW2, PersonRole, State } from 'ustaxes/core/data'

/**
 * W-2 field definitions based on IRS form layout
 */
export const W2_FIELDS: FieldDefinition[] = [
  // Employee Information
  {
    id: 'employeeSSN',
    name: "Employee's SSN",
    labels: [
      "Employee's social security number",
      'Social security number',
      'SSN',
      'a Employee',
      "Employee's SSN"
    ],
    type: 'ssn',
    required: true,
    boxNumber: 'a'
  },
  {
    id: 'employerEIN',
    name: "Employer's EIN",
    labels: [
      'Employer identification number',
      "Employer's identification number (EIN)",
      'EIN',
      'b Employer',
      "Employer's EIN"
    ],
    type: 'ein',
    required: true,
    boxNumber: 'b'
  },
  {
    id: 'employerName',
    name: "Employer's Name",
    labels: [
      "Employer's name, address, and ZIP code",
      "Employer's name",
      'Employer name',
      'c Employer'
    ],
    type: 'text',
    required: true,
    boxNumber: 'c'
  },
  {
    id: 'employeeName',
    name: "Employee's Name",
    labels: [
      "Employee's first name and initial",
      "Employee's name",
      'Employee name',
      'e Employee'
    ],
    type: 'text',
    required: true,
    boxNumber: 'e'
  },
  {
    id: 'employeeAddress',
    name: "Employee's Address",
    labels: [
      "Employee's address and ZIP code",
      "Employee's address",
      'f Employee'
    ],
    type: 'text',
    boxNumber: 'f'
  },

  // Income and Tax Boxes
  {
    id: 'wages',
    name: 'Wages, tips, other compensation',
    labels: [
      'Wages, tips, other compensation',
      'Wages tips other compensation',
      'Wages',
      'Box 1',
      '1 Wages'
    ],
    type: 'currency',
    required: true,
    boxNumber: '1'
  },
  {
    id: 'federalWithholding',
    name: 'Federal income tax withheld',
    labels: [
      'Federal income tax withheld',
      'Federal tax withheld',
      'Federal withholding',
      'Box 2',
      '2 Federal'
    ],
    type: 'currency',
    required: true,
    boxNumber: '2'
  },
  {
    id: 'ssWages',
    name: 'Social security wages',
    labels: [
      'Social security wages',
      'SS wages',
      'Soc sec wages',
      'Box 3',
      '3 Social'
    ],
    type: 'currency',
    required: true,
    boxNumber: '3'
  },
  {
    id: 'ssWithholding',
    name: 'Social security tax withheld',
    labels: [
      'Social security tax withheld',
      'SS tax withheld',
      'Soc sec tax',
      'Box 4',
      '4 Social'
    ],
    type: 'currency',
    required: true,
    boxNumber: '4'
  },
  {
    id: 'medicareWages',
    name: 'Medicare wages and tips',
    labels: [
      'Medicare wages and tips',
      'Medicare wages',
      'Box 5',
      '5 Medicare'
    ],
    type: 'currency',
    required: true,
    boxNumber: '5'
  },
  {
    id: 'medicareWithholding',
    name: 'Medicare tax withheld',
    labels: ['Medicare tax withheld', 'Medicare tax', 'Box 6', '6 Medicare'],
    type: 'currency',
    required: true,
    boxNumber: '6'
  },
  {
    id: 'ssTips',
    name: 'Social security tips',
    labels: ['Social security tips', 'SS tips', 'Box 7', '7 Social'],
    type: 'currency',
    boxNumber: '7'
  },
  {
    id: 'allocatedTips',
    name: 'Allocated tips',
    labels: ['Allocated tips', 'Box 8', '8 Allocated'],
    type: 'currency',
    boxNumber: '8'
  },
  {
    id: 'dependentCareBenefits',
    name: 'Dependent care benefits',
    labels: ['Dependent care benefits', 'Box 10', '10 Dependent'],
    type: 'currency',
    boxNumber: '10'
  },
  {
    id: 'nonqualifiedPlans',
    name: 'Nonqualified plans',
    labels: ['Nonqualified plans', 'Box 11', '11 Nonqualified'],
    type: 'currency',
    boxNumber: '11'
  },

  // State Information
  {
    id: 'state',
    name: 'State',
    labels: ['State', '15 State', 'Box 15'],
    type: 'text',
    boxNumber: '15'
  },
  {
    id: 'stateId',
    name: "Employer's state ID",
    labels: [
      "Employer's state ID number",
      "Employer's state ID",
      'State ID',
      '15 State'
    ],
    type: 'text',
    boxNumber: '15'
  },
  {
    id: 'stateWages',
    name: 'State wages, tips, etc.',
    labels: ['State wages, tips, etc.', 'State wages', 'Box 16', '16 State'],
    type: 'currency',
    boxNumber: '16'
  },
  {
    id: 'stateWithholding',
    name: 'State income tax',
    labels: ['State income tax', 'State tax', 'Box 17', '17 State'],
    type: 'currency',
    boxNumber: '17'
  },
  {
    id: 'localWages',
    name: 'Local wages, tips, etc.',
    labels: ['Local wages, tips, etc.', 'Local wages', 'Box 18', '18 Local'],
    type: 'currency',
    boxNumber: '18'
  },
  {
    id: 'localWithholding',
    name: 'Local income tax',
    labels: ['Local income tax', 'Local tax', 'Box 19', '19 Local'],
    type: 'currency',
    boxNumber: '19'
  },
  {
    id: 'localityName',
    name: 'Locality name',
    labels: ['Locality name', 'Box 20', '20 Locality'],
    type: 'text',
    boxNumber: '20'
  }
]

/**
 * Box 12 codes and their labels
 */
export const BOX_12_CODES = [
  { code: 'A', label: 'Uncollected social security or RRTA tax on tips' },
  { code: 'B', label: 'Uncollected Medicare tax on tips' },
  {
    code: 'C',
    label: 'Taxable cost of group-term life insurance over $50,000'
  },
  { code: 'D', label: 'Elective deferrals to 401(k)' },
  { code: 'E', label: 'Elective deferrals to 403(b)' },
  { code: 'F', label: 'Elective deferrals to 408(k)(6) SEP' },
  { code: 'G', label: 'Elective deferrals to 457(b)' },
  { code: 'H', label: 'Elective deferrals to 501(c)(18)(D)' },
  { code: 'J', label: 'Nontaxable sick pay' },
  { code: 'K', label: '20% excise tax on golden parachute' },
  {
    code: 'L',
    label: 'Substantiated employee business expense reimbursements'
  },
  {
    code: 'M',
    label: 'Uncollected SS or RRTA tax on group-term life insurance'
  },
  { code: 'N', label: 'Uncollected Medicare tax on group-term life insurance' },
  { code: 'P', label: 'Excludable moving expense reimbursements' },
  { code: 'Q', label: 'Nontaxable combat pay' },
  { code: 'R', label: 'Employer contributions to Archer MSA' },
  { code: 'S', label: 'Employee salary reduction contributions to SIMPLE' },
  { code: 'T', label: 'Adoption benefits' },
  { code: 'V', label: 'Income from nonstatutory stock options' },
  { code: 'W', label: 'Employer contributions to HSA' },
  {
    code: 'Y',
    label: 'Deferrals under 409A nonqualified deferred compensation'
  },
  { code: 'Z', label: 'Income under 409A nonqualified deferred compensation' },
  { code: 'AA', label: 'Designated Roth contributions to 401(k)' },
  { code: 'BB', label: 'Designated Roth contributions to 403(b)' },
  { code: 'DD', label: 'Cost of employer-sponsored health coverage' },
  { code: 'EE', label: 'Designated Roth contributions to 457(b)' },
  { code: 'FF', label: 'Qualified small employer health reimbursement' },
  { code: 'GG', label: 'Income from qualified equity grants' },
  { code: 'HH', label: 'Aggregate deferrals under 83(i) elections' }
]

/**
 * Result of W-2 extraction
 */
export interface W2ExtractionResult {
  fields: Map<string, ExtractedField>
  w2Data: Partial<IncomeW2>
  confidence: number
  missingRequired: string[]
}

/**
 * Extract W-2 data from OCR result
 */
export const extractW2Data = (ocrResult: OCRResult): W2ExtractionResult => {
  const fields = extractAllFields(ocrResult, W2_FIELDS)

  // Also try extracting by box numbers directly
  for (const fieldDef of W2_FIELDS) {
    if (fieldDef.boxNumber && !fields.has(fieldDef.id)) {
      const extracted = extractByBoxNumber(
        ocrResult,
        fieldDef.boxNumber,
        fieldDef.type
      )
      if (extracted) {
        fields.set(fieldDef.id, {
          ...extracted,
          label: fieldDef.name
        })
      }
    }
  }

  // Convert to IncomeW2 format
  const w2Data: Partial<IncomeW2> = {}

  // Parse numeric fields
  const parseNum = (fieldId: string): number | undefined => {
    const field = fields.get(fieldId)
    if (field) {
      const num = parseFloat(field.value)
      return isNaN(num) ? undefined : num
    }
    return undefined
  }

  // Map extracted fields to W2 data structure
  w2Data.income = parseNum('wages')
  w2Data.fedWithholding = parseNum('federalWithholding')
  w2Data.ssWages = parseNum('ssWages')
  w2Data.ssWithholding = parseNum('ssWithholding')
  w2Data.medicareIncome = parseNum('medicareWages')
  w2Data.medicareWithholding = parseNum('medicareWithholding')
  w2Data.stateWages = parseNum('stateWages')
  w2Data.stateWithholding = parseNum('stateWithholding')

  // Parse employer info
  const employerName = fields.get('employerName')?.value
  const employerEIN = fields.get('employerEIN')?.value
  if (employerName || employerEIN) {
    w2Data.employer = {
      employerName,
      EIN: employerEIN
    }
  }

  // Parse state
  const stateField = fields.get('state')
  if (stateField) {
    const stateValue = stateField.value.toUpperCase().trim()
    // Check if it's a valid state abbreviation
    if (/^[A-Z]{2}$/.test(stateValue)) {
      w2Data.state = stateValue as State
    }
  }

  // Default person role
  w2Data.personRole = PersonRole.PRIMARY

  // Calculate confidence
  const confidences = Array.from(fields.values()).map((f) => f.confidence)
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0

  // Check for missing required fields
  const missingRequired = W2_FIELDS.filter(
    (f) => f.required && !fields.has(f.id)
  ).map((f) => f.name)

  return {
    fields,
    w2Data,
    confidence: avgConfidence,
    missingRequired
  }
}

/**
 * Validate extracted W-2 data
 */
export const validateW2Data = (
  data: Partial<IncomeW2>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (data.income === undefined || data.income < 0) {
    errors.push('Invalid or missing wages (Box 1)')
  }

  if (data.fedWithholding === undefined || data.fedWithholding < 0) {
    errors.push('Invalid or missing federal withholding (Box 2)')
  }

  if (data.ssWages === undefined || data.ssWages < 0) {
    errors.push('Invalid or missing Social Security wages (Box 3)')
  }

  if (data.ssWithholding === undefined || data.ssWithholding < 0) {
    errors.push('Invalid or missing Social Security tax (Box 4)')
  }

  if (data.medicareIncome === undefined || data.medicareIncome < 0) {
    errors.push('Invalid or missing Medicare wages (Box 5)')
  }

  if (data.medicareWithholding === undefined || data.medicareWithholding < 0) {
    errors.push('Invalid or missing Medicare tax (Box 6)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  W2_FIELDS,
  BOX_12_CODES,
  extractW2Data,
  validateW2Data
}
