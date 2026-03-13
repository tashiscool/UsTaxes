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

const SESSION_COOKIE = 'app_session_id'
const DEV_LOCAL_SECRET = 'ustaxes-local-dev-secret'
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

const encoder = new TextEncoder()

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded =
    normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
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

const resolveSecret = (env: Env): string =>
  env.APP_AUTH_SECRET?.trim() || DEV_LOCAL_SECRET

const importHmacKey = async (env: Env): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(resolveSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

const sign = async (env: Env, payload: string): Promise<string> => {
  const key = await importHmacKey(env)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const bytes = Array.from(new Uint8Array(signature))
    .map((value) => String.fromCharCode(value))
    .join('')
  return toBase64Url(bytes)
}

const parseCookie = (cookieHeader: string | null | undefined, name: string): string | null => {
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

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}`
}

export const clearAppSessionCookie = (): string =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

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

  const parsed = JSON.parse(fromBase64Url(encodedPayload)) as AppUserClaims
  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  return parsed
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

export const localDevAuthAllowed = (env: Env): boolean =>
  env.APP_DEV_ALLOW_LOCAL_LOGIN !== 'false'
