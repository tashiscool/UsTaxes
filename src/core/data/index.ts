import { enumKeys } from '../util'

export enum TaxYears {
  Y2019 = 2019,
  Y2020 = 2020,
  Y2021 = 2021,
  Y2022 = 2022,
  Y2023 = 2023,
  Y2024 = 2024,
  Y2025 = 2025
}

export type TaxYear = keyof typeof TaxYears

export enum PersonRole {
  PRIMARY = 'PRIMARY',
  SPOUSE = 'SPOUSE',
  DEPENDENT = 'DEPENDENT',
  EMPLOYER = 'EMPLOYER'
}

/**
 * Types such as the following are generic with respect to the Date
 * type. AJV tests the typed serialization of these interfaces
 * in JSON, and Date is not a valid type in JSON. So when our data
 * is serialized in and out of local storage, or to a JSON file,
 * these data must be parsed / serialized from / to strings.
 *
 * Our AJV schema generator ignores generic types.
 */
export interface Person<D = Date> {
  firstName: string
  lastName: string
  ssid: string
  role: PersonRole
  isBlind: boolean
  dateOfBirth: D
}

// Concrete type for our AJV schema generator.
export type PersonDateString = Person<string>

export interface QualifyingInformation {
  numberOfMonths: number
  isStudent: boolean
}

export interface Dependent<D = Date> extends Person<D> {
  relationship: string
  qualifyingInfo?: QualifyingInformation
}

export type DependentDateString = Dependent<string>

export interface Address {
  address: string
  aptNo?: string
  city: string
  state?: State
  zip?: string
  foreignCountry?: string
  province?: string
  postalCode?: string
}

export interface PrimaryPerson<D = Date> extends Person<D> {
  address: Address
  isTaxpayerDependent: boolean
  isStudent?: boolean // For F8615 Kiddie Tax
  ein?: string // Employer ID for Schedule H household employment
}
export type PrimaryPersonDateString = PrimaryPerson<string>

export interface Spouse<D = Date> extends Person<D> {
  isTaxpayerDependent: boolean
}

export type SpouseDateString = Spouse<string>

export interface Employer {
  EIN?: string
  employerName?: string
  address?: Address
}

export enum AccountType {
  checking = 'checking',
  savings = 'savings'
}

export interface Refund {
  routingNumber: string
  accountNumber: string
  accountType: AccountType
}

export interface IncomeW2 {
  occupation: string
  income: number
  medicareIncome: number
  fedWithholding: number
  ssWages: number
  ssWithholding: number
  medicareWithholding: number
  employer?: Employer
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  state?: State
  stateWages?: number
  stateWithholding?: number
  box12?: W2Box12Info
}

export interface EstimatedTaxPayments {
  label: string
  payment: number
}

export enum Income1099Type {
  B = 'B',
  INT = 'INT',
  DIV = 'DIV',
  R = 'R',
  SSA = 'SSA',
  NEC = 'NEC', // Non-employee compensation (gig economy, freelance)
  MISC = 'MISC', // Miscellaneous income (rents, royalties, prizes)
  G = 'G' // Government payments (unemployment, state tax refunds)
}

export interface F1099BData {
  shortTermProceeds: number
  shortTermCostBasis: number
  longTermProceeds: number
  longTermCostBasis: number
}

export interface F1099IntData {
  income: number
}

export interface F1099DivData {
  dividends: number
  qualifiedDividends: number
  totalCapitalGainsDistributions: number
}
/*
 TODO: Add in logic for various different distributions
 that should go in box 4a and 5a. Will need to implement
 form 8606 and Schedule 1 line 19.
 */
export enum PlanType1099 {
  /* IRA includes a traditional IRA, Roth IRA,
   * simplified employee pension (SEP) IRA,
   * and a savings incentive match plan for employees (SIMPLE) IRA
   */
  IRA = 'IRA',
  RothIRA = 'RothIRA',
  SepIRA = 'SepIRA',
  SimpleIRA = 'SimpleIRA',
  // Pension and annuity payments include distributions from 401(k), 403(b), and governmental 457(b) plans.
  Pension = 'Pension'
}

export const PlanType1099Texts: { [k in keyof typeof PlanType1099]: string } = {
  IRA: 'traditional IRA',
  RothIRA: 'Roth IRA',
  SepIRA: 'simplified employee pension (SEP) IRA',
  SimpleIRA: 'savings incentive match plan for employees (SIMPLE) IRA',
  Pension: '401(k), 403(b), or 457(b) plan'
}

export interface F1099RData {
  grossDistribution: number
  taxableAmount: number
  federalIncomeTaxWithheld: number
  planType: PlanType1099
}

export interface F1099SSAData {
  // benefitsPaid: number
  // benefitsRepaid: number
  netBenefits: number
  federalIncomeTaxWithheld: number
}

/**
 * Form 1099-NEC - Nonemployee Compensation
 * Used for freelance work, gig economy, independent contractors
 * Replaced Box 7 of 1099-MISC starting in 2020
 */
export interface F1099NECData {
  nonemployeeCompensation: number // Box 1
  federalIncomeTaxWithheld?: number // Box 4
  stateTaxWithheld?: number // Box 5
  state?: State // Box 6
  statePayerNumber?: string // Box 7
  stateIncome?: number // Box 7
}

/**
 * Form 1099-MISC - Miscellaneous Information
 * Rents, royalties, prizes, awards, other income
 */
export interface F1099MISCData {
  rents?: number // Box 1 - Rents
  royalties?: number // Box 2 - Royalties
  otherIncome?: number // Box 3 - Other income
  federalIncomeTaxWithheld?: number // Box 4
  fishingBoatProceeds?: number // Box 5
  medicalPayments?: number // Box 6
  substitutePayments?: number // Box 8 - Substitute payments in lieu of dividends
  cropInsuranceProceeds?: number // Box 9
  grossProceedsAttorney?: number // Box 10
  fishPurchasedForResale?: number // Box 11
  section409ADeferrals?: number // Box 12
  excessGoldenParachute?: number // Box 13
  nonqualifiedDeferredComp?: number // Box 14
  stateTaxWithheld?: number // Box 15
  state?: State // Box 16
  stateIncome?: number // Box 17
}

/**
 * Form 1099-G - Certain Government Payments
 * Unemployment compensation, state/local tax refunds, RTAA payments
 */
export interface F1099GData {
  unemploymentCompensation?: number // Box 1 - Unemployment compensation
  stateLocalTaxRefund?: number // Box 2 - State or local income tax refunds
  taxYear?: number // Box 3 - Tax year of refund (if Box 2)
  federalIncomeTaxWithheld?: number // Box 4
  rtaaPayments?: number // Box 5 - RTAA payments (Reemployment Trade Adjustment)
  taxableGrants?: number // Box 6 - Taxable grants
  agriculturePayments?: number // Box 7 - Agriculture payments
  tradeOrBusinessIncome?: boolean // Box 8 - Check if trade/business income
  marketGain?: number // Box 9 - Market gain
  state?: State // Box 10a
  stateIdNumber?: string // Box 10b
  stateTaxWithheld?: number // Box 11
}

export interface Income1099<T, D> {
  payer: string
  type: T
  form: D
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
}
export enum W2Box12Code {
  A = 'A', // Uncollected social security or RRTA tax on tips.
  B = 'B', // Uncollected Medicare tax on tips.
  C = 'C', // Taxable cost of group-term life insurance over $50,000.
  D = 'D', // Elective deferrals under a section 401(k) cash or deferred arrangement (plan).
  E = 'E', // Elective deferrals under a section 403(b) salary reduction agreement.
  F = 'F', // Elective deferrals under a section 408(k)(6) salary reduction SEP.
  G = 'G', // Elective deferrals and employer contributions (including nonelective deferrals) to any governmental or nongovernmental section 457(b) deferred compensation plan.
  H = 'H', // Elective deferrals under section 501(c)(18)(D) tax-exempt organization plan.
  J = 'J', // Nontaxable sick pay.
  K = 'K', // 20% excise tax on excess golden parachute payments (not applicable to Forms W-2AS, W-2CM, W-2GU, or W-2VI).
  L = 'L', // Substantiated employee business expense reimbursements.
  M = 'M', // Uncollected social security or RRTA tax on taxable cost of group-term life insurance over $50,000 (for former employees).
  N = 'N', // Uncollected Medicare tax on taxable cost of group-term life insurance over $50,000 (for former employees).
  P = 'P', // Excludable moving expense reimbursements paid directly to a member of the U.S. Armed Forces.
  Q = 'Q', // Nontaxable combat pay.
  R = 'R', // Employer contributions to an Archer MSA.
  S = 'S', // Employee salary reduction contributions under a section 408(p) SIMPLE plan.
  T = 'T', // Adoption benefits.
  V = 'V', // Income from the exercise of nonstatutory stock option(s).
  W = 'W', // Employer contributions to a health savings account (HSA).
  Y = 'Y', // Deferrals under a section 409A nonqualified deferred compensation plan.
  Z = 'Z', // Income under a nonqualified deferred compensation plan that fails to satisfy section 409A.
  AA = 'AA', // Designated Roth contributions under a section 401(k) plan.
  BB = 'BB', // Designated Roth contributions under a section 403(b) plan.
  DD = 'DD', // Cost of employer-sponsored health coverage.
  EE = 'EE', // Designated Roth contributions under a governmental section 457(b) plan.
  FF = 'FF', // Permitted benefits under a qualified small employer health reimbursement arrangement.
  GG = 'GG', // Income from qualified equity grants under section 83(i).
  HH = 'HH' // Aggregate deferrals under section 83(i) elections as of the close of the calendar year.}
}

export const W2Box12CodeDescriptions: { [key in W2Box12Code]: string } = {
  A: 'Uncollected social security or RRTA tax on tips.',
  B: 'Uncollected Medicare tax on tips.',
  C: 'Taxable cost of group-term life insurance over $50,000.',
  D: 'Elective deferrals under a section 401(k) cash or deferred arrangement plan.',
  E: 'Elective deferrals under a section 403(b) salary reduction agreement.',
  F: 'Elective deferrals under a section 408(k)(6) salary reduction SEP.',
  G: 'Elective deferrals and employer contributions (including nonelective deferrals) to any governmental or nongovernmental section 457(b) deferred compensation plan.',
  H: 'Elective deferrals under section 501(c)(18)(D) tax-exempt organization plan.',
  J: 'Nontaxable sick pay.',
  K: '20% excise tax on excess golden parachute payments (not applicable to Forms W-2AS, W-2CM, W-2GU, or W-2VI).',
  L: 'Substantiated employee business expense reimbursements.',
  M: 'Uncollected social security or RRTA tax on taxable cost of group-term life insurance over $50,000 (for former employees).',
  N: 'Uncollected Medicare tax on taxable cost of group-term life insurance over $50,000 (for former employees).',
  P: 'Excludable moving expense reimbursements paid directly to a member of the U.S. Armed Forces.',
  Q: 'Nontaxable combat pay.',
  R: 'Employer contributions to an Archer MSA.',
  S: 'Employee salary reduction contributions under a section 408(p) SIMPLE plan.',
  T: 'Adoption benefits.',
  V: 'Income from the exercise of nonstatutory stock option(s).',
  W: 'Employer contributions to a health savings account (HSA).',
  Y: 'Deferrals under a section 409A nonqualified deferred compensation plan.',
  Z: 'Income under a nonqualified deferred compensation plan that fails to satisfy section 409A.',
  AA: 'Designated Roth contributions under a section 401(k) plan.',
  BB: 'Designated Roth contributions under a section 403(b) plan.',
  DD: 'Cost of employer-sponsored health coverage.',
  EE: 'Designated Roth contributions under a governmental section 457(b) plan.',
  FF: 'Permitted benefits under a qualified small employer health reimbursement arrangement.',
  GG: 'Income from qualified equity grants under section 83(i).',
  HH: 'Aggregate deferrals under section 83(i) elections as of the close of the calendar year.'
}

export type W2Box12Info<A = number> = { [key in W2Box12Code]?: A }

export interface HealthSavingsAccount<D = Date> {
  label: string
  coverageType: 'self-only' | 'family'
  contributions: number
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  startDate: D
  endDate: D
  totalDistributions: number
  qualifiedDistributions: number
}

