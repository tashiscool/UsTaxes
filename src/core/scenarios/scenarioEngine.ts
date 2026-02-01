/**
 * Scenario Engine
 *
 * Provides functionality to deep clone tax data, apply modifications,
 * run full tax calculations, and return comparison objects for
 * what-if scenario analysis.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars */

import {
  Information,
  TaxYear,
  Asset,
  FilingStatus,
  IncomeW2,
  PersonRole,
  IraPlanType
} from 'ustaxes/core/data'
import { YearCreateForm, yearFormBuilder } from 'ustaxes/forms/YearForms'
import { isRight } from 'ustaxes/core/util'
import _ from 'lodash'

/**
 * Represents a single what-if scenario
 */
export interface Scenario {
  id: string
  name: string
  description?: string
  modifications: ScenarioModification[]
  createdAt: Date
  modifiedAt: Date
}

/**
 * Types of modifications that can be applied to a scenario
 */
export type ModificationType =
  | 'ADD_INCOME'
  | 'MODIFY_INCOME'
  | 'ADD_401K_CONTRIBUTION'
  | 'ADD_HSA_CONTRIBUTION'
  | 'ADD_IRA_CONTRIBUTION'
  | 'ADD_DEPENDENT'
  | 'ADD_SPOUSE'
  | 'CHANGE_FILING_STATUS'
  | 'ADD_ITEMIZED_DEDUCTION'
  | 'CUSTOM_FIELD'

/**
 * A modification to apply to tax data
 */
export interface ScenarioModification {
  id: string
  type: ModificationType
  label: string
  value: number | string | boolean | object
  fieldPath?: string // For custom field modifications
}

/**
 * Tax calculation results for comparison
 */
export interface TaxCalculationResult {
  scenarioId: string
  scenarioName: string
  isBaseline: boolean
  // Income
  totalIncome: number
  wagesIncome: number
  otherIncome: number
  agi: number
  // Deductions
  standardDeduction: number
  itemizedDeduction: number
  deductionUsed: number
  taxableIncome: number
  // Tax
  taxBeforeCredits: number
  totalCredits: number
  totalTax: number
  // Payments
  withholdings: number
  estimatedPayments: number
  totalPayments: number
  // Result
  refundAmount: number
  amountOwed: number
  // Effective rates
  effectiveTaxRate: number
  marginalTaxRate: number
  // Errors
  errors: string[]
  calculatedSuccessfully: boolean
}

/**
 * Comparison between scenarios
 */
export interface ScenarioComparison {
  baseline: TaxCalculationResult
  scenarios: TaxCalculationResult[]
  differences: ScenarioDifference[]
}

/**
 * A single difference between baseline and a scenario
 */
export interface ScenarioDifference {
  scenarioId: string
  scenarioName: string
  agiDiff: number
  taxableIncomeDiff: number
  totalTaxDiff: number
  refundDiff: number
  effectiveRateDiff: number
}

/**
 * Deep clones Information object
 */
export const cloneInformation = (info: Information): Information => {
  return _.cloneDeep(info)
}

/**
 * Deep clones assets array
 */
export const cloneAssets = (assets: Asset<Date>[]): Asset<Date>[] => {
  return _.cloneDeep(assets)
}

/**
 * Apply a single modification to tax information
 */
