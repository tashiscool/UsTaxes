import type { Context } from 'hono'

import type { Env } from '../domain/env'
import { HttpError } from './http'

export interface AppUserClaims {
  sub: string
  email: string
  tin?: string
  displayName?: string
  exp: number
}

export interface AuthFlowStateClaims {
  redirectUri?: string
  nonce?: string
  issuedAt?: number
  exp?: number
}

export interface TrustedCallbackIdentityClaims {
  sub: string
  email: string
  tin?: string
  displayName?: string
}

const SESSION_COOKIE = 'app_session_id'
const AUTH_FLOW_COOKIE = 'app_auth_flow'
const DEV_LOCAL_SECRET = 'ustaxes-local-dev-secret'
const DEFAULT_TRUSTED_CALLBACK_IDENTITY_HEADER =
  'x-ustaxes-authenticated-user'
const DEFAULT_TRUSTED_CALLBACK_SIGNATURE_HEADER =
  'x-ustaxes-authenticated-user-signature'
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7
const TEN_MINUTES_SECONDS = 60 * 10
const DEVELOPMENT_ENVIRONMENTS = new Set([
  'development',
  'dev',
  'local',
  'test'
])
const WEAK_SECRETS = new Set([
  DEV_LOCAL_SECRET,
  'dev-secret-change-in-production',
  'integration-secret-token'
])

const encoder = new TextEncoder()

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return atob(padded)
}

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false
  }

  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return result === 0
}

const normalizedEnvironment = (env: Env): string =>
  env.ENVIRONMENT?.trim().toLowerCase() || 'unknown'

export const isDevelopmentLikeEnvironment = (env: Env): boolean =>
  DEVELOPMENT_ENVIRONMENTS.has(normalizedEnvironment(env))

const isProtectedEnvironment = (env: Env): boolean =>
  !isDevelopmentLikeEnvironment(env)

const resolveSecret = (env: Env): string => {
  const configuredSecret =
    env.APP_AUTH_SECRET?.trim() || env.SESSION_SECRET_HMAC_KEY?.trim()
  if (configuredSecret) {
    if (
      isProtectedEnvironment(env) &&
      (WEAK_SECRETS.has(configuredSecret) || configuredSecret.length < 32)
    ) {
      throw new HttpError(
        500,
        'App auth secret is too weak for this environment'
      )
    }
    return configuredSecret
  }

  if (isDevelopmentLikeEnvironment(env)) {
    return DEV_LOCAL_SECRET
  }

  throw new HttpError(
    500,
    'App auth secret is not configured for this environment'
  )
}

const resolveTrustedCallbackSecret = (env: Env): string => {
  const configuredSecret = env.APP_AUTH_CALLBACK_SHARED_SECRET?.trim()
  if (configuredSecret) {
    if (
      isProtectedEnvironment(env) &&
      (WEAK_SECRETS.has(configuredSecret) || configuredSecret.length < 32)
    ) {
      throw new HttpError(
        500,
        'Trusted callback secret is too weak for this environment'
      )
    }
    return configuredSecret
  }

  if (isDevelopmentLikeEnvironment(env)) {
    return DEV_LOCAL_SECRET
  }

  throw new HttpError(
    500,
    'Trusted callback secret is not configured for this environment'
  )
}

const importHmacKey = async (env: Env): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(resolveSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

const importTrustedCallbackHmacKey = async (env: Env): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(resolveTrustedCallbackSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

const sign = async (env: Env, payload: string): Promise<string> => {
  const key = await importHmacKey(env)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )
  const bytes = Array.from(new Uint8Array(signature))
    .map((value) => String.fromCharCode(value))
    .join('')
  return toBase64Url(bytes)
}

const signTrustedCallbackPayload = async (
  env: Env,
  payload: string
): Promise<string> => {
  const key = await importTrustedCallbackHmacKey(env)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )
  const bytes = Array.from(new Uint8Array(signature))
    .map((value) => String.fromCharCode(value))
    .join('')
  return toBase64Url(bytes)
}

