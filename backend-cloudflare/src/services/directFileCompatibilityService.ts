import { z } from 'zod'

import type { ArtifactStore } from '../adapters/artifactStore'
import type { TaxRepository } from '../adapters/repository'
import type { Env } from '../domain/env'
import type {
  CreateReturnRequest,
  ReturnFormType,
  SubmissionPayload
} from '../domain/types'
import { resolveStateProfile } from '../data/stateProfiles'
import { HttpError } from '../utils/http'
import { nowIso } from '../utils/time'
import {
  type DirectFileFacts,
  directFileStatusTranslationKey,
  extractFilingStatusFromFacts,
  extractFormTypeFromFacts,
  extractPrimaryTinFromFacts,
  extractStateCodeFromFacts,
  extractTaxYearFromFacts,
  toDirectFileStatus
} from '../utils/directFileFacts'
import { validateDirectFileFacts } from '../utils/factGraphValidation'
import { ApiService } from './apiService'

export interface DirectFileUserContext {
  id: string
  email: string
  tin?: string
}

export interface DirectFileStateProfile {
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

const createBodySchema = z.object({
  taxYear: z.number().int().min(2023).max(2050),
  facts: z.record(z.string(), z.unknown())
})

const updateBodySchema = z.object({
  facts: z.record(z.string(), z.unknown()),
  store: z.string().optional(),
  surveyOptIn: z.boolean().optional()
})

const submitBodySchema = z.object({
  facts: z.record(z.string(), z.unknown())
})

const signBodySchema = z.object({
  facts: z.record(z.string(), z.unknown()),
  intentStatement: z.string().min(1)
})

const authorizationBodySchema = z.object({
  taxReturnUuid: z.string().uuid(),
  taxYear: z.number().int().min(2023).max(2050)
})

const isEditableStatus = (status: string): boolean => status === 'draft'

const toTaxReturnSubmissionResponse = (
  submission: Awaited<
    ReturnType<TaxRepository['listReturnSubmissions']>
  >[number],
  ownerId: string
) => ({
  id: submission.id,
  createdAt: submission.createdAt,
  submitUserId: ownerId,
  submissionId: submission.id,
  submissionReceivedAt: submission.processedAt ?? null
})

export class DirectFileCompatibilityService {
  constructor(
    private readonly env: Env,
    private readonly repository: TaxRepository,
    private readonly artifacts: ArtifactStore,
    private readonly apiService: ApiService
  ) {}

  async listTaxReturns(user: DirectFileUserContext) {
    const taxReturns = await this.repository.listTaxReturns(user.id)
    const response = await Promise.all(
      taxReturns.map((taxReturn) => this.toTaxReturnResponseBody(taxReturn.id))
    )

    return response
  }

  async getTaxReturn(taxReturnId: string, user: DirectFileUserContext) {
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    return this.toTaxReturnResponseBody(taxReturnId)
  }

  async createTaxReturn(rawBody: unknown, user: DirectFileUserContext) {
    const body = createBodySchema.parse(rawBody)
    this.assertFactsValid(body.facts as DirectFileFacts)
    const existing = await this.repository.listTaxReturns(user.id)
    if (existing.some((taxReturn) => taxReturn.taxYear === body.taxYear)) {
      throw new HttpError(
        409,
        'The user already has a tax return for that tax year.'
      )
    }

    const filingStatus =
      extractFilingStatusFromFacts(body.facts as DirectFileFacts) ?? 'single'
    const ownerTin =
      user.tin ??
      extractPrimaryTinFromFacts(body.facts as DirectFileFacts) ??
      undefined
    const formType =
      extractFormTypeFromFacts(body.facts as DirectFileFacts) ?? undefined

    const created = await this.apiService.createReturn({
      taxYear: body.taxYear,
      filingStatus,
      facts: body.facts,
      ownerId: user.id,
      ownerTin,
      formType: formType as ReturnFormType | undefined
    } as CreateReturnRequest)

    return this.toTaxReturnResponseBody(created.taxReturn.id)
  }

