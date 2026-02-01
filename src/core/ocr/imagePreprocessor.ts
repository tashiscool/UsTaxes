/**
 * Image Preprocessor - Prepares images for optimal OCR recognition
 *
 * Provides utilities for image manipulation including:
 * - Resizing for optimal OCR
 * - Contrast enhancement
 * - Deskewing
 * - Grayscale conversion
 */

/**
 * Configuration options for image preprocessing
 */
export interface PreprocessorOptions {
  /** Target width for resizing (maintains aspect ratio) */
  targetWidth?: number
  /** Target height for resizing (maintains aspect ratio) */
  targetHeight?: number
  /** Maximum dimension (width or height) */
  maxDimension?: number
  /** Whether to convert to grayscale */
  grayscale?: boolean
  /** Contrast adjustment factor (1.0 = no change, > 1.0 = more contrast) */
  contrast?: number
  /** Brightness adjustment (-255 to 255) */
  brightness?: number
  /** Whether to apply automatic threshold */
  autoThreshold?: boolean
  /** Whether to attempt deskewing */
  deskew?: boolean
  /** Sharpening amount (0 = none, 1 = normal) */
  sharpen?: number
}

/**
 * Default preprocessing options optimized for tax documents
 */
const DEFAULT_OPTIONS: PreprocessorOptions = {
  maxDimension: 2000,
  grayscale: true,
  contrast: 1.2,
  brightness: 10,
  autoThreshold: false,
  deskew: false,
  sharpen: 0.3
}

/**
 * Result of image preprocessing
 */
export interface PreprocessedImage {
  canvas: HTMLCanvasElement
  dataUrl: string
  width: number
  height: number
  originalWidth: number
  originalHeight: number
}

/**
 * Load an image from various sources
 */
export const loadImage = (
  source: string | File | Blob
): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)

    if (typeof source === 'string') {
      img.src = source
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(source)
    }
  })
}

/**
 * Create a canvas from an image
 */
const createCanvasFromImage = (
  img: HTMLImageElement,
  width?: number,
  height?: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  const w = width ?? img.naturalWidth
  const h = height ?? img.naturalHeight
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
const calculateDimensions = (
  originalWidth: number,
  originalHeight: number,
  options: PreprocessorOptions
): { width: number; height: number } => {
  let width = originalWidth
  let height = originalHeight

  if (options.maxDimension) {
    const maxDim = Math.max(width, height)
    if (maxDim > options.maxDimension) {
      const scale = options.maxDimension / maxDim
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
  }

  if (options.targetWidth && !options.targetHeight) {
    const scale = options.targetWidth / width
    width = options.targetWidth
    height = Math.round(height * scale)
  } else if (options.targetHeight && !options.targetWidth) {
    const scale = options.targetHeight / height
    height = options.targetHeight
    width = Math.round(width * scale)
  } else if (options.targetWidth && options.targetHeight) {
    width = options.targetWidth
    height = options.targetHeight
  }

  return { width, height }
}

/**
 * Apply grayscale conversion to image data
 */
const applyGrayscale = (imageData: ImageData): void => {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }
}

/**
 * Apply contrast adjustment to image data
 */
const applyContrast = (imageData: ImageData, factor: number): void => {
  const data = imageData.data
  const intercept = 128 * (1 - factor)

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept))
  }
}

/**
 * Apply brightness adjustment to image data
 */
const applyBrightness = (imageData: ImageData, amount: number): void => {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] + amount))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + amount))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + amount))
  }
}

/**
 * Apply automatic thresholding (Otsu's method simplified)
 */
const applyAutoThreshold = (imageData: ImageData): void => {
  const data = imageData.data
  const histogram = new Array(256).fill(0)

  // Build histogram
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    )
    histogram[gray]++
  }

  // Find threshold using Otsu's method (simplified)
  const totalPixels = data.length / 4
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i]
  }

  let sumB = 0
  let wB = 0
  let wF = 0
  let maxVariance = 0
  let threshold = 0

  for (let i = 0; i < 256; i++) {
    wB += histogram[i]
    if (wB === 0) continue

    wF = totalPixels - wB
    if (wF === 0) break

    sumB += i * histogram[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const variance = wB * wF * (mB - mF) * (mB - mF)

    if (variance > maxVariance) {
      maxVariance = variance
      threshold = i
    }
  }

  // Apply threshold
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const value = gray > threshold ? 255 : 0
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }
}

/**
 * Apply sharpening using unsharp mask
 */
const applySharpen = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void => {
  if (amount <= 0) return

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const copy = new Uint8ClampedArray(data)

  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  const blendFactor = amount

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            sum += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
          }
        }
        const idx = (y * width + x) * 4 + c
        const original = copy[idx]
        const sharpened = Math.min(255, Math.max(0, sum))
        data[idx] = Math.round(
          original * (1 - blendFactor) + sharpened * blendFactor
        )
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Detect skew angle in image (simplified Hough transform approach)
 * Returns angle in degrees
 */
