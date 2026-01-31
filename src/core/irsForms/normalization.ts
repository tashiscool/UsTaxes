// IRS Forms normalization utilities
// Implements docs/irs-forms/README.md section "1) Normalization rules"

export type DocumentKind =
  | 'form'
  | 'instructions'
  | 'publication'
  | 'notice'
  | 'other'

export type CanonicalForm = {
  /**
   * Canonical identifier without the leading "Form" prefix.
   * Examples: "W-4", "1040 Schedule C", "W-2VI"
   */
  canonicalId: string

  /**
   * Original title as provided by the IRS product list.
   * Example: "Form 1040 (Schedule C) (sp)"
   */
  rawTitle: string

  /**
   * High-level document kind; we only keep rows where kind === "form".
   */
  documentKind: DocumentKind

  /**
   * ISO-style language code matching docs/irs-forms/forms-schema.yaml `variants.languages`
   * Examples: "en", "sp", "ko", "ru", "vie"
   */
  language: string

  /**
   * Territory code matching docs/irs-forms/forms-schema.yaml `variants.territories`
   * Examples: "US", "PR", "VI"
   */
  territory: string

  /**
   * True if this canonical form is a schedule (e.g. "1040 Schedule C").
   */
  isSchedule: boolean

  /**
   * Raw schedule code, if any (e.g. "C", "1-A", "K-1").
   */
  scheduleCode?: string
}

// Language codes from forms-schema.yaml
const LANGUAGE_CODES = new Set([
  'en',
  'sp',
  'ko',
  'ru',
  'vie',
  'zh-s',
  'zh-t',
  'ht',
  'ja',
  'fr',
  'de',
  'it',
  'pl',
  'pt',
  'ar',
  'bn',
  'fa',
  'guj',
  'km',
  'pa',
  'so',
  'tl',
  'ur'
])

// Territory codes from forms-schema.yaml
const TERRITORY_CODES: readonly string[] = [
  'US',
  'PR',
  'VI',
  'GU',
  'AS',
  'CNMI'
]
const TERRITORY_CODES_SET = new Set(TERRITORY_CODES)

const FORM_PREFIX_RE = /^Form\s+/i
const PUBLICATION_PREFIX_RE = /^Publication\b/i
const INSTRUCTION_PREFIX_RE = /^Instructions?\b/i
const NOTICE_PREFIX_RE = /^Notice\b/i

export interface RawProductRow {
  /** Raw product title like "Form W-4 (sp)" or "Publication 17" */
  title: string
}

/**
 * Returns true if this row should be treated as a "Form …" row per the README.
 *
 * - Keeps only rows whose title starts with "Form "
 * - Drops anything starting with Publication / Instruction / Notice
 */
export const isFormRow = (title: string): boolean => {
  const trimmed = title.trim()

  if (
    PUBLICATION_PREFIX_RE.test(trimmed) ||
    INSTRUCTION_PREFIX_RE.test(trimmed) ||
    NOTICE_PREFIX_RE.test(trimmed)
  ) {
    return false
  }

  return FORM_PREFIX_RE.test(trimmed)
}

type ParsedParentheticals = {
  language?: string
  territory?: string
  scheduleCode?: string
}

const parseParentheticals = (
  titleWithoutPrefix: string
): ParsedParentheticals => {
  const result: ParsedParentheticals = {}

  const parenRegex = /\(([^)]+)\)/g
  let match: RegExpExecArray | null

  while ((match = parenRegex.exec(titleWithoutPrefix)) !== null) {
    const value = match[1].trim()

    // Schedule markers like "Schedule C", "Schedule 1-A", "Schedule K-1"
    const scheduleMatch = /^Schedule\s+([A-Za-z0-9-]+)$/i.exec(value)
    if (scheduleMatch) {
      result.scheduleCode = scheduleMatch[1]
      continue
    }

    // Territory markers like "(PR)", "(VI)"
    const upper = value.toUpperCase()
    if (TERRITORY_CODES_SET.has(upper)) {
      result.territory = upper
      continue
    }

    // Language markers like "(sp)", "(ko)", "(ru)"
    const lower = value.toLowerCase()
    if (LANGUAGE_CODES.has(lower)) {
      result.language = lower
    }
  }

  return result
}

/**
 * Normalize a "Form …" product title into a canonical record.
 *
 * Examples (matching docs/irs-forms/README.md):
 * - "Form W-4 (sp)" → canonicalId "W-4", language "sp"
 * - "Form 1040 (Schedule C) (sp)" → canonicalId "1040 Schedule C", language "sp", isSchedule true, scheduleCode "C"
 * - "Form W-2VI" → canonicalId "W-2VI", territory "VI"
 * - "Form 1120-F (Schedule Q)" → canonicalId "1120-F Schedule Q", isSchedule true, scheduleCode "Q"
 *
 * Returns null for non-form rows (publications/instructions/notices).
 */
export const normalizeFormTitle = (rawTitle: string): CanonicalForm | null => {
  const title = rawTitle.trim()

  if (!isFormRow(title)) {
    return null
  }

  // Strip leading "Form "
  const withoutPrefix = title.replace(FORM_PREFIX_RE, '').trim()

  // First pass: pull metadata from parentheticals
  const { language, territory, scheduleCode } =
    parseParentheticals(withoutPrefix)

  // Remove parentheticals from the base name
  let base = withoutPrefix.replace(/\s*\([^)]*\)/g, '').trim()

  // If we discovered a scheduleCode but "Schedule" is not in the base,
  // append it so that canonicalId matches "1040 Schedule C" pattern.
  if (scheduleCode && !/Schedule\s+/i.test(base)) {
    base = `${base} Schedule ${scheduleCode}`
  }

  // Territory codes sometimes appear concatenated, e.g. "W-2VI".
  // If we didn't pick up a territory from parentheses, try to infer it from the suffix.
  if (!territory) {
    for (const code of TERRITORY_CODES) {
      if (code === 'US') continue
      if (base.endsWith(code)) {
        // Example: "W-2VI" → base "W-2VI", territory "VI"
        return {
          canonicalId: base,
          rawTitle,
          documentKind: 'form',
          language: language ?? 'en',
          territory: code,
          isSchedule: !!scheduleCode,
          scheduleCode
        }
      }
    }
  }

  return {
    canonicalId: base,
    rawTitle,
    documentKind: 'form',
    language: language ?? 'en',
    territory: territory ?? 'US',
    isSchedule: !!scheduleCode,
    scheduleCode
  }
}