export type HealthSavingsAccountDateString = HealthSavingsAccount<string>

export enum IraPlanType {
  IRA = 'IRA',
  RothIRA = 'RothIRA',
  SepIRA = 'SepIRA',
  SimpleIRA = 'SimpleIRA'
}

export const IraPlanTypeTexts = {
  [IraPlanType.IRA]: 'Traditional IRA',
  [IraPlanType.RothIRA]: 'Roth IRA',
  [IraPlanType.SepIRA]: 'Simplified employee pension (SEP) IRA',
  [IraPlanType.SimpleIRA]:
    'Savings incentive match plan for employees (SIMPLE) IRA'
}

export type IraPlanName = keyof typeof IraPlanType

export const iraPlanNames: IraPlanName[] = enumKeys(IraPlanType)
// export const iraPlanNames: IraPlanName[] = [
//   'IRA',
//   'RothIRA',
//   'SepIRA',
//   'SimpleIRA'
// ]

export interface Ira {
  payer: string
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  // fields about distributions from form 1099-R
  grossDistribution: number // 1099-R box 1
  taxableAmount: number // 1099-R box 2a
  taxableAmountNotDetermined: boolean // 1099-R box 2b
  totalDistribution: boolean // 1099-R box 2b
  federalIncomeTaxWithheld: number // 1099-R box 4
  planType: IraPlanType
  // fields about contributions from form 5498
  contributions: number // contributions depending on the plan type
  rolloverContributions: number // 5498 box 2
  rothIraConversion: number // 5498 box 3
  recharacterizedContributions: number // 5498 box 4
  requiredMinimumDistributions: number // 5498 box 12b
  lateContributions: number // 5498 box 13a
  repayments: number // 5498 box 14a
}

export enum FilingStatus {
  S = 'S',
  MFJ = 'MFJ',
  MFS = 'MFS',
  HOH = 'HOH',
  W = 'W'
}

export type FilingStatusName = keyof typeof FilingStatus

export const FilingStatusTexts = {
  [FilingStatus.S]: 'Single',
  [FilingStatus.MFJ]: 'Married Filing Jointly',
  [FilingStatus.MFS]: 'Married Filing Separately',
  [FilingStatus.HOH]: 'Head of Household',
  [FilingStatus.W]: 'Widow(er)'
}

export const filingStatuses = <D>(
  p: TaxPayer<D> | undefined
): FilingStatus[] => {
  let withDependents: FilingStatus[] = []
  let spouseStatuses: FilingStatus[] = []

  if ((p?.dependents ?? []).length > 0) {
    withDependents = [FilingStatus.HOH]
  }
  if (p?.spouse !== undefined) {
    spouseStatuses = [FilingStatus.MFJ, FilingStatus.MFS]
    // HoH not available if married
    withDependents = []
  } else {
    spouseStatuses = [FilingStatus.S, FilingStatus.W]
  }
  return [...spouseStatuses, ...withDependents]
}

export interface ContactInfo {
  contactPhoneNumber?: string
  contactEmail?: string
}

export interface TaxPayer<D = Date> extends ContactInfo {
  filingStatus?: FilingStatus
  primaryPerson?: PrimaryPerson<D>
  spouse?: Spouse<D>
  dependents: Dependent<D>[]
}

export type TaxPayerDateString = TaxPayer<string>

export type Income1099Int = Income1099<Income1099Type.INT, F1099IntData>
export type Income1099B = Income1099<Income1099Type.B, F1099BData>
export type Income1099Div = Income1099<Income1099Type.DIV, F1099DivData>
export type Income1099R = Income1099<Income1099Type.R, F1099RData>
export type Income1099SSA = Income1099<Income1099Type.SSA, F1099SSAData>
export type Income1099NEC = Income1099<Income1099Type.NEC, F1099NECData>
export type Income1099MISC = Income1099<Income1099Type.MISC, F1099MISCData>
export type Income1099G = Income1099<Income1099Type.G, F1099GData>

export type Supported1099 =
  | Income1099Int
  | Income1099B
  | Income1099Div
  | Income1099R
  | Income1099SSA
  | Income1099NEC
  | Income1099MISC
  | Income1099G

export enum PropertyType {
  singleFamily,
  multiFamily,
  vacation,
  commercial,
  land,
  selfRental,
  other
}

export type PropertyTypeName = keyof typeof PropertyType

export enum PropertyExpenseType {
  advertising,
  auto,
  cleaning,
  commissions,
  insurance,
  legal,
  management,
  mortgage,
  otherInterest,
  repairs,
  supplies,
  taxes,
  utilities,
  depreciation,
  other
}

export type PropertyExpenseTypeName = keyof typeof PropertyExpenseType

export interface Property {
  address: Address
  rentalDays: number
  personalUseDays: number
  rentReceived: number
  propertyType: PropertyTypeName
  otherPropertyType?: string
  qualifiedJointVenture: boolean
  expenses: Partial<{ [K in PropertyExpenseTypeName]: number }>
  otherExpenseType?: string
}

export interface F1098e {
  lender: string
  interest: number
}

export interface F3921 {
  name: string
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  exercisePricePerShare: number
  fmv: number
  numShares: number
}

// See https://www.irs.gov/instructions/i1065sk1
export interface ScheduleK1Form1065 {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  partnershipName: string
  partnershipEin: string
  partnerOrSCorp: 'P' | 'S'
  isForeign: boolean
  isPassive: boolean
  ordinaryBusinessIncome: number // Schedule E (Form 1040), line 28, column (i) or (k).
  interestIncome: number // Form 1040, line 2b
  guaranteedPaymentsForServices: number // Schedule E (Form 1040), line 28, column (k)
  guaranteedPaymentsForCapital: number // Schedule E (Form 1040), line 28, column (k)
  selfEmploymentEarningsA: number // Schedule SE (Form 1040)
  selfEmploymentEarningsB: number // Schedule SE (Form 1040)
  selfEmploymentEarningsC: number // Schedule SE (Form 1040)
  distributionsCodeAAmount: number // If the amount shown as code A exceeds the adjusted basis of your partnership interest immediately before the distribution, the excess is treated as gain from the sale or exchange of your partnership interest. Generally, this gain is treated as gain from the sale of a capital asset and should be reported on Form 8949 and the Schedule D for your return.
  section199AQBI: number // Form 8995 or 8995-A
}

export interface ItemizedDeductions {
  medicalAndDental: string | number
  stateAndLocalTaxes: string | number
  isSalesTax: boolean
  stateAndLocalRealEstateTaxes: string | number
  stateAndLocalPropertyTaxes: string | number
  interest8a: string | number
  interest8b: string | number
  interest8c: string | number
  interest8d: string | number
  investmentInterest: string | number
  charityCashCheck: string | number
  charityOther: string | number
}

export type State =
  | 'AL'
  | 'AK'
  | 'AZ'
  | 'CO'
  | 'DC'
  | 'FL'
  | 'HI'
  | 'ID'
  | 'IN'
  | 'KY'
  | 'MA'
  | 'ME'
  | 'MN'
  | 'MS'
  | 'NC'
  | 'NE'
  | 'NJ'
  | 'NV'
  | 'OH'
  | 'OR'
  | 'RI'
  | 'SD'
  | 'TX'
  | 'VA'
  | 'WA'
  | 'WV'
  | 'AR'
  | 'CA'
  | 'CT'
  | 'DE'
  | 'GA'
  | 'IA'
  | 'IL'
  | 'KS'
  | 'LA'
  | 'MD'
  | 'MI'
  | 'MO'
  | 'MT'
  | 'ND'
  | 'NH'
  | 'NM'
  | 'NY'
  | 'OK'
  | 'PA'
  | 'SC'
  | 'TN'
  | 'UT'
  | 'VT'
  | 'WI'
  | 'WY'

// Hold information about state residency
// TODO: Support part-year state residency
export interface StateResidency {
  state: State
}

// Defines usable tag names for each question later defined,
// and maps to a type which is the expected response type.
export interface QuestionTag {
  CRYPTO: boolean
  FOREIGN_ACCOUNT_EXISTS: boolean
  FINCEN_114: boolean
  FINCEN_114_ACCOUNT_COUNTRY: string
  FOREIGN_TRUST_RELATIONSHIP: boolean
  LIVE_APART_FROM_SPOUSE: boolean
}

export type QuestionTagName = keyof QuestionTag

// Typescript provides no way to access
// keys of an interface at runtime.
export const questionTagNames: QuestionTagName[] = [
  'CRYPTO',
  'FOREIGN_ACCOUNT_EXISTS',
  'FINCEN_114',
  'FINCEN_114_ACCOUNT_COUNTRY',
  'FOREIGN_TRUST_RELATIONSHIP',
  'LIVE_APART_FROM_SPOUSE'
]

export type ValueTag = 'string' | 'boolean'

export type Responses = Partial<QuestionTag> // Defines usable tag names for each question later defined,

export enum CreditType {
  AdvanceChildTaxCredit = 'CreditType/AdvanceChildTaxCredit',
  Other = 'CreditType/Other'
}

export interface Credit {
  recipient: PersonRole
  amount: number
  type: CreditType
}

// =============================================================================
// Local Tax Data Types (City/Municipal Taxes)
// =============================================================================

/**
 * Local Tax Jurisdiction - Represents a city/municipality that levies income tax
 */
export interface LocalTaxJurisdiction {
  name: string
  state: State
  taxRate: number
  creditRate?: number // Percentage of credit allowed for taxes paid to other jurisdictions
  collectionAgency?: 'RITA' | 'CCA' | 'Direct' // For Ohio cities
  hasResidentTax: boolean
  hasNonResidentTax: boolean
  hasSelfEmploymentTax: boolean
}

/**
 * Local Tax Information - User-entered data about local tax situation
 */
export interface LocalTaxInfo {
  // Residence information
  residenceCity?: string
  residenceState?: State
  isResident: boolean

  // Work location information
  workCity?: string
  workState?: State
  worksInDifferentCity: boolean

  // Withholding and payments
  localWithholding: number // Total local tax withheld (residence city)
  workCityWithholding?: number // Tax withheld for work city (if different)
  estimatedPayments?: number // Estimated local tax payments made
  otherMunicipalTaxPaid?: number // Taxes paid to other municipalities (for credit)

  // Ohio-specific fields
  ohioSchoolDistrict?: string
  ohioSchoolDistrictNumber?: string

  // NYC-specific fields
  nycBorough?: 'Manhattan' | 'Brooklyn' | 'Queens' | 'Bronx' | 'Staten Island'

  // Philadelphia-specific fields
  philadelphiaWageTaxAccountNumber?: string
}

/**
 * Edit action type for LocalTaxInfo
 */
export type EditLocalTaxInfoAction = {
  index: number
  value: LocalTaxInfo
}

// =============================================================================
// OBBBA 2025 New Data Types
// =============================================================================

// Overtime Income Exemption (new for 2025)
export interface OvertimeIncome {
  amount: number // Total qualified overtime wages
  employerName?: string
}

// Tip Income Exemption (new for 2025)
export interface TipIncome {
  amount: number // Total qualified tip income
  employerName?: string
}

// Auto Loan Interest Deduction (new for 2025)
export interface AutoLoanInterest {
  amount: number // Total auto loan interest paid
  domesticManufacture: boolean // Vehicle manufactured in USA
  lenderName?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: number
}

// Trump/MAGA Savings Account (new for 2025)
// Source: docs/obbba/new-provisions/TRUMP_ACCOUNT.md
export interface TrumpSavingsAccount<D = Date> {
  beneficiaryName: string
  beneficiarySSN: string
  beneficiaryDateOfBirth: D
  beneficiaryIsCitizen: boolean // Required for eligibility
  accountOpenDate?: D // Date account was opened
  contributionAmount: number // Taxpayer contribution this year (max $5,000)
  governmentContribution?: number // Initial $1,000 for children born 2025+
  fairMarketValue?: number // Year-end FMV
  accountNumber?: string
  custodianName?: string
  custodianEIN?: string
}

export type TrumpSavingsAccountDateString = TrumpSavingsAccount<string>

// =============================================================================
// Additional Form Data Types (Phase 1-3 Forms)
// =============================================================================

// Prior Year Tax Information (for F2210, ScheduleJ)
export interface PriorYearTaxInfo {
  year: number
  taxableIncome: number
  tax: number
  filingStatus: FilingStatus
}

