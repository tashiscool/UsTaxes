/**
 * Business Rules Engine for MeF (Modernized e-File) Submissions
 *
 * Implements IRS business rules that go beyond schema validation.
 * These rules ensure mathematical accuracy, consistency, and compliance
 * with tax law requirements.
 */

import { FilingStatus } from 'ustaxes/core/data'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Severity levels for business rule violations
 */
export enum RuleSeverity {
  /** Must be fixed before submission - will cause rejection */
  ERROR = 'error',
  /** Should be reviewed but can submit - may trigger IRS notice */
  WARNING = 'warning',
  /** Informational only - no action required */
  INFO = 'info'
}

/**
 * Categories of business rules
 */
export enum RuleCategory {
  /** Mathematical accuracy rules (sums, calculations) */
  MATHEMATICAL = 'mathematical',
  /** Consistency rules (if A then B) */
  CONSISTENCY = 'consistency',
  /** Range/limit rules (min/max values) */
  RANGE = 'range',
  /** Cross-form rules (Schedule C requires SE) */
  CROSS_FORM = 'cross_form',
  /** Filing status rules */
  FILING_STATUS = 'filing_status',
  /** Dependency rules */
  DEPENDENCY = 'dependency',
  /** Credit eligibility rules */
  CREDIT = 'credit',
  /** Deduction rules */
  DEDUCTION = 'deduction',
  /** Identity/SSN rules */
  IDENTITY = 'identity',
  /** Date/time rules */
  DATE = 'date'
}

/**
 * Result of a single business rule check
 */
export interface BusinessRuleError {
  /** Rule identifier (e.g., 'R0001') */
  ruleId: string
  /** Human-readable description of the rule */
  description: string
  /** Detailed error message */
  message: string
  /** Severity level */
  severity: RuleSeverity
  /** Rule category */
  category: RuleCategory
  /** Affected form(s) */
  forms: string[]
  /** Affected field(s)/line(s) */
  fields: string[]
  /** Expected value or condition */
  expected?: string
  /** Actual value found */
  actual?: string
  /** Suggested fix */
  suggestion?: string
  /** IRS rule reference if applicable */
  irsReference?: string
}

/**
 * Definition of a business rule
 */
export interface BusinessRule {
  /** Unique rule identifier */
  id: string
  /** Rule description */
  description: string
  /** Rule category */
  category: RuleCategory
  /** Severity if violated */
  severity: RuleSeverity
  /** Forms this rule applies to */
  applicableForms: string[]
  /** Tax years this rule applies to (empty = all years) */
  applicableYears?: number[]
  /** Condition check function - returns true if rule passes */
  check: (data: TaxReturnData, taxYear: number) => boolean
  /** Function to get error details when rule fails */
  getErrorDetails?: (
    data: TaxReturnData,
    taxYear: number
  ) => Partial<BusinessRuleError>
}

/**
 * Tax return data structure for rule checking
 */
export interface TaxReturnData {
  // Filing information
  filingStatus?: FilingStatus
  taxYear?: number

  // Form 1040 lines
  line1a?: number // Wages, salaries, tips
  line1b?: number // Household employee wages
  line1c?: number // Tip income
  line1d?: number // Medicaid waiver payments
  line1e?: number // Dependent care benefits
  line1f?: number // Employer-provided adoption benefits
  line1g?: number // Wages from Form 8919
  line1h?: number // Other earned income
  line1i?: number // Nontaxable combat pay
  line1z?: number // Total line 1 (sum of 1a-1h)
  line2a?: number // Tax-exempt interest
  line2b?: number // Taxable interest
  line3a?: number // Qualified dividends
  line3b?: number // Ordinary dividends
  line4a?: number // IRA distributions
  line4b?: number // Taxable IRA amount
  line5a?: number // Pensions and annuities
  line5b?: number // Taxable pension amount
  line6a?: number // Social Security benefits
  line6b?: number // Taxable Social Security
  line7?: number // Capital gain or loss
  line8?: number // Other income from Schedule 1
  line9?: number // Total income
  line10?: number // Adjustments from Schedule 1
  line11?: number // Adjusted Gross Income (AGI)
  line12?: number // Standard or itemized deductions
  line13?: number // QBI deduction
  line14?: number // Total deductions (12 + 13)
  line15?: number // Taxable income
  line16?: number // Tax
  line17?: number // Amount from Schedule 2, line 3
  line18?: number // Total tax before credits
  line19?: number // Child tax credit
  line20?: number // Amount from Schedule 3, line 8
  line21?: number // Total credits
  line22?: number // Tax after credits
  line23?: number // Other taxes from Schedule 2
  line24?: number // Total tax
  line25a?: number // Federal withholding from W-2
  line25b?: number // Federal withholding from 1099
  line25c?: number // Other withholding
  line25d?: number // Total withholding
  line26?: number // Estimated tax payments
  line27?: number // Earned income credit
  line28?: number // Additional child tax credit
  line29?: number // American opportunity credit
  line30?: number // Recovery rebate credit
  line31?: number // Amount from Schedule 3, line 15
  line32?: number // Total other payments/credits
  line33?: number // Total payments
  line34?: number // Overpaid amount
  line35a?: number // Amount to be refunded
  line36?: number // Amount applied to estimated tax
  line37?: number // Amount owed

  // Schedule 1 lines
  schedule1Line1?: number // Taxable refunds
  schedule1Line2a?: number // Alimony received
  schedule1Line3?: number // Business income (Schedule C)
  schedule1Line4?: number // Other gains (Form 4797)
  schedule1Line5?: number // Rental income (Schedule E)
  schedule1Line6?: number // Farm income (Schedule F)
  schedule1Line7?: number // Unemployment compensation
  schedule1Line8?: number // Other income
  schedule1Line10?: number // Total additional income
  schedule1Line11?: number // Educator expenses
  schedule1Line12?: number // HSA deduction
  schedule1Line13?: number // Moving expenses
  schedule1Line14?: number // Deductible SE tax
  schedule1Line15?: number // SE SEP/SIMPLE/qualified plans
  schedule1Line16?: number // SE health insurance
  schedule1Line17?: number // Penalty on early withdrawal
  schedule1Line18a?: number // Alimony paid
  schedule1Line19?: number // IRA deduction
  schedule1Line20?: number // Student loan interest
  schedule1Line21?: number // Reserved
  schedule1Line22?: number // Other adjustments
  schedule1Line26?: number // Total adjustments

