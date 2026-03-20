import { cloneDeep } from 'lodash'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { Form1040Serializer } from 'ustaxes/efile/mef/serializer'
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
      employer: { EIN: '123456789', employerName: 'Employer Inc' },
      personRole: PersonRole.PRIMARY,
      occupation: 'Engineer',
      state: 'CA',
      income: 50000,
      medicareIncome: 50000,
      fedWithholding: 6000,
      ssWages: 50000,
      ssWithholding: 3100,
      medicareWithholding: 725,
      stateWages: 50000,
      stateWithholding: 1800
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
      lastName: 'Designee',
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

const serializerConfig = {
  taxYear: 2025,
  softwareId: 'USTAXES1',
  softwareVersion: '1.0.0',
  originatorEFIN: '123456',
  originatorType: 'OnlineFiler' as const,
  pinType: 'SelfSelectPIN' as const,
  primaryPIN: '12345',
  isTestSubmission: true
}

describe('Form 1040 third-party designee parity', () => {
  it('serializes third-party designee fields into the 1040 MeF payload', () => {
    const information = cloneDeep(baseInformation)
    information.thirdPartyDesignee = {
      authorizeDiscussion: true,
      name: 'Pat Helper',
      phone: '(415) 555-1212',
      pin: '54321'
    }

    const f1040 = new F1040(information, [])
    const serializer = new Form1040Serializer(f1040, serializerConfig)
    const xml = serializer.serialize()

    expect(xml).toContain('<ThirdPartyDesigneeInd>true</ThirdPartyDesigneeInd>')
    expect(xml).toContain('<ThirdPartyDesigneeNm>Pat Helper</ThirdPartyDesigneeNm>')
    expect(xml).toContain(
      '<ThirdPartyDesigneePhoneNum>4155551212</ThirdPartyDesigneePhoneNum>'
    )
    expect(xml).toContain('<ThirdPartyDesigneePIN>54321</ThirdPartyDesigneePIN>')
  })

  it('omits third-party designee nodes when no authorization is given', () => {
    const f1040 = new F1040(cloneDeep(baseInformation), [])
    const serializer = new Form1040Serializer(f1040, serializerConfig)
    const xml = serializer.serialize()

    expect(xml).not.toContain('ThirdPartyDesigneeInd')
    expect(xml).not.toContain('ThirdPartyDesigneeNm')
    expect(xml).not.toContain('ThirdPartyDesigneePhoneNum')
    expect(xml).not.toContain('ThirdPartyDesigneePIN')
  })
})