  async updateTaxReturn(
    taxReturnId: string,
    rawBody: unknown,
    user: DirectFileUserContext
  ) {
    const body = updateBodySchema.parse(rawBody)
    this.assertFactsValid(body.facts as DirectFileFacts)
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    if (!isEditableStatus(taxReturn.currentStatus)) {
      throw new HttpError(
        409,
        'The tax return has already been dispatched for electronic filing.'
      )
    }

    await this.artifacts.putJson(taxReturn.factsKey, body.facts)
    await this.repository.updateTaxReturnStatus(
      taxReturnId,
      taxReturn.currentStatus
    )
  }

  async submitTaxReturn(
    taxReturnId: string,
    rawBody: unknown,
    user: DirectFileUserContext
  ) {
    const body = submitBodySchema.parse(rawBody)
    this.assertFactsValid(body.facts as DirectFileFacts)
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    if (!isEditableStatus(taxReturn.currentStatus)) {
      throw new HttpError(
        409,
        'The tax return has already been dispatched for electronic filing.'
      )
    }

    const payload = this.toSubmissionPayload(
      body.facts as DirectFileFacts,
      taxReturn,
      user
    )
    const submitResult = await this.apiService.submitReturn(taxReturnId, {
      idempotencyKey: crypto.randomUUID(),
      payload
    })

    return {
      message: `Tax return ${taxReturnId} was dispatched to the electronic filing queue by user ${
        user.id
      } at ${nowIso()}`,
      submissionId: submitResult.submission.id
    }
  }

  async signTaxReturn(
    taxReturnId: string,
    rawBody: unknown,
    user: DirectFileUserContext
  ) {
    const body = signBodySchema.parse(rawBody)
    this.assertFactsValid(body.facts as DirectFileFacts)
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    const signedAt = nowIso()
    const signKey = `returns/${taxReturnId}/signatures/${signedAt}.json`
    await this.artifacts.putJson(signKey, {
      intentStatement: body.intentStatement,
      facts: body.facts,
      signedBy: user.id,
      signedAt
    })
    await this.repository.setTaxReturnSignature(taxReturnId, signKey, signedAt)

    await this.submitTaxReturn(
      taxReturnId,
      {
        facts: body.facts
      },
      user
    )

    return `Signed request ${taxReturnId} was accepted`
  }

  async getTaxReturnStatus(taxReturnId: string, user: DirectFileUserContext) {
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    const submissions = await this.repository.listReturnSubmissions(taxReturnId)
    if (submissions.length === 0) {
      throw new HttpError(
        404,
        'Could not find a submission ID for the requested return. It may not have been processed yet.'
      )
    }

    const latest = submissions[0]
    return {
      status: toDirectFileStatus(latest.status),
      translationKey: directFileStatusTranslationKey(latest.status),
      rejectionCodes: latest.ackCode ? [latest.ackCode] : [],
      createdAt: latest.updatedAt
    }
  }

  async getTaxReturnPdf(
    taxReturnId: string,
    languageCode: string,
    user: DirectFileUserContext
  ): Promise<Uint8Array> {
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    void languageCode
    throw new HttpError(
      501,
      `A rendered ${taxReturn.formType ?? '1040'} PDF is not yet available for Direct File compatibility mode.`
    )
  }

  async getPopulatedData(taxReturnId: string, user: DirectFileUserContext) {
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    const facts =
      (await this.artifacts.getJson<DirectFileFacts>(taxReturn.factsKey)) ?? {}

    return {
      data: Object.entries(facts).map(([path, value]) => ({
        path,
        value
      }))
    }
  }

  async createAuthorizationCode(rawBody: unknown, user: DirectFileUserContext) {
    const body = authorizationBodySchema.parse(rawBody)
    const taxReturn = await this.repository.getTaxReturn(body.taxReturnUuid)
    if (!taxReturn || taxReturn.ownerId !== user.id) {
      throw new HttpError(404, 'The user has no such tax return.')
    }

    if (taxReturn.taxYear !== body.taxYear) {
      throw new HttpError(
        400,
        'A filing state cannot be determined from the tax return.'
      )
    }

    const submissions = await this.repository.listReturnSubmissions(
      taxReturn.id
    )
    if (submissions.length === 0) {
      throw new HttpError(400, 'No Submissions found for the tax return.')
    }

    const authorizationCode = crypto.randomUUID()
    await this.artifacts.putJson(`state/auth/${authorizationCode}.json`, {
      authorizationCode,
      taxReturnId: taxReturn.id,
      taxYear: taxReturn.taxYear,
      userId: user.id,
      submissionId: submissions[0].id,
      createdAt: nowIso()
    })

    return {
      authorizationCode
    }
  }