export const applyModification = (
  info: Information,
  modification: ScenarioModification
): Information => {
  const clonedInfo = cloneInformation(info)

  switch (modification.type) {
    case 'ADD_INCOME': {
      const additionalIncome = modification.value as number
      if (clonedInfo.w2s.length > 0) {
        clonedInfo.w2s[0] = {
          ...clonedInfo.w2s[0],
          income: clonedInfo.w2s[0].income + additionalIncome,
          medicareIncome: clonedInfo.w2s[0].medicareIncome + additionalIncome
        }
      }
      break
    }

    case 'MODIFY_INCOME': {
      const newIncome = modification.value as number
      if (clonedInfo.w2s.length > 0) {
        const diff = newIncome - clonedInfo.w2s[0].income
        clonedInfo.w2s[0] = {
          ...clonedInfo.w2s[0],
          income: newIncome,
          medicareIncome: clonedInfo.w2s[0].medicareIncome + diff
        }
      }
      break
    }

    case 'ADD_401K_CONTRIBUTION': {
      const contribution = modification.value as number
      if (clonedInfo.w2s.length > 0) {
        const currentBox12 = clonedInfo.w2s[0].box12 ?? {}
        clonedInfo.w2s[0] = {
          ...clonedInfo.w2s[0],
          box12: {
            ...currentBox12,
            D: (currentBox12.D ?? 0) + contribution
          }
        }
      }
      break
    }

    case 'ADD_HSA_CONTRIBUTION': {
      const contribution = modification.value as number
      const now = new Date()
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const yearEnd = new Date(now.getFullYear(), 11, 31)

      clonedInfo.healthSavingsAccounts = [
        ...clonedInfo.healthSavingsAccounts,
        {
          label: 'Scenario HSA',
          coverageType: 'self-only',
          contributions: contribution,
          personRole: clonedInfo.w2s[0]?.personRole ?? 'PRIMARY',
          startDate: yearStart,
          endDate: yearEnd,
          totalDistributions: 0,
          qualifiedDistributions: 0
        }
      ]
      break
    }

    case 'ADD_IRA_CONTRIBUTION': {
      const contribution = modification.value as number
      clonedInfo.individualRetirementArrangements = [
        ...clonedInfo.individualRetirementArrangements,
        {
          payer: 'Scenario IRA',
          personRole: clonedInfo.w2s[0]?.personRole ?? PersonRole.PRIMARY,
          grossDistribution: 0,
          taxableAmount: 0,
          taxableAmountNotDetermined: false,
          totalDistribution: false,
          federalIncomeTaxWithheld: 0,
          planType: IraPlanType.IRA,
          contributions: contribution,
          rolloverContributions: 0,
          rothIraConversion: 0,
          recharacterizedContributions: 0,
          requiredMinimumDistributions: 0,
          lateContributions: 0,
          repayments: 0
        }
      ]
      break
    }

    case 'ADD_DEPENDENT': {
      const dependentInfo = modification.value as {
        firstName: string
        lastName: string
        relationship: string
        dateOfBirth: Date
      }
      clonedInfo.taxPayer.dependents = [
        ...clonedInfo.taxPayer.dependents,
        {
          firstName: dependentInfo.firstName,
          lastName: dependentInfo.lastName,
          ssid: '000-00-0000',
          role: PersonRole.DEPENDENT,
          isBlind: false,
          dateOfBirth: dependentInfo.dateOfBirth,
          relationship: dependentInfo.relationship
        }
      ]
      break
    }

    case 'ADD_SPOUSE': {
      const spouseInfo = modification.value as {
        firstName: string
        lastName: string
        dateOfBirth: Date
        income?: number
      }
      clonedInfo.taxPayer.spouse = {
        firstName: spouseInfo.firstName,
        lastName: spouseInfo.lastName,
        ssid: '000-00-0000',
        role: PersonRole.SPOUSE,
        isBlind: false,
        dateOfBirth: spouseInfo.dateOfBirth,
        isTaxpayerDependent: false
      }

      // Optionally add spouse income
      if (spouseInfo.income && spouseInfo.income > 0) {
        clonedInfo.w2s = [
          ...clonedInfo.w2s,
          {
            occupation: 'Employee',
            income: spouseInfo.income,
            medicareIncome: spouseInfo.income,
            fedWithholding: Math.round(spouseInfo.income * 0.15),
            ssWages: spouseInfo.income,
            ssWithholding: Math.round(spouseInfo.income * 0.062),
            medicareWithholding: Math.round(spouseInfo.income * 0.0145),
            personRole: PersonRole.SPOUSE
          }
        ]
      }
      break
    }

    case 'CHANGE_FILING_STATUS': {
      const newStatus = modification.value as FilingStatus
      clonedInfo.taxPayer.filingStatus = newStatus
      break
    }

    case 'ADD_ITEMIZED_DEDUCTION': {
      const deductionValue = modification.value as number
      const fieldName = modification.fieldPath as keyof NonNullable<
        Information['itemizedDeductions']
      >
      clonedInfo.itemizedDeductions = {
        medicalAndDental: 0,
        stateAndLocalTaxes: 0,
        isSalesTax: false,
        stateAndLocalRealEstateTaxes: 0,
        stateAndLocalPropertyTaxes: 0,
        interest8a: 0,
        interest8b: 0,
        interest8c: 0,
        interest8d: 0,
        investmentInterest: 0,
        charityCashCheck: 0,
        charityOther: 0,
        ...(clonedInfo.itemizedDeductions ?? {}),
        [fieldName]: deductionValue
      }
      break
    }

    case 'CUSTOM_FIELD': {
      if (modification.fieldPath) {
        _.set(clonedInfo, modification.fieldPath, modification.value)
      }
      break
    }
  }

  return clonedInfo
}

