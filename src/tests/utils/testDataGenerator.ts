/**
 * Test Data Generator
 *
 * Generates synthetic test data with valid formats for use in
 * UsTaxes integration tests. Creates realistic tax scenarios
 * with deterministic, reproducible results.
 *
 * Features:
 * - Test SSNs (using 00 area number pattern for testing)
 * - W-2 scenarios at various income levels
 * - 1099 scenarios (INT, DIV, B, etc.)
 * - Multi-filer scenarios (MFJ with spouse)
 * - Expected result calculations
 */

import {
  Information,
  TaxPayer,
  PrimaryPerson,
  Spouse,
  Dependent,
  Address,
  FilingStatus,
  PersonRole,
  IncomeW2,
  Supported1099,
  Income1099Type,
  F1099IntData,
  F1099DivData,
  F1099BData,
  F1099SSAData,
  AccountType,
  Refund,
  State,
  Employer,
  StateResidency,
  EstimatedTaxPayments,
  F1098e,
  ItemizedDeductions,
  HealthSavingsAccount,
  Ira,
  IraPlanType
} from 'ustaxes/core/data'

// =============================================================================
// Random Number Generator with Seed
// =============================================================================

/**
 * Simple seeded pseudo-random number generator
 * Uses Mulberry32 algorithm for reproducibility
 */
class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed
  }

  /**
   * Generate random number between 0 and 1
   */
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /**
   * Generate random float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  /**
   * Pick random element from array
   */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)]
  }

  /**
   * Generate random boolean with given probability of true
   */
  nextBoolean(probability = 0.5): boolean {
    return this.next() < probability
  }
}

// =============================================================================
// Test SSN Generation
// =============================================================================

/**
 * Generate a test SSN using the 00 area number pattern
 * Real SSNs never start with 000, so these are safe for testing
 *
 * Format: 000-XX-XXXX where XX are deterministic based on index
 */
export function generateTestSSN(index: number): string {
  const groupNumber = Math.floor(index / 10000) % 100
  const serialNumber = index % 10000
  return `000${groupNumber.toString().padStart(2, '0')}${serialNumber
    .toString()
    .padStart(4, '0')}`
}

/**
 * Generate a test EIN using 00 prefix
 */
export function generateTestEIN(index: number): string {
  const suffix = index % 10000000
  return `00${suffix.toString().padStart(7, '0')}`
}

/**
 * Check if SSN is a test SSN (starts with 000)
 */
export function isTestSSN(ssn: string): boolean {
  return ssn.replace(/-/g, '').startsWith('000')
}

// =============================================================================
// Name and Address Generation
// =============================================================================

const firstNames = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Elizabeth',
  'David',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Christopher',
  'Lisa',
  'Daniel',
  'Nancy'
]

const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White'
]

const streetNames = [
  'Main St',
  'Oak Ave',
  'Maple Dr',
  'Cedar Ln',
  'Pine St',
  'Elm Ave',
  'Washington Blvd',
  'Lincoln Ave',
  'Park Dr',
  'Lake St',
  'River Rd',
  'Hill St'
]

const cities = [
  'Springfield',
  'Franklin',
  'Clinton',
  'Madison',
  'Georgetown',
  'Salem',
  'Fairview',
  'Bristol',
  'Manchester',
  'Riverside',
  'Oakland',
  'Burlington'
]

const states: State[] = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY'
]

const employers = [
  'Acme Corporation',
  'Global Tech Inc',
  'First National Bank',
  'City Hospital',
  'State University',
  'Metro Transit',
  'Regional Power Co',
  'United Manufacturing',
  'Digital Solutions LLC',
  'Healthcare Partners',
  'Financial Services Group'
]

const banks = [
  'First National Bank',
  'Citizens Bank',
  'Chase',
  'Bank of America',
  'Wells Fargo',
  'Capital One',
  'PNC Bank',
  'TD Bank'
]

