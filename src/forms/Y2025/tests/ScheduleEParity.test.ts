import { cloneDeep } from 'lodash'
import { FilingStatus, Income1099Type, PersonRole } from 'ustaxes/core/data'
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
        address: '0001 Main St',
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
      dateOfBirth: new Date('1970-01-01'),
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

describe('Schedule E parity improvements', () => {
  it('flows 1099-MISC royalties and royalty expenses through Schedule E', () => {
    const information = cloneDeep(baseInformation)
    information.f1099s = [
      {
        payer: 'Creative Royalty House',
        type: Income1099Type.MISC,
        personRole: PersonRole.PRIMARY,
        form: {
          royalties: 3200
        }
      } as never
    ]
    information.scheduleEPage2 = {
      royaltyExpenses: 700
    }

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleE.isNeeded()).toBe(true)
    expect(f1040.scheduleE.l4()).toEqual([3200, undefined, undefined])
    expect(f1040.scheduleE.royaltyExpenses()).toBe(700)
    expect(f1040.scheduleE.l20()).toEqual([700, undefined, undefined])
    expect(f1040.scheduleE.l24()).toBe(2500)
    expect(f1040.scheduleE.l25()).toBe(0)
    expect(f1040.scheduleE.l41()).toBe(2500)
  })

  it('includes page 2 trust, REMIC, and farm rental branches in the total', () => {
    const information = cloneDeep(baseInformation)
    information.scheduleEPage2 = {
      estateTrustIncomeLoss: 900,
      remicIncomeLoss: -150,
      farmRentalIncomeLoss: 400
    }

    const f1040 = new F1040(information, [])

    expect(f1040.scheduleE.isNeeded()).toBe(true)
    expect(f1040.scheduleE.l37()).toBe(900)
    expect(f1040.scheduleE.l39()).toBe(-150)
    expect(f1040.scheduleE.l40()).toBe(400)
    expect(f1040.scheduleE.l41()).toBe(1150)
  })
})
