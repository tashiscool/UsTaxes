/**
 * Field Extractor - Smart field extraction from OCR results
 *
 * Finds field labels in OCR text and extracts associated values.
 * Handles common OCR errors and parses various data formats.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars */

import { OCRResult, OCRWord, OCRLine } from './ocrEngine'

/**
 * Extracted field with value and confidence
 */
export interface ExtractedField {
  label: string
  value: string
  rawValue: string
  confidence: number
  bbox?: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

/**
 * Field definition for template matching
 */
export interface FieldDefinition {
  /** Unique identifier for the field */
  id: string
  /** Display name for the field */
  name: string
  /** Possible labels that might appear on the document */
  labels: string[]
  /** Regular expression to validate/extract the value */
  pattern?: RegExp
  /** Type of data expected */
  type: 'text' | 'number' | 'currency' | 'ssn' | 'ein' | 'date' | 'percentage'
  /** Whether this field is required */
  required?: boolean
  /** Box number on the form (e.g., "1", "2a") */
  boxNumber?: string
  /** Approximate position on document (0-1 normalized) */
  position?: {
    x: number
    y: number
    tolerance: number
  }
}

/**
 * Common OCR character substitutions (OCR errors)
 */
const OCR_SUBSTITUTIONS: Record<string, string[]> = {
  '0': ['O', 'o', 'Q', 'D'],
  '1': ['l', 'I', 'i', '|', '!'],
  '2': ['Z', 'z'],
  '5': ['S', 's'],
  '6': ['G', 'b'],
  '8': ['B'],
  '9': ['g', 'q'],
  O: ['0', 'Q', 'D'],
  l: ['1', 'I', 'i', '|'],
  S: ['5', '$'],
  B: ['8', '3'],
  Z: ['2'],
  G: ['6', 'C']
}

/**
 * Clean up common OCR errors in text
 */
export const cleanOCRText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/[`']/g, "'")
    .replace(/[""]/g, '"')
    .trim()
}

/**
 * Convert OCR text to a number, handling common errors
 */
export const parseOCRNumber = (text: string): number | null => {
  if (!text || text.trim() === '') {
    return null
  }

  // Remove currency symbols, commas, and spaces
  let cleaned = text.replace(/[$,\s]/g, '')

  // Fix common OCR substitutions for numbers
  cleaned = cleaned
    .replace(/[Oo]/g, '0')
    .replace(/[lIi|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[gq]/g, '9')

  // Handle negative numbers in parentheses
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  // Handle percentage
  const isPercentage = cleaned.endsWith('%')
  if (isPercentage) {
    cleaned = cleaned.slice(0, -1)
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    return null
  }

  return isNegative ? -num : num
}

/**
 * Parse currency value from OCR text
 */
export const parseOCRCurrency = (text: string): number | null => {
  const num = parseOCRNumber(text)
  if (num === null) return null

  // Round to 2 decimal places for currency
  return Math.round(num * 100) / 100
}

/**
 * Parse SSN from OCR text (xxx-xx-xxxx format)
 */
export const parseOCRSSN = (text: string): string | null => {
  // Remove all non-digit characters first
  let digits = text.replace(/\D/g, '')

  // Fix common OCR errors
  digits = digits
    .replace(/[Oo]/g, '0')
    .replace(/[lIi|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[gq]/g, '9')

  // Must be 9 digits
  if (digits.length !== 9) {
    // Try to find 9 consecutive digits in the original text
    const match = text.match(/\d{3}[\s-]?\d{2}[\s-]?\d{4}/)
    if (match) {
      digits = match[0].replace(/\D/g, '')
    }
  }

  if (digits.length !== 9) {
    return null
  }

  return digits
}

/**
 * Parse EIN from OCR text (xx-xxxxxxx format)
 */
export const parseOCREIN = (text: string): string | null => {
  // Remove all non-digit characters first
  let digits = text.replace(/\D/g, '')

  // Fix common OCR errors
  digits = digits
    .replace(/[Oo]/g, '0')
    .replace(/[lIi|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[gq]/g, '9')

  // Must be 9 digits
  if (digits.length !== 9) {
    // Try to find 9 consecutive digits in the original text
    const match = text.match(/\d{2}[\s-]?\d{7}/)
    if (match) {
      digits = match[0].replace(/\D/g, '')
    }
  }

  if (digits.length !== 9) {
    return null
  }

  return digits
}

/**
 * Parse date from OCR text
 */
export const parseOCRDate = (text: string): Date | null => {
  // Try common date formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY or M/D/YY
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/, // MM-DD-YYYY
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/, // YYYY/MM/DD
    /(\d{4})-(\d{1,2})-(\d{1,2})/ // YYYY-MM-DD
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      let year: number, month: number, day: number

      if (match[1].length === 4) {
        // YYYY/MM/DD format
        year = parseInt(match[1])
        month = parseInt(match[2]) - 1
        day = parseInt(match[3])
      } else {
        // MM/DD/YYYY format
        month = parseInt(match[1]) - 1
        day = parseInt(match[2])
        year = parseInt(match[3])

        // Handle 2-digit years
        if (year < 100) {
          year += year > 50 ? 1900 : 2000
        }
      }

      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  return null
}

/**
 * Calculate string similarity using Levenshtein distance
 */
export const stringSimilarity = (a: string, b: string): number => {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  if (aLower === bLower) return 1

  const matrix: number[][] = []

  for (let i = 0; i <= aLower.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= bLower.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= aLower.length; i++) {
    for (let j = 1; j <= bLower.length; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  const distance = matrix[aLower.length][bLower.length]
  const maxLength = Math.max(aLower.length, bLower.length)

  return maxLength > 0 ? 1 - distance / maxLength : 1
}

/**
 * Find text in OCR result that matches a label
 */
export const findLabelMatch = (
  ocrResult: OCRResult,
  labels: string[],
  minSimilarity = 0.7
): { word: OCRWord; similarity: number; label: string } | null => {
  let bestMatch: { word: OCRWord; similarity: number; label: string } | null =
    null

  for (const word of ocrResult.words) {
    for (const label of labels) {
      const similarity = stringSimilarity(word.text, label)
      if (
        similarity >= minSimilarity &&
        (!bestMatch || similarity > bestMatch.similarity)
      ) {
        bestMatch = { word, similarity, label }
      }
    }
  }

  // Also check multi-word labels against lines
  for (const line of ocrResult.lines) {
    for (const label of labels) {
      if (label.includes(' ')) {
        const similarity = stringSimilarity(line.text, label)
        if (
          similarity >= minSimilarity &&
          (!bestMatch || similarity > bestMatch.similarity)
        ) {
          // Create a synthetic word from the line
          bestMatch = {
            word: {
              text: line.text,
              confidence: line.confidence,
              bbox: line.bbox,
              baseline: line.words[0]?.baseline || {
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0
              }
            },
            similarity,
            label
          }
        }
      }
    }
  }

  return bestMatch
}

/**
 * Find value associated with a label (typically to the right or below)
 */
export const findAssociatedValue = (
  ocrResult: OCRResult,
  labelWord: OCRWord,
  type: FieldDefinition['type']
): { value: string; confidence: number; bbox: OCRWord['bbox'] } | null => {
  const labelBox = labelWord.bbox
  const tolerance = 50 // pixels

  // Find words to the right of the label (same row)
  const rightWords = ocrResult.words.filter((word) => {
    const verticalOverlap =
      word.bbox.y0 < labelBox.y1 + tolerance &&
      word.bbox.y1 > labelBox.y0 - tolerance
    const isRight = word.bbox.x0 > labelBox.x1 - 10
    return verticalOverlap && isRight
  })

  // Sort by x position
  rightWords.sort((a, b) => a.bbox.x0 - b.bbox.x0)

  // Find words below the label
  const belowWords = ocrResult.words.filter((word) => {
    const horizontalOverlap =
      word.bbox.x0 < labelBox.x1 + tolerance &&
      word.bbox.x1 > labelBox.x0 - tolerance
    const isBelow = word.bbox.y0 > labelBox.y1 - 10
    return horizontalOverlap && isBelow
  })

  // Sort by y position
  belowWords.sort((a, b) => a.bbox.y0 - b.bbox.y0)

  // Combine candidates: prioritize right, then below
  const candidates = [...rightWords, ...belowWords]

  // Filter and validate based on type
  for (const candidate of candidates) {
    const text = candidate.text.trim()
    if (!text) continue

    switch (type) {
      case 'currency':
      case 'number': {
        const num = parseOCRNumber(text)
        if (num !== null) {
          return {
            value: text,
            confidence: candidate.confidence,
            bbox: candidate.bbox
          }
        }
        break
      }
      case 'ssn': {
        const ssn = parseOCRSSN(text)
        if (ssn) {
          return {
            value: text,
            confidence: candidate.confidence,
            bbox: candidate.bbox
          }
        }
        break
      }
      case 'ein': {
        const ein = parseOCREIN(text)
        if (ein) {
          return {
            value: text,
            confidence: candidate.confidence,
            bbox: candidate.bbox
          }
        }
        break
      }
      case 'date': {
        const date = parseOCRDate(text)
        if (date) {
          return {
            value: text,
            confidence: candidate.confidence,
            bbox: candidate.bbox
          }
        }
        break
      }
      case 'percentage': {
        if (text.includes('%') || /^\d+\.?\d*$/.test(text)) {
          return {
            value: text,
            confidence: candidate.confidence,
            bbox: candidate.bbox
          }
        }
        break
      }
      default: // text
        // For text, accept any non-empty value
        if (text.length > 0 && !/^[\d.,$]+$/.test(text)) {
          return {
            value: text,
            confidence: candidate.confidence,
            bbox: candidate.bbox
          }
        }
    }
  }

  // Try combining multiple words for text fields
  if (type === 'text' && rightWords.length > 0) {
    const combinedText = rightWords
      .slice(0, 5)
      .map((w) => w.text)
      .join(' ')
      .trim()
    if (combinedText) {
      const avgConfidence =
        rightWords.slice(0, 5).reduce((sum, w) => sum + w.confidence, 0) /
        Math.min(5, rightWords.length)
      return {
        value: combinedText,
        confidence: avgConfidence,
        bbox: {
          x0: rightWords[0].bbox.x0,
          y0: Math.min(...rightWords.slice(0, 5).map((w) => w.bbox.y0)),
          x1: rightWords[Math.min(4, rightWords.length - 1)].bbox.x1,
          y1: Math.max(...rightWords.slice(0, 5).map((w) => w.bbox.y1))
        }
      }
    }
  }

  return null
}

/**
 * Extract a specific field from OCR result using field definition
 */
export const extractField = (
  ocrResult: OCRResult,
  fieldDef: FieldDefinition
): ExtractedField | null => {
  // Find the label in the OCR result
  const labelMatch = findLabelMatch(ocrResult, fieldDef.labels)

  if (!labelMatch) {
    return null
  }

  // Find the associated value
  const valueResult = findAssociatedValue(
    ocrResult,
    labelMatch.word,
    fieldDef.type
  )

  if (!valueResult) {
    return null
  }

  // Parse the value based on type
  let parsedValue: string = valueResult.value

  switch (fieldDef.type) {
    case 'currency': {
      const num = parseOCRCurrency(valueResult.value)
      parsedValue = num !== null ? num.toString() : valueResult.value
      break
    }
    case 'number': {
      const num = parseOCRNumber(valueResult.value)
      parsedValue = num !== null ? num.toString() : valueResult.value
      break
    }
    case 'ssn': {
      const ssn = parseOCRSSN(valueResult.value)
      parsedValue = ssn || valueResult.value
      break
    }
    case 'ein': {
      const ein = parseOCREIN(valueResult.value)
      parsedValue = ein || valueResult.value
      break
    }
    case 'date': {
      const date = parseOCRDate(valueResult.value)
      parsedValue = date ? date.toISOString().split('T')[0] : valueResult.value
      break
    }
    case 'percentage': {
      const num = parseOCRNumber(valueResult.value.replace('%', ''))
      parsedValue = num !== null ? num.toString() : valueResult.value
      break
    }
    default:
      parsedValue = cleanOCRText(valueResult.value)
  }

  // Validate against pattern if provided
  if (fieldDef.pattern && !fieldDef.pattern.test(parsedValue)) {
    // Try with raw value
    if (!fieldDef.pattern.test(valueResult.value)) {
      return null
    }
  }

  return {
    label: fieldDef.name,
    value: parsedValue,
    rawValue: valueResult.value,
    confidence: Math.min(labelMatch.similarity, valueResult.confidence / 100),
    bbox: valueResult.bbox
  }
}

/**
 * Extract all fields from OCR result using field definitions
 */
export const extractAllFields = (
  ocrResult: OCRResult,
  fieldDefs: FieldDefinition[]
): Map<string, ExtractedField> => {
  const results = new Map<string, ExtractedField>()

  for (const fieldDef of fieldDefs) {
    const extracted = extractField(ocrResult, fieldDef)
    if (extracted) {
      results.set(fieldDef.id, extracted)
    }
  }

  return results
}

/**
 * Search for a box number in the OCR text and extract its value
 */
export const extractByBoxNumber = (
  ocrResult: OCRResult,
  boxNumber: string,
  type: FieldDefinition['type'] = 'currency'
): ExtractedField | null => {
  // Look for patterns like "Box 1", "1.", "1:", "Box 1a", etc.
  const patterns = [
    `Box ${boxNumber}`,
    `${boxNumber}.`,
    `${boxNumber}:`,
    `${boxNumber} `,
    boxNumber
  ]

  const labelMatch = findLabelMatch(ocrResult, patterns, 0.8)

  if (!labelMatch) {
    return null
  }

  const valueResult = findAssociatedValue(ocrResult, labelMatch.word, type)

  if (!valueResult) {
    return null
  }

  let parsedValue = valueResult.value
  if (type === 'currency' || type === 'number') {
    const num = parseOCRCurrency(valueResult.value)
    parsedValue = num !== null ? num.toString() : valueResult.value
  }

  return {
    label: `Box ${boxNumber}`,
    value: parsedValue,
    rawValue: valueResult.value,
    confidence: Math.min(labelMatch.similarity, valueResult.confidence / 100),
    bbox: valueResult.bbox
  }
}

export default {
  extractField,
  extractAllFields,
  extractByBoxNumber,
  parseOCRNumber,
  parseOCRCurrency,
  parseOCRSSN,
  parseOCREIN,
  parseOCRDate,
  cleanOCRText,
  stringSimilarity
}