const brokers = [
  'Fidelity Investments',
  'Charles Schwab',
  'Vanguard',
  'TD Ameritrade',
  'E*TRADE',
  'Merrill Lynch',
  'Morgan Stanley'
]

// =============================================================================
// Address Generation
// =============================================================================

function generateAddress(rng: SeededRandom): Address {
  return {
    address: `${rng.nextInt(100, 9999)} ${rng.pick(streetNames)}`,
    city: rng.pick(cities),
    state: rng.pick(states),
    zip: rng.nextInt(10000, 99999).toString()
  }
}

function generateEmployer(rng: SeededRandom, index: number): Employer {
  return {
    EIN: generateTestEIN(index),
    employerName: rng.pick(employers),
    address: generateAddress(rng)
  }
}

// =============================================================================
// Person Generation
// =============================================================================

function generatePrimaryPerson(
  rng: SeededRandom,
  index: number
): PrimaryPerson {
  const birthYear = rng.nextInt(1950, 2000)
  return {
    firstName: rng.pick(firstNames),
    lastName: rng.pick(lastNames),
    ssid: generateTestSSN(index),
    role: PersonRole.PRIMARY,
    isBlind: rng.nextBoolean(0.02),
    dateOfBirth: new Date(birthYear, rng.nextInt(0, 11), rng.nextInt(1, 28)),
    address: generateAddress(rng),
    isTaxpayerDependent: false
  }
}

function generateSpouse(rng: SeededRandom, index: number): Spouse {
  const birthYear = rng.nextInt(1950, 2000)
  return {
    firstName: rng.pick(firstNames),
    lastName: rng.pick(lastNames),
    ssid: generateTestSSN(index + 1000),
    role: PersonRole.SPOUSE,
    isBlind: rng.nextBoolean(0.02),
    dateOfBirth: new Date(birthYear, rng.nextInt(0, 11), rng.nextInt(1, 28)),
    isTaxpayerDependent: false
  }
}

function generateDependent(
  rng: SeededRandom,
  index: number,
  taxYear: number
): Dependent {
  const birthYear = rng.nextInt(taxYear - 23, taxYear - 1)
  const isChild = taxYear - birthYear < 19
  return {
    firstName: rng.pick(firstNames),
    lastName: rng.pick(lastNames),
    ssid: generateTestSSN(index + 2000),
    role: PersonRole.DEPENDENT,
    isBlind: rng.nextBoolean(0.01),
    dateOfBirth: new Date(birthYear, rng.nextInt(0, 11), rng.nextInt(1, 28)),
    relationship: isChild ? 'child' : 'relative',
    qualifyingInfo: {
      numberOfMonths: 12,
      isStudent: birthYear >= taxYear - 24 && birthYear < taxYear - 18
    }
  }
}

// =============================================================================
// Income Generation
// =============================================================================

/**
 * Income level presets for generating W-2s
 */
export type IncomeLevel =
  | 'minimum_wage'
  | 'low'
  | 'median'
  | 'high'
  | 'very_high'
  | 'top_bracket'

const incomeLevelRanges: Record<IncomeLevel, [number, number]> = {
  minimum_wage: [15000, 25000],
  low: [25000, 50000],
  median: [50000, 80000],
  high: [80000, 150000],
  very_high: [150000, 400000],
  top_bracket: [400000, 1000000]
}

function generateW2(
  rng: SeededRandom,
  index: number,
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE,
  incomeLevel: IncomeLevel
): IncomeW2 {
  const [minIncome, maxIncome] = incomeLevelRanges[incomeLevel]
  const income = Math.round(rng.nextFloat(minIncome, maxIncome) * 100) / 100

  // Calculate realistic withholdings
  const fedWithholdingRate = rng.nextFloat(0.15, 0.28)
  const stateWithholdingRate = rng.nextFloat(0.03, 0.09)

  const ssWages = Math.min(income, 168600) // 2024 SS wage base
  const ssWithholding = Math.round(ssWages * 0.062 * 100) / 100
  const medicareWithholding = Math.round(income * 0.0145 * 100) / 100

  const state = rng.pick(states)

  return {
    occupation: 'Employee',
    income,
    medicareIncome: income,
    fedWithholding: Math.round(income * fedWithholdingRate * 100) / 100,
    ssWages,
    ssWithholding,
    medicareWithholding,
    employer: generateEmployer(rng, index),
    personRole,
    state,
    stateWages: income,
    stateWithholding: Math.round(income * stateWithholdingRate * 100) / 100
  }
}