/**
 * Apply multiple modifications to tax information
 */
export const applyModifications = (
  info: Information,
  modifications: ScenarioModification[]
): Information => {
  return modifications.reduce(
    (currentInfo, mod) => applyModification(currentInfo, mod),
    cloneInformation(info)
  )
}

/**
 * Calculate taxes for given information
 */
export const calculateTaxes = (
  year: TaxYear,
  info: Information,
  assets: Asset<Date>[],
  scenarioId: string,
  scenarioName: string,
  isBaseline: boolean
): TaxCalculationResult => {
  const builder = yearFormBuilder(year)
  const yearForm: YearCreateForm = builder.build(info, assets)
  const errors = yearForm.errors().map((e) => e.toString())

  const formResult = yearForm.f1040()

  if (!isRight(formResult)) {
    return {
      scenarioId,
      scenarioName,
      isBaseline,
      totalIncome: 0,
      wagesIncome: 0,
      otherIncome: 0,
      agi: 0,
      standardDeduction: 0,
      itemizedDeduction: 0,
      deductionUsed: 0,
      taxableIncome: 0,
      taxBeforeCredits: 0,
      totalCredits: 0,
      totalTax: 0,
      withholdings: 0,
      estimatedPayments: 0,
      totalPayments: 0,
      refundAmount: 0,
      amountOwed: 0,
      effectiveTaxRate: 0,
      marginalTaxRate: 0,
      errors: formResult.left.map((e) => e.toString()),
      calculatedSuccessfully: false
    }
  }

  const forms = formResult.right
  // Find the F1040 form
  const f1040 = forms.find((f) => f.tag === 'f1040')

  if (!f1040) {
    return {
      scenarioId,
      scenarioName,
      isBaseline,
      totalIncome: 0,
      wagesIncome: 0,
      otherIncome: 0,
      agi: 0,
      standardDeduction: 0,
      itemizedDeduction: 0,
      deductionUsed: 0,
      taxableIncome: 0,
      taxBeforeCredits: 0,
      totalCredits: 0,
      totalTax: 0,
      withholdings: 0,
      estimatedPayments: 0,
      totalPayments: 0,
      refundAmount: 0,
      amountOwed: 0,
      effectiveTaxRate: 0,
      marginalTaxRate: 0,
      errors: ['F1040 form not found'],
      calculatedSuccessfully: false
    }
  }

  // Extract values from F1040 using the form's methods
  // These correspond to the line numbers on the actual form
  // We use unknown first to safely cast to the expected interface
  const f = f1040 as unknown as {
    l1z: () => number
    l9: () => number
    l11: () => number
    l12: () => number
    l15: () => number
    l16: () => number | undefined
    l21: () => number
    l24: () => number
    l25d: () => number
    l26: () => number
    l33: () => number
    l35a: () => number
    l37: () => number
    scheduleA?: { deductions: () => number }
    standardDeduction?: () => number | undefined
  }

  const wagesIncome = f.l1z() ?? 0
  const totalIncome = f.l9() ?? 0
  const agi = f.l11() ?? 0
  const deductionUsed = f.l12() ?? 0
  const taxableIncome = f.l15() ?? 0
  const taxBeforeCredits = f.l16() ?? 0
  const totalCredits = f.l21() ?? 0
  const totalTax = f.l24() ?? 0
  const withholdings = f.l25d() ?? 0
  const estimatedPayments = f.l26() ?? 0
  const totalPayments = f.l33() ?? 0
  const refundAmount = f.l35a() ?? 0
  const amountOwed = f.l37() ?? 0

  const standardDeduction = f.standardDeduction?.() ?? 0
  const itemizedDeduction = f.scheduleA?.deductions() ?? 0

  const effectiveTaxRate =
    agi > 0 ? Math.round((totalTax / agi) * 10000) / 100 : 0
  const marginalTaxRate = estimateMarginalRate(
    info.taxPayer.filingStatus ?? FilingStatus.S,
    taxableIncome
  )

  return {
    scenarioId,
    scenarioName,
    isBaseline,
    totalIncome,
    wagesIncome,
    otherIncome: totalIncome - wagesIncome,
    agi,
    standardDeduction,
    itemizedDeduction,
    deductionUsed,
    taxableIncome,
    taxBeforeCredits,
    totalCredits,
    totalTax,
    withholdings,
    estimatedPayments,
    totalPayments,
    refundAmount,
    amountOwed,
    effectiveTaxRate,
    marginalTaxRate,
    errors,
    calculatedSuccessfully: errors.length === 0
  }
}

