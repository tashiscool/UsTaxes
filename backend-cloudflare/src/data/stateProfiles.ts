import type { Env } from '../domain/env'
import { resolveStateCapability } from './stateCapabilities'

export interface StateProfileRecord {
  stateCode: string
  taxSystemName: string
  landingUrl: string
  defaultRedirectUrl: string | null
  departmentOfRevenueUrl: string | null
  filingRequirementsUrl: string | null
  transferCancelUrl: string | null
  waitingForAcceptanceCancelUrl: string | null
  redirectUrls: string[]
  languages: Record<string, string>
  customFilingDeadline: string
  acceptedOnly: boolean
}

export const resolveStateProfile = (
  env: Env,
  stateCode: string
): StateProfileRecord | null => {
  const capability = resolveStateCapability(env, stateCode)
  if (!capability) {
    return null
  }
  return {
    stateCode: capability.stateCode,
    taxSystemName: capability.taxSystemName,
    landingUrl: capability.urls.landingUrl,
    defaultRedirectUrl: capability.urls.defaultRedirectUrl,
    departmentOfRevenueUrl: capability.urls.departmentOfRevenueUrl,
    filingRequirementsUrl: capability.urls.filingRequirementsUrl,
    transferCancelUrl: capability.urls.transferCancelUrl,
    waitingForAcceptanceCancelUrl:
      capability.urls.waitingForAcceptanceCancelUrl,
    redirectUrls: capability.urls.redirectUrls,
    languages: {
      en: 'en',
      es: 'es'
    },
    customFilingDeadline: '2026-04-15',
    acceptedOnly: capability.acceptedOnly
  }
}