function generate1099Int(
  rng: SeededRandom,
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE,
  maxInterest: number
): Supported1099 {
  return {
    payer: rng.pick(banks),
    type: Income1099Type.INT,
    form: {
      income: Math.round(rng.nextFloat(10, maxInterest) * 100) / 100
    } as F1099IntData,
    personRole
  }
}

function generate1099Div(
  rng: SeededRandom,
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE,
  maxDividends: number
): Supported1099 {
  const dividends = Math.round(rng.nextFloat(100, maxDividends) * 100) / 100
  const qualifiedRatio = rng.nextFloat(0.5, 1.0)
  return {
    payer: rng.pick(brokers),
    type: Income1099Type.DIV,
    form: {
      dividends,
      qualifiedDividends: Math.round(dividends * qualifiedRatio * 100) / 100,
      totalCapitalGainsDistributions:
        Math.round(rng.nextFloat(0, dividends * 0.3) * 100) / 100
    } as F1099DivData,
    personRole
  }
}

function generate1099B(
  rng: SeededRandom,
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE,
  maxProceeds: number
): Supported1099 {
  const stProceeds = Math.round(rng.nextFloat(0, maxProceeds * 0.3) * 100) / 100
  const ltProceeds = Math.round(rng.nextFloat(0, maxProceeds * 0.7) * 100) / 100

  // Generate gains or losses
  const stGainLoss = rng.nextFloat(-0.2, 0.3)
  const ltGainLoss = rng.nextFloat(-0.1, 0.4)

  return {
    payer: rng.pick(brokers),
    type: Income1099Type.B,
    form: {
      shortTermProceeds: stProceeds,
      shortTermCostBasis:
        Math.round((stProceeds / (1 + stGainLoss)) * 100) / 100,
      longTermProceeds: ltProceeds,
      longTermCostBasis: Math.round((ltProceeds / (1 + ltGainLoss)) * 100) / 100
    } as F1099BData,
    personRole
  }
}

// =============================================================================
// Scenario Presets
// =============================================================================

export interface TestScenarioOptions {
  seed?: number
  filingStatus: FilingStatus
  incomeLevel: IncomeLevel
  numW2s?: number
  numDependents?: number
  has1099Int?: boolean
  has1099Div?: boolean
  has1099B?: boolean
  hasHSA?: boolean
  hasStudentLoan?: boolean
  itemizeDeductions?: boolean
  taxYear?: number
}

export interface TestScenario {
  information: Information
  description: string
  expectedValues: {
    totalIncome: number
    totalWithholding: number
    estimatedAGI: number
    hasRefund: boolean
  }
}

/**
 * Generate a complete test scenario
 */
