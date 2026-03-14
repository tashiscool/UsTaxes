/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-var-requires, @typescript-eslint/no-empty-function, @typescript-eslint/require-await */
import { TextDecoder, TextEncoder } from 'util'
import type { TransmitterConfig } from 'ustaxes/efile/mef/transmitter'
import type { SubmissionId } from 'ustaxes/efile/types/mefTypes'

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder
})

const { createTestTransmitter, EFileTransmitter } =
  require('ustaxes/efile/mef/transmitter') as typeof import('ustaxes/efile/mef/transmitter')

const buildTestConfig = (): TransmitterConfig => ({
  taxYear: '2025',
  isTest: true,
  mefConfig: {
    environment: 'ATS',
    endpoints: {
      loginUrl: 'https://la.www4.irs.gov/a2a/mef/login',
      submitUrl: 'https://la.www4.irs.gov/a2a/mef/submit',
      getAckUrl: 'https://la.www4.irs.gov/a2a/mef/getack',
      getStatusUrl: 'https://la.www4.irs.gov/a2a/mef/getstatus',
      getBulkAckUrl: 'https://la.www4.irs.gov/a2a/mef/getbulkack'
    },
    timeoutMs: 60000,
    connectionTimeoutMs: 30000,
    tlsConfig: {
      minVersion: 'TLSv1.2',
      certPath: '',
      keyPath: '',
      rejectUnauthorized: true
    },
    retryConfig: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504]
    },
    softwareId: 'USTAXES1',
    softwareVersion: '1.0.0',
    transmitterInfo: {
      etin: 'TEST1',
      efin: '000000',
      softwareId: 'USTAXES1',
      transmitterName: 'UsTaxes Test',
      credentials: {
        etin: 'TEST1',
        appPassword: '',
        certificate: {
          certificateData: '',
          format: 'PEM',
          expirationDate: new Date('2026-12-31'),
          serialNumber: '',
          subjectDN: '',
          issuerDN: ''
        },
        privateKey: ''
      }
    }
  }
})

describe('EFileTransmitter acknowledgment workflow', () => {
  it('accepts deterministically in test mode', async () => {
    const transmitter = createTestTransmitter('2025')

    const result = await transmitter.pollForAcknowledgment(
      'TEST1ACCEPT000001' as SubmissionId,
      1,
      1
    )

    expect(result.status).toBe('Accepted')
    expect(result.pending).toBe(false)
    expect(result.acknowledgment?.irsReceiptId).toMatch(/^IRS-/)
  })

  it('supports deterministic rejection mode', async () => {
    const transmitter = new EFileTransmitter({
      ...buildTestConfig(),
      simulatedAcknowledgment: {
        mode: 'reject',
        errorCode: 'R0000-507-01',
        errorMessage: 'Dependent TIN conflict'
      }
    })

    const result = await transmitter.pollForAcknowledgment(
      'TEST1REJECT000001' as SubmissionId,
      1,
      1
    )

    expect(result.status).toBe('Rejected')
    expect(result.pending).toBe(false)
    expect(result.acknowledgment?.errors?.[0]?.ruleNum).toBe('R0000-507-01')
    expect(result.acknowledgment?.errors?.[0]?.errorMessageTxt).toBe(
      'Dependent TIN conflict'
    )
  })

  it('uses a transport adapter when one is provided', async () => {
    const transmitter = new EFileTransmitter({
      ...buildTestConfig(),
      transportAdapter: {
        login: async () => {},
        getAcknowledgment: async (submissionId) => ({
          submissionId,
          status: 'Accepted',
          acceptanceStatusTxt: 'Adapter accepted the return',
          ackTs: new Date('2026-03-13T12:00:00.000Z').toISOString(),
          irsReceiptId: 'IRS-ADAPTER-1',
          taxYr: '2025',
          returnTypeCd: '1040'
        })
      }
    })

    const result = await transmitter.pollForAcknowledgment(
      'TEST1ADAPTER00001' as SubmissionId,
      1,
      1
    )

    expect(result.status).toBe('Accepted')
    expect(result.acknowledgment?.irsReceiptId).toBe('IRS-ADAPTER-1')
  })
})
