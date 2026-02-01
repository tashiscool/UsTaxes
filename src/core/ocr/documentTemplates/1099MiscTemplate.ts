/**
 * 1099-MISC Template - Field definitions for 1099-MISC Miscellaneous Income
 *
 * Defines known field positions and labels for extracting data from 1099-MISC forms.
 */

import {
  FieldDefinition,
  ExtractedField,
  extractAllFields,
  extractByBoxNumber
} from '../fieldExtractor'
import { OCRResult } from '../ocrEngine'
import {
  Income1099MISC,
  Income1099Type,
  PersonRole,
  State
} from 'ustaxes/core/data'

/**
 * 1099-MISC field definitions based on IRS form layout
 */
export const F1099_MISC_FIELDS: FieldDefinition[] = [
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
    labels: ["RECIPIENT'S name", "Recipient's name", 'Recipient name'],
    type: 'text'
  },

  // Income Boxes
  {
    id: 'rents',
    name: 'Rents',
    labels: ['Rents', 'Box 1', '1 Rents', '1. Rents'],
    type: 'currency',
    boxNumber: '1'
  },
  {
    id: 'royalties',
    name: 'Royalties',
    labels: ['Royalties', 'Box 2', '2 Royalties', '2. Royalties'],
    type: 'currency',
    boxNumber: '2'
  },
  {
    id: 'otherIncome',
    name: 'Other income',
    labels: ['Other income', 'Box 3', '3 Other income', '3. Other income'],
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
    id: 'fishingBoatProceeds',
    name: 'Fishing boat proceeds',
    labels: ['Fishing boat proceeds', 'Box 5', '5 Fishing boat'],
    type: 'currency',
    boxNumber: '5'
  },
  {
    id: 'medicalPayments',
    name: 'Medical and health care payments',
    labels: [
      'Medical and health care payments',
      'Medical payments',
      'Health care payments',
      'Box 6',
      '6 Medical'
    ],
    type: 'currency',
    boxNumber: '6'
  },
  {
    id: 'directSales',
    name: 'Direct sales of $5,000 or more',
    labels: [
      'Direct sales of $5,000 or more',
      'Direct sales indicator',
      'Box 7',
      '7 Direct sales'
    ],
    type: 'text',
    boxNumber: '7'
  },
  {
    id: 'substitutePayments',
    name: 'Substitute payments in lieu of dividends or interest',
    labels: [
      'Substitute payments in lieu of dividends or interest',
      'Substitute payments',
      'Box 8',
      '8 Substitute'
    ],
    type: 'currency',
    boxNumber: '8'
  },
  {
    id: 'cropInsuranceProceeds',
    name: 'Crop insurance proceeds',
    labels: ['Crop insurance proceeds', 'Crop insurance', 'Box 9', '9 Crop'],
    type: 'currency',
    boxNumber: '9'
  },
  {
    id: 'grossProceedsAttorney',
    name: 'Gross proceeds paid to an attorney',
    labels: [
      'Gross proceeds paid to an attorney',
      'Attorney proceeds',
      'Box 10',
      '10 Gross proceeds'
    ],
    type: 'currency',
    boxNumber: '10'
  },
  {
    id: 'fishPurchasedForResale',
    name: 'Fish purchased for resale',
    labels: [
      'Fish purchased for resale',
      'Fish purchased',
      'Box 11',
      '11 Fish'
    ],
    type: 'currency',
    boxNumber: '11'
  },
  {
    id: 'section409ADeferrals',
    name: 'Section 409A deferrals',
    labels: [
      'Section 409A deferrals',
      'Sec. 409A deferrals',
      'Box 12',
      '12 Section 409A'
    ],
    type: 'currency',
    boxNumber: '12'
  },
  {
    id: 'excessGoldenParachute',
    name: 'Excess golden parachute payments',
    labels: [
      'Excess golden parachute payments',
      'Golden parachute',
      'Box 13',
      '13 Excess'
    ],
    type: 'currency',
    boxNumber: '13'
  },
  {
    id: 'nonqualifiedDeferredComp',
    name: 'Nonqualified deferred compensation',
    labels: [
      'Nonqualified deferred compensation',
      'NQDC',
      'Box 14',
      '14 Nonqualified'
    ],
    type: 'currency',
    boxNumber: '14'
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
    name: "Payer's state no.",
    labels: ["Payer's state no.", 'State identification', 'State ID'],
    type: 'text'
  },
  {
    id: 'stateTaxWithheld',
    name: 'State tax withheld',
    labels: [
      'State tax withheld',
      'State income tax',
      'Box 16',
      '16 State tax'
    ],
    type: 'currency',
    boxNumber: '16'
  },
  {
    id: 'stateIncome',
    name: 'State income',
    labels: ['State income', 'Box 17', '17 State income'],
    type: 'currency',
    boxNumber: '17'
  }
]