export function generateTestScenario(
  options: TestScenarioOptions
): TestScenario {
  const {
    seed = Date.now(),
    filingStatus,
    incomeLevel,
    numW2s = 1,
    numDependents = 0,
    has1099Int = false,
    has1099Div = false,
    has1099B = false,
    hasHSA = false,
    hasStudentLoan = false,
    itemizeDeductions = false,
    taxYear = 2024
  } = options

  const rng = new SeededRandom(seed)

  // Generate filers
  const primaryPerson = generatePrimaryPerson(rng, seed)
  const spouse =
    filingStatus === FilingStatus.MFJ || filingStatus === FilingStatus.MFS
      ? generateSpouse(rng, seed)
      : undefined

  // Generate dependents
  const dependents: Dependent[] = []
  for (let i = 0; i < numDependents; i++) {
    dependents.push(generateDependent(rng, seed + i, taxYear))
  }

  const taxPayer: TaxPayer = {
    filingStatus,
    primaryPerson,
    spouse,
    dependents
  }

  // Generate W-2s
  const w2s: IncomeW2[] = []
  for (let i = 0; i < numW2s; i++) {
    w2s.push(generateW2(rng, seed + i * 100, PersonRole.PRIMARY, incomeLevel))
  }

  // Add spouse W-2 if MFJ
  if (filingStatus === FilingStatus.MFJ && spouse) {
    w2s.push(generateW2(rng, seed + 1001, PersonRole.SPOUSE, incomeLevel))
  }

  // Generate 1099s
  const f1099s: Supported1099[] = []
  if (has1099Int) {
    f1099s.push(generate1099Int(rng, PersonRole.PRIMARY, 5000))
  }
  if (has1099Div) {
    f1099s.push(generate1099Div(rng, PersonRole.PRIMARY, 10000))
  }
  if (has1099B) {
    f1099s.push(generate1099B(rng, PersonRole.PRIMARY, 50000))
  }

  // Calculate totals
  const totalIncome =
    w2s.reduce((sum, w2) => sum + w2.income, 0) +
    f1099s.reduce((sum, f) => {
      if (f.type === Income1099Type.INT)
        return sum + (f.form ).income
      if (f.type === Income1099Type.DIV)
        return sum + (f.form ).dividends
      return sum
    }, 0)

  const totalWithholding = w2s.reduce((sum, w2) => sum + w2.fedWithholding, 0)

  // Generate itemized deductions if requested
  const itemizedDeductions: ItemizedDeductions | undefined = itemizeDeductions
    ? {
        medicalAndDental:
          Math.round(totalIncome * rng.nextFloat(0.05, 0.1) * 100) / 100,
        stateAndLocalTaxes:
          Math.round(totalIncome * rng.nextFloat(0.03, 0.08) * 100) / 100,
        isSalesTax: false,
        stateAndLocalRealEstateTaxes:
          Math.round(rng.nextFloat(2000, 15000) * 100) / 100,
        stateAndLocalPropertyTaxes:
          Math.round(rng.nextFloat(500, 3000) * 100) / 100,
        interest8a: Math.round(rng.nextFloat(3000, 20000) * 100) / 100,
        interest8b: 0,
        interest8c: 0,
        interest8d: 0,
        investmentInterest: 0,
        charityCashCheck: Math.round(rng.nextFloat(500, 5000) * 100) / 100,
        charityOther: Math.round(rng.nextFloat(100, 1000) * 100) / 100
      }
    : undefined

  // Generate HSA if requested
  const healthSavingsAccounts: HealthSavingsAccount[] = hasHSA
    ? [
        {
          label: 'HSA Account',
          coverageType:
            filingStatus === FilingStatus.MFJ ? 'family' : 'self-only',
          contributions: filingStatus === FilingStatus.MFJ ? 8300 : 4150,
          personRole: PersonRole.PRIMARY,
          startDate: new Date(taxYear, 0, 1),
          endDate: new Date(taxYear, 11, 31),
          totalDistributions: Math.round(rng.nextFloat(0, 2000) * 100) / 100,
          qualifiedDistributions: Math.round(rng.nextFloat(0, 2000) * 100) / 100
        }
      ]
    : []

  // Generate student loan interest if requested
  const f1098es: F1098e[] = hasStudentLoan
    ? [
        {
          lender: 'Student Loan Servicer',
          interest: Math.min(
            2500,
            Math.round(rng.nextFloat(500, 3000) * 100) / 100
          )
        }
      ]
    : []

  // State residency
  const stateResidencies: StateResidency[] = primaryPerson.address.state
    ? [{ state: primaryPerson.address.state }]
    : []

  // Generate refund info
  const refund: Refund = {
    routingNumber: '021000021', // Test routing number
    accountNumber: '123456789',
    accountType: AccountType.checking
  }

  // Estimate AGI (simplified)
  const estimatedAGI =
    totalIncome -
    (hasHSA ? healthSavingsAccounts[0].contributions : 0) -
    (hasStudentLoan ? f1098es[0]?.interest ?? 0 : 0)

  // Determine if likely to have refund
  const standardDeduction = filingStatus === FilingStatus.MFJ ? 29200 : 14600
  const taxableIncome = Math.max(0, estimatedAGI - standardDeduction)
  const estimatedTax = calculateEstimatedTax(taxableIncome, filingStatus)
  const hasRefund = totalWithholding > estimatedTax

  const information: Information = {
    f1099s,
    w2s,
    realEstate: [],
    estimatedTaxes: [],
    f1098es,
    f3921s: [],
    scheduleK1Form1065s: [],
    itemizedDeductions,
    refund,
    taxPayer,
    questions: {
      CRYPTO: false,
      FOREIGN_ACCOUNT_EXISTS: false,
      FINCEN_114: false,
      FOREIGN_TRUST_RELATIONSHIP: false,
      LIVE_APART_FROM_SPOUSE: false
    },
    credits: [],
    stateResidencies,
    healthSavingsAccounts,
    individualRetirementArrangements: []
  }

  const description =
    `${FilingStatus[filingStatus]} filer with ${incomeLevel} income` +
    `${numDependents > 0 ? `, ${numDependents} dependent(s)` : ''}` +
    `${has1099Int ? ', interest income' : ''}` +
    `${has1099Div ? ', dividend income' : ''}` +
    `${hasHSA ? ', HSA' : ''}` +
    `${itemizeDeductions ? ', itemizing' : ''}`

  return {
    information,
    description,
    expectedValues: {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalWithholding: Math.round(totalWithholding * 100) / 100,
      estimatedAGI: Math.round(estimatedAGI * 100) / 100,
      hasRefund
    }
  }
}