  // Schedule 2 lines
  schedule2Line1?: number // AMT
  schedule2Line2?: number // Excess advance PTC repayment
  schedule2Line3?: number // Total Part I
  schedule2Line4?: number // Self-employment tax
  schedule2Line5?: number // Unreported SS/Medicare tax
  schedule2Line6?: number // Additional tax on IRAs
  schedule2Line7?: number // Household employment taxes
  schedule2Line8?: number // Repayment of first-time homebuyer credit
  schedule2Line9?: number // Additional Medicare tax
  schedule2Line10?: number // Net investment income tax
  schedule2Line17?: number // Other taxes
  schedule2Line21?: number // Total Part II

  // Schedule 3 lines
  schedule3Line1?: number // Foreign tax credit
  schedule3Line2?: number // Child/dependent care credit
  schedule3Line3?: number // Education credits
  schedule3Line4?: number // Retirement savings credit
  schedule3Line5?: number // Residential energy credit
  schedule3Line6?: number // Other nonrefundable credits
  schedule3Line8?: number // Total nonrefundable credits
  schedule3Line9?: number // Net premium tax credit
  schedule3Line10?: number // Amount paid with extension
  schedule3Line11?: number // Excess SS tax withheld
  schedule3Line12?: number // Credit for federal tax on fuels
  schedule3Line13?: number // Other payments/credits
  schedule3Line15?: number // Total other payments/credits

  // Schedule A (Itemized Deductions)
  scheduleALine1?: number // Medical expenses
  scheduleALine2?: number // AGI (for calculation)
  scheduleALine3?: number // AGI * 7.5%
  scheduleALine4?: number // Deductible medical
  scheduleALine5a?: number // State/local income tax
  scheduleALine5b?: number // State/local sales tax
  scheduleALine5c?: number // Real estate taxes
  scheduleALine5d?: number // Personal property taxes
  scheduleALine5e?: number // Other taxes
  scheduleALine6?: number // Total taxes (max $10,000)
  scheduleALine7?: number // SALT limitation
  scheduleALine8a?: number // Home mortgage interest
  scheduleALine8b?: number // Points
  scheduleALine8c?: number // Mortgage interest not reported
  scheduleALine8d?: number // Reserved
  scheduleALine8e?: number // Investment interest
  scheduleALine9?: number // Total interest
  scheduleALine10?: number // Cash contributions (30%)
  scheduleALine11?: number // Cash contributions (60%)
  scheduleALine12?: number // Carryover contributions
  scheduleALine13?: number // Noncash contributions
  scheduleALine14?: number // Total charitable
  scheduleALine15?: number // Casualty/theft loss
  scheduleALine16?: number // Other deductions
  scheduleALine17?: number // Total itemized deductions

  // Schedule B
  scheduleBTotalInterest?: number
  scheduleBTotalDividends?: number
  scheduleBForeignAccounts?: boolean
  scheduleBForeignTrusts?: boolean

  // Schedule C
  scheduleCGrossReceipts?: number
  scheduleCCOGS?: number
  scheduleCGrossProfit?: number
  scheduleCOtherIncome?: number
  scheduleCGrossIncome?: number
  scheduleCTotalExpenses?: number
  scheduleCNetProfit?: number

  // Schedule D
  scheduleDShortTermGain?: number
  scheduleDLongTermGain?: number
  scheduleDNetGain?: number

  // Schedule E
  scheduleERentalIncome?: number
  scheduleERentalExpenses?: number
  scheduleENetRentalIncome?: number
  scheduleEPartnershipIncome?: number

  // Schedule SE
  scheduleSENetEarnings?: number
  scheduleSESelfEmploymentTax?: number
  scheduleSEDeduction?: number

  // Other data
  hasScheduleC?: boolean
  hasScheduleE?: boolean
  hasScheduleF?: boolean
  hasScheduleSE?: boolean
  hasScheduleA?: boolean
  hasForm8949?: boolean
  hasForeignIncome?: boolean
  hasForeignAccounts?: boolean
  dependentCount?: number
  qualifyingChildCount?: number
  age?: number
  spouseAge?: number
  isBlind?: boolean
  spouseIsBlind?: boolean
  primarySSN?: string
  spouseSSN?: string
  standardDeductionAmount?: number
  wages?: number
  selfEmploymentIncome?: number
}

// ============================================================================
// Form 1040 Business Rules
// ============================================================================

/**
 * Comprehensive business rules for Form 1040
 */