// Moving Expenses (Form 3903 - military only)
export interface MovingExpenses<D = Date> {
  isActiveDutyMilitary: boolean
  militaryOrderDate?: D
  permanentChangeOfStation: boolean
  oldAddress: string
  newAddress: string
  distanceMiles: number
  transportationHouseholdGoods: number
  travelLodging: number
  mileageExpense: number
  parkingAndTolls: number
  employerReimbursement: number
}

// Depreciable Assets (Form 4562)
export type DepreciableAssetClass =
  | '3-year'
  | '5-year'
  | '7-year'
  | '10-year'
  | '15-year'
  | '20-year'
  | '25-year'
  | '27.5-year'
  | '39-year'

export interface DepreciableAsset<D = Date> {
  description: string
  dateAcquired: D
  cost: number
  priorDepreciation: number
  assetClass: DepreciableAssetClass
  businessUsePercentage: number
  section179Election: boolean
  section179Amount?: number
}

// Casualty and Theft Events (Form 4684)
export interface CasualtyEvent<D = Date> {
  description: string
  dateOfEvent: D
  federallyDeclaredDisaster: boolean
  femaDisasterNumber?: string
  propertyDescription: string
  costBasis: number
  insuranceReimbursement: number
  fairMarketValueBefore: number
  fairMarketValueAfter: number
}

// Extension Request (Form 4868)
export interface ExtensionInfo {
  requestExtension: boolean
  extensionPayment: number
  outOfCountryOnDueDate: boolean
}

// Early Distribution Exceptions (Form 5329)
export interface EarlyDistributionException {
  code: string // IRS exception codes 01-12
  amount: number
  description: string
}

// Retirement Plan Excess Contributions (Form 5329)
export interface ExcessContributions {
  traditionalIra: number
  rothIra: number
  coverdellEsa: number
  hsa: number
  archerMsa: number
}

// RMD Shortfall (Form 5329)
export interface RmdShortfall {
  requiredAmount: number
  actualDistribution: number
  reasonableError: boolean
  correctionSteps?: string
}

// At-Risk Activities (Form 6198)
export interface AtRiskActivity {
  name: string
  description: string
  atRiskInvestment: number
  recourseLoans: number
  qualifiedNonrecourseFinancing: number
  amountsProtectedAgainstLoss: number
  currentYearIncome: number
  currentYearDeductions: number
  priorYearLossAllowed: number
  priorYearAtRiskCarryover: number
}

// Installment Sales (Form 6252)
export interface InstallmentSale<D = Date> {
  propertyDescription: string
  dateAcquired: D
  dateSold: D
  sellingPrice: number
  expensesOfSale: number
  adjustedBasis: number
  depreciationRecapture: number
  paymentsReceivedThisYear: number
  paymentsReceivedPriorYears: number
  mortgageAssumedByBuyer: number
}

// IRA Contribution Info (Form 8606)
export interface IraContribution {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  traditionalContributions: number
  traditionalDeductibleAmount: number
  rothContributions: number
}

// Roth Conversion Info (Form 8606)
export interface RothConversion {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  amount: number
  taxableAmount: number
  year: number
}

// Roth Distribution Info (Form 8606)
export interface RothDistribution {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  totalDistributions: number
  qualifiedDistributions: number
  earningsDistributed: number
}

// Parent Info for Kiddie Tax (Form 8615)
export interface ParentTaxInfo {
  name: string
  ssn: string
  filingStatus: FilingStatus
  taxableIncome: number
  taxLiability: number
}

// Prior Year AMT Info (Form 8801)
export interface PriorYearAmtInfo {
  amtLiability: number
  regularTaxLiability: number
  netAmtAdjustments: number
  amtCreditCarryforward: number
  line6: number // Form 6251 line 6 (AMT after exemption)
  exclusionItems: number // Exclusion items from prior year
  foreignTaxCredit: number // Prior year minimum tax foreign tax credit
}

// Like-Kind Exchange (Form 8824)
export interface LikeKindExchange<D = Date> {
  propertyGivenDescription: string
  propertyReceivedDescription: string
  datePropertyGivenTransferred: D
  datePropertyReceivedIdentified: D
  datePropertyReceived: D
  isRelatedPartyExchange: boolean
  fairMarketValueGiven: number
  adjustedBasisGiven: number
  fairMarketValueReceived: number
  cashBootReceived: number
  liabilitiesAssumed: number
  liabilitiesRelievedOf: number
}

// Home Office (Form 8829)
export type HomeOfficeMethod = 'regular' | 'simplified'

export interface HomeOfficeInfo<D = Date> {
  method: HomeOfficeMethod
  totalSquareFeet: number
  businessSquareFeet: number
  daysUsedForDaycare?: number
  hoursUsedForDaycare?: number
  mortgageInterest: number
  realEstateTaxes: number
  insurance: number
  utilities: number
  repairs: number
  otherExpenses: number
  homeValue: number
  landValue: number
  homePurchaseDate: D
  priorDepreciation: number
}

// Adopted Children (Form 8839)
export interface AdoptedChild {
  name: string
  ssn: string
  birthYear: number
  disabledChild: boolean
  foreignChild: boolean
  specialNeedsChild: boolean
  qualifiedExpenses: number
  priorYearExpenses: number
  adoptionFinalized: boolean
  yearAdoptionBegan: number
}

// Foreign Financial Assets (Form 8938 - FATCA)
export type ForeignAssetType =
  | 'depositAccount'
  | 'custodialAccount'
  | 'equity'
  | 'debt'
  | 'other'

export interface ForeignFinancialAsset<D = Date> {
  type: ForeignAssetType
  description: string
  institution: string
  country: string
  accountNumber?: string
  maxValueDuringYear: number
  valueAtYearEnd: number
  incomeEarned: number
  gainLoss: number
  isJointAccount: boolean
  acquisitionDate?: D
  dispositionDate?: D
}

// Farm Business (Schedule F, Schedule J)
export type FarmAccountingMethod = 'cash' | 'accrual'

export interface FarmIncome {
  salesLivestock: number
  salesCrops: number
  cooperativeDistributions: number
  agriculturalPayments: number
  cccLoans: number
  cropInsurance: number
  customHireIncome: number
  otherIncome: number
}

export interface FarmExpenses {
  carTruck: number
  chemicals: number
  conservation: number
  customHire: number
  depreciation: number
  employeeBenefit: number
  feed: number
  fertilizers: number
  freight: number
  fuel: number
  insurance: number
  interest: number
  labor: number
  pensionPlans: number
  rentLease: number
  repairs: number
  seeds: number
  storage: number
  supplies: number
  taxes: number
  utilities: number
  veterinary: number
  otherExpenses: number
}

export interface FarmBusiness<D = Date> {
  name: string
  ein?: string
  accountingMethod: FarmAccountingMethod
  income: FarmIncome
  expenses: FarmExpenses
  livestockCost?: number
  beginningInventory?: number
  endingInventory?: number
}

// Household Employees (Schedule H)
export interface HouseholdEmployee {
  name: string
  ssn: string
  cashWages: number
  socialSecurityWages: number
  medicareWages: number
  federalWithholding: number
  stateWithholding: number
}

// Dependent Care Provider (Form 2441)
export interface DependentCareProvider {
  name: string
  address: string
  tin: string // SSN or EIN
  amountPaid: number
}

// Education Expense (Form 8863)
export interface EducationExpense {
  studentName: string
  studentSsn: string
  institutionName: string
  institutionEin?: string
  institutionAddress?: string
  qualifiedExpenses: number // Tuition and fees
  scholarshipsReceived: number
  isHalfTimeStudent: boolean
  isFirstFourYears: boolean // First 4 years of postsecondary education
  hasConviction: boolean // Drug felony conviction
  creditType: 'AOTC' | 'LLC' // American Opportunity or Lifetime Learning
  personRole: PersonRole
}

// Energy Improvement (Form 5695)
export type EnergyImprovementType =
  | 'insulation'
  | 'exteriorDoors'
  | 'windows'
  | 'centralAirConditioner'
  | 'waterHeater'
  | 'furnace'
  | 'heatPump'
  | 'biomassStove'
  | 'homeEnergyAudit'

export interface EnergyImprovement<D = Date> {
  type: EnergyImprovementType
  cost: number
  dateInstalled: D
}

export type EnergyImprovementDateString = EnergyImprovement<string>

// Health Insurance Marketplace (Form 8962)
export interface HealthInsuranceMarketplaceInfo<D = Date> {
  policyNumber: string
  coverageStartDate: D
  coverageEndDate: D
  enrollmentPremiums: number[] // Monthly premiums (12 entries)
  slcsp: number[] // Second lowest cost silver plan (12 entries)
  advancePayments: number[] // Advance premium tax credit (12 entries)
  coverageFamily: number // Number of people covered
  sharedPolicyAllocation?: number // Percentage if shared policy
}

// Foreign Earned Income (Form 2555)
export interface ForeignEarnedIncomeInfo<D = Date> {
  foreignCountry: string
  foreignAddress: string
  employerName?: string
  employerAddress?: string
  employerIsForeign: boolean
  foreignEarnedWages: number
  foreignEarnedSelfEmployment: number
  foreignHousingAmount: number
  qualifyingTest: 'bonaFideResident' | 'physicalPresence'
  taxHomeCountry: string
  // Bona fide residence test
  residenceStartDate?: D
  residenceEndDate?: D
  // Physical presence test
  physicalPresenceDays?: number // Days in foreign countries
  physicalPresenceStartDate?: D
  physicalPresenceEndDate?: D
}

// =============================================================================
// Form 2439 - Undistributed Long-Term Capital Gains
// =============================================================================

/**
 * Form 2439 data - Notice to Shareholder of Undistributed Long-Term Capital Gains
 * Received from RICs (mutual funds) or REITs
 */
export interface F2439Data {
  payer: string // Name of RIC or REIT
  payerTin?: string // Payer's TIN
  box1a: number // Total undistributed long-term capital gains
  box1b?: number // Unrecaptured section 1250 gain
  box1c?: number // Section 1202 gain (excluded from tax)
  box1d?: number // Collectibles (28%) gain
  box2: number // Tax paid by the RIC or REIT
}

// =============================================================================
// Form 4136 - Credit for Federal Tax Paid on Fuels
// =============================================================================

export type FuelType =
  | 'nontaxableUseGasoline'
  | 'nontaxableUseAviationGasoline'
  | 'nontaxableUseUndyedDiesel'
  | 'nontaxableUseUndyedKerosene'
  | 'nontaxableUseKeroseneAviation'
  | 'exportedDyedFuels'
  | 'exportedDyedDiesel'
  | 'exportedDyedKerosene'
  | 'biodieselMixture'
  | 'agribiodiesel'
  | 'renewableDiesel'
  | 'alternativeFuel'
  | 'alternativeFuelMixture'
  | 'cngLng'
  | 'liquefiedGasFromBiomass'
  | 'compressedGasFromBiomass'
  | 'sustainableAviationFuel'

/**
 * Fuel tax credit entry for Form 4136
 */
export interface FuelTaxCreditEntry {
  fuelType: FuelType
  gallons: number
  rate?: number // If not provided, use standard rate
  claimant?: string // Type of claimant (registered ultimate vendor, etc.)
  crnCode?: string // Claimant registration number code
}

// =============================================================================
// Form 4972 - Tax on Lump-Sum Distributions
// =============================================================================

/**
 * Lump-sum distribution data for Form 4972
 * Special 10-year averaging or capital gain election
 */
export interface LumpSumDistributionData {
  planName: string
  planEin?: string
  participantBirthYear: number // Must have been born before 1936 for capital gain treatment
  totalDistribution: number // Box 1 of 1099-R
  capitalGainPortion?: number // Amount eligible for capital gain treatment
  ordinaryIncomePortion?: number // Amount subject to ordinary income tax
  netUnrealizedAppreciation?: number // NUA from employer securities
  employeeContributions?: number // Your after-tax contributions
  previouslyTaxedAmount?: number // Amount previously taxed
  currentActuarialValue?: number // Current actuarial value of annuity
  electCapitalGainTreatment?: boolean // Elect 20% capital gain rate for pre-1974 participation
  elect10YearAveraging?: boolean // Elect 10-year averaging
  federalEstateTaxAttributable?: number // Federal estate tax attributable to distribution
}