const parseCookie = (
  cookieHeader: string | null | undefined,
  name: string
): string | null => {
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=')
    if (rawName === name) {
      return rest.join('=')
    }
  }

  return null
}

const cookieSecurityAttributes = (env: Env): string =>
  isProtectedEnvironment(env) ? '; Secure' : ''

export const issueAppSessionCookie = async (
  env: Env,
  user: Omit<AppUserClaims, 'exp'>,
  ttlSeconds = ONE_WEEK_SECONDS
): Promise<string> => {
  const claims: AppUserClaims = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  }
  const encodedPayload = toBase64Url(JSON.stringify(claims))
  const signature = await sign(env, encodedPayload)
  const token = `${encodedPayload}.${signature}`

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${cookieSecurityAttributes(
    env
  )}`
}

export const clearAppSessionCookie = (env: Env): string =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecurityAttributes(
    env
  )}`

export const issueAuthFlowCookie = (
  env: Env,
  nonce: string,
  ttlSeconds = TEN_MINUTES_SECONDS
): string =>
  `${AUTH_FLOW_COOKIE}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${cookieSecurityAttributes(
    env
  )}`

export const clearAuthFlowCookie = (env: Env): string =>
  `${AUTH_FLOW_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecurityAttributes(
    env
  )}`

export const readCookieValue = (
  cookieHeader: string | null | undefined,
  name: string
): string | null => parseCookie(cookieHeader, name)

const normalizedHeaderName = (
  value: string | undefined,
  fallback: string
): string => value?.trim().toLowerCase() || fallback

export const trustedCallbackIdentityHeaderName = (env: Env): string =>
  normalizedHeaderName(
    env.APP_TRUSTED_AUTH_USER_HEADER,
    DEFAULT_TRUSTED_CALLBACK_IDENTITY_HEADER
  )

export const trustedCallbackSignatureHeaderName = (env: Env): string =>
  normalizedHeaderName(
    env.APP_TRUSTED_AUTH_SIGNATURE_HEADER,
    DEFAULT_TRUSTED_CALLBACK_SIGNATURE_HEADER
  )

const parseAuthFlowStatePayload = (
  encodedPayload: string
): AuthFlowStateClaims | null => {
  try {
    const decoded = fromBase64Url(encodedPayload)
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    return {
      redirectUri:
        typeof parsed.redirectUri === 'string' ? parsed.redirectUri : undefined,
      nonce: typeof parsed.nonce === 'string' ? parsed.nonce : undefined,
      issuedAt:
        typeof parsed.issuedAt === 'number' ? parsed.issuedAt : undefined,
      exp: typeof parsed.exp === 'number' ? parsed.exp : undefined
    }
  } catch {
    return null
  }
}

export const verifyAuthFlowState = async (
  env: Env,
  state: string | undefined,
  ttlSeconds = TEN_MINUTES_SECONDS
): Promise<AuthFlowStateClaims | null> => {
  if (!state) {
    return null
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const signedSeparatorIndex = state.lastIndexOf('.')
  if (signedSeparatorIndex > 0) {
    const encodedPayload = state.slice(0, signedSeparatorIndex)
    const providedSignature = state.slice(signedSeparatorIndex + 1)
    if (!encodedPayload || !providedSignature) {
      return null
    }

    const expectedSignature = await sign(env, encodedPayload)
    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      return null
    }

    const parsed = parseAuthFlowStatePayload(encodedPayload)
    if (!parsed) {
      return null
    }

    if (typeof parsed.exp === 'number' && parsed.exp < nowSeconds) {
      return null
    }
    if (typeof parsed.issuedAt === 'number') {
      const issuedAtSeconds = Math.floor(parsed.issuedAt / 1000)
      if (
        issuedAtSeconds > nowSeconds + 60 ||
        issuedAtSeconds < nowSeconds - ttlSeconds
      ) {
        return null
      }
    }

    return parsed
  }

  if (isProtectedEnvironment(env)) {
    return null
  }

  try {
    const decoded = atob(state)
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    const issuedAt =
      typeof parsed.issuedAt === 'number' ? parsed.issuedAt : undefined
    const redirectUri =
      typeof parsed.redirectUri === 'string' ? parsed.redirectUri : undefined
    const nonce = typeof parsed.nonce === 'string' ? parsed.nonce : undefined
    if (typeof issuedAt === 'number') {
      const issuedAtSeconds = Math.floor(issuedAt / 1000)
      if (
        issuedAtSeconds > nowSeconds + 60 ||
        issuedAtSeconds < nowSeconds - ttlSeconds
      ) {
        return null
      }
    }

    return {
      redirectUri,
      nonce,
      issuedAt
    }
  } catch {
    if (isProtectedEnvironment(env)) {
      return null
    }
    try {
      return { redirectUri: atob(state) }
    } catch {
      return null
    }
  }
}