export const RULES_1040: BusinessRule[] = [
  // -------------------------------------------------------------------------
  // Mathematical Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0001',
    description: 'Line 1z must equal sum of lines 1a through 1h',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const sum =
        (data.line1a || 0) +
        (data.line1b || 0) +
        (data.line1c || 0) +
        (data.line1d || 0) +
        (data.line1e || 0) +
        (data.line1f || 0) +
        (data.line1g || 0) +
        (data.line1h || 0)
      return Math.abs((data.line1z || 0) - sum) < 0.01
    },
    getErrorDetails: (data) => {
      const sum =
        (data.line1a || 0) +
        (data.line1b || 0) +
        (data.line1c || 0) +
        (data.line1d || 0) +
        (data.line1e || 0) +
        (data.line1f || 0) +
        (data.line1g || 0) +
        (data.line1h || 0)
      return {
        fields: [
          'Line 1a',
          'Line 1b',
          'Line 1c',
          'Line 1d',
          'Line 1e',
          'Line 1f',
          'Line 1g',
          'Line 1h',
          'Line 1z'
        ],
        expected: `$${sum.toFixed(2)}`,
        actual: `$${(data.line1z || 0).toFixed(2)}`,
        suggestion: 'Verify all wage and income entries on lines 1a through 1h'
      }
    }
  },
  {
    id: 'R0002',
    description: 'Taxable income (Line 15) cannot be negative',
    category: RuleCategory.RANGE,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => (data.line15 || 0) >= 0,
    getErrorDetails: (data) => ({
      fields: ['Line 15'],
      expected: 'Amount >= $0',
      actual: `$${(data.line15 || 0).toFixed(2)}`,
      suggestion:
        'Taxable income should be zero or positive. If deductions exceed income, taxable income is zero.'
    })
  },
  {
    id: 'R0003',
    description:
      'AGI (Line 11) must equal Total Income (Line 9) minus Adjustments (Line 10)',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const expected = (data.line9 || 0) - (data.line10 || 0)
      return Math.abs((data.line11 || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected = (data.line9 || 0) - (data.line10 || 0)
      return {
        fields: ['Line 9', 'Line 10', 'Line 11'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.line11 || 0).toFixed(2)}`,
        suggestion: 'AGI = Total Income - Adjustments to Income'
      }
    }
  },
  {
    id: 'R0004',
    description: 'Total Income (Line 9) must equal sum of all income lines',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const sum =
        (data.line1z || 0) +
        (data.line2b || 0) +
        (data.line3b || 0) +
        (data.line4b || 0) +
        (data.line5b || 0) +
        (data.line6b || 0) +
        (data.line7 || 0) +
        (data.line8 || 0)
      return Math.abs((data.line9 || 0) - sum) < 0.01
    },
    getErrorDetails: (data) => {
      const sum =
        (data.line1z || 0) +
        (data.line2b || 0) +
        (data.line3b || 0) +
        (data.line4b || 0) +
        (data.line5b || 0) +
        (data.line6b || 0) +
        (data.line7 || 0) +
        (data.line8 || 0)
      return {
        fields: [
          'Line 1z',
          'Line 2b',
          'Line 3b',
          'Line 4b',
          'Line 5b',
          'Line 6b',
          'Line 7',
          'Line 8',
          'Line 9'
        ],
        expected: `$${sum.toFixed(2)}`,
        actual: `$${(data.line9 || 0).toFixed(2)}`,
        suggestion: 'Total income should be the sum of all income sources'
      }
    }
  },
  {
    id: 'R0005',
    description:
      'Taxable income (Line 15) must equal AGI (Line 11) minus Total Deductions (Line 14)',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const expected = Math.max(0, (data.line11 || 0) - (data.line14 || 0))
      return Math.abs((data.line15 || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected = Math.max(0, (data.line11 || 0) - (data.line14 || 0))
      return {
        fields: ['Line 11', 'Line 14', 'Line 15'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.line15 || 0).toFixed(2)}`,
        suggestion:
          'Taxable Income = AGI - Total Deductions (cannot be less than zero)'
      }
    }
  },
  {
    id: 'R0006',
    description:
      'Total Deductions (Line 14) must equal Deductions (Line 12) plus QBI Deduction (Line 13)',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const expected = (data.line12 || 0) + (data.line13 || 0)
      return Math.abs((data.line14 || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected = (data.line12 || 0) + (data.line13 || 0)
      return {
        fields: ['Line 12', 'Line 13', 'Line 14'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.line14 || 0).toFixed(2)}`,
        suggestion:
          'Total Deductions = Standard/Itemized Deduction + QBI Deduction'
      }
    }
  },
  {
    id: 'R0007',
    description:
      'Total Tax (Line 24) must equal Tax after Credits (Line 22) plus Other Taxes (Line 23)',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const expected = (data.line22 || 0) + (data.line23 || 0)
      return Math.abs((data.line24 || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected = (data.line22 || 0) + (data.line23 || 0)
      return {
        fields: ['Line 22', 'Line 23', 'Line 24'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.line24 || 0).toFixed(2)}`,
        suggestion:
          'Total Tax = Tax after Credits + Other Taxes (from Schedule 2)'
      }
    }
  },
  {
    id: 'R0008',
    description:
      'Total Withholding (Line 25d) must equal sum of Lines 25a, 25b, 25c',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const expected =
        (data.line25a || 0) + (data.line25b || 0) + (data.line25c || 0)
      return Math.abs((data.line25d || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected =
        (data.line25a || 0) + (data.line25b || 0) + (data.line25c || 0)
      return {
        fields: ['Line 25a', 'Line 25b', 'Line 25c', 'Line 25d'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.line25d || 0).toFixed(2)}`,
        suggestion:
          'Total withholding should include all federal income tax withheld from W-2s and 1099s'
      }
    }
  },
  {
    id: 'R0009',
    description:
      'Total Payments (Line 33) must equal Withholding plus Estimated Payments plus Credits',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const expected =
        (data.line25d || 0) + (data.line26 || 0) + (data.line32 || 0)
      return Math.abs((data.line33 || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected =
        (data.line25d || 0) + (data.line26 || 0) + (data.line32 || 0)
      return {
        fields: ['Line 25d', 'Line 26', 'Line 32', 'Line 33'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.line33 || 0).toFixed(2)}`,
        suggestion:
          'Total Payments = Total Withholding + Estimated Tax Payments + Refundable Credits'
      }
    }
  },
  {
    id: 'R0010',
    description: 'Refund or Amount Owed must be calculated correctly',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const difference = (data.line33 || 0) - (data.line24 || 0)
      if (difference >= 0) {
        // Overpayment/refund scenario
        return Math.abs((data.line34 || 0) - difference) < 0.01
      } else {
        // Amount owed scenario
        return Math.abs((data.line37 || 0) - Math.abs(difference)) < 0.01
      }
    },
    getErrorDetails: (data) => {
      const difference = (data.line33 || 0) - (data.line24 || 0)
      return {
        fields: ['Line 24', 'Line 33', 'Line 34', 'Line 37'],
        expected:
          difference >= 0
            ? `Overpaid: $${difference.toFixed(2)}`
            : `Owed: $${Math.abs(difference).toFixed(2)}`,
        actual:
          difference >= 0
            ? `Overpaid: $${(data.line34 || 0).toFixed(2)}`
            : `Owed: $${(data.line37 || 0).toFixed(2)}`,
        suggestion:
          'If Total Payments > Total Tax, you have an overpayment. Otherwise, you owe tax.'
      }
    }
  },

  // -------------------------------------------------------------------------
  // Consistency Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0050',
    description: 'If taxable interest exceeds $1,500, Schedule B is required',
    category: RuleCategory.CONSISTENCY,
    severity: RuleSeverity.WARNING,
    applicableForms: ['Form1040', 'ScheduleB'],
    check: (data) => {
      if ((data.line2b || 0) > 1500) {
        return data.scheduleBTotalInterest !== undefined
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Line 2b'],
      expected: 'Schedule B attached',
      actual: `Interest: $${(data.line2b || 0).toFixed(2)}, No Schedule B`,
      suggestion: 'Attach Schedule B when taxable interest exceeds $1,500'
    })
  },
  {
    id: 'R0051',
    description: 'If ordinary dividends exceed $1,500, Schedule B is required',
    category: RuleCategory.CONSISTENCY,
    severity: RuleSeverity.WARNING,
    applicableForms: ['Form1040', 'ScheduleB'],
    check: (data) => {
      if ((data.line3b || 0) > 1500) {
        return data.scheduleBTotalDividends !== undefined
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Line 3b'],
      expected: 'Schedule B attached',
      actual: `Dividends: $${(data.line3b || 0).toFixed(2)}, No Schedule B`,
      suggestion: 'Attach Schedule B when ordinary dividends exceed $1,500'
    })
  },
  {
    id: 'R0052',
    description: 'Qualified dividends cannot exceed ordinary dividends',
    category: RuleCategory.CONSISTENCY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => (data.line3a || 0) <= (data.line3b || 0),
    getErrorDetails: (data) => ({
      fields: ['Line 3a', 'Line 3b'],
      expected: `Line 3a <= Line 3b`,
      actual: `Qualified: $${(data.line3a || 0).toFixed(2)}, Ordinary: $${(
        data.line3b || 0
      ).toFixed(2)}`,
      suggestion:
        'Qualified dividends are a subset of ordinary dividends and cannot be greater'
    })
  },
  {
    id: 'R0053',
    description: 'Taxable IRA amount cannot exceed total IRA distributions',
    category: RuleCategory.CONSISTENCY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => (data.line4b || 0) <= (data.line4a || 0),
    getErrorDetails: (data) => ({
      fields: ['Line 4a', 'Line 4b'],
      expected: `Line 4b <= Line 4a`,
      actual: `Taxable: $${(data.line4b || 0).toFixed(2)}, Total: $${(
        data.line4a || 0
      ).toFixed(2)}`,
      suggestion: 'Taxable IRA amount cannot exceed total IRA distributions'
    })
  },
  {
    id: 'R0054',
    description:
      'Taxable pension amount cannot exceed total pension distributions',
    category: RuleCategory.CONSISTENCY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => (data.line5b || 0) <= (data.line5a || 0),
    getErrorDetails: (data) => ({
      fields: ['Line 5a', 'Line 5b'],
      expected: `Line 5b <= Line 5a`,
      actual: `Taxable: $${(data.line5b || 0).toFixed(2)}, Total: $${(
        data.line5a || 0
      ).toFixed(2)}`,
      suggestion:
        'Taxable pension amount cannot exceed total pension distributions'
    })
  },
  {
    id: 'R0055',
    description: 'Taxable Social Security cannot exceed 85% of total benefits',
    category: RuleCategory.CONSISTENCY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => (data.line6b || 0) <= (data.line6a || 0) * 0.85,
    getErrorDetails: (data) => ({
      fields: ['Line 6a', 'Line 6b'],
      expected: `Line 6b <= ${((data.line6a || 0) * 0.85).toFixed(
        2
      )} (85% of Line 6a)`,
      actual: `Taxable: $${(data.line6b || 0).toFixed(2)}`,
      suggestion:
        'Maximum taxable Social Security is 85% of total benefits received'
    })
  },

  // -------------------------------------------------------------------------
  // Cross-Form Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0100',
    description: 'Schedule C net profit/loss must be reported on Schedule 1',
    category: RuleCategory.CROSS_FORM,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleC', 'Schedule1'],
    check: (data) => {
      if (data.hasScheduleC && data.scheduleCNetProfit !== undefined) {
        return (
          Math.abs((data.schedule1Line3 || 0) - data.scheduleCNetProfit) < 0.01
        )
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule C Line 31', 'Schedule 1 Line 3'],
      expected: `$${(data.scheduleCNetProfit || 0).toFixed(2)}`,
      actual: `$${(data.schedule1Line3 || 0).toFixed(2)}`,
      suggestion:
        'Schedule C net profit or loss must flow to Schedule 1, Line 3'
    })
  },
  {
    id: 'R0101',
    description:
      'If Schedule C shows profit, Schedule SE is generally required',
    category: RuleCategory.CROSS_FORM,
    severity: RuleSeverity.WARNING,
    applicableForms: ['ScheduleC', 'ScheduleSE'],
    check: (data) => {
      if (data.hasScheduleC && (data.scheduleCNetProfit || 0) >= 400) {
        return data.hasScheduleSE === true
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule C Line 31'],
      expected: 'Schedule SE attached',
      actual: `Net profit: $${(data.scheduleCNetProfit || 0).toFixed(
        2
      )}, No Schedule SE`,
      suggestion:
        'Self-employment tax is required when net self-employment earnings are $400 or more'
    })
  },
  {
    id: 'R0102',
    description: 'Schedule SE deductible amount must flow to Schedule 1',
    category: RuleCategory.CROSS_FORM,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleSE', 'Schedule1'],
    check: (data) => {
      if (data.hasScheduleSE && data.scheduleSEDeduction !== undefined) {
        return (
          Math.abs((data.schedule1Line14 || 0) - data.scheduleSEDeduction) <
          0.01
        )
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule SE Deduction', 'Schedule 1 Line 14'],
      expected: `$${(data.scheduleSEDeduction || 0).toFixed(2)}`,
      actual: `$${(data.schedule1Line14 || 0).toFixed(2)}`,
      suggestion:
        'Deductible self-employment tax (50% of SE tax) must be reported on Schedule 1, Line 14'
    })
  },
  {
    id: 'R0103',
    description:
      'Schedule D net gain/loss must be reported on Form 1040 Line 7',
    category: RuleCategory.CROSS_FORM,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleD', 'Form1040'],
    check: (data) => {
      if (data.scheduleDNetGain !== undefined) {
        return Math.abs((data.line7 || 0) - data.scheduleDNetGain) < 0.01
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule D Line 16', 'Form 1040 Line 7'],
      expected: `$${(data.scheduleDNetGain || 0).toFixed(2)}`,
      actual: `$${(data.line7 || 0).toFixed(2)}`,
      suggestion:
        'Net capital gain or loss from Schedule D must be reported on Form 1040, Line 7'
    })
  },
  {
    id: 'R0104',
    description: 'Schedule E rental income must be reported on Schedule 1',
    category: RuleCategory.CROSS_FORM,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleE', 'Schedule1'],
    check: (data) => {
      if (data.hasScheduleE && data.scheduleENetRentalIncome !== undefined) {
        return (
          Math.abs((data.schedule1Line5 || 0) - data.scheduleENetRentalIncome) <
          0.01
        )
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule E Part I', 'Schedule 1 Line 5'],
      expected: `$${(data.scheduleENetRentalIncome || 0).toFixed(2)}`,
      actual: `$${(data.schedule1Line5 || 0).toFixed(2)}`,
      suggestion:
        'Net rental income from Schedule E must flow to Schedule 1, Line 5'
    })
  },
  {
    id: 'R0105',
    description: 'If itemizing, Schedule A total must equal Form 1040 Line 12',
    category: RuleCategory.CROSS_FORM,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleA', 'Form1040'],
    check: (data) => {
      if (data.hasScheduleA && data.scheduleALine17 !== undefined) {
        return Math.abs((data.line12 || 0) - data.scheduleALine17) < 0.01
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule A Line 17', 'Form 1040 Line 12'],
      expected: `$${(data.scheduleALine17 || 0).toFixed(2)}`,
      actual: `$${(data.line12 || 0).toFixed(2)}`,
      suggestion:
        'Total itemized deductions from Schedule A must match Form 1040, Line 12'
    })
  },

  // -------------------------------------------------------------------------
  // Range Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0150',
    description:
      'State and local tax deduction limited to $10,000 ($5,000 if MFS)',
    category: RuleCategory.RANGE,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleA'],
    applicableYears: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    check: (data) => {
      const limit = data.filingStatus === FilingStatus.MFS ? 5000 : 10000
      return (data.scheduleALine7 || 0) <= limit
    },
    getErrorDetails: (data) => {
      const limit = data.filingStatus === FilingStatus.MFS ? 5000 : 10000
      return {
        fields: ['Schedule A Line 7'],
        expected: `<= $${limit.toFixed(2)}`,
        actual: `$${(data.scheduleALine7 || 0).toFixed(2)}`,
        suggestion: `SALT deduction is limited to $${limit.toLocaleString()} for ${
          data.filingStatus === FilingStatus.MFS
            ? 'Married Filing Separately'
            : 'your filing status'
        }`,
        irsReference: 'IRC Section 164(b)(6)'
      }
    }
  },
  {
    id: 'R0151',
    description: 'Educator expense deduction limited to $300 per educator',
    category: RuleCategory.RANGE,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Schedule1'],
    applicableYears: [2023, 2024, 2025],
    check: (data) => (data.schedule1Line11 || 0) <= 600, // $300 x 2 for MFJ
    getErrorDetails: (data) => ({
      fields: ['Schedule 1 Line 11'],
      expected: '<= $300 per educator ($600 for MFJ)',
      actual: `$${(data.schedule1Line11 || 0).toFixed(2)}`,
      suggestion:
        'Educator expenses are limited to $300 per educator. For MFJ with both spouses as educators, maximum is $600.'
    })
  },
  {
    id: 'R0152',
    description: 'Student loan interest deduction limited to $2,500',
    category: RuleCategory.RANGE,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Schedule1'],
    check: (data) => (data.schedule1Line20 || 0) <= 2500,
    getErrorDetails: (data) => ({
      fields: ['Schedule 1 Line 20'],
      expected: '<= $2,500',
      actual: `$${(data.schedule1Line20 || 0).toFixed(2)}`,
      suggestion:
        'Student loan interest deduction is limited to $2,500 per year',
      irsReference: 'IRC Section 221'
    })
  },
  {
    id: 'R0153',
    description: 'HSA contribution limit must not be exceeded',
    category: RuleCategory.RANGE,
    severity: RuleSeverity.WARNING,
    applicableForms: ['Schedule1', 'Form8889'],
    applicableYears: [2024],
    check: (data) => {
      // 2024 limits: $4,150 self-only, $8,300 family, plus $1,000 catch-up if 55+
      const baseLimit = 8300 // Conservative: use family limit
      return (data.schedule1Line12 || 0) <= baseLimit + 1000
    },
    getErrorDetails: (data) => ({
      fields: ['Schedule 1 Line 12'],
      expected: '<= $8,300 (family) or $4,150 (self-only) + $1,000 if age 55+',
      actual: `$${(data.schedule1Line12 || 0).toFixed(2)}`,
      suggestion:
        'Verify HSA contribution does not exceed IRS limits. Excess contributions may be subject to 6% excise tax.'
    })
  },

  // -------------------------------------------------------------------------
  // Filing Status Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0200',
    description: 'MFS filers cannot claim Earned Income Credit',
    category: RuleCategory.FILING_STATUS,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040', 'ScheduleEIC'],
    check: (data) => {
      if (data.filingStatus === FilingStatus.MFS) {
        return (data.line27 || 0) === 0
      }
      return true
    },
    getErrorDetails: () => ({
      fields: ['Line 27'],
      expected: '$0 for MFS filers',
      suggestion:
        'Earned Income Credit is not available when filing Married Filing Separately',
      irsReference: 'IRC Section 32(d)'
    })
  },
  {
    id: 'R0201',
    description: 'Head of Household requires qualifying person',
    category: RuleCategory.FILING_STATUS,
    severity: RuleSeverity.WARNING,
    applicableForms: ['Form1040'],
    check: (data) => {
      if (data.filingStatus === FilingStatus.HOH) {
        return (
          (data.dependentCount || 0) > 0 || (data.qualifyingChildCount || 0) > 0
        )
      }
      return true
    },
    getErrorDetails: () => ({
      fields: ['Filing Status'],
      expected: 'At least one qualifying person',
      suggestion:
        'Head of Household status requires a qualifying child or dependent who lived with you for more than half the year'
    })
  },
  {
    id: 'R0202',
    description: 'Qualifying Widow(er) requires dependent child',
    category: RuleCategory.FILING_STATUS,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      if (data.filingStatus === FilingStatus.W) {
        return (data.qualifyingChildCount || 0) > 0
      }
      return true
    },
    getErrorDetails: () => ({
      fields: ['Filing Status'],
      expected: 'At least one dependent child',
      suggestion: 'Qualifying Widow(er) status requires a dependent child'
    })
  },

  // -------------------------------------------------------------------------
  // Credit Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0250',
    description:
      'Child Tax Credit limited based on number of qualifying children',
    category: RuleCategory.CREDIT,
    severity: RuleSeverity.WARNING,
    applicableForms: ['Form1040', 'Schedule8812'],
    applicableYears: [2024, 2025],
    check: (data) => {
      const maxCredit = (data.qualifyingChildCount || 0) * 2000
      return (data.line19 || 0) <= maxCredit
    },
    getErrorDetails: (data) => {
      const maxCredit = (data.qualifyingChildCount || 0) * 2000
      return {
        fields: ['Line 19'],
        expected: `<= $${maxCredit.toFixed(2)} (${
          data.qualifyingChildCount || 0
        } children x $2,000)`,
        actual: `$${(data.line19 || 0).toFixed(2)}`,
        suggestion: 'Child Tax Credit is $2,000 per qualifying child under 17'
      }
    }
  },
  {
    id: 'R0251',
    description: 'Total credits cannot exceed tax before credits',
    category: RuleCategory.CREDIT,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      const nonrefundableCredits = (data.line19 || 0) + (data.line20 || 0)
      return nonrefundableCredits <= (data.line18 || 0)
    },
    getErrorDetails: (data) => ({
      fields: ['Line 18', 'Line 19', 'Line 20', 'Line 21'],
      expected: `Credits <= $${(data.line18 || 0).toFixed(
        2
      )} (tax before credits)`,
      actual: `Credits: $${((data.line19 || 0) + (data.line20 || 0)).toFixed(
        2
      )}`,
      suggestion:
        'Nonrefundable credits cannot exceed your tax liability. Excess credits may be lost or carried forward.'
    })
  },
  {
    id: 'R0252',
    description: 'American Opportunity Credit limited to $2,500 per student',
    category: RuleCategory.CREDIT,
    severity: RuleSeverity.WARNING,
    applicableForms: ['Form1040', 'Form8863'],
    check: (data) => (data.line29 || 0) <= 2500,
    getErrorDetails: (data) => ({
      fields: ['Line 29'],
      expected: '<= $2,500 per eligible student',
      actual: `$${(data.line29 || 0).toFixed(2)}`,
      suggestion:
        'American Opportunity Credit is limited to $2,500 per eligible student',
      irsReference: 'IRC Section 25A'
    })
  },

  // -------------------------------------------------------------------------
  // Deduction Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0300',
    description: 'Cannot claim both standard deduction and itemized deductions',
    category: RuleCategory.DEDUCTION,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040', 'ScheduleA'],
    check: (data) => {
      // If using standard deduction, should not have Schedule A
      // If itemizing, line 12 should equal Schedule A total
      if (data.hasScheduleA) {
        return Math.abs((data.line12 || 0) - (data.scheduleALine17 || 0)) < 0.01
      }
      return true
    },
    getErrorDetails: (data) => ({
      fields: ['Line 12', 'Schedule A Line 17'],
      expected: 'Either standard deduction OR itemized deductions',
      actual: `Line 12: $${(data.line12 || 0).toFixed(2)}, Schedule A: $${(
        data.scheduleALine17 || 0
      ).toFixed(2)}`,
      suggestion:
        'Choose either the standard deduction or itemized deductions, not both'
    })
  },
  {
    id: 'R0301',
    description: 'Medical expense deduction threshold is 7.5% of AGI',
    category: RuleCategory.DEDUCTION,
    severity: RuleSeverity.WARNING,
    applicableForms: ['ScheduleA'],
    check: (data) => {
      if (data.scheduleALine1 && data.scheduleALine2) {
        const threshold = data.scheduleALine2 * 0.075
        const expectedDeduction = Math.max(0, data.scheduleALine1 - threshold)
        return Math.abs((data.scheduleALine4 || 0) - expectedDeduction) < 0.01
      }
      return true
    },
    getErrorDetails: (data) => {
      const threshold = (data.scheduleALine2 || 0) * 0.075
      return {
        fields: ['Schedule A Lines 1-4'],
        expected: `Deductible: Expenses - ${threshold.toFixed(
          2
        )} (7.5% of AGI)`,
        actual: `$${(data.scheduleALine4 || 0).toFixed(2)}`,
        suggestion: 'Only medical expenses exceeding 7.5% of AGI are deductible'
      }
    }
  },
  {
    id: 'R0302',
    description: 'QBI deduction cannot exceed 20% of taxable income',
    category: RuleCategory.DEDUCTION,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040', 'Form8995'],
    check: (data) => {
      if (data.line13 && data.line15) {
        // QBI deduction limited to 20% of taxable income before QBI
        const taxableBeforeQBI = (data.line15 || 0) + (data.line13 || 0)
        return (data.line13 || 0) <= taxableBeforeQBI * 0.2
      }
      return true
    },
    getErrorDetails: (data) => {
      const taxableBeforeQBI = (data.line15 || 0) + (data.line13 || 0)
      return {
        fields: ['Line 13', 'Line 15'],
        expected: `<= $${(taxableBeforeQBI * 0.2).toFixed(
          2
        )} (20% of taxable income)`,
        actual: `$${(data.line13 || 0).toFixed(2)}`,
        suggestion:
          'QBI deduction is limited to 20% of taxable income (before QBI deduction)',
        irsReference: 'IRC Section 199A'
      }
    }
  },

  // -------------------------------------------------------------------------
  // Identity Rules
  // -------------------------------------------------------------------------
  {
    id: 'R0350',
    description: 'Primary SSN is required',
    category: RuleCategory.IDENTITY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => !!data.primarySSN && data.primarySSN.length === 9,
    getErrorDetails: () => ({
      fields: ['Primary SSN'],
      expected: '9-digit SSN',
      suggestion:
        'A valid 9-digit Social Security Number is required for the primary taxpayer'
    })
  },
  {
    id: 'R0351',
    description: 'Spouse SSN required for MFJ or MFS',
    category: RuleCategory.IDENTITY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      if (
        data.filingStatus === FilingStatus.MFJ ||
        data.filingStatus === FilingStatus.MFS
      ) {
        return !!data.spouseSSN && data.spouseSSN.length === 9
      }
      return true
    },
    getErrorDetails: () => ({
      fields: ['Spouse SSN'],
      expected: '9-digit SSN for spouse',
      suggestion:
        'A valid 9-digit Social Security Number is required for spouse when filing MFJ or MFS'
    })
  },
  {
    id: 'R0352',
    description: 'Primary and spouse SSN must be different',
    category: RuleCategory.IDENTITY,
    severity: RuleSeverity.ERROR,
    applicableForms: ['Form1040'],
    check: (data) => {
      if (data.primarySSN && data.spouseSSN) {
        return data.primarySSN !== data.spouseSSN
      }
      return true
    },
    getErrorDetails: () => ({
      fields: ['Primary SSN', 'Spouse SSN'],
      expected: 'Different SSNs',
      suggestion:
        'Primary taxpayer and spouse must have different Social Security Numbers'
    })
  }
]

