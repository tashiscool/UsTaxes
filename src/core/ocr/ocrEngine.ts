/**
 * OCR Engine - Tesseract.js wrapper for document scanning
 *
 * Initializes and manages Tesseract.js workers for optical character recognition.
 * Supports multiple languages and returns text with position data.
 */

import Tesseract, {
  Worker,
  createWorker,
  RecognizeResult,
  Word,
  Line,
  Block
} from 'tesseract.js'

/**
 * Represents a recognized text element with its bounding box
 */
export interface OCRTextElement {
  text: string
  confidence: number
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

/**
 * Represents a word recognized by OCR with position data
 */
export interface OCRWord extends OCRTextElement {
  baseline: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

/**
 * Represents a line of text recognized by OCR
 */
export interface OCRLine extends OCRTextElement {
  words: OCRWord[]
}

/**
 * Represents a block of text recognized by OCR
 */
export interface OCRBlock extends OCRTextElement {
  lines: OCRLine[]
}

/**
 * Complete OCR result with all recognized elements
 */
export interface OCRResult {
  text: string
  confidence: number
  blocks: OCRBlock[]
  words: OCRWord[]
  lines: OCRLine[]
  imageWidth: number
  imageHeight: number
}

/**
 * Supported languages for OCR
 */
export type OCRLanguage = 'eng' | 'spa' | 'fra' | 'deu' | 'chi_sim' | 'chi_tra'

/**
 * OCR Engine configuration options
 */
export interface OCREngineOptions {
  languages?: OCRLanguage[]
  workerPath?: string
  corePath?: string
  langPath?: string
}

/**
 * Default configuration for OCR Engine
 */
const DEFAULT_OPTIONS: OCREngineOptions = {
  languages: ['eng']
}

/**
 * OCR Engine class for managing Tesseract.js workers
 */
export class OCREngine {
  private worker: Worker | null = null
  private initialized = false
  private languages: OCRLanguage[]
  private options: OCREngineOptions

  constructor(options: OCREngineOptions = DEFAULT_OPTIONS) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.languages = this.options.languages || ['eng']
  }

  /**
   * Initialize the Tesseract worker
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.worker) {
      return
    }

    try {
      this.worker = await createWorker(this.languages.join('+'), 1, {
        workerPath: this.options.workerPath,
        corePath: this.options.corePath,
        langPath: this.options.langPath
      })

      // Set recognition parameters for optimal tax document scanning
      await this.worker.setParameters({
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/-$%() ',
        preserve_interword_spaces: '1'
      })

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize OCR engine:', error)
      throw new Error('OCR engine initialization failed')
    }
  }

  /**
   * Process an image and return OCR results
   * @param image - Image source (URL, File, Blob, or HTMLImageElement)
   */
  async processImage(
    image: string | File | Blob | HTMLImageElement | HTMLCanvasElement
  ): Promise<OCRResult> {
    if (!this.initialized || !this.worker) {
      await this.initialize()
    }

    if (!this.worker) {
      throw new Error('OCR worker not initialized')
    }

    try {
      const result: RecognizeResult = await this.worker.recognize(image)
      return this.transformResult(result)
    } catch (error) {
      console.error('OCR processing failed:', error)
      throw new Error('OCR processing failed')
    }
  }

  /**
   * Transform Tesseract result to our OCRResult format
   */
  private transformResult(result: RecognizeResult): OCRResult {
    const { data } = result

    const transformWord = (word: Word): OCRWord => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1
      },
      baseline: {
        x0: word.baseline.x0,
        y0: word.baseline.y0,
        x1: word.baseline.x1,
        y1: word.baseline.y1
      }
    })

    const transformLine = (line: Line): OCRLine => ({
      text: line.text,
      confidence: line.confidence,
      bbox: {
        x0: line.bbox.x0,
        y0: line.bbox.y0,
        x1: line.bbox.x1,
        y1: line.bbox.y1
      },
      words: line.words.map(transformWord)
    })

    const transformBlock = (block: Block): OCRBlock => ({
      text: block.text,
      confidence: block.confidence,
      bbox: {
        x0: block.bbox.x0,
        y0: block.bbox.y0,
        x1: block.bbox.x1,
        y1: block.bbox.y1
      },
      lines: block.lines.map(transformLine)
    })

    // Get image dimensions from the first block or default values
    const blocks = data.blocks ?? []
    const words = data.words ?? []
    const lines = data.lines ?? []

    const imageWidth =
      blocks.length > 0
        ? Math.max(...blocks.map((b: Block) => b.bbox.x1))
        : 0
    const imageHeight =
      blocks.length > 0
        ? Math.max(...blocks.map((b: Block) => b.bbox.y1))
        : 0

    return {
      text: data.text,
      confidence: data.confidence,
      blocks: blocks.map(transformBlock),
      words: words.map(transformWord),
      lines: lines.map(transformLine),
      imageWidth,
      imageHeight
    }
  }

  /**
   * Change the recognition language(s)
   */
  async setLanguages(languages: OCRLanguage[]): Promise<void> {
    this.languages = languages

    if (this.worker) {
      await this.worker.reinitialize(languages.join('+'))
    }
  }

  /**
   * Get current languages
   */
  getLanguages(): OCRLanguage[] {
    return [...this.languages]
  }

  /**
   * Terminate the worker and clean up resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this.initialized = false
    }
  }

  /**
   * Check if the engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }
}

/**
 * Singleton instance for convenience
 */
let defaultEngine: OCREngine | null = null

/**
 * Get or create the default OCR engine instance
 */
export const getOCREngine = (options?: OCREngineOptions): OCREngine => {
  if (!defaultEngine) {
    defaultEngine = new OCREngine(options)
  }
  return defaultEngine
}

/**
 * Process an image using the default OCR engine
 */
export const processImage = async (
  image: string | File | Blob | HTMLImageElement | HTMLCanvasElement,
  options?: OCREngineOptions
): Promise<OCRResult> => {
  const engine = getOCREngine(options)
  return engine.processImage(image)
}

export default OCREngine
