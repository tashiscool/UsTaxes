export const normalizeFilingStatus = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll('-', '')
    .replaceAll('_', '')
    .replaceAll(' ', '')

const VALID_FILING_STATUSES = new Set([
  'single',
  'mfj',
  'marriedfilingjointly',
  'mfs',
  'marriedfilingseparately',
  'hoh',
  'headofhousehold',
  'qss',
  'qualifyingsurvivingspouse'
])

export const isValidFilingStatus = (value: string): boolean =>
  VALID_FILING_STATUSES.has(normalizeFilingStatus(value))
