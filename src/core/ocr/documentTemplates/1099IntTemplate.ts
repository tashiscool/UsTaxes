/**
 * 1099-INT Template - Field definitions for 1099-INT Interest Income
 *
 * Defines known field positions and labels for extracting data from 1099-INT forms.
 */

import { FieldDefinition, ExtractedField, extractAllFields, extractByBoxNumber } from '../fieldExtractor'
import { OCRResult } from '../ocrEngine'
import { Income1099Int, Income1099Type, PersonRole } from 'ustaxes/core/data'

/**
 * 1099-INT field definitions based on IRS form layout
 */
export const F1099_INT_FIELDS: FieldDefinition[] = [
  // Payer Information
  {
    id: 'payerName',
    name: "Payer's Name",
    labels: [
      "PAYER'S name, street address, city or town, state or province",
      "Payer's name",
      'PAYER',
      'Payer name'
    ],
    type: 'text',
    required: true
  },
  {
    id: 'payerTIN',
    name: "Payer's TIN",
    labels: [
      "PAYER'S TIN",
      "Payer's TIN",
      'Payer TIN',
      "PAYER'S federal identification"
    ],
    type: 'ein'
  },

  // Recipient Information
  {
    id: 'recipientTIN',
    name: "Recipient's TIN",
    labels: [
      "RECIPIENT'S TIN",
      "Recipient's identification number",
      'Social security number',
      'SSN'
    ],
    type: 'ssn'
  },
  {
    id: 'recipientName',
    name: "Recipient's Name",
    labels: [
      "RECIPIENT'S name",
      "Recipient's name",
      'Recipient name'
    ],
    type: 'text'
  },

  // Income Boxes
  {
    id: 'interestIncome',
    name: 'Interest income',
    labels: [
      'Interest income',
      'Box 1',
      '1 Interest income',
      '1. Interest income'
    ],
    type: 'currency',
    required: true,
    boxNumber: '1'
  },
  {
    id: 'earlyWithdrawalPenalty',
    name: 'Early withdrawal penalty',
    labels: [
      'Early withdrawal penalty',
      'Box 2',
      '2 Early withdrawal penalty',
      '2. Early withdrawal'
    ],
    type: 'currency',
    boxNumber: '2'
  },
  {
    id: 'usSavingsBondInterest',
    name: 'Interest on U.S. Savings Bonds and Treasury obligations',
    labels: [
      'Interest on U.S. Savings Bonds',
      'U.S. Savings Bonds',
      'Treasury obligations',
      'Box 3',
      '3 Interest'
    ],
    type: 'currency',
    boxNumber: '3'
  },
  {
    id: 'federalWithholding',
    name: 'Federal income tax withheld',
    labels: [
      'Federal income tax withheld',
      'Federal tax withheld',
      'Box 4',
      '4 Federal'
    ],
    type: 'currency',
    boxNumber: '4'
  },
  {
    id: 'investmentExpenses',
    name: 'Investment expenses',
    labels: [
      'Investment expenses',
      'Box 5',
      '5 Investment'
    ],
    type: 'currency',
    boxNumber: '5'
  },
  {
    id: 'foreignTaxPaid',
    name: 'Foreign tax paid',
    labels: [
      'Foreign tax paid',
      'Box 6',
      '6 Foreign tax'
    ],
    type: 'currency',
    boxNumber: '6'
  },
  {
    id: 'foreignCountry',
    name: 'Foreign country or U.S. possession',
    labels: [
      'Foreign country',
      'U.S. possession',
      'Box 7',
      '7 Foreign country'
    ],
    type: 'text',
    boxNumber: '7'
  },
  {
    id: 'taxExemptInterest',
    name: 'Tax-exempt interest',
    labels: [
      'Tax-exempt interest',
      'Box 8',
      '8 Tax-exempt'
    ],
    type: 'currency',
    boxNumber: '8'
  },
  {
    id: 'specifiedPrivateActivityBondInterest',
    name: 'Specified private activity bond interest',
    labels: [
      'Specified private activity bond interest',
      'Private activity bond',
      'Box 9',
      '9 Specified'
    ],
    type: 'currency',
    boxNumber: '9'
  },
  {
    id: 'marketDiscount',
    name: 'Market discount',
    labels: [
      'Market discount',
      'Box 10',
      '10 Market'
    ],
    type: 'currency',
    boxNumber: '10'
  },
  {
    id: 'bondPremium',
    name: 'Bond premium',
    labels: [
      'Bond premium',
      'Box 11',
      '11 Bond premium'
    ],
    type: 'currency',
    boxNumber: '11'
  },
  {
    id: 'bondPremiumTreasury',
    name: 'Bond premium on Treasury obligations',
    labels: [
      'Bond premium on Treasury obligations',
      'Treasury bond premium',
      'Box 12',
      '12 Bond premium'
    ],
    type: 'currency',
    boxNumber: '12'
  },
  {
    id: 'bondPremiumTaxExempt',
    name: 'Bond premium on tax-exempt bond',
    labels: [
      'Bond premium on tax-exempt bond',
      'Tax-exempt bond premium',
      'Box 13',
      '13 Bond premium'
    ],
    type: 'currency',
    boxNumber: '13'
  },

  // State Information
  {
    id: 'state',
    name: 'State',
    labels: [
      'State',
      '15 State',
      'Box 15'
    ],
    type: 'text',
    boxNumber: '15'
  },
  {
    id: 'stateId',
    name: "Payer's state no.",
    labels: [
      "Payer's state no.",
      'State identification',
      'State ID',
      '15 Payer'
    ],
    type: 'text',
    boxNumber: '15'
  },
  {
    id: 'stateWithholding',
    name: 'State tax withheld',
    labels: [
      'State tax withheld',
      'State income tax',
      'Box 17',
      '17 State'
    ],
    type: 'currency',
    boxNumber: '17'
  }
]

