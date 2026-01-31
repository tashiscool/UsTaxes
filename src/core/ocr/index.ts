/**
 * OCR Module Index
 *
 * Exports all OCR-related functionality for document scanning.
 */

export * from './ocrEngine'
export * from './imagePreprocessor'
export * from './fieldExtractor'
export * from './documentTemplates'

import { OCREngine, getOCREngine, OCRResult } from './ocrEngine'
import { preprocessForOCR, preprocessForPreview, PreprocessedImage } from './imagePreprocessor'
import {
  DocumentType,
  ExtractionResult,
  extractDocumentData,
  detectDocumentType,
  DOCUMENT_TYPE_LABELS
} from './documentTemplates'

/**
 * Complete document scan result
 */
export interface DocumentScanResult {
  ocrResult: OCRResult
  preprocessedImage: PreprocessedImage
  documentType: DocumentType | null
  extractionResult: ExtractionResult | null
  processingTimeMs: number
}

/**
 * Scan a document image and extract data
 *
 * @param image - Image source (File, Blob, URL, or HTMLImageElement)
 * @param documentType - Optional document type (auto-detected if not provided)
 * @returns Complete scan result with OCR text, extracted fields, and confidence
 */
export const scanDocument = async (
  image: File | Blob | string | HTMLImageElement,
  documentType?: DocumentType
): Promise<DocumentScanResult> => {
  const startTime = performance.now()

  // Preprocess image for OCR
  const preprocessedImage = await preprocessForOCR(image)

  // Initialize and run OCR
  const engine = getOCREngine()
  await engine.initialize()
  const ocrResult = await engine.processImage(preprocessedImage.canvas)

  // Detect document type if not provided
  const detectedType = documentType ?? detectDocumentType(ocrResult)

  // Extract data based on document type
  let extractionResult: ExtractionResult | null = null
  if (detectedType) {
    extractionResult = extractDocumentData(ocrResult, detectedType)
  }

  const processingTimeMs = performance.now() - startTime

  return {
    ocrResult,
    preprocessedImage,
    documentType: detectedType,
    extractionResult,
    processingTimeMs
  }
}

/**
 * Quick preview scan (lower quality, faster)
 */
export const scanDocumentPreview = async (
  image: File | Blob | string | HTMLImageElement
): Promise<{
  previewImage: PreprocessedImage
  estimatedType: DocumentType | null
}> => {
  const previewImage = await preprocessForPreview(image)

  // Quick OCR for document type detection
  const engine = getOCREngine()
  await engine.initialize()
  const ocrResult = await engine.processImage(previewImage.canvas)

  const estimatedType = detectDocumentType(ocrResult)

  return {
    previewImage,
    estimatedType
  }
}

export default {
  scanDocument,
  scanDocumentPreview,
  OCREngine,
  getOCREngine,
  preprocessForOCR,
  preprocessForPreview,
  extractDocumentData,
  detectDocumentType,
  DOCUMENT_TYPE_LABELS
}