/**
 * Simple tax calculation for estimation purposes
 */
function calculateEstimatedTax(
  taxableIncome: number,
  filingStatus: FilingStatus
): number {
  // 2024 tax brackets (simplified)
  const brackets =
    filingStatus === FilingStatus.MFJ
      ? [
          { threshold: 23200, rate: 0.1 },
          { threshold: 94300, rate: 0.12 },
          { threshold: 201050, rate: 0.22 },
          { threshold: 383900, rate: 0.24 },
          { threshold: 487450, rate: 0.32 },
          { threshold: 731200, rate: 0.35 },
          { threshold: Infinity, rate: 0.37 }
        ]
      : [
          { threshold: 11600, rate: 0.1 },
          { threshold: 47150, rate: 0.12 },
          { threshold: 100525, rate: 0.22 },
          { threshold: 191950, rate: 0.24 },
          { threshold: 243725, rate: 0.32 },
          { threshold: 609350, rate: 0.35 },
          { threshold: Infinity, rate: 0.37 }
        ]

  let tax = 0
  let remainingIncome = taxableIncome
  let prevThreshold = 0

  for (const bracket of brackets) {
    const taxableInBracket = Math.min(
      remainingIncome,
      bracket.threshold - prevThreshold
    )
    if (taxableInBracket <= 0) break
    tax += taxableInBracket * bracket.rate
    remainingIncome -= taxableInBracket
    prevThreshold = bracket.threshold
  }

  return Math.round(tax * 100) / 100
}

// =============================================================================
// Preset Scenarios
// =============================================================================

/**
 * Generate preset test scenarios covering common tax situations
 */