// =============================================================================
// Business Entity Data Types (Form 1120, 1120-S, 1065, 941, 940)
// =============================================================================

/**
 * Entity type for business returns
 */
export type BusinessEntityType =
  | 'C-Corporation'
  | 'S-Corporation'
  | 'Partnership'
  | 'LLC-Partnership' // LLC taxed as partnership
  | 'LLC-SCorp' // LLC elected S-Corp status
  | 'LLC-CCorp' // LLC elected C-Corp status
  | 'LLC-Disregarded' // Single-member LLC (Schedule C)
  | 'SoleProprietorship' // Schedule C

/**
 * Business entity identification and basic info
 */
export interface BusinessEntity<D = Date> {
  entityName: string
  ein: string
  entityType: BusinessEntityType
  dateIncorporated?: D
  stateOfIncorporation?: State
  address: Address
  principalBusinessActivity: string // NAICS code
  principalProductOrService: string
  accountingMethod: 'cash' | 'accrual' | 'other'
  taxYear: number
  isFiscalYear: boolean
  fiscalYearEnd?: string // MM/DD format if fiscal year
  totalAssets: number
  numberOfEmployees?: number
}

export type BusinessEntityDateString = BusinessEntity<string>

/**
 * S-Corporation Income (Form 1120-S)
 */
export interface SCorpIncome {
  grossReceiptsOrSales: number
  returnsAndAllowances: number
  costOfGoodsSold: number
  netGainFromSaleOfAssets: number // Form 4797
  otherIncome: number
  interestIncome: number
  dividendIncome: number
  grossRents: number
  grossRoyalties: number
}

/**
 * S-Corporation Deductions (Form 1120-S)
 */
export interface SCorpDeductions {
  compensation: number // Shareholder-employee wages
  salariesAndWages: number // Non-shareholder employees
  repairsAndMaintenance: number
  badDebts: number
  rents: number
  taxesAndLicenses: number
  interest: number
  depreciation: number // From Form 4562
  depletion: number
  advertising: number
  pensionPlans: number
  employeeBenefits: number
  otherDeductions: number
}

/**
 * S-Corporation Shareholder Information
 */
export interface SCorpShareholder {
  name: string
  ssn: string
  address?: Address
  ownershipPercentage: number // 0-100
  stockOwned: number // Number of shares
  dateAcquired?: string // Date acquired stock
  isOfficer: boolean
  compensation?: number // If officer/employee
}

/**
 * Schedule K Items (Pass-through to shareholders/partners)
 * Used by both 1120-S and 1065
 */
export interface ScheduleKItems {
  // Income/Loss
  ordinaryBusinessIncome: number // Line 1
  netRentalRealEstateIncome: number // Line 2
  otherNetRentalIncome: number // Line 3c
  interestIncome: number // Line 4
  dividendIncome: number // Line 5a
  qualifiedDividends: number // Line 5b
  royalties: number // Line 6
  netShortTermCapitalGain: number // Line 7
  netLongTermCapitalGain: number // Line 8a
  collectibles28Gain: number // Line 8b
  unrecaptured1250Gain: number // Line 8c
  net1231Gain: number // Line 9
  otherIncome: number // Line 10
  // Deductions
  section179Deduction: number // Line 11
  otherDeductions: number // Line 12
  charitableContributions: number
  // Credits
  lowIncomeHousingCredit: number // Line 13a
  otherCredits: number // Line 13b-13g
  // Self-employment
  netEarningsSE: number // For partners only
  // Tax-exempt income
  taxExemptInterest: number // Line 16a
  otherTaxExemptIncome: number // Line 16b
  nondeductibleExpenses: number // Line 16c
  // Distributions
  cashDistributions: number // Line 16d
  propertyDistributions: number
  // Other
  section199AQBI: number // Line 17
  foreignTransactions?: Record<string, unknown>
  amtItems?: Record<string, unknown>
}

/**
 * Form 1120-S Complete Data Structure
 */
export interface Form1120SData<D = Date> {
  entity: BusinessEntity<D>
  income: SCorpIncome
  deductions: SCorpDeductions
  shareholders: SCorpShareholder[]
  scheduleK: ScheduleKItems
  // Tax computation
  builtInGainsTax?: number // If converted from C-Corp
  excessPassiveIncomeTax?: number // If excess passive income and E&P
  // Prior year items
  priorYearAccumulatedE_P?: number // C-Corp E&P if converted
  // Credits
  generalBusinessCredits?: Record<string, number>
  // Estimated tax payments
  estimatedTaxPayments: number
}

export type Form1120SDataDateString = Form1120SData<string>

/**
 * C-Corporation Income (Form 1120)
 */
export interface CCorpIncome {
  grossReceiptsOrSales: number
  returnsAndAllowances: number
  costOfGoodsSold: number
  dividendIncome: number
  interestIncome: number
  grossRents: number
  grossRoyalties: number
  capitalGainNetIncome: number
  netGainFromSaleOfAssets: number // Form 4797
  otherIncome: number
}

/**
 * C-Corporation Deductions (Form 1120)
 */
export interface CCorpDeductions {
  compensationOfOfficers: number
  salariesAndWages: number
  repairsAndMaintenance: number
  badDebts: number
  rents: number
  taxesAndLicenses: number
  interest: number
  charitableContributions: number // Limited to 10% taxable income
  depreciation: number
  depletion: number
  advertising: number
  pensionPlans: number
  employeeBenefits: number
  domesticProductionDeduction: number
  otherDeductions: number
}

/**
 * C-Corporation Special Deductions (Schedule C of 1120)
 */
export interface CCorpSpecialDeductions {
  dividendsReceivedDeduction: number // 50%, 65%, or 100%
  dividendsFromAffiliated: number
  dividendsOnDebtFinancedStock: number
  dividendsOnCertainPreferred: number
  foreignDividends: number
  nol: number // Net Operating Loss deduction
}

/**
 * Form 1120 Complete Data Structure
 */
export interface Form1120Data<D = Date> {
  entity: BusinessEntity<D>
  income: CCorpIncome
  deductions: CCorpDeductions
  specialDeductions: CCorpSpecialDeductions
  // Tax computation
  taxableIncome: number
  taxBeforeCredits: number // 21% flat rate for 2025
  // Credits
  foreignTaxCredit?: number
  generalBusinessCredits?: Record<string, number>
  priorYearMinimumTax?: number
  // Payments
  estimatedTaxPayments: number
  extensionPayment?: number
  priorYearOverpayment?: number
  // Other
  accumulatedEarnings?: number
  personalHoldingCompanyTax?: number
}

export type Form1120DataDateString = Form1120Data<string>

/**
 * Estimated Tax Payment for Corporations (Form 1120-W)
 */
export interface CorporateEstimatedPayment {
  quarter: 1 | 2 | 3 | 4
  dueDate: Date
  requiredAmount: number
  amountPaid?: number
  datePaid?: Date
  confirmationNumber?: string
}

/**
 * Prior Year Tax Information for Safe Harbor (Form 1120-W)
 */
export interface PriorYearCorporateTax {
  taxableIncome: number
  totalTax: number
  wasLargeCorporation: boolean
  priorYear1TaxableIncome?: number
  priorYear2TaxableIncome?: number
  priorYear3TaxableIncome?: number
}

/**
 * Annualized Income Installment Method Data (Form 1120-W)
 */
export interface AnnualizedIncomeMethod {
  period1Income: number // Jan 1 - Mar 31
  period2Income: number // Jan 1 - May 31
  period3Income: number // Jan 1 - Aug 31
  period4Income: number // Jan 1 - Nov 30
  period1Factor?: number // Default: 4
  period2Factor?: number // Default: 2.4
  period3Factor?: number // Default: 1.5
  period4Factor?: number // Default: 1.09091
}

/**
 * Adjusted Seasonal Installment Method Data (Form 1120-W)
 */
export interface SeasonalInstallmentMethod {
  q1Percentage: number
  q2Percentage: number
  q3Percentage: number
  q4Percentage: number
  incomeThroughQ1: number
  incomeThroughQ2: number
  incomeThroughQ3: number
  incomeThroughQ4: number
}

/**
 * Form 1120-W - Estimated Tax for Corporations
 *
 * Used by C-Corporations to calculate and pay quarterly estimated taxes.
 * Large corporations ($1M+ taxable income in prior 3 years) have special rules.
 */
export interface Form1120WData {
  taxYear: number
  estimatedTaxableIncome: number
  estimatedTax: number
  estimatedCredits: number
  estimatedOtherTaxes: number
  priorYearInfo?: PriorYearCorporateTax
  payments: CorporateEstimatedPayment[]
  useAnnualizedIncomeMethod: boolean
  annualizedIncomeData?: AnnualizedIncomeMethod
  useSeasonalInstallmentMethod: boolean
  seasonalInstallmentData?: SeasonalInstallmentMethod
  recaptureTaxes: number
  refundableCredits: number
}

/**
 * Partnership Partner Information
 */
export interface PartnerInfo {
  name: string
  tin: string // SSN or EIN
  tinType: 'SSN' | 'EIN'
  address?: Address
  isGeneralPartner: boolean
  isLimitedPartner: boolean
  isDomestic: boolean
  profitSharingPercent: number // Profit sharing %
  lossSharingPercent: number // Loss sharing %
  capitalSharingPercent: number // Capital sharing %
  beginningCapitalAccount: number
  capitalContributed: number
  currentYearIncrease: number
  withdrawalsDistributions: number
  endingCapitalAccount: number
  share179Deduction?: number
  shareOtherDeductions?: number
}

/**
 * Partnership Income (Form 1065)
 */
export interface PartnershipIncome {
  grossReceiptsOrSales: number
  returnsAndAllowances: number
  costOfGoodsSold: number
  ordinaryIncome: number // From other partnerships, estates, trusts
  netFarmProfit: number
  netGainFromSaleOfAssets: number
  otherIncome: number
  interestIncome: number
  dividendIncome: number
  grossRents: number
  grossRoyalties: number
  net1231Gain: number
}

/**
 * Partnership Deductions (Form 1065)
 */
export interface PartnershipDeductions {
  salariesAndWages: number
  guaranteedPaymentsToPartners: number
  repairsAndMaintenance: number
  badDebts: number
  rents: number
  taxesAndLicenses: number
  interest: number
  depreciation: number
  depletion: number
  retirementPlans: number
  employeeBenefits: number
  otherDeductions: number
}

/**
 * Form 1065 Complete Data Structure
 */
export interface Form1065Data<D = Date> {
  entity: BusinessEntity<D>
  income: PartnershipIncome
  deductions: PartnershipDeductions
  partners: PartnerInfo[]
  scheduleK: ScheduleKItems
  // Analysis of partners
  numberOfGeneralPartners: number
  numberOfLimitedPartners: number
  // Special items
  liabilitiesAtYearEnd: {
    recourse: number
    nonrecourse: number
    qualifiedNonrecourse: number
  }
  // Partner capital accounts
  capitalAccountMethod: 'tax' | 'GAAP' | 'section704b' | 'other'
}

export type Form1065DataDateString = Form1065Data<string>

/**
 * Employee for payroll purposes
 */
export interface PayrollEmployee {
  name: string
  ssn: string
  wages: number
  federalWithholding: number
  socialSecurityWages: number
  socialSecurityTax: number
  medicareWages: number
  medicareTax: number
  additionalMedicareTax?: number // Over $200K
  tipsReported?: number
  advancedEIC?: number // Legacy, no longer applicable
}

/**
 * Quarterly payroll data for Form 941
 */
export interface QuarterlyPayrollData<D = Date> {
  quarter: 1 | 2 | 3 | 4
  year: number
  endDate: D
  employees: PayrollEmployee[]
  // Aggregate amounts
  totalWages: number
  totalFederalWithholding: number
  totalSocialSecurityWages: number
  totalSocialSecurityTax: number // Employee + employer share
  totalMedicareWages: number
  totalMedicareTax: number // Employee + employer share
  totalAdditionalMedicareTax: number
  totalTipsReported: number
  // Adjustments
  adjustmentForFractions: number
  adjustmentForSickPay: number
  adjustmentForTips: number
  // Deposits and payments
  depositsForQuarter: number
  cobrafPremuimAssistance?: number
  // Credits
  qualifiedSmallBusinessPayrollTaxCredit?: number
  researchCreditPayroll?: number
  // Qualified sick/family leave credits (COVID-era, mostly phased out)
  qualifiedSickLeaveWages?: number
  qualifiedFamilyLeaveWages?: number
}

