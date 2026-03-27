import type { Env } from '../domain/env'

export type StateCapabilityLane = 'native' | 'transfer_export' | 'expert_route'
export type StateCapabilitySubmissionMode =
  | 'self_service'
  | 'handoff'
  | 'expert_review'

export interface StateCapabilityRecord {
  stateCode: string
  stateName: string
  taxYear: number
  lane: StateCapabilityLane
  submissionMode: StateCapabilitySubmissionMode
  supportedForms: string[]
  statusSupport: string[]
  taxSystemName: string
  acceptedOnly: boolean
  noIncomeTax: boolean
  urls: {
    landingUrl: string
    defaultRedirectUrl: string | null
    departmentOfRevenueUrl: string | null
    filingRequirementsUrl: string | null
    transferCancelUrl: string | null
    waitingForAcceptanceCancelUrl: string | null
    redirectUrls: string[]
    expertHandoffUrl: string
  }
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia'
}

const ACCEPTED_ONLY_STATES = new Set(['CA', 'NY', 'IL', 'MA'])
const TRANSFER_EXPORT_STATES = new Set(['CA', 'NY', 'IL', 'MA'])
const NO_INCOME_TAX_STATES = new Set([
  'AK',
  'FL',
  'NV',
  'NH',
  'SD',
  'TN',
  'TX',
  'WA',
  'WY'
])

const TAX_SYSTEM_NAMES: Partial<Record<string, string>> = {
  CA: 'California Franchise Tax Board',
  NY: 'New York State Department of Taxation and Finance',
  IL: 'Illinois Department of Revenue',
  MA: 'Massachusetts Department of Revenue',
  DC: 'District of Columbia Office of Tax and Revenue'
}

const getBaseUrl = (env: Env) =>
  (env.TAXFLOW_STATE_PROFILE_BASE_URL || 'https://freetaxflow.com').replace(
    /\/+$/g,
    ''
  )

const buildUrl = (baseUrl: string, path: string, stateCode: string) =>
  `${baseUrl}${path}${path.includes('?') ? '&' : '?'}state=${stateCode.toLowerCase()}`

export const resolveStateCapability = (
  env: Env,
  stateCode: string,
  taxYear = 2025
): StateCapabilityRecord | null => {
  const normalized = stateCode.trim().toUpperCase()
  const stateName = STATE_NAMES[normalized]
  if (!stateName) {
    return null
  }

  const baseUrl = getBaseUrl(env)
  const lane: StateCapabilityLane = TRANSFER_EXPORT_STATES.has(normalized)
    ? 'transfer_export'
    : 'expert_route'
  const submissionMode: StateCapabilitySubmissionMode =
    lane === 'transfer_export' ? 'handoff' : 'expert_review'
  const acceptedOnly = ACCEPTED_ONLY_STATES.has(normalized)
  const noIncomeTax = NO_INCOME_TAX_STATES.has(normalized)
  const landingUrl = buildUrl(baseUrl, '/state-tax', normalized)
  const expertHandoffUrl = buildUrl(baseUrl, '/expert-handoff', normalized)
  const transferUrl = buildUrl(baseUrl, '/state-transfer', normalized)
  const transferCancelUrl = buildUrl(
    baseUrl,
    '/state-transfer-auth',
    normalized
  )
  const waitingForAcceptanceCancelUrl = buildUrl(
    baseUrl,
    '/waiting-federal',
    normalized
  )

  return {
    stateCode: normalized,
    stateName,
    taxYear,
    lane,
    submissionMode,
    supportedForms: noIncomeTax ? [] : ['1040'],
    statusSupport:
      lane === 'transfer_export'
        ? ['authorized', 'queued', 'pending', 'accepted', 'rejected']
        : ['expert_review', 'handoff_ready'],
    taxSystemName:
      TAX_SYSTEM_NAMES[normalized] ?? `${stateName} Department of Revenue`,
    acceptedOnly,
    noIncomeTax,
    urls: {
      landingUrl,
      defaultRedirectUrl: lane === 'transfer_export' ? transferUrl : null,
      departmentOfRevenueUrl: null,
      filingRequirementsUrl: landingUrl,
      transferCancelUrl:
        lane === 'transfer_export' ? transferCancelUrl : expertHandoffUrl,
      waitingForAcceptanceCancelUrl:
        lane === 'transfer_export'
          ? waitingForAcceptanceCancelUrl
          : expertHandoffUrl,
      redirectUrls: lane === 'transfer_export' ? [transferUrl] : [],
      expertHandoffUrl
    }
  }
}

export const listStateCapabilities = (
  env: Env,
  taxYear = 2025
): StateCapabilityRecord[] =>
  Object.keys(STATE_NAMES)
    .sort()
    .map((stateCode) => resolveStateCapability(env, stateCode, taxYear))
    .filter((record): record is StateCapabilityRecord => record !== null)
