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
        address: '100 Main St',
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
  stateResidencies: [{ state: 'AR' }],
  healthSavingsAccounts: [],
  individualRetirementArrangements: []
}

describe('990-family rendered parity', () => {
  it('renders Form 990 totals and governance outputs from explicit nonprofit data', () => {
    const information = cloneDeep(baseInformation)
    information.exemptOrgReturn = {
      organization: {
        name: 'Community Health Foundation',
        ein: '12-3456789',
        address: '10 Charity Plaza',
        city: 'Austin',
        state: 'TX',
        zip: '73301',
        website: 'https://communityhealth.example',
        yearFormed: 2002,
        stateOfIncorporation: 'TX',
        exemptionType: '501c3'
      },
      fiscalYearStart: new Date('2025-01-01'),
      fiscalYearEnd: new Date('2025-12-31'),
      isFinalReturn: false,
      isAmendedReturn: false,
      isGroupReturn: false,
      revenue: {
        contributions: 200000,
        programServiceRevenue: 120000,
        membershipDues: 5000,
        investmentIncome: 7000,
        grossRents: 10000,
        netRentalIncome: 8000,
        grossSalesOfAssets: 2000,
        netGainFromSales: 1500,
        fundraisingEvents: 2500,
        grossSalesOfInventory: 0,
        otherRevenue: 4000
      },
      expenses: {
        grants: 60000,
        benefitsPaid: 5000,
        salariesAndWages: 80000,
        employeeBenefits: 12000,
        payrollTaxes: 6000,
        managementFees: 4000,
        legalFees: 3000,
        accountingFees: 2000,
        lobbyingExpenses: 0,
        professionalFundraising: 5000,
        advertising: 2500,
        officeExpenses: 7000,
        informationTechnology: 3000,
        occupancy: 10000,
        travel: 4000,
        conferences: 2000,
        interest: 1000,
        depreciation: 3500,
        insurance: 2500,
        otherExpenses: 6000
      },
      balanceSheet: {
        cashNonInterest: 50000,
        savingsAndInvestments: 90000,
        pledgesReceivable: 10000,
        accountsReceivable: 15000,
        loansReceivable: 5000,
        inventories: 2000,
        prepaidExpenses: 3000,
        landBuildingsEquipment: 120000,
        investments: 75000,
        intangibleAssets: 5000,
        otherAssets: 8000,
        accountsPayable: 18000,
        grantsPayable: 12000,
        deferredRevenue: 10000,
        taxExemptBonds: 25000,
        mortgages: 30000,
        otherLiabilities: 6000,
        unrestrictedNetAssets: 220000,
        temporarilyRestricted: 80000,
        permanentlyRestricted: 20000
      },
      governance: {
        numberOfVotingMembers: 9,
        numberOfIndependentMembers: 7,
        totalEmployees: 18,
        totalVolunteers: 55,
        hasWrittenConflictPolicy: true,
        hasDocumentRetentionPolicy: true,
        hasWhistleblowerPolicy: true,
        hasCompensationProcess: true
      },
      missionStatement: 'Expand community health access',
      programAccomplishments: ['Expanded rural clinic hours']
    }

    const f1040 = new F1040(information, [])
    const f990 = f1040.f990

    expect(f990?.isNeeded()).toBe(true)
    expect(f990?.l12()).toBe(348000)
    expect(f990?.l18()).toBe(212500)
    expect(f990?.l19()).toBe(135500)
    expect(f990?.l21()).toBe(383000)
    expect(f990?.l22()).toBe(101000)
    expect(f990?.netAssets()).toBe(320000)
    expect(f990?.numberOfVotingMembers()).toBe(9)
    expect(f990?.programEfficiencyRatio()).toBe(85)

    const fields = f990?.fields() ?? []
    expect(fields[0]).toBe('Community Health Foundation')
    expect(fields[1]).toBe('12-3456789')
    expect(fields[8]).toBe(
      (information.exemptOrgReturn as { fiscalYearStart: Date }).fiscalYearStart.toLocaleDateString()
    )
    expect(fields[16]).toBe(348000)
    expect(fields[23]).toBe(135500)
    expect(fields[24]).toBe(383000)
    expect(fields[25]).toBe(101000)
    expect(fields[26]).toBe(320000)
  })

  it('renders Form 990-EZ totals, balance-sheet outputs, and eligibility', () => {
    const information = cloneDeep(baseInformation)
    information.exemptOrgReturnEZ = {
      orgName: 'Friends of the Public Library',
      ein: '98-7654321',
      address: '20 Reading Way',
      city: 'Madison',
      state: 'WI',
      zip: '53703',
      website: 'https://libraryfriends.example',
      exemptionType: '501(c)(4)',
      fiscalYearStart: new Date('2025-01-01'),
      fiscalYearEnd: new Date('2025-12-31'),
      isFinalReturn: false,
      isAmendedReturn: false,
      contributions: 90000,
      programServiceRevenue: 35000,
      membershipDues: 10000,
      investmentIncome: 5000,
      saleOfAssets: 2500,
      specialEventsGross: 12000,
      specialEventsExpenses: 4000,
      otherRevenue: 3000,
      grantsAndSimilar: 20000,
      benefitsPaid: 0,
      salariesAndCompensation: 45000,
      professionalFees: 5000,
      occupancy: 6000,
      printing: 3000,
      otherExpenses: 7000,
      beginningCash: 45000,
      endingCash: 55000,
      beginningLandBuildings: 70000,
      endingLandBuildings: 68000,
      beginningOtherAssets: 12000,
      endingOtherAssets: 15000,
      beginningLiabilities: 10000,
      endingLiabilities: 12000,
      primaryExemptPurpose: 'Support public library services',
      programAccomplishments: [
        {
          description: 'Funded literacy programs',
          expenses: 22000,
          grants: 5000
        }
      ],
      officers: [
        {
          name: 'Jordan Smith',
          title: 'Treasurer',
          hoursPerWeek: 10,
          compensation: 0
        }
      ]
    }

    const f1040 = new F1040(information, [])
    const f990ez = f1040.f990ez

    expect(f990ez?.isNeeded()).toBe(true)
    expect(f990ez?.l9()).toBe(153500)
    expect(f990ez?.l17()).toBe(86000)
    expect(f990ez?.l18()).toBe(67500)
    expect(f990ez?.l19()).toBe(117000)
    expect(f990ez?.l21()).toBe(126000)
    expect(f990ez?.totalAssetsBOY()).toBe(127000)
    expect(f990ez?.totalAssetsEOY()).toBe(138000)
    expect(f990ez?.isEligible()).toBe(true)

    const fields = f990ez?.fields() ?? []
    expect(fields[0]).toBe('Friends of the Public Library')
    expect(fields[1]).toBe('98-7654321')
    expect(fields[19]).toBe(153500)
    expect(fields[27]).toBe(86000)
    expect(fields[28]).toBe(67500)
    expect(fields[29]).toBe(117000)
    expect(fields[30]).toBe(126000)
    expect(fields[36]).toBe(138000)
    expect(fields[39]).toBe('Support public library services')
    expect(fields[40]).toBe('Funded literacy programs')
    expect(fields[42]).toBe('Jordan Smith')
  })

  it('renders Form 990-N identity and eligibility outputs from explicit e-postcard data', () => {
    const information = cloneDeep(baseInformation)
    information.exemptOrgReturnN = {
      organizationName: 'Neighborhood Arts Collective',
      doingBusinessAs: 'Arts Collective',
      ein: '55-1111111',
      mailingAddress: {
        street: '30 Arts Ave',
        city: 'Providence',
        state: 'RI',
        zip: '02903',
        country: 'United States'
      },
      principalOfficerName: 'Morgan Lee',
      principalOfficerAddress: {
        street: '31 Arts Ave',
        city: 'Providence',
        state: 'RI',
        zip: '02903'
      },
      websiteAddress: 'https://artscollective.example',
      taxYearBeginning: new Date('2025-01-01'),
      taxYearEnding: new Date('2025-12-31'),
      grossReceiptsNormally50kOrLess: true,
      hasTerminated: false
    }

    const f1040 = new F1040(information, [])
    const f990n = f1040.f990n

    expect(f990n?.isNeeded()).toBe(true)
    expect(f990n?.isEligibleForEPostcard()).toBe(true)
    expect(f990n?.organizationName()).toBe('Neighborhood Arts Collective')
    expect(f990n?.mailingAddress()).toBe(
      '30 Arts Ave, Providence, RI 02903'
    )
    expect(f990n?.principalOfficerName()).toBe('Morgan Lee')
    expect(f990n?.websiteAddress()).toBe('https://artscollective.example')
    expect(f990n?.isValid()).toBe(true)

    const fields = f990n?.fields() ?? []
    expect(fields[0]).toBe('Neighborhood Arts Collective')
    expect(fields[1]).toBe('Arts Collective')
    expect(fields[2]).toBe('55-1111111')
    expect(fields[8]).toBe('Morgan Lee')
    expect(fields[13]).toBe('https://artscollective.example')
    expect(fields[16]).toBe(true)
    expect(fields[17]).toBe(50000)
    expect(fields[20]).toBe(true)
  })
})