export type QuarterlyPayrollDataDateString = QuarterlyPayrollData<string>

/**
 * Form 941 Complete Data Structure
 */
export interface Form941Data<D = Date> {
  entity: BusinessEntity<D>
  quarterData: QuarterlyPayrollData<D>
  // Signatures
  payerNameControl: string // First 4 letters of business name
  // Deposit schedule
  depositSchedule: 'monthly' | 'semiweekly'
  totalLiabilityForQuarter: number
  // State information
  stateCode?: State
  stateIdNumber?: string
}

export type Form941DataDateString = Form941Data<string>

/**
 * Annual FUTA data for Form 940
 */
export interface FUTAWageData {
  employeeName: string
  employeeSSN: string
  totalWages: number
  wagesToFUTALimit: number // Up to $7,000 per employee for 2025
  stateUnemploymentWages: number
  stateUnemploymentContributions: number
}

/**
 * Form 940 Complete Data Structure
 */
export interface Form940Data<D = Date> {
  entity: BusinessEntity<D>
  taxYear: number
  // Type of return
  isAmended: boolean
  isFinal: boolean
  isSuccessor: boolean
  // State information
  statesWhereWagesPaid: State[]
  allWagesExemptFromSUTA: boolean
  // Wages
  totalPayments: number // Line 3
  exemptPayments: number // Line 4 (retirement, group life, dependent care, other)
  paymentsOverFUTALimit: number // Line 5
  totalTaxableWages: number // Line 7
  // FUTA tax calculation
  futaTaxBeforeAdjustments: number // Line 8 (0.6% of line 7)
  // Multi-state adjustments
  stateUnemploymentTaxCredit: number // Line 9
  creditReductionAmount: number // Line 10 (for credit reduction states)
  totalFUTATax: number // Line 12
  // Payments
  depositsForYear: number // Line 13
  balanceDue: number
  overpayment: number
  // Per-employee data for Schedule A if needed
  employees?: FUTAWageData[]
}

export type Form940DataDateString = Form940Data<string>

/**
 * General Business Credit Components (Form 3800)
 */
export interface GeneralBusinessCreditComponents {
  investmentCredit?: number // Form 3468
  workOpportunityCredit?: number // Form 5884
  alcoholFuelsCredit?: number // Form 6478
  researchCredit?: number // Form 6765
  lowIncomeHousingCredit?: number // Form 8586
  disabledAccessCredit?: number // Form 8826
  renewableElectricityCredit?: number // Form 8835
  empowermentZoneCredit?: number // Form 8844
  indianEmploymentCredit?: number // Form 8845
  orphanDrugCredit?: number // Form 8820
  newMarketsCredit?: number // Form 8874
  creditForEmployerSSOnTips?: number // Form 8846
  biodieselFuelsCredit?: number // Form 8864
  smallEmployerPensionStartup?: number // Form 8881
  employerProvidedChildcareCredit?: number // Form 8882
  differentialWageCredit?: number // Form 8932
  carbonOxideSequestration?: number // Form 8933
  qualifiedPlugInCredit?: number // Form 8936
  smallEmployerHealthInsurance?: number // Form 8941 Part III
  otherCredits?: number
}

/**
 * Form 3800 Complete Data Structure
 */
export interface Form3800Data {
  creditComponents: GeneralBusinessCreditComponents
  carryforwardFromPriorYears: number
  carrybackFromFutureYears: number
  currentYearCredits: number
  regularTaxLiability: number
  tentativeMinimumTax: number
  netIncomeTax: number
  netRegularTaxLiability: number
  allowedCredit: number // Lesser of available credit or limitation
  carryforwardToNextYear: number
}

// =============================================================================
// Form 944 - Employer's Annual Federal Tax Return (Small Employers)
// =============================================================================

/**
 * Form 944 - For employers with annual employment tax liability of $1,000 or less
 * Annual version of Form 941
 */
export interface Form944Data<D = Date> {
  entity: BusinessEntity<D>
  taxYear: number
  employees: PayrollEmployee[]
  // Annual totals
  totalWages: number
  totalFederalWithholding: number
  totalSocialSecurityWages: number
  totalMedicareWages: number
  totalTipsReported: number
  // Tax calculations
  socialSecurityTax: number
  medicareTax: number
  additionalMedicareTax: number
  totalTaxBeforeAdjustments: number
  // Adjustments
  adjustmentForFractions: number
  adjustmentForSickPay: number
  adjustmentForTips: number
  // Deposits
  totalDeposits: number
  // Credits
  cobraCredits?: number
  researchCredit?: number
}

export type Form944DataDateString = Form944Data<string>

// =============================================================================
// Form 943 - Employer's Annual Federal Tax Return for Agricultural Employees
// =============================================================================

/**
 * Form 943 - For employers of agricultural (farm) workers
 */
export interface Form943Data<D = Date> {
  entity: BusinessEntity<D>
  taxYear: number
  // Employee information
  farmworkers: PayrollEmployee[]
  // Wages
  totalWages: number
  totalSocialSecurityWages: number
  totalMedicareWages: number
  // Tax
  federalWithholding: number
  socialSecurityTax: number
  medicareTax: number
  additionalMedicareTax: number
  // Adjustments
  adjustmentForFractions: number
  // Deposits
  totalDeposits: number
  depositSchedule: 'monthly' | 'semiweekly'
  // Crew leader information
  crewLeaderPaid?: boolean
}

export type Form943DataDateString = Form943Data<string>

// =============================================================================
// Form 945 - Annual Return of Withheld Federal Income Tax
// =============================================================================

/**
 * Form 945 - For non-payroll withholding (pensions, gambling, backup)
 */
export interface Form945Data<D = Date> {
  entity: BusinessEntity<D>
  taxYear: number
  // Withholding types
  pensionWithholding: number
  gamblingWithholding: number
  backupWithholding: number
  indianGamingWithholding: number
  // Total
  totalWithholding: number
  // Adjustments
  adjustmentForFractions: number
  // Deposits
  totalDeposits: number
  depositSchedule: 'monthly' | 'semiweekly'
}

export type Form945DataDateString = Form945Data<string>

// =============================================================================
// Form 1099 Series - Information Returns
// =============================================================================

/**
 * Common fields for all 1099 forms
 */
export interface Form1099Base {
  payerName: string
  payerTIN: string
  payerAddress: Address
  recipientName: string
  recipientTIN: string
  recipientAddress?: Address
  accountNumber?: string
  taxYear: number
}

/**
 * Form 1099-NEC - Nonemployee Compensation
 */
export interface Form1099NECGenerated extends Form1099Base {
  formType: '1099-NEC'
  box1NonemployeeCompensation: number
  box4FederalWithholding?: number
  box5StateTaxWithheld?: number
  box6StateId?: string
  box7StateIncome?: number
}

/**
 * Form 1099-MISC - Miscellaneous Information
 */
export interface Form1099MISCGenerated extends Form1099Base {
  formType: '1099-MISC'
  box1Rents?: number
  box2Royalties?: number
  box3OtherIncome?: number
  box4FederalWithholding?: number
  box5FishingBoatProceeds?: number
  box6MedicalPayments?: number
  box8SubstitutePayments?: number
  box9CropInsurance?: number
  box10GrossProceedsAttorney?: number
  box11FishPurchased?: number
  box12Section409A?: number
  box13ExcessGoldenParachute?: number
  box14NonqualifiedDeferredComp?: number
  box15StateTaxWithheld?: number
  box16StatePayerNumber?: string
  box17StateIncome?: number
}

/**
 * Form 1099-INT - Interest Income
 */
export interface Form1099INTGenerated extends Form1099Base {
  formType: '1099-INT'
  box1Interest: number
  box2EarlyWithdrawalPenalty?: number
  box3USBondInterest?: number
  box4FederalWithholding?: number
  box5InvestmentExpenses?: number
  box6ForeignTaxPaid?: number
  box7ForeignCountry?: string
  box8TaxExemptInterest?: number
  box9SpecifiedPrivateActivityBond?: number
  box10MarketDiscount?: number
  box11BondPremium?: number
  box12TreasuryBondPremium?: number
  box13TaxExemptBondPremium?: number
  box14CUSIP?: string
  box15StateTaxWithheld?: number
  box16State?: State
  box17StateIdNumber?: string
}

/**
 * Form 1099-DIV - Dividends and Distributions
 */
export interface Form1099DIVGenerated extends Form1099Base {
  formType: '1099-DIV'
  box1aTotalOrdinaryDividends: number
  box1bQualifiedDividends: number
  box2aTotalCapitalGainDist?: number
  box2bUnrecaptured1250Gain?: number
  box2cSection1202Gain?: number
  box2dCollectiblesGain?: number
  box2eSection897OrdinaryDividends?: number
  box2fSection897CapitalGain?: number
  box3NondividendDistributions?: number
  box4FederalWithholding?: number
  box5Section199ADividends?: number
  box6InvestmentExpenses?: number
  box7ForeignTaxPaid?: number
  box8ForeignCountry?: string
  box9CashLiquidationDist?: number
  box10NoncashLiquidationDist?: number
  box11ExemptInterestDividends?: number
  box12SpecifiedPrivateActivityBondDividends?: number
  box13State?: State
  box14StateIdNumber?: string
  box15StateTaxWithheld?: number
}

/**
 * Form 1099-K - Payment Card and Third Party Network Transactions
 */
export interface Form1099KGenerated extends Form1099Base {
  formType: '1099-K'
  box1aGrossAmount: number
  box1bCardNotPresent?: number
  box2MerchantCategoryCode?: string
  box3NumberOfTransactions: number
  box4FederalWithholding?: number
  box5aJanuary?: number
  box5bFebruary?: number
  box5cMarch?: number
  box5dApril?: number
  box5eMay?: number
  box5fJune?: number
  box5gJuly?: number
  box5hAugust?: number
  box5iSeptember?: number
  box5jOctober?: number
  box5kNovember?: number
  box5lDecember?: number
  box6State?: State
  box7StateIdNumber?: string
  box8StateTaxWithheld?: number
}

/**
 * Form 1099-B - Proceeds from Broker and Barter Exchange Transactions
 */
export interface Form1099BGenerated extends Form1099Base {
  formType: '1099-B'
  box1aDescription: string
  box1bDateAcquired?: string
  box1cDateSold: string
  box1dProceeds: number
  box1eCostBasis?: number
  box1fAccruedMarketDiscount?: number
  box1gWashSaleDisallowed?: number
  box2ShortTermGainLoss?: number
  box3LongTermGainLoss?: number
  box4FederalWithholding?: number
  box5Checkbox?: boolean // Noncovered security
  box6ReportedToIRS?: 'A' | 'B' | 'D' | 'X' // Basis reporting
  box7LossNotAllowed?: boolean
  box8Type?: 'ordinary' | 'QOF' | 'collectibles'
  box9QOFDeferredGain?: number
  box11StateTaxWithheld?: number
  box12State?: State
  box13StateIdNumber?: string
}

/**
 * Form 1099-R - Distributions From Pensions, Annuities, Retirement, etc.
 */
export interface Form1099RGenerated extends Form1099Base {
  formType: '1099-R'
  box1GrossDistribution: number
  box2aTaxableAmount: number
  box2bTaxableNotDetermined?: boolean
  box2bTotalDistribution?: boolean
  box3CapitalGain?: number
  box4FederalWithholding?: number
  box5EmployeeContributions?: number
  box6NetUnrealizedAppreciation?: number
  box7DistributionCode: string // e.g., '1', '7', 'G'
  box7IRASEPSimple?: boolean
  box8Other?: number
  box8OtherPercent?: number
  box9aYourPercentage?: number
  box9bTotalEmployeeContributions?: number
  box10AmountAllocableToIRR?: number
  box11FirstYearRothContribution?: number
  box12StateTaxWithheld?: number
  box13State?: State
  box14StateDistribution?: number
  box15LocalTaxWithheld?: number
  box16LocalityName?: string
  box17LocalDistribution?: number
}