/**
 * Result of 1099-INT extraction
 */
export interface F1099IntExtractionResult {
  fields: Map<string, ExtractedField>
  f1099IntData: Partial<Income1099Int>
  confidence: number
  missingRequired: string[]
}

/**
 * Extract 1099-INT data from OCR result
 */
export const extract1099IntData = (ocrResult: OCRResult): F1099IntExtractionResult => {
  const fields = extractAllFields(ocrResult, F1099_INT_FIELDS)

  // Also try extracting by box numbers directly
  for (const fieldDef of F1099_INT_FIELDS) {
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

  // Convert to Income1099Int format
  const f1099IntData: Partial<Income1099Int> = {
    type: Income1099Type.INT,
    personRole: PersonRole.PRIMARY
  }

  // Parse numeric fields
  const parseNum = (fieldId: string): number | undefined => {
    const field = fields.get(fieldId)
    if (field) {
      const num = parseFloat(field.value)
      return isNaN(num) ? undefined : num
    }
    return undefined
  }

  // Map extracted fields to 1099-INT data structure
  const payerName = fields.get('payerName')?.value
  if (payerName) {
    f1099IntData.payer = payerName
  }

  const interestIncome = parseNum('interestIncome')
  if (interestIncome !== undefined) {
    f1099IntData.form = {
      income: interestIncome
    }
  }

  // Calculate confidence
  const confidences = Array.from(fields.values()).map((f) => f.confidence)
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0

  // Check for missing required fields
  const missingRequired = F1099_INT_FIELDS.filter(
    (f) => f.required && !fields.has(f.id)
  ).map((f) => f.name)

  return {
    fields,
    f1099IntData,
    confidence: avgConfidence,
    missingRequired
  }
}

/**
 * Validate extracted 1099-INT data
 */
export const validate1099IntData = (
  data: Partial<Income1099Int>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!data.payer) {
    errors.push('Missing payer name')
  }

  if (!data.form?.income && data.form?.income !== 0) {
    errors.push('Missing interest income (Box 1)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  F1099_INT_FIELDS,
  extract1099IntData,
  validate1099IntData
}