/**
 * Estimate marginal tax rate based on filing status and taxable income
 * 2024 tax brackets (approximate)
 */
const estimateMarginalRate = (
  filingStatus: FilingStatus,
  taxableIncome: number
): number => {
  const brackets =
    filingStatus === FilingStatus.MFJ || filingStatus === FilingStatus.W
      ? [
          { limit: 23200, rate: 10 },
          { limit: 94300, rate: 12 },
          { limit: 201050, rate: 22 },
          { limit: 383900, rate: 24 },
          { limit: 487450, rate: 32 },
          { limit: 731200, rate: 35 },
          { limit: Infinity, rate: 37 }
        ]
      : filingStatus === FilingStatus.HOH
      ? [
          { limit: 16550, rate: 10 },
          { limit: 63100, rate: 12 },
          { limit: 100500, rate: 22 },
          { limit: 191950, rate: 24 },
          { limit: 243700, rate: 32 },
          { limit: 609350, rate: 35 },
          { limit: Infinity, rate: 37 }
        ]
      : [
          { limit: 11600, rate: 10 },
          { limit: 47150, rate: 12 },
          { limit: 100525, rate: 22 },
          { limit: 191950, rate: 24 },
          { limit: 243725, rate: 32 },
          { limit: 609350, rate: 35 },
          { limit: Infinity, rate: 37 }
        ]

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.limit) {
      return bracket.rate
    }
  }
  return 37
}

/**
 * Compare multiple scenarios against a baseline
 */
export const compareScenarios = (
  year: TaxYear,
  baseInfo: Information,
  assets: Asset<Date>[],
  scenarios: Scenario[]
): ScenarioComparison => {
  // Calculate baseline
  const baseline = calculateTaxes(
    year,
    baseInfo,
    assets,
    'baseline',
    'Current',
    true
  )

  // Calculate each scenario
  const scenarioResults = scenarios.map((scenario) => {
    const modifiedInfo = applyModifications(baseInfo, scenario.modifications)
    return calculateTaxes(
      year,
      modifiedInfo,
      assets,
      scenario.id,
      scenario.name,
      false
    )
  })

  // Calculate differences
  const differences: ScenarioDifference[] = scenarioResults.map((result) => ({
    scenarioId: result.scenarioId,
    scenarioName: result.scenarioName,
    agiDiff: result.agi - baseline.agi,
    taxableIncomeDiff: result.taxableIncome - baseline.taxableIncome,
    totalTaxDiff: result.totalTax - baseline.totalTax,
    refundDiff: result.refundAmount - baseline.refundAmount,
    effectiveRateDiff: result.effectiveTaxRate - baseline.effectiveTaxRate
  }))

  return {
    baseline,
    scenarios: scenarioResults,
    differences
  }
}