/**
 * Form 1099-S - Proceeds from Real Estate Transactions
 */
export interface Form1099SGenerated extends Form1099Base {
  formType: '1099-S'
  box1DateOfClosing: string
  box2GrossProceeds: number
  box3AddressOfProperty: string
  box4BuyerReceivedPropertyTax?: boolean
  box5BuyerPart?: number
  box6ForeignPerson?: boolean
}

/**
 * Combined type for all generated 1099 forms
 */
export type Generated1099Form =
  | Form1099NECGenerated
  | Form1099MISCGenerated
  | Form1099INTGenerated
  | Form1099DIVGenerated
  | Form1099KGenerated
  | Form1099BGenerated
  | Form1099RGenerated
  | Form1099SGenerated

// =============================================================================
// Form W-2 and W-3 - Wage Statements
// =============================================================================

/**
 * Form W-2 - Wage and Tax Statement (Generated by employer)
 */
export interface FormW2Generated {
  // Employer info
  employerEIN: string
  employerName: string
  employerAddress: Address
  // Employee info
  employeeSSN: string
  employeeName: string
  employeeAddress?: Address
  // Boxes
  box1Wages: number
  box2FederalWithholding: number
  box3SocialSecurityWages: number
  box4SocialSecurityTax: number
  box5MedicareWages: number
  box6MedicareTax: number
  box7SocialSecurityTips?: number
  box8AllocatedTips?: number
  box10DependentCareBenefits?: number
  box11NonqualifiedPlans?: number
  box12: W2Box12Info // Various codes
  box13Statutory?: boolean
  box13RetirementPlan?: boolean
  box13ThirdPartySickPay?: boolean
  // State/local
  box15State?: State
  box15StateEIN?: string
  box16StateWages?: number
  box17StateWithholding?: number
  box18LocalWages?: number
  box19LocalWithholding?: number
  box20LocalityName?: string
  // Control number
  controlNumber?: string
  taxYear: number
}

/**
 * Form W-3 - Transmittal of Wage and Tax Statements
 */
export interface FormW3Data {
  // Employer info
  employerEIN: string
  employerName: string
  employerAddress: Address
  employerContactName?: string
  employerContactPhone?: string
  employerContactEmail?: string
  // Aggregate data from all W-2s
  numberOfW2s: number
  totalWages: number
  totalFederalWithholding: number
  totalSocialSecurityWages: number
  totalSocialSecurityTax: number
  totalMedicareWages: number
  totalMedicareTax: number
  totalSocialSecurityTips?: number
  totalAllocatedTips?: number
  totalDependentCareBenefits?: number
  totalNonqualifiedPlans?: number
  // Kind of employer
  kindOfEmployer: '941' | '943' | '944' | 'CT-1' | 'Household' | 'Military'
  // Kind of payer
  kindOfPayer: 'regular' | 'government' | '501c' | 'thirdParty'
  taxYear: number
}

// =============================================================================
// Form 1096 - Annual Summary and Transmittal
// =============================================================================

/**
 * Form 1096 - Transmittal for 1099 forms
 */
export interface Form1096Data {
  filerName: string
  filerTIN: string
  filerAddress: Address
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  // Type of form being transmitted
  formType:
    | '1099-NEC'
    | '1099-MISC'
    | '1099-INT'
    | '1099-DIV'
    | '1099-B'
    | '1099-R'
    | '1099-S'
    | '1099-K'
  numberOfForms: number
  totalAmount: number
  federalWithholding?: number
  taxYear: number
}

// =============================================================================
// Form 720 - Quarterly Federal Excise Tax Return
// =============================================================================

export type ExciseTaxCategory =
  | 'fuel'
  | 'environmental'
  | 'communications'
  | 'airTransportation'
  | 'retailTax'
  | 'shipPassenger'
  | 'foreignInsurance'
  | 'indoorTanning'
  | 'manufacturer'
  | 'vaccines'
  | 'opioid'

export interface ExciseTaxItem {
  category: ExciseTaxCategory
  irn: string // IRS Reference Number
  description: string
  gallonsOrUnits: number
  rate: number
  taxAmount: number
}

/**
 * Form 720 - Quarterly Federal Excise Tax Return
 */
export interface Form720Data<D = Date> {
  entity: BusinessEntity<D>
  quarter: 1 | 2 | 3 | 4
  year: number
  // Tax items by category
  exciseTaxItems: ExciseTaxItem[]
  // Part I totals
  totalTaxLiability: number
  // Part II - Adjustments
  adjustments: number
  // Deposits
  depositsForQuarter: number
  // Claims
  claimsForRefund: number
  // Net tax
  netTax: number
}

export type Form720DataDateString = Form720Data<string>

// =============================================================================
// Form 2290 - Heavy Highway Vehicle Use Tax Return
// =============================================================================

export interface HeavyVehicle {
  vin: string
  taxableGrossWeight: number // In pounds (55,000+ taxable)
  categoryLetter: string // A through V based on weight
  firstUseMonth: number // 1-12
  loggingUse?: boolean // Reduced rate for logging
  suspended?: boolean // Mileage under 5,000 (7,500 for ag)
}

/**
 * Form 2290 - Heavy Highway Vehicle Use Tax Return
 */
export interface Form2290Data<D = Date> {
  entity: BusinessEntity<D>
  taxPeriod: string // July YYYY - June YYYY+1
  taxYear: number
  // Vehicles
  vehicles: HeavyVehicle[]
  // Tax computation
  totalTaxableVehicles: number
  totalSuspendedVehicles: number
  totalTax: number
  // Credits
  creditForVehiclesSold: number
  creditForLowMileage: number
  // Prior year
  priorYearCredit?: number
  // Payment
  amountDue: number
  // Electronic filing required if 25+ vehicles
  electronicFilingRequired: boolean
}

export type Form2290DataDateString = Form2290Data<string>

// =============================================================================
// Form 8832 - Entity Classification Election
// =============================================================================

export type EntityClassificationChoice =
  | 'corporation' // Taxed as corporation
  | 'partnership' // Taxed as partnership (default for multi-member)
  | 'disregarded' // Disregarded entity (default for single-member LLC)
  | 'sCorporation' // S-Corporation election (requires 2553)

/**
 * Form 8832 - Entity Classification Election
 */
export interface Form8832Data<D = Date> {
  entityName: string
  ein: string
  address: Address
  // Election information
  electionType: 'initial' | 'change'
  effectiveDate: D
  previousClassification?: EntityClassificationChoice
  newClassification: EntityClassificationChoice
  // Entity formation
  dateFormed: D
  stateOrCountryOfFormation: string
  // Ownership
  numberOfOwners: number
  ownerNames?: string[]
  // Late election relief
  isLateElection?: boolean
  lateElectionReason?: string
  // Consent
  allOwnersConsent: boolean
}

export type Form8832DataDateString = Form8832Data<string>

// =============================================================================
// Form 2553 - Election by a Small Business Corporation
// =============================================================================

export interface SCorpShareholderConsent {
  name: string
  ssn: string
  address?: Address
  stockOwned: number // Number of shares
  dateAcquired: string
  taxYearEnd: string // Fiscal year ending month/day
  signatureDate: string
  consent: boolean
}

/**
 * Form 2553 - S Corporation Election
 */
export interface Form2553Data<D = Date> {
  // Corporation info
  corporationName: string
  ein: string
  address: Address
  dateIncorporated: D
  stateOfIncorporation: State
  // Election details
  effectiveDate: D // First day of tax year election is effective
  taxYearEnd: 'December' | string // Calendar year or fiscal
  // Principal business
  principalBusinessActivity: string
  principalProduct: string
  // Shareholders (100 max)
  shareholders: SCorpShareholderConsent[]
  totalShares: number
  // Late election
  isLateElection?: boolean
  reasonForLateElection?: string
  // Officer signature
  officerName: string
  officerTitle: string
  signatureDate: D
  phoneNumber: string
}

export type Form2553DataDateString = Form2553Data<string>

// =============================================================================
// Schedule K-1 (Generated)
// =============================================================================

/**
 * Schedule K-1 (Form 1065) - Partner's Share of Income
 */
export interface ScheduleK1Form1065Generated {
  // Partnership info
  partnershipName: string
  partnershipEIN: string
  partnershipAddress: Address
  irsCenter: string
  // Partner info
  partnerName: string
  partnerTIN: string
  partnerAddress?: Address
  partnerType: 'general' | 'limited' | 'LLC-member'
  domesticOrForeign: 'domestic' | 'foreign'
  // Ownership
  profitShareBeginning: number
  profitShareEnd: number
  lossShareBeginning: number
  lossShareEnd: number
  capitalShareBeginning: number
  capitalShareEnd: number
  // Capital account
  beginningCapitalAccount: number
  capitalContributed: number
  currentYearNetIncome: number
  otherIncreaseDecrease: number
  withdrawalsDistributions: number
  endingCapitalAccount: number
  capitalAccountMethod: 'tax' | 'GAAP' | 'section704b' | 'other'
  // Partner's share of liabilities
  recourseShare: number
  qualifiedNonrecourseShare: number
  nonrecourseShare: number
  // K-1 items (from ScheduleKItems)
  items: ScheduleKItems
  // AMT items
  amtItems?: Record<string, number>
  // Tax year
  taxYear: number
  isFinalK1: boolean
}

/**
 * Schedule K-1 (Form 1120-S) - Shareholder's Share of Income
 */
export interface ScheduleK1Form1120SGenerated {
  // Corporation info
  corporationName: string
  corporationEIN: string
  corporationAddress: Address
  irsCenter: string
  // Shareholder info
  shareholderName: string
  shareholderTIN: string
  shareholderAddress?: Address
  // Ownership
  percentageOfStock: number
  // K-1 items
  items: ScheduleKItems
  // Shareholder's pro rata share loans to S corp
  shareholderLoans?: number
  // Tax year
  taxYear: number
  isFinalK1: boolean
}

// =============================================================================
// Additional Business Credit Forms Data
// =============================================================================

/**
 * Form 5884 - Work Opportunity Credit
 */
export interface Form5884Data {
  qualifiedWages: {
    targetGroup: string
    employeeName: string
    wages: number
    creditRate: number // 25% or 40%
    credit: number
  }[]
  totalCredit: number
}

/**
 * Form 6765 - Credit for Increasing Research Activities
 */
export interface Form6765Data {
  // Regular credit method
  qualifiedResearchExpenses: number
  basicResearchPayments: number
  fixedBasePercentage: number
  // Alternative simplified credit
  useSimplifiedMethod: boolean
  currentYearQRE?: number
  priorYearQRE?: number[] // Prior 3 years
  // Credit calculation
  regularCredit: number
  alternativeCredit: number
  totalCredit: number
  // Payroll tax election (qualified small business)
  electPayrollTaxCredit?: boolean
  payrollTaxCreditAmount?: number
}

/**
 * Form 8994 - Employer Credit for Paid Family and Medical Leave
 */
export interface Form8994Data {
  qualifiedEmployees: {
    name: string
    wagesForLeave: number
    normalWages: number
    leaveWagesPercent: number // 50-100%
    creditRate: number // 12.5-25%
    credit: number
  }[]
  totalCredit: number
}

/**
 * Form 8586 - Low-Income Housing Credit
 */
export interface Form8586Data {
  buildings: {
    buildingIdentificationNumber: string
    address: string
    dateAcquired: string
    dateOfAllocation: string
    qualifiedBasisAmount: number
    creditPercentage: number // 4% or ~9%
    creditAmount: number
  }[]
  passthrough8586Credit?: number // From partnerships/S-corps
  totalCredit: number
}

/**
 * Form 8826 - Disabled Access Credit
 */
export interface Form8826Data {
  eligibleAccessExpenditures: number // Total eligible expenses (max $10,250)
  minimumExpenditure: number // $250 (not eligible)
  maximumExpenditure: number // $10,250 (cap)
  taxYear: number
  totalCredit: number // 50% of expenses between $250 and $10,250 (max $5,000)
}

/**
 * Form 8835 - Renewable Electricity Production Credit
 */
