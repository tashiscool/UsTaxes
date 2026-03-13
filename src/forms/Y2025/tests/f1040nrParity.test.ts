import { cloneDeep } from 'lodash'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: '123 Overseas Drive',
        aptNo: '',
        city: 'London',
        state: 'CA',
        zip: '94105'
      },
      firstName: 'Genesis',
      lastName: 'DeSilva',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '123013333',
      dateOfBirth: new Date('1978-11-15'),
      isBlind: false
    },
    spouse: undefined,
    dependents: [],
    filingStatus: FilingStatus.S
  },
  questions: {},
  f1098es: [],
  stateResidencies: [{ state: 'CA' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

describe('Form 1040-NR parity', () => {
  it('computes ECI tax, FDAP tax, and refund flow for a nonresident return', () => {
    const information = cloneDeep(baseInformation)
    information.nonresidentAlienReturn = {
      nonresidentInfo: {
        countryOfCitizenship: 'GB',
        countryOfResidence: 'GB',
        visaType: 'H1B',
        dateEnteredUS: new Date('2025-01-15'),
        daysInUSThisYear: 120,
        daysInUSPriorYear: 60,
        daysInUS2YearsPrior: 30,
        claimsTaxTreaty: false,
        hasEffectivelyConnectedIncome: true,
        hasFDAPIncome: true,
        fdapIncome: {
          dividends: 1000,
          interest: 0,
          rents: 0,
          royalties: 500,
          gambling: 0,
          socialSecurity: 0,
          capitalGains: 0,
          otherIncome: 0
        }
      },
      effectivelyConnectedIncome: {
        wages: 150000,
        businessIncome: 10000,
        capitalGains: 5000,
        rentalIncome: 0,
        partnershipIncome: 0,
        otherIncome: 0
      },
      itemizedDeductions: {
        stateTaxes: 6000,
        charitableContributions: 4000,
        casualtyLosses: 0,
        otherDeductions: 0
      },
      taxWithheld: 35000,
      estimatedTaxPayments: 0
    }

    const f1040 = new F1040(information, [])
    const f1040nr = f1040.f1040nr

    expect(f1040nr.isNeeded()).toBe(true)
    expect(f1040nr.totalEffectivelyConnectedIncome()).toBe(165000)
    expect(f1040nr.totalFDAPIncome()).toBe(1500)
    expect(f1040nr.totalItemizedDeductions()).toBe(10000)
    expect(f1040nr.taxableIncome()).toBe(155000)
    expect(f1040nr.eciTax()).toBe(30047)
    expect(f1040nr.fdapTax()).toBe(450)
    expect(f1040nr.totalTax()).toBe(30497)
    expect(f1040nr.totalPayments()).toBe(35000)
    expect(f1040nr.refund()).toBe(4503)
    expect(f1040nr.amountOwed()).toBe(0)
  })

  it('avoids negative treaty FDAP rates when benefit exceeds flat-tax amount', () => {
    const information = cloneDeep(baseInformation)
    information.nonresidentAlienReturn = {
      nonresidentInfo: {
        countryOfCitizenship: 'IN',
        countryOfResidence: 'IN',
        visaType: 'F1',
        dateEnteredUS: new Date('2025-01-15'),
        daysInUSThisYear: 120,
        claimsTaxTreaty: true,
        treatyCountry: 'IN',
        treatyArticle: '21',
        treatyBenefitAmount: 1000,
        hasEffectivelyConnectedIncome: false,
        hasFDAPIncome: true,
        fdapIncome: {
          dividends: 500,
          interest: 0,
          rents: 0,
          royalties: 0,
          gambling: 0,
          socialSecurity: 0,
          capitalGains: 0,
          otherIncome: 0
        }
      },
      effectivelyConnectedIncome: {
        wages: 0,
        businessIncome: 0,
        capitalGains: 0,
        rentalIncome: 0,
        partnershipIncome: 0,
        otherIncome: 0
      },
      taxWithheld: 0,
      estimatedTaxPayments: 0
    }

    const f1040 = new F1040(information, [])
    const f1040nr = f1040.f1040nr

    expect(f1040nr.fdapTaxRate()).toBe(0)
    expect(f1040nr.fdapTax()).toBe(0)
  })

  it('uses explicit treaty rates and excludes treaty-exempt scholarship from ECI', () => {
    const information = cloneDeep(baseInformation)
    information.nonresidentAlienReturn = {
      nonresidentInfo: {
        countryOfCitizenship: 'CN',
        countryOfResidence: 'CN',
        visaType: 'F1',
        dateEnteredUS: new Date('2025-01-15'),
        daysInUSThisYear: 120,
        claimsTaxTreaty: true,
        treatyCountry: 'CN',
        treatyArticle: '20',
        reducedTreatyRate: 0.1,
        hasEffectivelyConnectedIncome: true,
        hasFDAPIncome: true,
        fdapIncome: {
          dividends: 1000,
          interest: 500,
          rents: 0,
          royalties: 0,
          gambling: 0,
          socialSecurity: 0,
          capitalGains: 0,
          otherIncome: 0
        }
      },
      effectivelyConnectedIncome: {
        wages: 0,
        businessIncome: 0,
        scholarshipIncome: 5000,
        treatyExemptScholarship: 5000,
        capitalGains: 0,
        rentalIncome: 0,
        partnershipIncome: 0,
        otherIncome: 24000
      },
      taxWithheld: 0,
      estimatedTaxPayments: 0
    }

    const f1040 = new F1040(information, [])
    const f1040nr = f1040.f1040nr

    expect(f1040nr.eciScholarshipIncome()).toBe(5000)
    expect(f1040nr.treatyExemptScholarship()).toBe(5000)
    expect(f1040nr.taxableScholarshipIncome()).toBe(0)
    expect(f1040nr.totalEffectivelyConnectedIncome()).toBe(24000)
    expect(f1040nr.eciTax()).toBe(2645)
    expect(f1040nr.fdapTaxRate()).toBe(0.1)
    expect(f1040nr.fdapTax()).toBe(150)
  })
})