  getStateProfile(stateCode: string) {
    const profile = resolveStateProfile(this.env, stateCode)
    if (!profile) {
      return {
        stateProfile: null,
        error: `Unsupported state profile for ${stateCode}`
      }
    }
    return {
      stateProfile: profile,
      error: null
    }
  }

  async getStateExportedFacts(
    submissionId: string,
    stateCode: string,
    accountId: string
  ) {
    const submission = await this.repository.getSubmission(submissionId)
    if (!submission) {
      throw new HttpError(404, 'Submission not found')
    }

    const payload = await this.artifacts.getJson<SubmissionPayload>(
      submission.payloadKey
    )
    if (!payload) {
      throw new HttpError(404, 'Submission payload not found')
    }

    return {
      exportedFacts: {
        submissionId,
        taxYear: payload.taxYear,
        filingStatus: payload.filingStatus,
        stateCode: stateCode.toUpperCase(),
        accountId,
        form1040: payload.form1040 ?? null,
        forms: payload.forms ?? {},
        metadata: payload.metadata ?? {}
      }
    }
  }

  async getInternalTaxReturnStatus(
    taxFilingYear: number,
    taxReturnId: string,
    submissionId: string
  ) {
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn || taxReturn.taxYear !== taxFilingYear) {
      throw new HttpError(404, 'Tax return not found')
    }

    const submission = await this.repository.getSubmission(submissionId)
    if (!submission || submission.taxReturnId !== taxReturnId) {
      throw new HttpError(404, 'Submission not found')
    }

    return toDirectFileStatus(submission.status)
  }

  private toSubmissionPayload(
    facts: DirectFileFacts,
    taxReturn: {
      taxYear: number
      filingStatus: string
      ownerTin?: string
      formType?: ReturnFormType
    },
    user: DirectFileUserContext
  ): SubmissionPayload {
    const taxYear = extractTaxYearFromFacts(facts) ?? taxReturn.taxYear
    const filingStatus =
      extractFilingStatusFromFacts(facts) ?? taxReturn.filingStatus ?? 'single'
    const primaryTIN =
      extractPrimaryTinFromFacts(facts) ??
      taxReturn.ownerTin ??
      user.tin ??
      undefined
    const formType =
      extractFormTypeFromFacts(facts) ?? taxReturn.formType ?? undefined
    const stateCode = extractStateCodeFromFacts(facts) ?? undefined

    return {
      taxYear,
      filingStatus,
      primaryTIN,
      formType,
      metadata: {
        source: 'direct-file-compat',
        stateCode
      }
    }
  }

  private async toTaxReturnResponseBody(taxReturnId: string) {
    const taxReturn = await this.repository.getTaxReturn(taxReturnId)
    if (!taxReturn) {
      throw new HttpError(404, `Tax return ${taxReturnId} not found`)
    }

    const facts =
      (await this.artifacts.getJson<DirectFileFacts>(taxReturn.factsKey)) ?? {}
    const submissions = await this.repository.listReturnSubmissions(
      taxReturn.id
    )

    return {
      id: taxReturn.id,
      createdAt: taxReturn.createdAt,
      taxYear: taxReturn.taxYear,
      facts,
      store: 'cloudflare',
      taxReturnSubmissions: submissions.map((submission) =>
        toTaxReturnSubmissionResponse(submission, taxReturn.ownerId)
      ),
      isEditable: isEditableStatus(taxReturn.currentStatus),
      populatedData: {
        data: Object.entries(facts).map(([path, value]) => ({
          path,
          value
        }))
      },
      dataImportBehavior: 'ON_DEMAND',
      surveyOptIn: null
    }
  }

  private assertFactsValid(facts: DirectFileFacts): void {
    const issues = validateDirectFileFacts(facts)
    if (issues.length === 0) {
      return
    }

    const first = issues[0]
    throw new HttpError(
      400,
      `Invalid request data. ${first.path}: ${first.message}`
    )
  }
}