export interface Form8835Data {
  facilities: {
    facilityType:
      | 'wind'
      | 'closedLoopBiomass'
      | 'openLoopBiomass'
      | 'geothermal'
      | 'solar'
      | 'smallIrrigation'
      | 'landfillGas'
      | 'trash'
      | 'hydropower'
      | 'marineHydrokinetic'
    dateInService: string
    kilowattHoursProduced: number
    creditRate: number // Per kWh rate
    creditAmount: number
  }[]
  passthrough8835Credit?: number
  totalCredit: number
}

/**
 * Form 8844 - Empowerment Zone Employment Credit
 */
export interface Form8844Data {
  qualifiedEmployees: {
    name: string
    ssn: string
    zoneName: string // Name of empowerment zone
    qualifiedWages: number // Up to $15,000 per employee
    creditAmount: number // 20% of qualified wages
  }[]
  passthrough8844Credit?: number
  totalCredit: number
}

/**
 * Form 8845 - Indian Employment Credit
 */
export interface Form8845Data {
  qualifiedEmployees: {
    name: string
    ssn: string
    reservationName: string
    qualifiedWages: number
    qualifiedHealthInsuranceCosts: number
    totalQualifiedAmount: number // Up to $20,000 per employee
    priorYearAmount: number
    incrementalAmount: number
    creditAmount: number // 20% of incremental amount
  }[]
  passthrough8845Credit?: number
  totalCredit: number
}

/**
 * Form 8820 - Orphan Drug Credit
 */
export interface Form8820Data {
  qualifiedClinicalTestingExpenses: number
  passthrough8820Credit?: number
  totalCredit: number // 25% of qualified clinical testing expenses
}

/**
 * Form 8874 - New Markets Credit
 */
export interface Form8874Data {
  qualifiedEquityInvestments: {
    cdfiName: string // Community Development Financial Institution
    cdfiEIN: string
    dateOfInvestment: string
    originalInvestmentAmount: number
    creditAllocationYear: number
    creditPercentage: number // 5% for years 1-3, 6% for years 4-7
    creditAmount: number
  }[]
  passthrough8874Credit?: number
  totalCredit: number
}

/**
 * Form 8846 - Credit for Employer SS/Medicare Taxes Paid on Tips
 */
export interface Form8846Data {
  tippedEmployees: {
    name: string
    ssn: string
    totalTips: number
    tipsAboveMinWage: number // Tips above minimum wage already
    creditableTips: number // Tips below cash wage limit
    ssAndMedicareTax: number // 7.65% employer portion
  }[]
  passthrough8846Credit?: number
  totalCredit: number
}

/**
 * Form 8864 - Biodiesel and Renewable Diesel Fuels Credit
 */
export interface Form8864Data {
  biodieselGallons: number
  biodieselCreditRate: number // $1.00 per gallon
  biodieselCredit: number
  agribiodieselGallons: number
  agribiodieselCreditRate: number // $1.00 per gallon
  agribiodieselCredit: number
  renewableDieselGallons: number
  renewableDieselCreditRate: number // $1.00 per gallon
  renewableDieselCredit: number
  passthrough8864Credit?: number
  totalCredit: number
}

/**
 * Form 8881 - Credit for Small Employer Pension Plan Startup Costs
 */
export interface Form8881Data {
  qualifiedStartupCosts: number // Up to $5,000 per year
  autoEnrollmentCredit: number // Up to $500 for auto-enrollment feature
  numberOfNonHighlyCompensatedEmployees: number // Max 100
  yearsOfCredit: number // Up to 3 years
  passthrough8881Credit?: number
  totalCredit: number // 50% of startup costs (max $250-$5,000 depending on employees)
}

/**
 * Form 8882 - Credit for Employer-Provided Childcare
 */
export interface Form8882Data {
  qualifiedChildcareFacilityCosts: number
  qualifiedChildcareResourceCosts: number
  totalQualifiedCosts: number
  passthrough8882Credit?: number
  totalCredit: number // 25% of facility costs + 10% of resource costs (max $150,000)
}

/**
 * Form 8932 - Credit for Employer Differential Wage Payments
 */
export interface Form8932Data {
  qualifiedEmployees: {
    name: string
    ssn: string
    militaryDutyDays: number
    differentialWagesPaid: number // Wages paid while on active duty
    creditAmount: number // 20% of wages (max $20,000 per employee)
  }[]
  passthrough8932Credit?: number
  totalCredit: number
}

/**
 * Form 8933 - Carbon Oxide Sequestration Credit
 */
export interface Form8933Data {
  facilities: {
    facilityName: string
    location: string
    metricTonsCaptured: number
    disposalMethod: 'geologicStorage' | 'enhancedOilRecovery' | 'utilization'
    creditRate: number // Varies by disposal method and capture year
    creditAmount: number
  }[]
  passthrough8933Credit?: number
  totalCredit: number
}

/**
 * Form 3468 - Investment Credit
 */
export interface Form3468Data {
  // Rehabilitation credit
  rehabilitatedBuildings: {
    buildingAddress: string
    preCertified: boolean
    qualifiedRehabilitationExpenditures: number
    creditPercentage: number // 20% for certified historic structures
    creditAmount: number
  }[]
  // Energy credit
  energyProperty: {
    propertyDescription: string
    propertyType:
      | 'solar'
      | 'geothermal'
      | 'fuelCell'
      | 'microturbine'
      | 'chp'
      | 'smallWind'
      | 'offshoreWind'
      | 'geothermalHeatPump'
      | 'wasteEnergyRecovery'
    basisForCredit: number
    creditPercentage: number // 6% base, up to 30% with prevailing wage/apprenticeship
    creditAmount: number
  }[]
  // Qualifying advanced coal/gasification projects
  advancedEnergyProjectCredit?: number
  // Passthrough credits
  passthrough3468Credit?: number
  totalCredit: number
}

// =============================================================================

export interface Information<D = Date> {
  f1099s: Supported1099[]
  w2s: IncomeW2[]
  realEstate: Property[]
  estimatedTaxes: EstimatedTaxPayments[]
  f1098es: F1098e[]
  f3921s: F3921[]
  scheduleK1Form1065s: ScheduleK1Form1065[]
  itemizedDeductions: ItemizedDeductions | undefined
  refund?: Refund
  taxPayer: TaxPayer<D>
  questions: Responses
  credits: Credit[]
  stateResidencies: StateResidency[]
  healthSavingsAccounts: HealthSavingsAccount<D>[]
  individualRetirementArrangements: Ira[]
  // Local Tax Information (city/municipal taxes)
  localTaxInfo?: LocalTaxInfo
  // OBBBA 2025 new fields
  overtimeIncome?: OvertimeIncome
  tipIncome?: TipIncome
  autoLoanInterest?: AutoLoanInterest
  trumpSavingsAccounts?: TrumpSavingsAccount<D>[]
  // Phase 1-3 Form Data (using generic Record types to avoid conflicts with form-specific interfaces)
  priorYearTax?: number // Prior year tax liability (F2210)
  priorYearTaxInfo?: PriorYearTaxInfo[] // Prior year tax info for income averaging (ScheduleJ)
  movingExpenses?: Record<string, unknown> // Form 3903 (cast in form)
  depreciableAssets?: Record<string, unknown>[] // Form 4562 (cast in form)
  section179Carryover?: number // Form 4562
  amortizationCostsCurrentYear?: number // Form 4562
  amortizationCostsPriorYears?: number // Form 4562
  casualtyEvents?: Record<string, unknown>[] // Form 4684 (cast in form)
  requestExtension?: boolean // Form 4868
  extensionPayment?: number // Form 4868
  outOfCountryOnDueDate?: boolean // Form 4868
  earlyDistributionExceptions?: EarlyDistributionException[] // Form 5329
  excessIraContributions?: number // Form 5329
  excessRothContributions?: number // Form 5329
  excessEsaContributions?: number // Form 5329
  excessHsaContributions?: number // Form 5329
  rmdShortfall?: RmdShortfall // Form 5329
  atRiskActivities?: AtRiskActivity[] // Form 6198
  installmentSales?: Record<string, unknown>[] // Form 6252 (cast in form)
  iraContributions?: IraContribution[] // Form 8606, F8880
  rothConversions?: RothConversion[] // Form 8606
  traditionalIraBasis?: number // Form 8606
  iraEndOfYearValue?: number // Form 8606
  rothDistributions?: RothDistribution[] // Form 8606
  rothIraBasis?: number // Form 8606
  parentInfo?: ParentTaxInfo // Form 8615 (Kiddie Tax)
  priorYearAmtCredit?: number // Form 8801
  priorYearAmt?: PriorYearAmtInfo // Form 8801
  priorYearAmtCreditCarryforward?: number // Form 8801
  likeKindExchanges?: Record<string, unknown>[] // Form 8824 (cast in form)
  homeOffice?: Record<string, unknown> // Form 8829 (cast in form)
  adoptedChildren?: AdoptedChild[] // Form 8839
  adoptionCreditCarryforward?: number // Form 8839
  foreignFinancialAssets?: Record<string, unknown>[] // Form 8938 (cast in form)
  farmBusiness?: Record<string, unknown> // Schedule F (cast in form)
  electFarmIncomeAveraging?: boolean // Schedule J
  householdEmployees?: Record<string, unknown>[] // Schedule H (cast in form)
  householdTaxDeposits?: number // Schedule H
  // Schedule C - Business Income
  businesses?: Record<string, unknown>[] // Schedule C (cast in form)
  // Form 2441 - Child Care
  dependentCareProviders?: DependentCareProvider[]
  dependentCareExpenses?: number
  employerDependentCareBenefits?: number
  // Form 8863 - Education Credits
  educationExpenses?: EducationExpense[]
  // Form 5695 - Energy Credits
  energyImprovements?: EnergyImprovement<D>[]
  solarPanelCost?: number
  windEnergyCost?: number
  geothermalCost?: number
  fuelCellCost?: number
  batteryStorageCost?: number
  cleanEnergyProperties?: Record<string, unknown>[] // Part I: Solar, wind, geothermal, fuel cells, battery
  homeImprovements?: Record<string, unknown>[] // Part II: Insulation, doors, windows, HVAC
  cleanEnergyCarryforward?: number // Carryforward from prior year
  // Form 8962 - Premium Tax Credit
  healthInsuranceMarketplace?: HealthInsuranceMarketplaceInfo<D>[]
  // Form 2555 - Foreign Earned Income
  foreignEarnedIncome?: ForeignEarnedIncomeInfo<D>
  // Schedule R - Elderly/Disabled Credit
  disabilityIncome?: number
  nontaxablePensionIncome?: number
  // Military retirement income (for state deductions)
  militaryRetirement?: number
  // Form 4797 - Sale of Business Property
  businessPropertySales?: Record<string, unknown>[]
  priorSection1231Losses?: number // Total unrecaptured Section 1231 losses from prior 5 years
  section179Recapture?: number
  // Form 2439 - Undistributed Long-Term Capital Gains
  f2439s?: F2439Data[]
  // Form 4136 - Credit for Federal Tax Paid on Fuels
  fuelTaxCredits?: FuelTaxCreditEntry[]
  // Form 4972 - Tax on Lump-Sum Distributions
  lumpSumDistributions?: LumpSumDistributionData[]
  // HSA spouse allocation (0-100 percent to primary taxpayer, default 50)
  hsaSpouseAllocationPercent?: number
  // Form 2350 - Extension for Citizens Abroad
  abroadExtension?: Record<string, unknown>
  // Form 4255 - Recapture of Investment Credit
  investmentCreditRecaptures?: Record<string, unknown>[]
  // Form 7004 - Business Extension
  businessExtension?: Record<string, unknown>
  // Form 8379 - Injured Spouse Allocation
  injuredSpouse?: Record<string, unknown>
  // Form 843 - Claim for Refund
  refundClaim?: Record<string, unknown>
  // Form 8582-CR - Passive Activity Credit Limitations
  passiveActivityCredits?: Record<string, unknown>[]
  // Form 8810 - Corporate Passive Activity Loss
  corporatePassiveInfo?: Record<string, unknown>
  // Form 8833 - Treaty-Based Return Position
  treatyPositions?: Record<string, unknown>[]
  // Form 8840 - Closer Connection Exception
  closerConnection?: Record<string, unknown>
  // Form 8843 - Exempt Individual Statement
  exemptIndividualInfo?: Record<string, unknown>
  // Form 8862 - Credits After Disallowance
  creditDisallowance?: Record<string, unknown>
  // Form 8868 - Exempt Organization Extension
  exemptOrgExtension?: Record<string, unknown>
  // Form 8915-F - Qualified Disaster Distributions
  disasterDistributions?: Record<string, unknown>[]
  // Form 8941 - Small Employer Health Insurance Credit
  smallEmployerHealth?: Record<string, unknown>
  // Form 9465 - Installment Agreement Request
  installmentAgreement?: Record<string, unknown>
  // Form 4952 - Investment Interest Expense
  investmentInterestExpense?: number
  investmentInterestCarryforward?: number
  capitalGainsElectedAsInvestmentIncome?: number
  // Form 8888 - Allocation of Refund
  refundAllocations?: Record<string, unknown>[]
  // Form 4137 - Unreported Tip Income
  unreportedTipIncome?: number
  // Form 8910 - Alternative Motor Vehicle Credit
  fuelCellVehicles?: Record<string, unknown>[]
  fuelCellCreditCarryforward?: number
  // Form 8919 - Uncollected SS/Medicare Tax
  uncollectedSSTaxWages?: Record<string, unknown>[]
  // Form 6168 - Long-Term Contracts Look-Back
  longTermContracts?: Record<string, unknown>[]
  // Business Entity Data (for business owners filing individual returns)
  // These are used when an individual owns a pass-through entity
  sCorpOwnership?: Form1120SData<D>[] // S-Corps owned (generates K-1)
  partnershipOwnership?: Form1065Data<D>[] // Partnerships owned (generates K-1)
  cCorpOwnership?: Form1120Data<D>[] // C-Corps owned (for dividend reporting)
  // Payroll for household/business employees (individual employers)
  payrollData?: Form941Data<D>[] // Quarterly payroll for Schedule H integration
  futaData?: Form940Data<D> // Annual FUTA for Schedule H
  // General business credits for pass-through entities
  generalBusinessCredits?: Form3800Data
  // Phase 6-8: Advanced Forms Data
  // Form 433-A - Collection Statement for Individuals
  collectionStatement?: Record<string, unknown>
  // Form 433-B - Collection Statement for Businesses
  businessCollectionStatement?: Record<string, unknown>
  // Form 656 - Offer in Compromise
  offerInCompromise?: Record<string, unknown>
  // Form 5471 - Foreign Corporation Information Return
  foreignCorporations?: Record<string, unknown>[]
  // Form 5472 - Foreign-Owned US Corporation
  foreignOwnedCorpInfo?: Record<string, unknown>
  // Form 5500 - Employee Benefit Plan
  employeeBenefitPlan?: Record<string, unknown>
  // Form 5500-EZ - One-Participant Plan
  oneParticipantPlan?: Record<string, unknown>
  // Form 5330 - Excise Taxes on Retirement Plans
  retirementPlanExciseTaxes?: Record<string, unknown>
  // Form 8809 - Information Return Extension
  infoReturnExtension?: Record<string, unknown>
  // Form 8865 - Foreign Partnership
  foreignPartnerships?: Record<string, unknown>[]
  // Form 8966 - FATCA Certification
  fatcaReport?: Record<string, unknown>
  // Form 1040-NR - Non-Resident Alien Return
  nonresidentAlienReturn?: Record<string, unknown>
  // Form 1040-SS - Self-Employment Tax for Territories
  territoryTaxReturn?: Record<string, unknown>
  // Phase 9: Estate, Gift, Fiduciary, and Exempt Organization Forms
  // Form 706 - Estate Tax Return
  estateTaxReturn?: Record<string, unknown>
  // Form 709 - Gift Tax Return
  giftTaxReturn?: Record<string, unknown>
  // Form 1041 - Fiduciary Income Tax Return
  fiduciaryReturn?: Record<string, unknown>
  // Form 990 - Exempt Organization Return
  exemptOrgReturn?: Record<string, unknown>
  // Form 990-EZ - Short Form Exempt Organization
  exemptOrgReturnEZ?: Record<string, unknown>
  // Form 990-T - Exempt Organization Business Income Tax
  ubitReturn?: Record<string, unknown>
  // Form 990-PF - Private Foundation Return
  privateFoundationReturn?: Record<string, unknown>
  // FinCEN 114 - FBAR Report
  fbarReport?: Record<string, unknown>
  // Phase 10: Additional International Forms
  // Form 3520 - Foreign Trusts and Gifts
  foreignTrustReport?: Record<string, unknown>
  // Form 3520-A - Foreign Trust Annual Return
  foreignTrustAnnualReturn?: Record<string, unknown>
  // Form 8621 - PFIC Annual Information
  pficReport?: Record<string, unknown>
  // Form 8858 - Foreign Disregarded Entity
  foreignDisregardedEntity?: Record<string, unknown>
  // Form 926 - Return of Transferred Property to Foreign Corp
  foreignTransferReturn?: Record<string, unknown>
  // Form 8283 - Noncash Charitable Contributions
  noncashContributions?: Record<string, unknown>
}