/**
 * Generate a unique scenario ID
 */
export const generateScenarioId = (): string => {
  return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new empty scenario
 */
export const createEmptyScenario = (name: string): Scenario => {
  const now = new Date()
  return {
    id: generateScenarioId(),
    name,
    description: '',
    modifications: [],
    createdAt: now,
    modifiedAt: now
  }
}

/**
 * Quick scenario: Max out 401(k)
 */
export const createMax401kScenario = (
  currentContribution: number
): Scenario => {
  const max401k = 23000 // 2024 limit
  const additionalContribution = Math.max(0, max401k - currentContribution)

  return {
    id: generateScenarioId(),
    name: 'Max Out 401(k)',
    description: `Add $${additionalContribution.toLocaleString()} to reach 401(k) max`,
    modifications: [
      {
        id: 'mod_401k',
        type: 'ADD_401K_CONTRIBUTION',
        label: 'Additional 401(k) Contribution',
        value: additionalContribution
      }
    ],
    createdAt: new Date(),
    modifiedAt: new Date()
  }
}

/**
 * Quick scenario: Add child dependent
 */
export const createAddChildScenario = (): Scenario => {
  return {
    id: generateScenarioId(),
    name: 'Add Child Dependent',
    description: 'Add a qualifying child dependent',
    modifications: [
      {
        id: 'mod_child',
        type: 'ADD_DEPENDENT',
        label: 'New Child',
        value: {
          firstName: 'New',
          lastName: 'Child',
          relationship: 'Son/Daughter',
          dateOfBirth: new Date(new Date().getFullYear() - 5, 0, 1)
        }
      }
    ],
    createdAt: new Date(),
    modifiedAt: new Date()
  }
}

/**
 * Quick scenario: Max HSA contribution
 */
export const createMaxHSAScenario = (
  currentContribution: number,
  isFamilyCoverage: boolean
): Scenario => {
  const maxHSA = isFamilyCoverage ? 8300 : 4150 // 2024 limits
  const additionalContribution = Math.max(0, maxHSA - currentContribution)

  return {
    id: generateScenarioId(),
    name: 'Max Out HSA',
    description: `Add $${additionalContribution.toLocaleString()} HSA contribution`,
    modifications: [
      {
        id: 'mod_hsa',
        type: 'ADD_HSA_CONTRIBUTION',
        label: 'Additional HSA Contribution',
        value: additionalContribution
      }
    ],
    createdAt: new Date(),
    modifiedAt: new Date()
  }
}

/**
 * Quick scenario: Spouse starts working
 */
export const createSpouseWorksScenario = (spouseIncome: number): Scenario => {
  return {
    id: generateScenarioId(),
    name: 'Spouse Works',
    description: `Add spouse with $${spouseIncome.toLocaleString()} income`,
    modifications: [
      {
        id: 'mod_spouse',
        type: 'ADD_SPOUSE',
        label: 'Add Working Spouse',
        value: {
          firstName: 'Spouse',
          lastName: 'Name',
          dateOfBirth: new Date(1985, 0, 1),
          income: spouseIncome
        }
      },
      {
        id: 'mod_status',
        type: 'CHANGE_FILING_STATUS',
        label: 'Change to Married Filing Jointly',
        value: FilingStatus.MFJ
      }
    ],
    createdAt: new Date(),
    modifiedAt: new Date()
  }
}

export default {
  cloneInformation,
  cloneAssets,
  applyModification,
  applyModifications,
  calculateTaxes,
  compareScenarios,
  generateScenarioId,
  createEmptyScenario,
  createMax401kScenario,
  createAddChildScenario,
  createMaxHSAScenario,
  createSpouseWorksScenario
}