const detectSkewAngle = (imageData: ImageData): number => {
  const { data, width, height } = imageData
  const angleRange = 15 // Check angles from -15 to 15 degrees
  const angleStep = 0.5
  const scores: Map<number, number> = new Map()

  // Sample horizontal lines and check alignment
  const sampleLines = 20
  const lineSpacing = Math.floor(height / sampleLines)

  for (let angle = -angleRange; angle <= angleRange; angle += angleStep) {
    let score = 0
    const radians = (angle * Math.PI) / 180

    for (let line = 0; line < sampleLines; line++) {
      const y = line * lineSpacing + Math.floor(lineSpacing / 2)
      let darkPixels = 0
      let maxConsecutive = 0
      let consecutive = 0

      for (let x = 0; x < width; x++) {
        // Calculate rotated y position
        const rotY = Math.round(y + x * Math.tan(radians))
        if (rotY < 0 || rotY >= height) continue

        const idx = (rotY * width + x) * 4
        const gray =
          data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114

        if (gray < 128) {
          darkPixels++
          consecutive++
          maxConsecutive = Math.max(maxConsecutive, consecutive)
        } else {
          consecutive = 0
        }
      }

      score += maxConsecutive
    }

    scores.set(angle, score)
  }

  // Find angle with highest score
  let bestAngle = 0
  let bestScore = 0
  scores.forEach((score, angle) => {
    if (score > bestScore) {
      bestScore = score
      bestAngle = angle
    }
  })

  return bestAngle
}

/**
 * Apply deskew transformation to canvas
 */
const applyDeskew = (
  canvas: HTMLCanvasElement,
  angle: number
): HTMLCanvasElement => {
  if (Math.abs(angle) < 0.5) {
    return canvas // No significant skew detected
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const radians = (-angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  // Calculate new dimensions
  const newWidth = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin)
  const newHeight = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos)

  const newCanvas = document.createElement('canvas')
  newCanvas.width = Math.ceil(newWidth)
  newCanvas.height = Math.ceil(newHeight)

  const newCtx = newCanvas.getContext('2d')
  if (!newCtx) return canvas

  // Set white background
  newCtx.fillStyle = 'white'
  newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height)

  // Rotate around center
  newCtx.translate(newCanvas.width / 2, newCanvas.height / 2)
  newCtx.rotate(radians)
  newCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)

  return newCanvas
}

/**
 * Preprocess an image for optimal OCR recognition
 */
export const preprocessImage = async (
  source: string | File | Blob | HTMLImageElement,
  options: PreprocessorOptions = {}
): Promise<PreprocessedImage> => {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Load image if needed
  const img =
    source instanceof HTMLImageElement ? source : await loadImage(source)

  const originalWidth = img.naturalWidth
  const originalHeight = img.naturalHeight

  // Calculate target dimensions
  const { width, height } = calculateDimensions(
    originalWidth,
    originalHeight,
    opts
  )

  // Create initial canvas
  let canvas = createCanvasFromImage(img, width, height)
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  // Get image data for pixel manipulation
  let imageData = ctx.getImageData(0, 0, width, height)

  // Apply grayscale conversion
  if (opts.grayscale) {
    applyGrayscale(imageData)
  }

  // Apply contrast adjustment
  if (opts.contrast && opts.contrast !== 1.0) {
    applyContrast(imageData, opts.contrast)
  }

  // Apply brightness adjustment
  if (opts.brightness && opts.brightness !== 0) {
    applyBrightness(imageData, opts.brightness)
  }

  // Apply automatic thresholding
  if (opts.autoThreshold) {
    applyAutoThreshold(imageData)
  }

  // Put the modified image data back
  ctx.putImageData(imageData, 0, 0)

  // Apply sharpening
  if (opts.sharpen && opts.sharpen > 0) {
    applySharpen(ctx, width, height, opts.sharpen)
  }

  // Apply deskewing
  if (opts.deskew) {
    imageData = ctx.getImageData(0, 0, width, height)
    const skewAngle = detectSkewAngle(imageData)
    canvas = applyDeskew(canvas, skewAngle)
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    originalWidth,
    originalHeight
  }
}

/**
 * Quick preprocessing for previews (faster, less processing)
 */
export const preprocessForPreview = async (
  source: string | File | Blob | HTMLImageElement
): Promise<PreprocessedImage> => {
  return preprocessImage(source, {
    maxDimension: 800,
    grayscale: false,
    contrast: 1.0,
    brightness: 0,
    autoThreshold: false,
    deskew: false,
    sharpen: 0
  })
}

/**
 * Full preprocessing for OCR (optimized for recognition accuracy)
 */
export const preprocessForOCR = async (
  source: string | File | Blob | HTMLImageElement
): Promise<PreprocessedImage> => {
  return preprocessImage(source, {
    maxDimension: 2000,
    grayscale: true,
    contrast: 1.3,
    brightness: 10,
    autoThreshold: false,
    deskew: true,
    sharpen: 0.4
  })
}

export default {
  preprocessImage,
  preprocessForPreview,
  preprocessForOCR,
  loadImage
}
