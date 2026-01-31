/**
 * Document Templates Index
 *
 * Exports all document template definitions and extraction functions.
 */

export * from './w2Template'
export * from './1099IntTemplate'
export * from './1099DivTemplate'
export * from './1099MiscTemplate'

import { extractW2Data, W2ExtractionResult } from './w2Template'
import { extract1099IntData, F1099IntExtractionResult } from './1099IntTemplate'
import { extract1099DivData, F1099DivExtractionResult } from './1099DivTemplate'
import { extract1099MiscData, F1099MiscExtractionResult } from './1099MiscTemplate'
import { OCRResult } from '../ocrEngine'

/**
 * Supported document types for OCR scanning
 */
export type DocumentType = 'W-2' | '1099-INT' | '1099-DIV' | '1099-B' | '1099-MISC'

/**
 * Document type descriptions for UI
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'W-2': 'W-2 Wage and Tax Statement',
  '1099-INT': '1099-INT Interest Income',
  '1099-DIV': '1099-DIV Dividends and Distributions',
  '1099-B': '1099-B Proceeds from Broker Transactions',
  '1099-MISC': '1099-MISC Miscellaneous Income'
}

/**
 * Union type for all extraction results
 */
export type ExtractionResult =
  | { type: 'W-2'; result: W2ExtractionResult }
  | { type: '1099-INT'; result: F1099IntExtractionResult }
  | { type: '1099-DIV'; result: F1099DivExtractionResult }
  | { type: '1099-MISC'; result: F1099MiscExtractionResult }
  | { type: '1099-B'; result: null } // Placeholder for future implementation

/**
 * Extract data from OCR result based on document type
 */
export const extractDocumentData = (
  ocrResult: OCRResult,
  documentType: DocumentType
): ExtractionResult => {
  switch (documentType) {
    case 'W-2':
      return { type: 'W-2', result: extractW2Data(ocrResult) }
    case '1099-INT':
      return { type: '1099-INT', result: extract1099IntData(ocrResult) }
    case '1099-DIV':
      return { type: '1099-DIV', result: extract1099DivData(ocrResult) }
    case '1099-MISC':
      return { type: '1099-MISC', result: extract1099MiscData(ocrResult) }
    case '1099-B':
      // 1099-B requires more complex handling due to multiple transactions
      // For now, return null as placeholder
      console.warn('1099-B OCR extraction not yet implemented')
      return { type: '1099-B', result: null }
  }
}

/**
 * Auto-detect document type from OCR text
 */
export const detectDocumentType = (ocrResult: OCRResult): DocumentType | null => {
  const text = ocrResult.text.toLowerCase()

  // Look for form identifiers
  if (
    text.includes('form w-2') ||
    text.includes('wage and tax statement') ||
    (text.includes('w-2') && text.includes('wages'))
  ) {
    return 'W-2'
  }

  if (
    text.includes('1099-int') ||
    text.includes('form 1099-int') ||
    (text.includes('1099') && text.includes('interest income'))
  ) {
    return '1099-INT'
  }

  if (
    text.includes('1099-div') ||
    text.includes('form 1099-div') ||
    (text.includes('1099') && text.includes('dividends'))
  ) {
    return '1099-DIV'
  }

  if (
    text.includes('1099-b') ||
    text.includes('form 1099-b') ||
    (text.includes('1099') && text.includes('proceeds from broker'))
  ) {
    return '1099-B'
  }

  if (
    text.includes('1099-misc') ||
    text.includes('form 1099-misc') ||
    (text.includes('1099') && text.includes('miscellaneous'))
  ) {
    return '1099-MISC'
  }

  return null
}

export default {
  extractDocumentData,
  detectDocumentType,
  DOCUMENT_TYPE_LABELS
}
