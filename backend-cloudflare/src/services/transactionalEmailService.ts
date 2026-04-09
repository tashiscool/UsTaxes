import type { Env } from '../domain/env'
import type { ReturnFormType, SubmissionPayload, SubmissionStatus } from '../domain/types'
import type { AppUserClaims } from '../utils/appAuth'

export interface TransactionalEmailTemplate {
  subject: string
  textBody: string
  htmlBody: string
}

export interface EmailSendResult {
  delivered: boolean
  skipped: boolean
  provider: string
  providerStatus?: string
  providerRequestId?: string
  statusCode?: number
  errorCode?: string
  errorDetail?: string
}

interface MailConfig {
  provider: string
  fromEmail: string | null
  fromName: string
  timeoutMs: number
  mailchannelsUrl: string
  mailchannelsApiKey: string | null
  dkimDomain: string | null
  dkimSelector: string | null
  dkimPrivateKey: string | null
}

interface SendTransactionalEmailInput {
  eventType: string
  emailNormalized: string
  userId?: string | null
  dedupeKey?: string | null
  template: TransactionalEmailTemplate
  metadata?: Record<string, unknown> | null
  errorCodePrefix?: string
}

export interface SubmissionReceiptEmailInput {
  user: AppUserClaims
  sessionId: string
  taxYear: number
  filingStatus: string
  formType: ReturnFormType
  submissionId: string
  submissionStatus: SubmissionStatus
  submittedAt: string
  payload?: SubmissionPayload | null
  force?: boolean
}

const FRONTEND_ORIGIN_FALLBACK = 'https://freetaxflow.com'

