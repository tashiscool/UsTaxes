import { cloneDeep } from 'lodash'
import { FilingStatus, Income1099Type, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040 from '../irsForms/F1040'
import F8949 from '../irsForms/F8949'

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

describe('Form 8949 parity improvements', () => {
  it('renders broker summary rows on reported-basis pages and fee-adjusted asset rows on continuation pages', () => {
    const information = cloneDeep(baseInformation)
    information.f1099s = [
      {
        payer: 'Broker Summary',
        type: Income1099Type.B,
        personRole: PersonRole.PRIMARY,
        form: {
          shortTermProceeds: 1200,
          shortTermCostBasis: 900,
          longTermProceeds: 4000,
          longTermCostBasis: 2500
        }
      } as never
    ]

    const assets = [
      {
        name: 'WidgetCo',
        positionType: 'Security',
        openDate: new Date('2025-01-10'),
        closeDate: new Date('2025-04-12'),
        openPrice: 100,
        openFee: 5,
        closePrice: 150,
        closeFee: 7,
        quantity: 10
      }
    ] as never

    const f1040 = new F1040(information, assets)
    const reportedPage = new F8949(f1040, 0)
    const assetPage = new F8949(f1040, 1)

    expect(reportedPage.part1BoxA()).toBe(true)
    expect(reportedPage.part1BoxC()).toBe(false)
    expect(reportedPage.part2BoxD()).toBe(true)
    expect(reportedPage.part2BoxF()).toBe(false)
    expect(reportedPage.copies()).toHaveLength(1)
    expect(reportedPage.shortTermSales()[0]).toMatchObject({
      description: 'Broker Summary',
      proceeds: 1200,
      costBasis: 900,
      gainLoss: 300
    })
    expect(reportedPage.longTermSales()[0]).toMatchObject({
      description: 'Broker Summary',
      proceeds: 4000,
      costBasis: 2500,
      gainLoss: 1500
    })
    expect(reportedPage.shortTermTotalGain()).toBe(300)
    expect(reportedPage.longTermTotalGain()).toBe(1500)

    expect(assetPage.part1BoxA()).toBe(false)
    expect(assetPage.part1BoxC()).toBe(true)
    expect(assetPage.part2BoxD()).toBe(false)
    expect(assetPage.part2BoxF()).toBe(true)
    expect(assetPage.shortTermSales()[0]).toMatchObject({
      description: 'WidgetCo',
      proceeds: 1493,
      costBasis: 1005,
      gainLoss: 488
    })
    expect(assetPage.shortTermTotalProceeds()).toBe(1493)
    expect(assetPage.shortTermTotalCost()).toBe(1005)
    expect(assetPage.shortTermTotalGain()).toBe(488)
  })
})
