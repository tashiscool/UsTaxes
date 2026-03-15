/**
 * Push Notification Service
 *
 * VAPID Web Push for tax deadline reminders. Uses SubtleCrypto (available in
 * Cloudflare Workers) for P-256 ECDSA JWT signing. Payload encryption follows
 * RFC 8291 / ece aes128gcm.
 */

export interface PushSubscription {
  endpoint: string
  p256dh: string // base64url-encoded UA public key
  auth: string // base64url-encoded auth secret (16 bytes)
}

// ─── Base64url helpers ────────────────────────────────────────────────────────

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// ─── VAPID JWT ────────────────────────────────────────────────────────────────

async function buildVapidJwt(
  endpoint: string,
  vapidPrivateKeyB64: string,
  vapidPublicKeyB64: string
): Promise<string> {
  const origin = new URL(endpoint).origin
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600

  const header = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  )
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        aud: origin,
        exp,
        sub: 'mailto:noreply@freetaxflow.com'
      })
    )
  )
  const signingInput = `${header}.${payload}`

  const rawKey = base64urlDecode(vapidPrivateKeyB64)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    rawKey.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${base64urlEncode(sigBuf)}`
  return `vapid t=${jwt},k=${vapidPublicKeyB64}`
}

// ─── Web Push payload encryption (RFC 8291 / aes128gcm) ──────────────────────

async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string
): Promise<{
  ciphertext: ArrayBuffer
  salt: Uint8Array
  serverPublicKey: Uint8Array
}> {
  const uaPublicKey = base64urlDecode(p256dhB64)
  const authSecret = base64urlDecode(authB64)

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )

  const uaCryptoKey = await crypto.subtle.importKey(
    'raw',
    uaPublicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaCryptoKey },
    serverKeyPair.privateKey,
    256
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  )

  // PRK = HKDF-Extract(auth_secret, ecdh_secret)
  const enc = new TextEncoder()
  const prkKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  )
  const authInfo = enc.encode('Content-Encoding: auth\x00')
  const prkBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: authSecret.buffer as ArrayBuffer,
      info: authInfo
    },
    prkKey,
    256
  )

  // CEK and nonce from PRK + salt
  const prkExpandKey = await crypto.subtle.importKey(
    'raw',
    prkBits,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  )
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\x00')
  const cekBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: cekInfo
    },
    prkExpandKey,
    128
  )
  const nonceInfo = enc.encode('Content-Encoding: nonce\x00')
  const nonceBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: nonceInfo
    },
    prkExpandKey,
    96
  )

  const cek = await crypto.subtle.importKey(
    'raw',
    cekBits,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const nonce = new Uint8Array(nonceBits)

  // Pad plaintext to record size with \x02 delimiter
  const ptBytes = enc.encode(plaintext)
  const padded = new Uint8Array(ptBytes.length + 1)
  padded.set(ptBytes)
  padded[ptBytes.length] = 0x02

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cek,
    padded
  )

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw }
}

// ─── D1 persistence ───────────────────────────────────────────────────────────

export async function saveSubscription(
  db: D1Database,
  userId: string,
  sub: PushSubscription
): Promise<void> {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
    )
    .bind(id, userId, sub.endpoint, sub.p256dh, sub.auth)
    .run()
}

export async function deleteSubscription(
  db: D1Database,
  endpoint: string
): Promise<void> {
  await db
    .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
    .bind(endpoint)
    .run()
}

export async function getSubscriptionsForUser(
  db: D1Database,
  userId: string
): Promise<PushSubscription[]> {
  const result = await db
    .prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
    )
    .bind(userId)
    .all<PushSubscription>()
  return result.results
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendNotification(
  sub: PushSubscription,
  title: string,
  body: string,
  vapidPrivateKeyB64: string,
  vapidPublicKeyB64: string
): Promise<boolean> {
  const notificationPayload = JSON.stringify({
    title,
    body,
    icon: '/icon-192.png'
  })

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    notificationPayload,
    sub.p256dh,
    sub.auth
  )

  // Build aes128gcm content-encoding header: salt(16) + rs(4) + keyLen(1) + publicKey(65)
  const rs = 4096
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, rs, false)
  header[20] = serverPublicKey.length
  header.set(serverPublicKey, 21)

  const body2 = new Uint8Array(header.byteLength + ciphertext.byteLength)
  body2.set(header, 0)
  body2.set(new Uint8Array(ciphertext), header.byteLength)

  const authHeader = await buildVapidJwt(
    sub.endpoint,
    vapidPrivateKeyB64,
    vapidPublicKeyB64
  )

  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400'
    },
    body: body2
  })

  // 201 = accepted, 410/404 = subscription gone
  return response.status === 201 || response.status === 202
}