// ============================================================================
// Additional Schedule Rules
// ============================================================================

/**
 * Business rules for Schedule A (Itemized Deductions)
 */
export const RULES_SCHEDULE_A: BusinessRule[] = [
  {
    id: 'SA001',
    description:
      'Total itemized deductions must equal sum of all deduction categories',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleA'],
    check: (data) => {
      const sum =
        (data.scheduleALine4 || 0) +
        (data.scheduleALine7 || 0) +
        (data.scheduleALine9 || 0) +
        (data.scheduleALine14 || 0) +
        (data.scheduleALine15 || 0) +
        (data.scheduleALine16 || 0)
      return Math.abs((data.scheduleALine17 || 0) - sum) < 0.01
    },
    getErrorDetails: (data) => {
      const sum =
        (data.scheduleALine4 || 0) +
        (data.scheduleALine7 || 0) +
        (data.scheduleALine9 || 0) +
        (data.scheduleALine14 || 0) +
        (data.scheduleALine15 || 0) +
        (data.scheduleALine16 || 0)
      return {
        fields: ['Schedule A Lines 4, 7, 9, 14, 15, 16, 17'],
        expected: `$${sum.toFixed(2)}`,
        actual: `$${(data.scheduleALine17 || 0).toFixed(2)}`,
        suggestion:
          'Total itemized deductions should equal sum of medical, taxes, interest, charity, casualty, and other deductions'
      }
    }
  }
]