const readEnvString = (env: Env, name: keyof Env | string): string | null => {
  const raw = (env as unknown as Record<string, unknown>)[name]
  if (typeof raw !== 'string') {
    return null
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeProvider = (value: string | null): string =>
  (value ?? 'none').trim().toLowerCase()

const readConfig = (env: Env): MailConfig => ({
  provider: normalizeProvider(readEnvString(env, 'EMAIL_PROVIDER')),
  fromEmail: readEnvString(env, 'EMAIL_FROM'),
  fromName: readEnvString(env, 'EMAIL_FROM_NAME') ?? 'FreeTaxFlow',
  timeoutMs:
    Math.max(
      1,
      Number.parseInt(readEnvString(env, 'EMAIL_TIMEOUT_SECONDS') ?? '10', 10)
    ) * 1000,
  mailchannelsUrl:
    readEnvString(env, 'EMAIL_MAILCHANNELS_URL') ??
    'https://api.mailchannels.net/tx/v1/send',
  mailchannelsApiKey:
    readEnvString(env, 'EMAIL_MAILCHANNELS_API_KEY') ??
    readEnvString(env, 'MAILCHANNELS_API_KEY'),
  dkimDomain: readEnvString(env, 'EMAIL_DKIM_DOMAIN'),
  dkimSelector: readEnvString(env, 'EMAIL_DKIM_SELECTOR'),
  dkimPrivateKey: readEnvString(env, 'EMAIL_DKIM_PRIVATE_KEY')
})

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const asObjectRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const truncateForStorage = (value: string, maxLength = 240): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

const formatMoney = (value: number | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

const formatSubmissionTime = (value: string): string => {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  }).format(new Date(parsed))
}

const resolveFrontendOrigin = (env: Env): string =>
  (
    readEnvString(env, 'USTAXES_FRONTEND_URL') ??
    readEnvString(env, 'CORS_ORIGIN') ??
    FRONTEND_ORIGIN_FALLBACK
  ).replace(/\/+$/, '')

const describeSubmissionStatus = (status: SubmissionStatus): string => {
  switch (status) {
    case 'queued':
      return 'Queued for IRS processing'
    case 'processing':
      return 'Processing'
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    case 'failed':
      return 'Failed'
    case 'draft':
      return 'Draft'
    default:
      return status
  }
}

const runWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const writeDeliveryLog = async (
  env: Env,
  input: SendTransactionalEmailInput,
  result: EmailSendResult
): Promise<void> => {
  try {
    await env.USTAXES_DB.prepare(
      `INSERT INTO transactional_email_delivery_log(
         event_type,
         dedupe_key,
         user_id,
         email_normalized,
         subject,
         provider,
         delivery_status,
         provider_status_code,
         provider_response_status,
         provider_request_id,
         error_code,
         error_detail,
         metadata_json,
         created_at_ms
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        truncateForStorage(input.eventType.trim().toUpperCase(), 80),
        input.dedupeKey?.trim()
          ? truncateForStorage(input.dedupeKey.trim(), 180)
          : null,
        input.userId?.trim() ? truncateForStorage(input.userId.trim(), 120) : null,
        truncateForStorage(input.emailNormalized, 255),
        truncateForStorage(input.template.subject, 240),
        truncateForStorage(result.provider, 60),
        result.delivered ? 'sent' : result.skipped ? 'skipped' : 'failed',
        result.statusCode ?? null,
        result.providerStatus
          ? truncateForStorage(result.providerStatus, 80)
          : null,
        result.providerRequestId
          ? truncateForStorage(result.providerRequestId, 120)
          : null,
        result.errorCode ? truncateForStorage(result.errorCode, 120) : null,
        result.errorDetail
          ? truncateForStorage(result.errorDetail, 400)
          : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        Date.now()
      )
      .run()
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'transactional_email_log_write_failed',
        eventType: input.eventType,
        userId: input.userId ?? null,
        provider: result.provider,
        message: error instanceof Error ? error.message : 'unknown_error'
      })
    )
  }
}

const hasRecentSuccessfulEmail = async (
  env: Env,
  dedupeKey: string,
  windowMs: number
): Promise<boolean> => {
  const normalizedKey = dedupeKey.trim()
  if (!normalizedKey) {
    return false
  }

  const row = await env.USTAXES_DB.prepare(
    `SELECT COUNT(1) AS delivered_count
     FROM transactional_email_delivery_log
     WHERE dedupe_key = ?
       AND delivery_status = 'sent'
       AND created_at_ms >= ?`
  )
    .bind(normalizedKey, Date.now() - Math.max(0, Math.floor(windowMs)))
    .first<{ delivered_count: number | null }>()

  return Number(row?.delivered_count ?? 0) > 0
}

const buildSubmissionReceiptTemplate = (
  env: Env,
  input: SubmissionReceiptEmailInput
): TransactionalEmailTemplate => {
  const frontendOrigin = resolveFrontendOrigin(env)
  const displayName = input.user.displayName?.trim() || 'there'
  const summary = input.payload?.form1040
  const refund = formatMoney(summary?.refund)
  const amountOwed = formatMoney(summary?.amountOwed)
  const totalTax = formatMoney(summary?.totalTax)
  const totalPayments = formatMoney(summary?.totalPayments)
  const statusLabel = describeSubmissionStatus(input.submissionStatus)
  const submittedLabel = formatSubmissionTime(input.submittedAt)
  const filingStatusLabel = input.filingStatus
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  const amountLine = refund
    ? `Estimated refund: ${refund}`
    : amountOwed && amountOwed !== '$0.00'
      ? `Estimated amount owed: ${amountOwed}`
      : totalTax || totalPayments
        ? `Tax summary: total tax ${totalTax ?? '$0.00'}, total payments ${totalPayments ?? '$0.00'}`
        : null

  const textBlocks = [
    `Hi ${displayName},`,
    '',
    `We received your FreeTaxFlow ${input.taxYear} ${input.formType} submission.`,
    `Submission ID: ${input.submissionId}`,
    `Submitted: ${submittedLabel}`,
    `Current status: ${statusLabel}`,
    `Filing status: ${filingStatusLabel}`,
    amountLine,
    '',
    `Track your filing status in FreeTaxFlow: ${frontendOrigin}/efile-wizard`,
    `Review your return: ${frontendOrigin}/review-confirm`,
    '',
    'We will keep your return moving and surface any next steps in the app.',
    '',
    'FreeTaxFlow'
  ].filter((line): line is string => Boolean(line))

  const htmlBlocks = [
    `<p style="margin:0 0 16px;">Hi ${escapeHtml(displayName)},</p>`,
    `<p style="margin:0 0 16px;">We received your FreeTaxFlow ${input.taxYear} ${escapeHtml(
      input.formType
    )} submission.</p>`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">`,
    `<tr><td style="padding:8px 0;color:#475569;">Submission ID</td><td style="padding:8px 0;font-weight:600;color:#0f172a;">${escapeHtml(
      input.submissionId
    )}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#475569;">Submitted</td><td style="padding:8px 0;font-weight:600;color:#0f172a;">${escapeHtml(
      submittedLabel
    )}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#475569;">Current status</td><td style="padding:8px 0;font-weight:600;color:#0f172a;">${escapeHtml(
      statusLabel
    )}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#475569;">Filing status</td><td style="padding:8px 0;font-weight:600;color:#0f172a;">${escapeHtml(
      filingStatusLabel
    )}</td></tr>`,
    amountLine
      ? `<tr><td style="padding:8px 0;color:#475569;">Tax summary</td><td style="padding:8px 0;font-weight:600;color:#0f172a;">${escapeHtml(
          amountLine.replace(/^Estimated /, '')
        )}</td></tr>`
      : '',
    `</table>`,
    `<p style="margin:0 0 16px;"><a href="${escapeHtml(
      `${frontendOrigin}/efile-wizard`
    )}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f9f45;color:#ffffff;text-decoration:none;font-weight:600;">View filing status</a></p>`,
    `<p style="margin:0 0 12px;"><a href="${escapeHtml(
      `${frontendOrigin}/review-confirm`
    )}" style="color:#0f172a;font-weight:600;">Review your return</a></p>`,
    `<p style="margin:0;color:#475569;">We will keep your return moving and surface any next steps in the app.</p>`
  ]
    .filter(Boolean)
    .join('')

  return {
    subject: `FreeTaxFlow submission received for tax year ${input.taxYear}`,
    textBody: textBlocks.join('\n'),
    htmlBody: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#0f9f45;">FreeTaxFlow</p>
      <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;">Your submission is in</h1>
      ${htmlBlocks}
    </main>
  </body>
</html>`
  }
}

export class TransactionalEmailService {
  constructor(private readonly env: Env) {}

  async sendSubmissionReceiptEmail(
    input: SubmissionReceiptEmailInput
  ): Promise<EmailSendResult> {
    const template = buildSubmissionReceiptTemplate(this.env, input)
    return this.sendTransactionalEmail({
      eventType: 'submission_receipt',
      emailNormalized: input.user.email.trim().toLowerCase(),
      userId: input.user.sub,
      dedupeKey: input.force
        ? null
        : `submission_receipt:${input.submissionId}:${input.user.email
            .trim()
            .toLowerCase()}`,
      metadata: {
        sessionId: input.sessionId,
        submissionId: input.submissionId,
        submissionStatus: input.submissionStatus,
        taxYear: input.taxYear,
        filingStatus: input.filingStatus,
        formType: input.formType
      },
      errorCodePrefix: 'submission_receipt_email',
      template
    })
  }

  async sendTransactionalEmail(
    input: SendTransactionalEmailInput
  ): Promise<EmailSendResult> {
    const dedupeKey = input.dedupeKey?.trim() ?? ''
    const errorPrefix = (
      input.errorCodePrefix?.trim() || 'email'
    )
      .replace(/[^a-z0-9_]+/gi, '_')
      .toLowerCase()

    if (dedupeKey) {
      const alreadySent = await hasRecentSuccessfulEmail(
        this.env,
        dedupeKey,
        30 * 24 * 60 * 60 * 1000
      )
      if (alreadySent) {
        const result: EmailSendResult = {
          delivered: false,
          skipped: true,
          provider: 'dedupe',
          providerStatus: 'already_sent'
        }
        await writeDeliveryLog(this.env, input, result)
        return result
      }
    }

    const config = readConfig(this.env)
    if (['none', 'off', 'disabled'].includes(config.provider)) {
      const result: EmailSendResult = {
        delivered: false,
        skipped: true,
        provider: config.provider || 'none',
        providerStatus: 'disabled'
      }
      await writeDeliveryLog(this.env, input, result)
      return result
    }

    if (!config.fromEmail) {
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        errorCode: `${errorPrefix}_from_not_configured`
      }
      await writeDeliveryLog(this.env, input, result)
      return result
    }

    if (config.provider !== 'mailchannels') {
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        errorCode: `${errorPrefix}_unsupported_provider`,
        errorDetail: `Unsupported provider: ${config.provider}`
      }
      await writeDeliveryLog(this.env, input, result)
      return result
    }

    const personalization: Record<string, unknown> = {
      to: [{ email: input.emailNormalized }]
    }

    if (config.dkimDomain) {
      personalization.dkim_domain = config.dkimDomain
    }
    if (config.dkimSelector) {
      personalization.dkim_selector = config.dkimSelector
    }
    if (config.dkimPrivateKey) {
      personalization.dkim_private_key = config.dkimPrivateKey
    }

    const mailPayload: Record<string, unknown> = {
      personalizations: [personalization],
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      subject: input.template.subject,
      content: [
        { type: 'text/plain', value: input.template.textBody },
        { type: 'text/html', value: input.template.htmlBody }
      ]
    }

    if (config.dkimDomain) {
      mailPayload.dkim_domain = config.dkimDomain
    }
    if (config.dkimSelector) {
      mailPayload.dkim_selector = config.dkimSelector
    }
    if (config.dkimPrivateKey) {
      mailPayload.dkim_private_key = config.dkimPrivateKey
    }

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json'
      }
      if (config.mailchannelsApiKey) {
        headers['X-Api-Key'] = config.mailchannelsApiKey
      }

      const response = await runWithTimeout(
        config.mailchannelsUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(mailPayload)
        },
        config.timeoutMs
      )

      const responseText = await response.text().catch(() => '')
      const responseJson = safeJsonParse(responseText)
      const responseRecord = asObjectRecord(responseJson)
      const responseResults = Array.isArray(responseRecord?.results)
        ? responseRecord.results
        : []
      const firstResult =
        responseResults
          .map((entry) => asObjectRecord(entry))
          .find(Boolean) ?? null
      const providerStatus =
        typeof firstResult?.status === 'string' &&
        firstResult.status.trim().length > 0
          ? truncateForStorage(firstResult.status.trim().toLowerCase(), 60)
          : undefined
      const providerRequestId =
        typeof responseRecord?.request_id === 'string' &&
        responseRecord.request_id.trim().length > 0
          ? truncateForStorage(responseRecord.request_id.trim(), 120)
          : undefined

      if (!response.ok) {
        const result: EmailSendResult = {
          delivered: false,
          skipped: false,
          provider: config.provider,
          statusCode: response.status,
          providerStatus: providerStatus ?? 'http_error',
          providerRequestId,
          errorCode: `${errorPrefix}_mailchannels_delivery_failed`,
          errorDetail: truncateForStorage(responseText || 'request_failed', 180)
        }
        await writeDeliveryLog(this.env, input, result)
        return result
      }

      const failedResult = responseResults
        .map((entry) => asObjectRecord(entry))
        .find((entry) => String(entry?.status ?? '').toLowerCase() === 'failed')

      if (failedResult) {
        const reason =
          typeof failedResult.reason === 'string' &&
          failedResult.reason.trim().length > 0
            ? failedResult.reason.trim()
            : 'mailchannels_rejected_message'
        const result: EmailSendResult = {
          delivered: false,
          skipped: false,
          provider: config.provider,
          statusCode: response.status,
          providerStatus: 'failed',
          providerRequestId,
          errorCode: `${errorPrefix}_mailchannels_delivery_rejected`,
          errorDetail: truncateForStorage(reason, 180)
        }
        await writeDeliveryLog(this.env, input, result)
        return result
      }

      const result: EmailSendResult = {
        delivered: true,
        skipped: false,
        provider: config.provider,
        statusCode: response.status,
        providerStatus: providerStatus ?? 'sent',
        providerRequestId
      }
      await writeDeliveryLog(this.env, input, result)
      return result
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown_delivery_error'
      const result: EmailSendResult = {
        delivered: false,
        skipped: false,
        provider: config.provider,
        errorCode: `${errorPrefix}_mailchannels_delivery_error`,
        errorDetail: truncateForStorage(message, 180)
      }
      await writeDeliveryLog(this.env, input, result)
      return result
    }
  }
}