export const issueSignedAuthFlowState = async (
  env: Env,
  claims: AuthFlowStateClaims,
  ttlSeconds = TEN_MINUTES_SECONDS
): Promise<string> => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const payload: AuthFlowStateClaims = {
    ...claims,
    issuedAt: claims.issuedAt ?? Date.now(),
    exp: claims.exp ?? nowSeconds + ttlSeconds
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = await sign(env, encodedPayload)
  return `${encodedPayload}.${signature}`
}

const parseTrustedCallbackIdentityPayload = (
  encodedPayload: string
): TrustedCallbackIdentityClaims | null => {
  try {
    const decoded = fromBase64Url(encodedPayload)
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    const sub = typeof parsed.sub === 'string' ? parsed.sub : undefined
    const email = typeof parsed.email === 'string' ? parsed.email : undefined
    const tin = typeof parsed.tin === 'string' ? parsed.tin : undefined
    const displayName =
      typeof parsed.displayName === 'string' ? parsed.displayName : undefined

    if (!sub || !email) {
      return null
    }

    return {
      sub,
      email,
      tin,
      displayName
    }
  } catch {
    return null
  }
}

export const issueTrustedCallbackIdentityAssertion = async (
  env: Env,
  claims: TrustedCallbackIdentityClaims
): Promise<{ payload: string; signature: string }> => {
  const payload = toBase64Url(JSON.stringify(claims))
  const signature = await signTrustedCallbackPayload(env, payload)
  return { payload, signature }
}

export const verifyTrustedCallbackIdentityAssertion = async (
  env: Env,
  encodedPayload: string | undefined,
  providedSignature: string | undefined
): Promise<TrustedCallbackIdentityClaims | null> => {
  if (!encodedPayload || !providedSignature) {
    return null
  }

  const expectedSignature = await signTrustedCallbackPayload(env, encodedPayload)
  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    return null
  }

  return parseTrustedCallbackIdentityPayload(encodedPayload)
}

export const readAppUserFromRequest = async (
  c: Context<{ Bindings: Env }>
): Promise<AppUserClaims | null> => {
  const token = parseCookie(c.req.header('cookie'), SESSION_COOKIE)
  if (!token) {
    return null
  }

  const [encodedPayload, providedSignature] = token.split('.')
  if (!encodedPayload || !providedSignature) {
    return null
  }

  const expectedSignature = await sign(c.env, encodedPayload)
  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    return null
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as AppUserClaims
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const requireAppUser = async (
  c: Context<{ Bindings: Env }>
): Promise<AppUserClaims> => {
  const user = await readAppUserFromRequest(c)
  if (!user) {
    throw new HttpError(401, 'Authentication required')
  }
  return user
}

export const localDevAuthAllowed = (env: Env): boolean => {
  if (!isDevelopmentLikeEnvironment(env)) {
    return false
  }

  const explicitFlag = env.APP_DEV_ALLOW_LOCAL_LOGIN?.trim()
  if (explicitFlag) {
    return explicitFlag !== 'false'
  }

  const legacyFlag = env.LOCAL_DEV_AUTH_ENABLED?.trim()
  if (legacyFlag) {
    return legacyFlag !== 'false'
  }

  return true
}