export type InformationDateString = Information<string>

/**
 * An asset can be anything that is transactable, such as a stock,
 * bond, mutual fund, real estate, or cryptocurrency, which is not reported
 * on 1099-B. A position always has an open date. A position may
 * be sold, at which time its gain or loss will be reported,
 * or it may be gifted to another person, at which time its
 * gain or loss will not be reported.
 *
 * An asset can be carried across multiple tax years,
 * so it should not be a sibling rather than a member of `Information`.
 *
 * If a position is real estate, then it has a state, which will
 * require state apportionment.
 *
 * "Closing an asset" can result in a long-term or short-term capital
 * gain. An asset is closed when it gets a closeDate.
 */
export type AssetType = 'Security' | 'Real Estate'
export interface Asset<D = Date> {
  name: string
  positionType: AssetType
  openDate: D
  closeDate?: D
  giftedDate?: D
  openPrice: number
  openFee: number
  closePrice?: number
  closeFee?: number
  quantity: number
  state?: State
}

export type SoldAsset<D> = Asset<D> & {
  closePrice: number
  closeDate: D
}

export const isSold = <D>(p: Asset<D>): p is SoldAsset<D> => {
  return p.closeDate !== undefined && p.closePrice !== undefined
}

export type AssetString = Asset<string>

// Validated action types:

export interface ArrayItemEditAction<A> {
  index: number
  value: A
}

export type EditDependentAction = ArrayItemEditAction<DependentDateString>
export type EditW2Action = ArrayItemEditAction<IncomeW2>
export type EditEstimatedTaxesAction = ArrayItemEditAction<EstimatedTaxPayments>
export type Edit1099Action = ArrayItemEditAction<Supported1099>
export type EditPropertyAction = ArrayItemEditAction<Property>
export type Edit1098eAction = ArrayItemEditAction<F1098e>
export type EditHSAAction = ArrayItemEditAction<HealthSavingsAccountDateString>
export type EditIraAction = ArrayItemEditAction<Ira>
export type EditAssetAction = ArrayItemEditAction<Asset<Date>>
export type EditF3921Action = ArrayItemEditAction<F3921>
export type EditScheduleK1Form1065Action =
  ArrayItemEditAction<ScheduleK1Form1065>
export type EditCreditAction = ArrayItemEditAction<Credit>
export type EditTrumpAccountAction =
  ArrayItemEditAction<TrumpSavingsAccountDateString>

// =============================================================================
// Cost Basis Tracking Types
// =============================================================================

/**
 * Method for selecting tax lots when selling securities
 */
export enum CostBasisMethod {
  FIFO = 'FIFO', // First In, First Out
  LIFO = 'LIFO', // Last In, First Out
  SpecificID = 'SpecificID', // Specific Identification
  AverageCost = 'AverageCost' // Average Cost (mutual funds only)
}

/**
 * Transaction type for investment tracking
 */
export enum StockTransactionType {
  Buy = 'Buy',
  Sell = 'Sell',
  DividendReinvestment = 'DividendReinvestment',
  StockSplit = 'StockSplit',
  Merger = 'Merger',
  SpinOff = 'SpinOff',
  TransferIn = 'TransferIn',
  TransferOut = 'TransferOut'
}

/**
 * A single tax lot representing a purchase of securities
 */
export interface TaxLot<D = Date> {
  id: string // Unique identifier for the lot
  symbol: string // Ticker symbol
  purchaseDate: D // Date of purchase
  shares: number // Number of shares in this lot
  costPerShare: number // Cost per share at purchase
  fees: number // Transaction fees
  totalCost: number // Total cost basis (shares * costPerShare + fees)
  remainingShares: number // Shares remaining after sales
  adjustedCostBasis: number // Cost basis after wash sale adjustments
  washSaleAdjustment: number // Amount added due to wash sales
  washSaleDisallowedLoss: number // Disallowed loss from wash sales
  sourceTransactionId?: string // Reference to source transaction
  isMutualFund: boolean // Whether this is a mutual fund (for average cost)
}

export type TaxLotDateString = TaxLot<string>

/**
 * A stock transaction (buy, sell, dividend, etc.)
 */
export interface StockTransaction<D = Date> {
  id: string // Unique identifier
  symbol: string // Ticker symbol
  transactionType: StockTransactionType
  date: D // Transaction date
  shares: number // Number of shares
  pricePerShare: number // Price per share
  fees: number // Transaction fees
  proceeds?: number // For sales: total proceeds
  costBasis?: number // For sales: cost basis of sold shares
  lotSelections?: TaxLotSelection[] // For sales: which lots were sold
  gainLoss?: number // For sales: realized gain/loss
  isShortTerm?: boolean // For sales: short or long term
  isWashSale?: boolean // Whether this sale triggered wash sale
  washSaleDisallowedLoss?: number // Disallowed loss amount
  relatedLotId?: string // For dividend reinvestment, splits, etc.
  splitRatio?: number // For stock splits (e.g., 2 for 2:1 split)
  mergerRatio?: number // For mergers
  notes?: string // Optional notes
}

export type StockTransactionDateString = StockTransaction<string>

/**
 * Selection of a specific lot for a sale
 */
export interface TaxLotSelection {
  lotId: string // ID of the tax lot
  sharesFromLot: number // Number of shares sold from this lot
}

/**
 * An investment position (aggregated view of all lots for a symbol)
 */
export interface Investment<D = Date> {
  symbol: string // Ticker symbol
  name?: string // Company/fund name
  isMutualFund: boolean // Whether this is a mutual fund
  lots: TaxLot<D>[] // All tax lots for this position
  transactions: StockTransaction<D>[] // All transactions for this position
  totalShares: number // Total shares held
  totalCostBasis: number // Total cost basis of current holdings
  averageCostPerShare: number // Average cost per share
  currentPrice?: number // Current market price (for unrealized gains)
  unrealizedGainLoss?: number // Unrealized gain/loss
  defaultCostBasisMethod: CostBasisMethod // Default method for this investment
}

export type InvestmentDateString = Investment<string>

/**
 * Wash sale detection result
 */
export interface WashSaleInfo {
  isWashSale: boolean
  matchingLotId?: string // The lot that triggered the wash sale
  disallowedLoss: number // Amount of loss disallowed
  adjustmentToNewLot: number // Amount to add to new lot's cost basis
  washSaleDate: Date // Date of the wash sale
  replacementDate: Date // Date of the replacement purchase
}

/**
 * Summary of gains/losses for tax reporting (Form 8949/Schedule D)
 */
export interface GainLossSummary {
  shortTermProceeds: number
  shortTermCostBasis: number
  shortTermGainLoss: number
  shortTermWashSaleAdjustment: number
  longTermProceeds: number
  longTermCostBasis: number
  longTermGainLoss: number
  longTermWashSaleAdjustment: number
}

/**
 * Cost basis portfolio - all investments for a taxpayer
 */
export interface CostBasisPortfolio<D = Date> {
  investments: Investment<D>[]
  defaultMethod: CostBasisMethod
  lastUpdated: D
}

export type CostBasisPortfolioDateString = CostBasisPortfolio<string>

// Edit action types for cost basis tracking
export type EditTaxLotAction = ArrayItemEditAction<TaxLotDateString>
export type EditStockTransactionAction =
  ArrayItemEditAction<StockTransactionDateString>
export type EditInvestmentAction = ArrayItemEditAction<InvestmentDateString>

// Gift tax exports
export * from './giftTax'
