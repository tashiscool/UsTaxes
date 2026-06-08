import { describe, expect, it } from 'vitest'

import type { Env } from '../../src/domain/env'
import { ApiService } from '../../src/services/apiService'
import { AppSessionService } from '../../src/services/appSessionService'
import {
  asQueue,
  InMemoryArtifactStore,
  InMemoryQueue,
  InMemoryTaxRepository
} from '../support/inMemoryAdapters'

class FakeD1Database {
  constructor(
    readonly filingSession: Record<string, unknown>,
    readonly entityRows: Array<Record<string, unknown>>
  ) {}

  prepare(sql: string) {
    return new FakeD1Statement(this, sql)
  }
}

class FakeD1Statement {
  private values: unknown[] = []

  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string
  ) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async first<T>() {
    if (this.sql.includes('FROM filing_sessions')) {
      const [id, userId] = this.values
      if (
        this.db.filingSession.id === id &&
        this.db.filingSession.user_id === userId
      ) {
        return this.db.filingSession as T
      }
    }
    return null
  }

  async all<T>() {
    if (this.sql.includes('FROM session_entities')) {
      const [sessionId] = this.values
      return {
        results: this.db.entityRows.filter(
          (row) => row.filing_session_id === sessionId
        ) as T[]
      }
    }
    return { results: [] as T[] }
  }

  async run() {
    if (
      this.sql.includes('UPDATE filing_sessions') &&
      this.sql.includes('estimated_refund')
    ) {
      const [estimatedRefund, updatedAt, sessionId] = this.values
      if (this.db.filingSession.id === sessionId) {
        this.db.filingSession.estimated_refund = estimatedRefund
        this.db.filingSession.updated_at = updatedAt
      }
    }
    if (
      this.sql.includes('UPDATE filing_sessions') &&
      this.sql.includes('tax_return_id')
    ) {
      const [taxReturnId, factsKey, updatedAt, sessionId] = this.values
      if (this.db.filingSession.id === sessionId) {
        this.db.filingSession.tax_return_id = taxReturnId
        this.db.filingSession.facts_key = factsKey
        this.db.filingSession.updated_at = updatedAt
      }
    }
    return { success: true, results: [] }
  }
}

