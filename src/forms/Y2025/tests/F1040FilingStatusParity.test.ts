import { cloneDeep } from 'lodash'

import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { run } from 'ustaxes/core/util'
import { validate, type ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'

const baseInformation: ValidatedInformation = {
  f1099s: [],
  f3921s: [],
  credits: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  w2s: [
    {
      employer: { EIN: '123456789', employerName: 'Employer Inc' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'CA',
      income: 60000,
      medicareIncome: 60000,
      fedWithholding: 0,
      ssWages: 60000,
      ssWithholding: 3720,
      medicareWithholding: 870,
      stateWages: 60000,
      stateWithholding: 0
    }
  ],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: {
    primaryPerson: {
      address: {
        address: '123 Main St',
        aptNo: '',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001'
      },
      firstName: 'Taylor',
      lastName: 'Filer',
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      ssid: '111223333',
      dateOfBirth: new Date('1988-01-01'),
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

describe('Form 1040 filing-status parity', () => {
  it('accepts HOH with a non-dependent-child qualifying-person override', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.filingStatus = FilingStatus.HOH
    information.taxPayer.headOfHouseholdQualifyingPerson = {
      firstName: 'Avery',
      lastName: 'Filer',
      relationship: 'child',
      isDependent: false,
      isQualifyingChildNotClaimedAsDependent: true
    }

    const errors = run(validate(information)).fold(
      (validationErrors) => validationErrors,
      () => []
    )

    expect(errors).toEqual([])
  })

  it('renders the qualifying widow(er) child name in the filing-status detail field', () => {
    const information = cloneDeep(baseInformation)
    information.taxPayer.filingStatus = FilingStatus.W
    information.taxPayer.qualifyingWidowChildName = 'Sam Filer'

    const validated = run(validate(information)).fold(
      (errors) => {
        throw new Error(
          `Expected validation to pass, received: ${errors.join(', ')}`
        )
      },
      (value) => value
    )

    const f1040 = new F1040(validated, [])
    expect(f1040.filingStatusDetailName()).toBe('Sam Filer')
  })
})