/**
 * Result of 1099-MISC extraction
 */
export interface F1099MiscExtractionResult {
  fields: Map<string, ExtractedField>
  f1099MiscData: Partial<Income1099MISC>
  confidence: number
  missingRequired: string[]
}

/**
 * Extract 1099-MISC data from OCR result
 */
export const extract1099MiscData = (
  ocrResult: OCRResult
): F1099MiscExtractionResult => {
  const fields = extractAllFields(ocrResult, F1099_MISC_FIELDS)

  // Also try extracting by box numbers directly
  for (const fieldDef of F1099_MISC_FIELDS) {
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

  // Convert to Income1099MISC format
  const f1099MiscData: Partial<Income1099MISC> = {
    type: Income1099Type.MISC,
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

  // Map extracted fields to 1099-MISC data structure
  const payerName = fields.get('payerName')?.value
  if (payerName) {
    f1099MiscData.payer = payerName
  }

  // Build form data
  const rents = parseNum('rents')
  const royalties = parseNum('royalties')
  const otherIncome = parseNum('otherIncome')
  const federalWithholding = parseNum('federalWithholding')
  const fishingBoatProceeds = parseNum('fishingBoatProceeds')
  const medicalPayments = parseNum('medicalPayments')
  const substitutePayments = parseNum('substitutePayments')
  const cropInsuranceProceeds = parseNum('cropInsuranceProceeds')
  const grossProceedsAttorney = parseNum('grossProceedsAttorney')
  const fishPurchasedForResale = parseNum('fishPurchasedForResale')
  const section409ADeferrals = parseNum('section409ADeferrals')
  const excessGoldenParachute = parseNum('excessGoldenParachute')
  const nonqualifiedDeferredComp = parseNum('nonqualifiedDeferredComp')
  const stateTaxWithheld = parseNum('stateTaxWithheld')
  const stateIncome = parseNum('stateIncome')

  f1099MiscData.form = {
    rents,
    royalties,
    otherIncome,
    federalIncomeTaxWithheld: federalWithholding,
    fishingBoatProceeds,
    medicalPayments,
    substitutePayments,
    cropInsuranceProceeds,
    grossProceedsAttorney,
    fishPurchasedForResale,
    section409ADeferrals,
    excessGoldenParachute,
    nonqualifiedDeferredComp,
    stateTaxWithheld,
    stateIncome
  }

  // Parse state
  const stateField = fields.get('state')
  if (stateField) {
    const stateValue = stateField.value.toUpperCase().trim()
    if (/^[A-Z]{2}$/.test(stateValue)) {
      f1099MiscData.form.state = stateValue as State
    }
  }

  // Calculate confidence
  const confidences = Array.from(fields.values()).map((f) => f.confidence)
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0

  // Check for missing required fields
  const missingRequired = F1099_MISC_FIELDS.filter(
    (f) => f.required && !fields.has(f.id)
  ).map((f) => f.name)

  return {
    fields,
    f1099MiscData,
    confidence: avgConfidence,
    missingRequired
  }
}

/**
 * Validate extracted 1099-MISC data
 */
export const validate1099MiscData = (
  data: Partial<Income1099MISC>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!data.payer) {
    errors.push('Missing payer name')
  }

  // At least one income field should be present
  const form = data.form
  if (!form) {
    errors.push('No income data found')
  } else {
    const hasIncome =
      (form.rents && form.rents > 0) ||
      (form.royalties && form.royalties > 0) ||
      (form.otherIncome && form.otherIncome > 0) ||
      (form.fishingBoatProceeds && form.fishingBoatProceeds > 0) ||
      (form.medicalPayments && form.medicalPayments > 0) ||
      (form.substitutePayments && form.substitutePayments > 0) ||
      (form.cropInsuranceProceeds && form.cropInsuranceProceeds > 0) ||
      (form.grossProceedsAttorney && form.grossProceedsAttorney > 0) ||
      (form.fishPurchasedForResale && form.fishPurchasedForResale > 0)

    if (!hasIncome) {
      errors.push('No income amounts found in any box')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  F1099_MISC_FIELDS,
  extract1099MiscData,
  validate1099MiscData
}
