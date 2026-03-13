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
  'qualifyingsurvivingspouse',
  // Business entity filing statuses
  'corporation',
  'ccorp',
  'scorp',
  'partnership',
  'trust',
  'estate',
  'nonprofit',
  'exemptorganization',
  'w'
])

export const isValidFilingStatus = (value: string): boolean =>
  VALID_FILING_STATUSES.has(normalizeFilingStatus(value))
