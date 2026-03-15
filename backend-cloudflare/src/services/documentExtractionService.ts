/**
 * Document Extraction Service
 *
 * Uses Cloudflare Workers AI (LLaVA vision model) to extract structured tax
 * data from W-2 and 1099 document images stored in R2.
 */

export interface ExtractedW2 {
  employerName?: string
  ein?: string
  box1Wages?: number
  box2FedWithholding?: number
  box12Codes?: Array<{ code: string; amount: number }>
  box16StateWages?: number
  box17StateWithholding?: number
  confidence: number
}

export interface ExtractedDocument {
  documentType:
    | 'w2'
    | '1099-nec'
    | '1099-int'
    | '1099-div'
    | '1099-r'
    | 'unknown'
  w2?: ExtractedW2
  raw?: Record<string, unknown>
  confidence: number
  processingTimeMs: number
}

const EXTRACTION_PROMPT =
  'You are a tax document parser. Extract all tax fields from this document image as JSON. ' +
  'Identify the document type (w2, 1099-nec, 1099-int, 1099-div, 1099-r). ' +
  'For W-2: extract employerName, ein, box1Wages, box2FedWithholding, box12Codes (array of {code, amount}), ' +
  'box16StateWages, box17StateWithholding. ' +
  'Respond ONLY with valid JSON matching: ' +
  '{"documentType":"w2","employerName":"...","ein":"...","box1Wages":0,"box2FedWithholding":0,' +
  '"box12Codes":[{"code":"D","amount":0}],"box16StateWages":0,"box17StateWithholding":0}'

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? undefined : n
  }
  return undefined
}

function parseBox12Codes(
  value: unknown
): Array<{ code: string; amount: number }> | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{ code: string; amount: number }> = []
  for (const entry of value) {
    if (
      entry &&
      typeof entry === 'object' &&
      'code' in entry &&
      'amount' in entry
    ) {
      const amount = parseNumber((entry as Record<string, unknown>).amount)
      if (
        typeof (entry as Record<string, unknown>).code === 'string' &&
        amount !== undefined
      ) {
        result.push({
          code: (entry as Record<string, unknown>).code as string,
          amount
        })
      }
    }
  }
  return result.length > 0 ? result : undefined
}

function buildExtractedDocument(
  parsed: Record<string, unknown>,
  processingTimeMs: number
): ExtractedDocument {
  const rawType =
    (parsed.documentType as string | undefined)?.toLowerCase() ?? 'unknown'
  const docType = ['w2', '1099-nec', '1099-int', '1099-div', '1099-r'].includes(
    rawType
  )
    ? (rawType as ExtractedDocument['documentType'])
    : 'unknown'

  const w2: ExtractedW2 | undefined =
    docType === 'w2'
      ? {
          employerName:
            typeof parsed.employerName === 'string'
              ? parsed.employerName
              : undefined,
          ein: typeof parsed.ein === 'string' ? parsed.ein : undefined,
          box1Wages: parseNumber(parsed.box1Wages),
          box2FedWithholding: parseNumber(parsed.box2FedWithholding),
          box12Codes: parseBox12Codes(parsed.box12Codes),
          box16StateWages: parseNumber(parsed.box16StateWages),
          box17StateWithholding: parseNumber(parsed.box17StateWithholding),
          confidence: docType === 'w2' ? 0.85 : 0.5
        }
      : undefined

  return {
    documentType: docType,
    w2,
    raw: parsed,
    confidence: docType !== 'unknown' ? 0.85 : 0.3,
    processingTimeMs
  }
}

export async function extractDocumentFromR2(
  bucket: R2Bucket,
  ai: Ai,
  r2Key: string
): Promise<ExtractedDocument> {
  const startMs = Date.now()

  const object = await bucket.get(r2Key)
  if (!object) {
    throw new Error(`Document not found in R2: ${r2Key}`)
  }

  const bytes = new Uint8Array(await object.arrayBuffer())
  // Workers AI vision models accept image as a number array
  const imageArray = Array.from(bytes)

  const aiResponse = await (
    ai as unknown as {
      run(
        model: string,
        input: { image: number[]; prompt: string }
      ): Promise<{ response?: string }>
    }
  ).run('@cf/llava-1.5-7b-hf', {
    image: imageArray,
    prompt: EXTRACTION_PROMPT
  })

  const processingTimeMs = Date.now() - startMs
  const rawText = aiResponse?.response ?? ''

  // Extract JSON from the response — the model may wrap it in prose
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      documentType: 'unknown',
      raw: { rawText },
      confidence: 0,
      processingTimeMs
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return buildExtractedDocument(parsed, processingTimeMs)
  } catch {
    return {
      documentType: 'unknown',
      raw: { rawText },
      confidence: 0,
      processingTimeMs
    }
  }
}
