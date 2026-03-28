import { cloneDeep } from 'lodash'
import { FilingStatus, PersonRole, type HealthInsuranceMarketplaceInfo } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [
    {
      employer: { EIN: '111111111', employerName: 'Employer' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'AL',
      income: 48000,
      medicareIncome: 48000,
      fedWithholding: 4200,
      ssWages: 48000,
      ssWithholding: 2976,
      medicareWithholding: 696,
      stateWages: 48000,
      stateWithholding: 0
    }
  ],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: '1 Main St',
        aptNo: '',
        city: 'Little Rock',
        state: 'AR',
        zip: '72201'
      },
      firstName: 'Taylor',
      lastName: 'Payer',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '111111111',
      dateOfBirth: new Date('1990-01-01'),
      isBlind: false
    },
    spouse: undefined,
    dependents: [],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'AL' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

const buildPolicy = (
  overrides: Partial<HealthInsuranceMarketplaceInfo<Date>>
): HealthInsuranceMarketplaceInfo<Date> => ({
  policyNumber: 'POLICY-1',
  coverageStartDate: new Date('2025-01-01'),
  coverageEndDate: new Date('2025-12-31'),
  enrollmentPremiums: Array(12).fill(0),
  slcsp: Array(12).fill(0),
  advancePayments: Array(12).fill(0),
  coverageFamily: 1,
  ...overrides
})

describe('F8962', () => {
  it('sums overlapping monthly amounts across multiple marketplace policies', () => {
    const information = cloneDeep(baseInformation)
    information.healthInsuranceMarketplace = [
      buildPolicy({
        policyNumber: 'POLICY-A',
        enrollmentPremiums: [300, ...Array(11).fill(0)],
        slcsp: [250, ...Array(11).fill(0)],
        advancePayments: [120, ...Array(11).fill(0)]
      }),
      buildPolicy({
        policyNumber: 'POLICY-B',
        enrollmentPremiums: [200, ...Array(11).fill(0)],
        slcsp: [150, ...Array(11).fill(0)],
        advancePayments: [80, ...Array(11).fill(0)]
      })
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f8962?.l11(1)).toBe(500)
    expect(f1040.f8962?.l12(1)).toBe(400)
    expect(f1040.f8962?.l16(1)).toBe(200)
    expect(f1040.f8962?.totalEnrollmentPremiums()).toBe(500)
    expect(f1040.f8962?.totalSlcsp()).toBe(400)
    expect(f1040.f8962?.totalAptc()).toBe(200)
  })

  it('applies shared-policy allocation percentages before monthly reconciliation totals', () => {
    const information = cloneDeep(baseInformation)
    information.healthInsuranceMarketplace = [
      buildPolicy({
        policyNumber: 'SHARED-1',
        enrollmentPremiums: [600, ...Array(11).fill(0)],
        slcsp: [500, ...Array(11).fill(0)],
        advancePayments: [300, ...Array(11).fill(0)],
        sharedPolicyAllocation: 50
      })
    ]

    const f1040 = new F1040(information, [])

    expect(f1040.f8962?.l11(1)).toBe(300)
    expect(f1040.f8962?.l12(1)).toBe(250)
    expect(f1040.f8962?.l16(1)).toBe(150)
    expect(f1040.f8962?.totalEnrollmentPremiums()).toBe(300)
    expect(f1040.f8962?.totalSlcsp()).toBe(250)
    expect(f1040.f8962?.totalAptc()).toBe(150)
  })
})
