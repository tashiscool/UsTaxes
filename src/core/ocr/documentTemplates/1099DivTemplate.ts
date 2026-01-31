/**
 * 1099-DIV Template - Field definitions for 1099-DIV Dividends and Distributions
 *
 * Defines known field positions and labels for extracting data from 1099-DIV forms.
 */

import { FieldDefinition, ExtractedField, extractAllFields, extractByBoxNumber } from '../fieldExtractor'
import { OCRResult } from '../ocrEngine'
import { Income1099Div, Income1099Type, PersonRole } from 'ustaxes/core/data'

/**
 * 1099-DIV field definitions based on IRS form layout
 */
export const F1099_DIV_FIELDS: FieldDefinition[] = [
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

  // Dividend Boxes
  {
    id: 'totalOrdinaryDividends',
    name: 'Total ordinary dividends',
    labels: [
      'Total ordinary dividends',
      'Ordinary dividends',
      'Box 1a',
      '1a Total ordinary dividends',
      '1a. Total ordinary'
    ],
    type: 'currency',
    required: true,
    boxNumber: '1a'
  },
  {
    id: 'qualifiedDividends',
    name: 'Qualified dividends',
    labels: [
      'Qualified dividends',
      'Box 1b',
      '1b Qualified dividends',
      '1b. Qualified'
    ],
    type: 'currency',
    boxNumber: '1b'
  },
  {
    id: 'totalCapitalGain',
    name: 'Total capital gain distr.',
    labels: [
      'Total capital gain distr.',
      'Total capital gain distributions',
      'Capital gain distributions',
      'Box 2a',
      '2a Total capital'
    ],
    type: 'currency',
    boxNumber: '2a'
  },
  {
    id: 'unrecaptured1250Gain',
    name: 'Unrecap. Sec. 1250 gain',
    labels: [
      'Unrecap. Sec. 1250 gain',
      'Unrecaptured Section 1250 gain',
      'Section 1250 gain',
      'Box 2b',
      '2b Unrecap'
    ],
    type: 'currency',
    boxNumber: '2b'
  },
  {
    id: 'section1202Gain',
    name: 'Section 1202 gain',
    labels: [
      'Section 1202 gain',
      'Sec. 1202 gain',
      'Box 2c',
      '2c Section'
    ],
    type: 'currency',
    boxNumber: '2c'
  },
  {
    id: 'collectiblesGain',
    name: 'Collectibles (28%) gain',
    labels: [
      'Collectibles (28%) gain',
      'Collectibles gain',
      '28% rate gain',
      'Box 2d',
      '2d Collectibles'
    ],
    type: 'currency',
    boxNumber: '2d'
  },
  {
    id: 'section897OrdinaryDividends',
    name: 'Section 897 ordinary dividends',
    labels: [
      'Section 897 ordinary dividends',
      'Sec. 897 ordinary dividends',
      'Box 2e',
      '2e Section 897'
    ],
    type: 'currency',
    boxNumber: '2e'
  },
  {
    id: 'section897CapitalGain',
    name: 'Section 897 capital gain',
    labels: [
      'Section 897 capital gain',
      'Sec. 897 capital gain',
      'Box 2f',
      '2f Section 897'
    ],
    type: 'currency',
    boxNumber: '2f'
  },
  {
    id: 'nondividendDistributions',
    name: 'Nondividend distributions',
    labels: [
      'Nondividend distributions',
      'Return of capital',
      'Box 3',
      '3 Nondividend'
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
    id: 'section199ADividends',
    name: 'Section 199A dividends',
    labels: [
      'Section 199A dividends',
      'Sec. 199A dividends',
      'Box 5',
      '5 Section 199A'
    ],
    type: 'currency',
    boxNumber: '5'
  },
  {
    id: 'investmentExpenses',
    name: 'Investment expenses',
    labels: [
      'Investment expenses',
      'Box 6',
      '6 Investment'
    ],
    type: 'currency',
    boxNumber: '6'
  },
  {
    id: 'foreignTaxPaid',
    name: 'Foreign tax paid',
    labels: [
      'Foreign tax paid',
      'Box 7',
      '7 Foreign tax'
    ],
    type: 'currency',
    boxNumber: '7'
  },
  {
    id: 'foreignCountry',
    name: 'Foreign country or U.S. possession',
    labels: [
      'Foreign country',
      'U.S. possession',
      'Box 8',
      '8 Foreign country'
    ],
    type: 'text',
    boxNumber: '8'
  },
  {
    id: 'cashLiquidationDistributions',
    name: 'Cash liquidation distributions',
    labels: [
      'Cash liquidation distributions',
      'Cash liquidation',
      'Box 9',
      '9 Cash'
    ],
    type: 'currency',
    boxNumber: '9'
  },
  {
    id: 'noncashLiquidationDistributions',
    name: 'Noncash liquidation distributions',
    labels: [
      'Noncash liquidation distributions',
      'Noncash liquidation',
      'Box 10',
      '10 Noncash'
    ],
    type: 'currency',
    boxNumber: '10'
  },
  {
    id: 'exemptInterestDividends',
    name: 'Exempt-interest dividends',
    labels: [
      'Exempt-interest dividends',
      'Tax-exempt dividends',
      'Box 12',
      '12 Exempt'
    ],
    type: 'currency',
    boxNumber: '12'
  },
  {
    id: 'specifiedPrivateActivityBondDividends',
    name: 'Specified private activity bond interest dividends',
    labels: [
      'Specified private activity bond interest dividends',
      'Private activity bond dividends',
      'Box 13',
      '13 Specified'
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
      'Box 16',
      '16 State'
    ],
    type: 'currency',
    boxNumber: '16'
  }
]

/**
 * Result of 1099-DIV extraction
 */
export interface F1099DivExtractionResult {
  fields: Map<string, ExtractedField>
  f1099DivData: Partial<Income1099Div>
  confidence: number
  missingRequired: string[]
}

/**
 * Extract 1099-DIV data from OCR result
 */
export const extract1099DivData = (ocrResult: OCRResult): F1099DivExtractionResult => {
  const fields = extractAllFields(ocrResult, F1099_DIV_FIELDS)

  // Also try extracting by box numbers directly
  for (const fieldDef of F1099_DIV_FIELDS) {
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

  // Convert to Income1099Div format
  const f1099DivData: Partial<Income1099Div> = {
    type: Income1099Type.DIV,
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

  // Map extracted fields to 1099-DIV data structure
  const payerName = fields.get('payerName')?.value
  if (payerName) {
    f1099DivData.payer = payerName
  }

  const totalOrdinaryDividends = parseNum('totalOrdinaryDividends')
  const qualifiedDividends = parseNum('qualifiedDividends')
  const totalCapitalGain = parseNum('totalCapitalGain')

  if (totalOrdinaryDividends !== undefined) {
    f1099DivData.form = {
      dividends: totalOrdinaryDividends,
      qualifiedDividends: qualifiedDividends ?? 0,
      totalCapitalGainsDistributions: totalCapitalGain ?? 0
    }
  }

  // Calculate confidence
  const confidences = Array.from(fields.values()).map((f) => f.confidence)
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0

  // Check for missing required fields
  const missingRequired = F1099_DIV_FIELDS.filter(
    (f) => f.required && !fields.has(f.id)
  ).map((f) => f.name)

  return {
    fields,
    f1099DivData,
    confidence: avgConfidence,
    missingRequired
  }
}

/**
 * Validate extracted 1099-DIV data
 */
export const validate1099DivData = (
  data: Partial<Income1099Div>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!data.payer) {
    errors.push('Missing payer name')
  }

  if (!data.form?.dividends && data.form?.dividends !== 0) {
    errors.push('Missing total ordinary dividends (Box 1a)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  F1099_DIV_FIELDS,
  extract1099DivData,
  validate1099DivData
}