describe('AppSessionService frontend gap entity mapping', () => {
  it('turns saved frontend gap entities into computation facts', async () => {
    const sessionId = 'session-gap-mapping'
    const user = {
      sub: 'user-gap-mapping',
      email: 'gap@example.test',
      tin: '123456789',
      exp: Math.floor(Date.now() / 1000) + 3600
    }
    const now = '2026-06-08T00:00:00.000Z'
    const snapshotKey = `filing-sessions/${sessionId}/snapshot.json`
    const snapshot = {
      name: 'Gap mapping session',
      taxYear: 2025,
      filingStatus: 'single',
      formType: '1040',
      currentPhase: 'review',
      completionPct: 80,
      completedScreens: [],
      checklistState: {},
      entities: {},
      screenData: {
        '/taxpayer-profile': {
          firstName: 'Pat',
          lastName: 'Filer',
          ssn: '123-45-6789',
          filingStatus: 'single',
          address: { state: 'AK' }
        },
        '/residency': { state: 'AK' },
        '/efile-wizard': {},
        '/w2': {},
        '/1099': { records: [] }
      }
    }
    const filingSession = {
      id: sessionId,
      user_id: user.sub,
      local_session_id: null,
      tax_year: 2025,
      filing_status: 'single',
      form_type: '1040',
      lifecycle_status: 'draft',
      name: snapshot.name,
      current_phase: 'review',
      last_screen: null,
      completion_pct: 80,
      estimated_refund: null,
      tax_return_id: null,
      latest_submission_id: null,
      metadata_key: snapshotKey,
      facts_key: null,
      created_at: now,
      updated_at: now
    }
    const entityInputs: Array<{
      entityType: string
      entityKey: string
      label?: string
      data: Record<string, unknown>
    }> = [
      {
        entityType: 'payments_estimates_hub',
        entityKey: 'payments',
        data: {
          federalEstimatedTaxPayments: 1200,
          amountPaidWithExtension: 300,
          otherFederalWithholdings: [
            { source: 'Backup withholding', amount: 75 }
          ],
          applyFederalOverpayment: true,
          applyFederalOverpaymentAmount: 45
        }
      },
      {
        entityType: '1099_oid',
        entityKey: 'oid-1',
        data: {
          payerName: 'OID Bank',
          originalIssueDiscount: 100,
          secondaryAmount: 25,
          federalTaxWithheld: 10
        }
      },
      {
        entityType: '1099_c',
        entityKey: 'c-1',
        data: {
          payerName: 'Debt Co',
          amountOfDebtCancelled: 2000,
          totalExcludedFromGrossIncome: 500
        }
      },
      {
        entityType: '1099_ltc',
        entityKey: 'ltc-1',
        data: {
          payerName: 'LTC Co',
          grossBenefitsPaid: 6000,
          acceleratedDeathBenefits: 100,
          benefitsPaidOnPerDiemBasis: true,
          qualifiedContract: true,
          statusOfInsured: 'chronically_ill'
        }
      },
      {
        entityType: 'clean_vehicle_credit',
        entityKey: 'vehicle-1',
        data: {
          vin: '1FTVW1EL0PW000001',
          make: 'Ford',
          model: 'F-150 Lightning',
          year: 2025,
          purchaseDate: '2025-03-01',
          purchasePrice: 56000,
          newOrUsed: 'new',
          batteryKwh: 98,
          estimatedCredit: 7500
        }
      },
      {
        entityType: 'alaska_pfd',
        entityKey: 'pfd',
        data: {
          pfdAmount: 1702,
          numberOfRecipients: 2
        }
      },
      {
        entityType: 'aca_household_income',
        entityKey: 'aca-household',
        data: {
          dependentAgi: 1000,
          dependentTaxExemptInterest: 50,
          dependentForeignIncomeAdjustment: 25,
          dependentLine6Difference: 75
        }
      },
      {
        entityType: 'local_tax_obligation',
        entityKey: 'local-va',
        data: {
          state: 'VA',
          stateWithheld: 20,
          estimatedPayments: 30
        }
      },
      {
        entityType: 'state_va_classic',
        entityKey: 'va',
        data: {
          residencyType: 'resident'
        }
      },
      {
        entityType: 'misc_forms_hub',
        entityKey: 'misc',
        data: {
          filed4868: true,
          hasForm8857: true
        }
      },
      {
        entityType: 'other_taxes_hub',
        entityKey: 'other-taxes',
        data: {
          hasForm5329: true,
          hasForm8828: true
        }
      }
    ]

    const artifacts = new InMemoryArtifactStore()
    await artifacts.putJson(snapshotKey, snapshot)

    const entityRows = await Promise.all(
      entityInputs.map(async (entity) => {
        const dataKey = `filing-sessions/${sessionId}/entities/${entity.entityType}/${entity.entityKey}.json`
        await artifacts.putJson(dataKey, entity.data)
        return {
          id: `${sessionId}:${entity.entityType}:${entity.entityKey}`,
          filing_session_id: sessionId,
          entity_type: entity.entityType,
          entity_key: entity.entityKey,
          status: 'complete',
          label: entity.label ?? null,
          data_key: dataKey,
          created_at: now,
          updated_at: now
        }
      })
    )

    const repository = new InMemoryTaxRepository()
    const apiService = new ApiService(
      repository,
      artifacts,
      asQueue(new InMemoryQueue())
    )
    const service = new AppSessionService(
      {
        USTAXES_DB: new FakeD1Database(filingSession, entityRows),
        ARTIFACTS_BUCKET: { get: async () => null, put: async () => undefined }
      } as unknown as Env,
      repository,
      artifacts,
      apiService
    )

    const result = await service.syncReturn(sessionId, user)
    const facts = result.facts

    expect(facts.estimatedTaxPayments).toEqual([
      { label: 'Federal estimated tax payments', payment: 1200 }
    ])
    expect(facts.extensionPayment).toBe(300)
    expect(facts.appliedToNextYearEstimatedTax).toBe(45)
    expect(facts.otherFederalWithholdingCredits).toEqual([
      {
        source: 'other',
        amount: 75,
        description: 'Backup withholding'
      }
    ])

    const records = facts.form1099Records as Array<Record<string, unknown>>
    expect(records.find((record) => record.type === '1099-OID')).toMatchObject({
      payer: 'OID Bank',
      originalIssueDiscount: 100,
      secondaryAmount: 25,
      amount: 125,
      federalWithheld: 10
    })
    expect(records.find((record) => record.type === '1099-C')).toMatchObject({
      payer: 'Debt Co',
      amountOfDebtCancelled: 2000,
      totalExcludedFromGrossIncome: 500
    })
    expect(records.find((record) => record.type === '1099-LTC')).toMatchObject({
      payer: 'LTC Co',
      grossBenefitsPaid: 6000,
      acceleratedDeathBenefits: 100,
      benefitsPaidOnPerDiemBasis: true,
      qualifiedContract: true,
      statusOfInsured: 'chronically_ill'
    })

    expect(facts.cleanVehicleCredits).toEqual([
      expect.objectContaining({
        vin: '1FTVW1EL0PW000001',
        estimatedCredit: 7500
      })
    ])
    expect(facts.otherIncomeItems).toEqual([
      { description: 'Alaska Permanent Fund Dividend', amount: 3404 }
    ])
    expect(facts.acaHouseholdIncome).toEqual({
      dependentAgi: 1000,
      dependentTaxExemptInterest: 50,
      dependentForeignIncomeAdjustment: 25,
      dependentLine6Difference: 75
    })
    expect(facts.localTaxInfo).toMatchObject({
      residenceState: 'VA',
      localWithholding: 20,
      estimatedPayments: 30
    })
    expect(
      (
        (facts['/filerResidenceAndIncomeState'] as Record<string, unknown>)
          .item as Record<string, unknown>
      ).value
    ).toEqual(['va'])
    expect(facts.computationSupportReport).toEqual(
      expect.arrayContaining([
        {
          entityType: 'hasForm5329',
          item: 'Form 5329',
          status: 'computed'
        },
        {
          entityType: 'hasForm8828',
          item: 'Form 8828',
          status: 'metadata_only'
        },
        {
          entityType: 'filed4868',
          item: 'Form 4868',
          status: 'dedicated_screen_required'
        },
        {
          entityType: 'hasForm8857',
          item: 'Form 8857',
          status: 'metadata_only'
        }
      ])
    )
  })
})