/**
 * Business rules for Schedule C (Business Income)
 */
export const RULES_SCHEDULE_C: BusinessRule[] = [
  {
    id: 'SC001',
    description: 'Gross profit must equal gross receipts minus COGS',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleC'],
    check: (data) => {
      const expected =
        (data.scheduleCGrossReceipts || 0) - (data.scheduleCCOGS || 0)
      return Math.abs((data.scheduleCGrossProfit || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected =
        (data.scheduleCGrossReceipts || 0) - (data.scheduleCCOGS || 0)
      return {
        fields: ['Schedule C Lines 1, 4, 5'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.scheduleCGrossProfit || 0).toFixed(2)}`,
        suggestion: 'Gross Profit = Gross Receipts - Cost of Goods Sold'
      }
    }
  },
  {
    id: 'SC002',
    description: 'Net profit must equal gross income minus total expenses',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleC'],
    check: (data) => {
      const expected =
        (data.scheduleCGrossIncome || 0) - (data.scheduleCTotalExpenses || 0)
      return Math.abs((data.scheduleCNetProfit || 0) - expected) < 0.01
    },
    getErrorDetails: (data) => {
      const expected =
        (data.scheduleCGrossIncome || 0) - (data.scheduleCTotalExpenses || 0)
      return {
        fields: ['Schedule C Lines 7, 28, 31'],
        expected: `$${expected.toFixed(2)}`,
        actual: `$${(data.scheduleCNetProfit || 0).toFixed(2)}`,
        suggestion: 'Net Profit = Gross Income - Total Expenses'
      }
    }
  }
]

/**
 * Business rules for Schedule SE (Self-Employment Tax)
 */
export const RULES_SCHEDULE_SE: BusinessRule[] = [
  {
    id: 'SSE001',
    description: 'Self-employment tax must be calculated correctly',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleSE'],
    check: (data) => {
      if (
        data.scheduleSENetEarnings !== undefined &&
        data.scheduleSENetEarnings >= 400
      ) {
        // SE tax rate is 15.3% on 92.35% of net earnings (up to SS wage base)
        const seBase = data.scheduleSENetEarnings * 0.9235
        const expectedTax = seBase * 0.153
        // Allow some variance for wage base cap calculations
        return (
          Math.abs((data.scheduleSESelfEmploymentTax || 0) - expectedTax) < 100
        )
      }
      return true
    },
    getErrorDetails: (data) => {
      const seBase = (data.scheduleSENetEarnings || 0) * 0.9235
      const expectedTax = seBase * 0.153
      return {
        fields: ['Schedule SE Lines 4, 12'],
        expected: `Approximately $${expectedTax.toFixed(2)}`,
        actual: `$${(data.scheduleSESelfEmploymentTax || 0).toFixed(2)}`,
        suggestion: 'SE tax = 15.3% of (92.35% of net self-employment earnings)'
      }
    }
  },
  {
    id: 'SSE002',
    description: 'Deductible SE tax must be 50% of SE tax',
    category: RuleCategory.MATHEMATICAL,
    severity: RuleSeverity.ERROR,
    applicableForms: ['ScheduleSE'],
    check: (data) => {
      if (data.scheduleSESelfEmploymentTax !== undefined) {
        const expected = data.scheduleSESelfEmploymentTax * 0.5
        return Math.abs((data.scheduleSEDeduction || 0) - expected) < 0.01
      }
      return true
    },
    getErrorDetails: (data) => {
      const expected = (data.scheduleSESelfEmploymentTax || 0) * 0.5
      return {
        fields: ['Schedule SE Lines 12, 13'],
        expected: `$${expected.toFixed(2)} (50% of SE tax)`,
        actual: `$${(data.scheduleSEDeduction || 0).toFixed(2)}`,
        suggestion:
          'Deductible self-employment tax is exactly 50% of total SE tax'
      }
    }
  }
]

// ============================================================================
// Business Rules Engine
// ============================================================================

/**
 * Business Rules Engine for validating tax returns against IRS rules.
 *
 * This engine applies business rules that go beyond XML schema validation,
 * checking mathematical accuracy, consistency, and compliance with tax law.
 *
 * @example
 * ```typescript
 * const engine = new BusinessRulesEngine();
 * const errors = engine.check(taxReturnData, 2024);
 * errors.forEach(error => {
 *   console.log(`[${error.severity}] ${error.ruleId}: ${error.message}`);
 * });
 * ```
 */
export class BusinessRulesEngine {
  private rules: BusinessRule[] = []
  private customRules: BusinessRule[] = []

  /**
   * Creates a new BusinessRulesEngine with default rules
   */
  constructor() {
    // Load all default rules
    this.rules = [
      ...RULES_1040,
      ...RULES_SCHEDULE_A,
      ...RULES_SCHEDULE_C,
      ...RULES_SCHEDULE_SE
    ]
  }

  /**
   * Checks all applicable business rules against the provided data
   *
   * @param returnData - The tax return data to validate
   * @param taxYear - The tax year being filed
   * @returns Array of business rule errors
   */
  check(returnData: TaxReturnData, taxYear: number): BusinessRuleError[] {
    const errors: BusinessRuleError[] = []
    const allRules = [...this.rules, ...this.customRules]

    for (const rule of allRules) {
      // Check if rule applies to this tax year
      if (rule.applicableYears && rule.applicableYears.length > 0) {
        if (!rule.applicableYears.includes(taxYear)) {
          continue
        }
      }

      try {
        const passes = rule.check(returnData, taxYear)

        if (!passes) {
          const error: BusinessRuleError = {
            ruleId: rule.id,
            description: rule.description,
            message: rule.description,
            severity: rule.severity,
            category: rule.category,
            forms: rule.applicableForms,
            fields: []
          }

          // Get additional error details if available
          if (rule.getErrorDetails) {
            const details = rule.getErrorDetails(returnData, taxYear)
            Object.assign(error, details)
          }

          errors.push(error)
        }
      } catch (e) {
        // Rule threw an error - log it but continue checking other rules
        errors.push({
          ruleId: rule.id,
          description: rule.description,
          message: `Rule check failed: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`,
          severity: RuleSeverity.WARNING,
          category: rule.category,
          forms: rule.applicableForms,
          fields: []
        })
      }
    }

    return errors
  }

  /**
   * Checks rules for a specific category only
   *
   * @param returnData - The tax return data to validate
   * @param taxYear - The tax year being filed
   * @param category - The category of rules to check
   * @returns Array of business rule errors for the specified category
   */
  checkCategory(
    returnData: TaxReturnData,
    taxYear: number,
    category: RuleCategory
  ): BusinessRuleError[] {
    const originalRules = this.rules
    this.rules = this.rules.filter((r) => r.category === category)
    const errors = this.check(returnData, taxYear)
    this.rules = originalRules
    return errors
  }

  /**
   * Checks rules for a specific form only
   *
   * @param returnData - The tax return data to validate
   * @param taxYear - The tax year being filed
   * @param formType - The form type to check rules for
   * @returns Array of business rule errors for the specified form
   */
  checkForm(
    returnData: TaxReturnData,
    taxYear: number,
    formType: string
  ): BusinessRuleError[] {
    const originalRules = this.rules
    this.rules = this.rules.filter((r) => r.applicableForms.includes(formType))
    const errors = this.check(returnData, taxYear)
    this.rules = originalRules
    return errors
  }

  /**
   * Gets errors only (excludes warnings and info)
   *
   * @param returnData - The tax return data to validate
   * @param taxYear - The tax year being filed
   * @returns Array of ERROR severity violations only
   */
  getErrors(returnData: TaxReturnData, taxYear: number): BusinessRuleError[] {
    return this.check(returnData, taxYear).filter(
      (e) => e.severity === RuleSeverity.ERROR
    )
  }

  /**
   * Gets warnings only
   *
   * @param returnData - The tax return data to validate
   * @param taxYear - The tax year being filed
   * @returns Array of WARNING severity violations only
   */
  getWarnings(returnData: TaxReturnData, taxYear: number): BusinessRuleError[] {
    return this.check(returnData, taxYear).filter(
      (e) => e.severity === RuleSeverity.WARNING
    )
  }

  /**
   * Adds a custom business rule
   *
   * @param rule - The custom rule to add
   */
  addRule(rule: BusinessRule): void {
    this.customRules.push(rule)
  }

  /**
   * Adds multiple custom business rules
   *
   * @param rules - Array of custom rules to add
   */
  addRules(rules: BusinessRule[]): void {
    this.customRules.push(...rules)
  }

  /**
   * Removes a custom rule by ID
   *
   * @param ruleId - The ID of the rule to remove
   * @returns true if rule was found and removed
   */
  removeRule(ruleId: string): boolean {
    const index = this.customRules.findIndex((r) => r.id === ruleId)
    if (index >= 0) {
      this.customRules.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clears all custom rules
   */
  clearCustomRules(): void {
    this.customRules = []
  }

  /**
   * Gets the total number of rules (including custom)
   */
  getRuleCount(): number {
    return this.rules.length + this.customRules.length
  }

  /**
   * Gets all rule IDs
   */
  getRuleIds(): string[] {
    return [...this.rules, ...this.customRules].map((r) => r.id)
  }

  /**
   * Gets a specific rule by ID
   */
  getRule(ruleId: string): BusinessRule | undefined {
    return [...this.rules, ...this.customRules].find((r) => r.id === ruleId)
  }

  /**
   * Validates that the return is ready for submission
   * Returns true only if there are no ERROR severity violations
   *
   * @param returnData - The tax return data to validate
   * @param taxYear - The tax year being filed
   * @returns true if no blocking errors exist
   */
  isReadyForSubmission(returnData: TaxReturnData, taxYear: number): boolean {
    const errors = this.getErrors(returnData, taxYear)
    return errors.length === 0
  }

  /**
   * Gets a summary of all violations grouped by severity
   */
  getSummary(
    returnData: TaxReturnData,
    taxYear: number
  ): {
    errors: number
    warnings: number
    info: number
    total: number
    byCategory: Record<RuleCategory, number>
  } {
    const allErrors = this.check(returnData, taxYear)
    const byCategory: Record<RuleCategory, number> = {
      [RuleCategory.MATHEMATICAL]: 0,
      [RuleCategory.CONSISTENCY]: 0,
      [RuleCategory.RANGE]: 0,
      [RuleCategory.CROSS_FORM]: 0,
      [RuleCategory.FILING_STATUS]: 0,
      [RuleCategory.DEPENDENCY]: 0,
      [RuleCategory.CREDIT]: 0,
      [RuleCategory.DEDUCTION]: 0,
      [RuleCategory.IDENTITY]: 0,
      [RuleCategory.DATE]: 0
    }

    allErrors.forEach((e) => {
      byCategory[e.category]++
    })

    return {
      errors: allErrors.filter((e) => e.severity === RuleSeverity.ERROR).length,
      warnings: allErrors.filter((e) => e.severity === RuleSeverity.WARNING)
        .length,
      info: allErrors.filter((e) => e.severity === RuleSeverity.INFO).length,
      total: allErrors.length,
      byCategory
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default BusinessRulesEngine
