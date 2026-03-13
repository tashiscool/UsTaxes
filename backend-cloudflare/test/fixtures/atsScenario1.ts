import type { SubmissionPayload } from '../../src/domain/types'

export const atsScenario1Payload: SubmissionPayload = {
  taxYear: 2025,
  primaryTIN: '400011032',
  filingStatus: 'single',
  form1040: {
    totalTax: 2974,
    totalPayments: 2713
  },
  forms: {
    W2: [{ employer: 'The Green Ladies' }, { employer: 'C&R' }],
    ScheduleH: { tax: 474.3 },
    Form5695: { credit: 1200 }
  },
  metadata: {
    scenario: 'ATS-1',
    taxpayer: 'Tara Black'
  }
}
