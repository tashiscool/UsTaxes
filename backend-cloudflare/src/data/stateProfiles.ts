import type { Env } from '../domain/env'

export interface StateProfileRecord {
  stateCode: string
  taxSystemName: string
  landingUrl: string
  defaultRedirectUrl: string
  departmentOfRevenueUrl: string
  filingRequirementsUrl: string
  transferCancelUrl: string
  waitingForAcceptanceCancelUrl: string
  redirectUrls: string[]
  languages: Record<string, string>
  customFilingDeadline: string
  acceptedOnly: boolean
}

const buildUrl = (env: Env, stateCode: string, suffix: string): string => {
  const base =
    env.TAXFLOW_STATE_PROFILE_BASE_URL?.replace(/\/+$/g, '') ??
    `https://state.${stateCode.toLowerCase()}.example.gov`
  return `${base}${suffix}`
}

export const resolveStateProfile = (
  env: Env,
  stateCode: string
): StateProfileRecord | null => {
  const normalized = stateCode.trim().toUpperCase()
  if (normalized.length !== 2) {
    return null
  }

  const acceptedOnlyStates = new Set(['CA', 'NY', 'IL', 'MA'])
  const systemNames: Record<string, string> = {
    CA: 'California Franchise Tax Board',
    NY: 'New York State Department of Taxation and Finance',
    IL: 'Illinois Department of Revenue',
    MA: 'Massachusetts Department of Revenue'
  }

  return {
    stateCode: normalized,
    taxSystemName: systemNames[normalized] ?? `${normalized} Department of Revenue`,
    landingUrl: buildUrl(env, normalized, '/direct-file'),
    defaultRedirectUrl: buildUrl(env, normalized, '/direct-file/return'),
    departmentOfRevenueUrl: buildUrl(env, normalized, ''),
    filingRequirementsUrl: buildUrl(env, normalized, '/filing-requirements'),
    transferCancelUrl: buildUrl(env, normalized, '/transfer/cancel'),
    waitingForAcceptanceCancelUrl: buildUrl(env, normalized, '/acceptance/cancel'),
    redirectUrls: [buildUrl(env, normalized, '/direct-file/*')],
    languages: {
      en: 'en',
      es: 'es'
    },
    customFilingDeadline: '2026-04-15',
    acceptedOnly: acceptedOnlyStates.has(normalized)
  }
}