export function generatePresetScenarios(): TestScenario[] {
  return [
    // Single filer scenarios
    generateTestScenario({
      seed: 1001,
      filingStatus: FilingStatus.S,
      incomeLevel: 'minimum_wage',
      numDependents: 0
    }),
    generateTestScenario({
      seed: 1002,
      filingStatus: FilingStatus.S,
      incomeLevel: 'median',
      numDependents: 0,
      has1099Int: true
    }),
    generateTestScenario({
      seed: 1003,
      filingStatus: FilingStatus.S,
      incomeLevel: 'high',
      numDependents: 0,
      has1099Div: true,
      hasHSA: true
    }),
    generateTestScenario({
      seed: 1004,
      filingStatus: FilingStatus.S,
      incomeLevel: 'very_high',
      numDependents: 0,
      has1099Int: true,
      has1099Div: true,
      has1099B: true,
      itemizeDeductions: true
    }),

    // MFJ scenarios
    generateTestScenario({
      seed: 2001,
      filingStatus: FilingStatus.MFJ,
      incomeLevel: 'low',
      numDependents: 2
    }),
    generateTestScenario({
      seed: 2002,
      filingStatus: FilingStatus.MFJ,
      incomeLevel: 'median',
      numDependents: 3,
      has1099Int: true
    }),
    generateTestScenario({
      seed: 2003,
      filingStatus: FilingStatus.MFJ,
      incomeLevel: 'high',
      numDependents: 2,
      hasHSA: true,
      hasStudentLoan: true
    }),
    generateTestScenario({
      seed: 2004,
      filingStatus: FilingStatus.MFJ,
      incomeLevel: 'top_bracket',
      numDependents: 1,
      has1099Div: true,
      has1099B: true,
      itemizeDeductions: true
    }),

    // Head of Household scenarios
    generateTestScenario({
      seed: 3001,
      filingStatus: FilingStatus.HOH,
      incomeLevel: 'low',
      numDependents: 1
    }),
    generateTestScenario({
      seed: 3002,
      filingStatus: FilingStatus.HOH,
      incomeLevel: 'median',
      numDependents: 2,
      has1099Int: true
    }),

    // MFS scenario
    generateTestScenario({
      seed: 4001,
      filingStatus: FilingStatus.MFS,
      incomeLevel: 'high',
      numDependents: 0
    }),

    // Qualifying Widower scenario
    generateTestScenario({
      seed: 5001,
      filingStatus: FilingStatus.W,
      incomeLevel: 'median',
      numDependents: 1
    })
  ]
}

/**
 * Generate a batch of random test scenarios
 */
export function generateRandomScenarios(
  count: number,
  baseSeed = Date.now()
): TestScenario[] {
  const scenarios: TestScenario[] = []
  const rng = new SeededRandom(baseSeed)

  const filingStatuses: FilingStatus[] = [
    FilingStatus.S,
    FilingStatus.MFJ,
    FilingStatus.MFS,
    FilingStatus.HOH,
    FilingStatus.W
  ]

  const incomeLevels: IncomeLevel[] = [
    'minimum_wage',
    'low',
    'median',
    'high',
    'very_high',
    'top_bracket'
  ]

  for (let i = 0; i < count; i++) {
    const filingStatus = rng.pick(filingStatuses)
    const incomeLevel = rng.pick(incomeLevels)

    // Determine number of dependents based on filing status
    let maxDependents = 4
    if (filingStatus === FilingStatus.S || filingStatus === FilingStatus.MFS) {
      maxDependents = rng.nextBoolean(0.7) ? 0 : 2
    }

    scenarios.push(
      generateTestScenario({
        seed: baseSeed + i * 1000,
        filingStatus,
        incomeLevel,
        numDependents: rng.nextInt(0, maxDependents),
        has1099Int: rng.nextBoolean(0.4),
        has1099Div: rng.nextBoolean(0.3),
        has1099B: rng.nextBoolean(0.2),
        hasHSA: rng.nextBoolean(0.25),
        hasStudentLoan: rng.nextBoolean(0.15),
        itemizeDeductions: rng.nextBoolean(0.2)
      })
    )
  }

  return scenarios
}

// Export types
export type { SeededRandom }
