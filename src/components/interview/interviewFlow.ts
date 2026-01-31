/**
 * Interview Flow Definition
 * Defines all questions, branching logic, and mappings to form fields/sections
 */

import Urls from 'ustaxes/data/urls'
import { FilingStatus } from 'ustaxes/core/data'

// Question input types
export type QuestionInputType =
  | 'yes_no'
  | 'multiple_choice'
  | 'numeric'
  | 'text'
  | 'currency'
  | 'date'

// Question categories
export type QuestionCategory =
  | 'filing_status'
  | 'income'
  | 'deductions'
  | 'credits'
  | 'state'
  | 'personal'
  | 'review'

// Individual question option (for multiple choice)
export interface QuestionOption {
  value: string
  label: string
  helpText?: string
}

// Branching condition
export interface BranchCondition {
  questionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  operator?: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
}

// Question definition
export interface InterviewQuestion {
  id: string
  category: QuestionCategory
  questionText: string
  helpText?: string
  whyAskingText?: string
  inputType: QuestionInputType
  options?: QuestionOption[]
  required?: boolean
  // Where this answer should be saved in the form
  formSection?: string
  formField?: string
  formUrl?: string
  // Branching logic
  showIf?: BranchCondition[]
  skipToIf?: { condition: BranchCondition[]; targetQuestionId: string }[]
  // For numeric inputs
  min?: number
  max?: number
  // For currency
  isCurrency?: boolean
}

// Category definition with display info
export interface InterviewCategory {
  id: QuestionCategory
  title: string
  description: string
  icon?: string
}

// Interview step (groups related questions)
export interface InterviewStep {
  id: string
  title: string
  description: string
  category: QuestionCategory
  questions: string[] // Question IDs
}

// Define all categories
export const interviewCategories: InterviewCategory[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Basic information about you and your family'
  },
  {
    id: 'filing_status',
    title: 'Filing Status',
    description: 'Determine how you will file your tax return'
  },
  {
    id: 'income',
    title: 'Income',
    description: 'All sources of income for the tax year'
  },
  {
    id: 'deductions',
    title: 'Deductions',
    description: 'Expenses that can reduce your taxable income'
  },
  {
    id: 'credits',
    title: 'Credits',
    description: 'Tax credits you may be eligible for'
  },
  {
    id: 'state',
    title: 'State Taxes',
    description: 'State-specific tax information'
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Review your information before filing'
  }
]

// Define all interview questions
export const interviewQuestions: InterviewQuestion[] = [
  // ============================================================
  // PERSONAL INFORMATION
  // ============================================================
  {
    id: 'marital_status',
    category: 'personal',
    questionText: 'What was your marital status on December 31, 2025?',
    helpText: 'Your marital status on the last day of the year determines your filing options.',
    whyAskingText: 'Your marital status affects which filing statuses are available to you and can significantly impact your tax liability.',
    inputType: 'multiple_choice',
    options: [
      { value: 'single', label: 'Single (never married)' },
      { value: 'married', label: 'Married' },
      { value: 'divorced', label: 'Divorced or legally separated' },
      { value: 'widowed', label: 'Widowed' }
    ],
    required: true,
    formSection: 'taxPayer',
    formUrl: Urls.taxPayer.info
  },
  {
    id: 'has_spouse',
    category: 'personal',
    questionText: 'Will you be filing jointly with your spouse?',
    helpText: 'Filing jointly often results in lower taxes, but both spouses are responsible for the accuracy of the return.',
    whyAskingText: 'Married couples can choose to file jointly or separately. Filing jointly usually results in a lower tax bill.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'marital_status', value: 'married' }],
    formSection: 'taxPayer',
    formUrl: Urls.taxPayer.spouseAndDependent
  },
  {
    id: 'has_dependents',
    category: 'personal',
    questionText: 'Do you have any dependents (children or qualifying relatives)?',
    helpText: 'Dependents include children under 19, full-time students under 24, or relatives you support.',
    whyAskingText: 'Claiming dependents can qualify you for valuable tax credits like the Child Tax Credit and may affect your filing status.',
    inputType: 'yes_no',
    required: true,
    formSection: 'taxPayer',
    formUrl: Urls.taxPayer.spouseAndDependent
  },
  {
    id: 'num_dependents',
    category: 'personal',
    questionText: 'How many dependents do you have?',
    inputType: 'numeric',
    min: 1,
    max: 20,
    showIf: [{ questionId: 'has_dependents', value: true }],
    formSection: 'taxPayer',
    formUrl: Urls.taxPayer.spouseAndDependent
  },
  {
    id: 'has_children_under_17',
    category: 'personal',
    questionText: 'Do you have any children under the age of 17?',
    helpText: 'Children under 17 may qualify for the Child Tax Credit worth up to $2,000 per child.',
    whyAskingText: 'The Child Tax Credit is only available for qualifying children under age 17 at the end of the tax year.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'has_dependents', value: true }],
    formSection: 'credits'
  },

  // ============================================================
  // FILING STATUS
  // ============================================================
  {
    id: 'filing_status',
    category: 'filing_status',
    questionText: "What's your filing status?",
    helpText: 'Your filing status determines your tax brackets and standard deduction amount.',
    whyAskingText: 'Filing status is one of the most important factors in calculating your taxes. It affects your tax rates, standard deduction, and eligibility for various credits.',
    inputType: 'multiple_choice',
    options: [
      {
        value: FilingStatus.S,
        label: 'Single',
        helpText: 'You are unmarried, divorced, or legally separated'
      },
      {
        value: FilingStatus.MFJ,
        label: 'Married Filing Jointly',
        helpText: 'You are married and want to file one return with your spouse'
      },
      {
        value: FilingStatus.MFS,
        label: 'Married Filing Separately',
        helpText: 'You are married but want to be responsible only for your own tax'
      },
      {
        value: FilingStatus.HOH,
        label: 'Head of Household',
        helpText: 'You are unmarried and pay more than half the cost of keeping up a home for yourself and a qualifying person'
      },
      {
        value: FilingStatus.W,
        label: 'Qualifying Widow(er)',
        helpText: 'Your spouse died in the previous two years and you have a dependent child'
      }
    ],
    required: true,
    formSection: 'taxPayer',
    formField: 'filingStatus',
    formUrl: Urls.taxPayer.info
  },
  {
    id: 'spouse_died_recently',
    category: 'filing_status',
    questionText: 'Did your spouse pass away in 2023 or 2024?',
    helpText: 'If your spouse died recently and you have a dependent child, you may qualify for Qualifying Widow(er) status.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'marital_status', value: 'widowed' }]
  },

  // ============================================================
  // INCOME - W2 Employment
  // ============================================================
  {
    id: 'had_w2_income',
    category: 'income',
    questionText: 'Did you work as an employee in 2025?',
    helpText: 'This includes any job where you received a W-2 form from your employer.',
    whyAskingText: 'W-2 income is wages from employment. Your employer withholds taxes and reports your income to the IRS.',
    inputType: 'yes_no',
    required: true,
    formSection: 'w2s',
    formUrl: Urls.income.w2s
  },
  {
    id: 'num_w2_employers',
    category: 'income',
    questionText: 'How many W-2 forms did you receive?',
    helpText: 'Count each W-2 you received. If you had multiple jobs, you will have multiple W-2s.',
    inputType: 'numeric',
    min: 1,
    max: 20,
    showIf: [{ questionId: 'had_w2_income', value: true }],
    formSection: 'w2s',
    formUrl: Urls.income.w2s
  },

  // INCOME - 1099 Income
  {
    id: 'had_1099_income',
    category: 'income',
    questionText: 'Did you receive any 1099 forms in 2025?',
    helpText: '1099 forms report income from sources other than employment, such as freelance work, investments, or retirement distributions.',
    whyAskingText: '1099 forms report various types of income including interest, dividends, self-employment income, and retirement distributions.',
    inputType: 'yes_no',
    required: true,
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },
  {
    id: 'had_interest_income',
    category: 'income',
    questionText: 'Did you earn interest income (1099-INT)?',
    helpText: 'Interest from bank accounts, CDs, or bonds is reported on Form 1099-INT.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'had_1099_income', value: true }],
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },
  {
    id: 'had_dividend_income',
    category: 'income',
    questionText: 'Did you receive dividend income (1099-DIV)?',
    helpText: 'Dividends from stocks or mutual funds are reported on Form 1099-DIV.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'had_1099_income', value: true }],
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },
  {
    id: 'had_investment_sales',
    category: 'income',
    questionText: 'Did you sell any stocks, bonds, or other investments (1099-B)?',
    helpText: 'Sales of investments are reported on Form 1099-B from your broker.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'had_1099_income', value: true }],
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },
  {
    id: 'had_retirement_distribution',
    category: 'income',
    questionText: 'Did you receive retirement account distributions (1099-R)?',
    helpText: 'Distributions from IRAs, 401(k)s, or pensions are reported on Form 1099-R.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'had_1099_income', value: true }],
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },
  {
    id: 'had_social_security',
    category: 'income',
    questionText: 'Did you receive Social Security benefits (SSA-1099)?',
    helpText: 'Social Security benefits are reported on Form SSA-1099.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'had_1099_income', value: true }],
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },
  {
    id: 'had_self_employment',
    category: 'income',
    questionText: 'Did you have self-employment or freelance income (1099-NEC)?',
    helpText: 'Non-employee compensation from contract work is reported on Form 1099-NEC.',
    whyAskingText: 'Self-employment income is subject to self-employment tax in addition to regular income tax.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'had_1099_income', value: true }],
    formSection: 'f1099s',
    formUrl: Urls.income.f1099s
  },

  // INCOME - Real Estate
  {
    id: 'had_rental_income',
    category: 'income',
    questionText: 'Did you receive rental income from real estate?',
    helpText: 'Report income from renting out property such as houses, apartments, or rooms.',
    whyAskingText: 'Rental income is taxable, but you can deduct expenses like mortgage interest, repairs, and depreciation.',
    inputType: 'yes_no',
    required: true,
    formSection: 'realEstate',
    formUrl: Urls.income.realEstate
  },

  // INCOME - Stock Options
  {
    id: 'had_stock_options',
    category: 'income',
    questionText: 'Did you exercise any stock options (Form 3921)?',
    helpText: 'If you exercised incentive stock options (ISOs), you should have received Form 3921.',
    inputType: 'yes_no',
    formSection: 'f3921s',
    formUrl: Urls.income.stockOptions
  },

  // INCOME - Partnership
  {
    id: 'had_partnership_income',
    category: 'income',
    questionText: 'Are you a partner in a partnership or S-corporation (Schedule K-1)?',
    helpText: 'Partnership and S-corp income is reported on Schedule K-1.',
    inputType: 'yes_no',
    formSection: 'scheduleK1Form1065s',
    formUrl: Urls.income.partnershipIncome
  },

  // ============================================================
  // DEDUCTIONS
  // ============================================================
  {
    id: 'itemize_deductions',
    category: 'deductions',
    questionText: 'Do you want to itemize your deductions?',
    helpText: 'You can either take the standard deduction or itemize. Itemizing makes sense if your itemized deductions exceed the standard deduction.',
    whyAskingText: 'The standard deduction for 2025 is $15,000 for single filers and $30,000 for married filing jointly. If your itemized deductions are higher, you should itemize.',
    inputType: 'yes_no',
    required: true,
    formSection: 'itemizedDeductions',
    formUrl: Urls.deductions.itemized
  },
  {
    id: 'paid_mortgage_interest',
    category: 'deductions',
    questionText: 'Did you pay mortgage interest on your home?',
    helpText: 'Mortgage interest on your primary residence (and sometimes a second home) is deductible if you itemize.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'itemize_deductions', value: true }],
    formSection: 'itemizedDeductions',
    formUrl: Urls.deductions.itemized
  },
  {
    id: 'paid_state_local_taxes',
    category: 'deductions',
    questionText: 'Did you pay state and local income or sales taxes?',
    helpText: 'You can deduct up to $10,000 of state and local taxes (SALT) if you itemize.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'itemize_deductions', value: true }],
    formSection: 'itemizedDeductions',
    formUrl: Urls.deductions.itemized
  },
  {
    id: 'made_charitable_donations',
    category: 'deductions',
    questionText: 'Did you make charitable donations?',
    helpText: 'Cash and non-cash donations to qualified charities are deductible if you itemize.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'itemize_deductions', value: true }],
    formSection: 'itemizedDeductions',
    formUrl: Urls.deductions.itemized
  },
  {
    id: 'paid_medical_expenses',
    category: 'deductions',
    questionText: 'Did you pay significant medical expenses?',
    helpText: 'Medical expenses exceeding 7.5% of your adjusted gross income are deductible if you itemize.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'itemize_deductions', value: true }],
    formSection: 'itemizedDeductions',
    formUrl: Urls.deductions.itemized
  },
  {
    id: 'paid_student_loan_interest',
    category: 'deductions',
    questionText: 'Did you pay student loan interest?',
    helpText: 'You can deduct up to $2,500 of student loan interest even if you take the standard deduction.',
    whyAskingText: 'Student loan interest is an "above the line" deduction, meaning you can claim it even if you do not itemize.',
    inputType: 'yes_no',
    required: true,
    formSection: 'f1098es',
    formUrl: Urls.deductions.f1098es
  },
  {
    id: 'student_loan_interest_amount',
    category: 'deductions',
    questionText: 'How much student loan interest did you pay?',
    inputType: 'currency',
    isCurrency: true,
    min: 0,
    max: 10000,
    showIf: [{ questionId: 'paid_student_loan_interest', value: true }],
    formSection: 'f1098es',
    formUrl: Urls.deductions.f1098es
  },

  // ============================================================
  // SAVINGS ACCOUNTS
  // ============================================================
  {
    id: 'has_hsa',
    category: 'deductions',
    questionText: 'Do you have a Health Savings Account (HSA)?',
    helpText: 'HSA contributions are tax-deductible and can be used for qualified medical expenses.',
    whyAskingText: 'HSA contributions reduce your taxable income. You can contribute if you have a high-deductible health plan.',
    inputType: 'yes_no',
    formSection: 'healthSavingsAccounts',
    formUrl: Urls.savingsAccounts.healthSavingsAccounts
  },
  {
    id: 'contributed_to_ira',
    category: 'deductions',
    questionText: 'Did you contribute to a Traditional or Roth IRA?',
    helpText: 'Traditional IRA contributions may be tax-deductible. Roth IRA contributions are not deductible but grow tax-free.',
    inputType: 'yes_no',
    formSection: 'individualRetirementArrangements',
    formUrl: Urls.savingsAccounts.ira
  },

  // ============================================================
  // CREDITS
  // ============================================================
  {
    id: 'eligible_child_tax_credit',
    category: 'credits',
    questionText: 'Based on your dependents, you may be eligible for the Child Tax Credit. Would you like to claim it?',
    helpText: 'The Child Tax Credit is worth up to $2,000 per qualifying child under 17.',
    inputType: 'yes_no',
    showIf: [{ questionId: 'has_children_under_17', value: true }],
    formSection: 'credits'
  },
  {
    id: 'eligible_earned_income_credit',
    category: 'credits',
    questionText: 'Would you like us to check if you qualify for the Earned Income Tax Credit (EITC)?',
    helpText: 'The EITC is a refundable credit for low to moderate income workers. It can be worth up to $7,830 for 2025.',
    whyAskingText: 'The EITC is one of the largest credits available and is fully refundable, meaning you can get it even if you owe no taxes.',
    inputType: 'yes_no',
    formSection: 'credits'
  },

  // ============================================================
  // ESTIMATED TAXES & PAYMENTS
  // ============================================================
  {
    id: 'made_estimated_payments',
    category: 'income',
    questionText: 'Did you make estimated tax payments for 2025?',
    helpText: 'If you paid estimated taxes quarterly, those payments will be credited toward your tax bill.',
    inputType: 'yes_no',
    formSection: 'estimatedTaxes',
    formUrl: Urls.payments.estimatedTaxes
  },

  // ============================================================
  // STATE TAXES
  // ============================================================
  {
    id: 'state_of_residence',
    category: 'state',
    questionText: 'What state did you live in during 2025?',
    helpText: 'Your state of residence determines if you need to file a state tax return.',
    whyAskingText: 'Most states require you to file a state income tax return in addition to your federal return.',
    inputType: 'text',
    required: true,
    formSection: 'stateResidencies',
    formUrl: Urls.taxPayer.info
  },
  {
    id: 'lived_multiple_states',
    category: 'state',
    questionText: 'Did you live in more than one state during 2025?',
    helpText: 'If you moved between states, you may need to file part-year resident returns in multiple states.',
    inputType: 'yes_no',
    formSection: 'stateResidencies'
  },

  // ============================================================
  // REVIEW
  // ============================================================
  {
    id: 'review_complete',
    category: 'review',
    questionText: 'Have you reviewed all your information and are ready to generate your tax forms?',
    helpText: 'Make sure all information is accurate before generating your tax forms.',
    inputType: 'yes_no',
    formUrl: Urls.createPdf
  }
]

// Define interview steps (groups of questions)
export const interviewSteps: InterviewStep[] = [
  {
    id: 'personal_info',
    title: 'About You',
    description: 'Tell us about yourself and your family',
    category: 'personal',
    questions: [
      'marital_status',
      'has_spouse',
      'has_dependents',
      'num_dependents',
      'has_children_under_17'
    ]
  },
  {
    id: 'filing_status_step',
    title: 'Filing Status',
    description: 'Determine how you will file',
    category: 'filing_status',
    questions: ['filing_status', 'spouse_died_recently']
  },
  {
    id: 'employment_income',
    title: 'Employment Income',
    description: 'Income from jobs and employers',
    category: 'income',
    questions: ['had_w2_income', 'num_w2_employers']
  },
  {
    id: 'other_income',
    title: 'Other Income',
    description: 'Investment and other income sources',
    category: 'income',
    questions: [
      'had_1099_income',
      'had_interest_income',
      'had_dividend_income',
      'had_investment_sales',
      'had_retirement_distribution',
      'had_social_security',
      'had_self_employment'
    ]
  },
  {
    id: 'additional_income',
    title: 'Additional Income',
    description: 'Real estate, stock options, and partnership income',
    category: 'income',
    questions: [
      'had_rental_income',
      'had_stock_options',
      'had_partnership_income',
      'made_estimated_payments'
    ]
  },
  {
    id: 'deductions_step',
    title: 'Deductions',
    description: 'Reduce your taxable income',
    category: 'deductions',
    questions: [
      'itemize_deductions',
      'paid_mortgage_interest',
      'paid_state_local_taxes',
      'made_charitable_donations',
      'paid_medical_expenses',
      'paid_student_loan_interest',
      'student_loan_interest_amount'
    ]
  },
  {
    id: 'savings_accounts_step',
    title: 'Savings Accounts',
    description: 'HSA and retirement contributions',
    category: 'deductions',
    questions: ['has_hsa', 'contributed_to_ira']
  },
  {
    id: 'credits_step',
    title: 'Tax Credits',
    description: 'Credits that reduce your tax bill',
    category: 'credits',
    questions: ['eligible_child_tax_credit', 'eligible_earned_income_credit']
  },
  {
    id: 'state_step',
    title: 'State Taxes',
    description: 'State tax information',
    category: 'state',
    questions: ['state_of_residence', 'lived_multiple_states']
  },
  {
    id: 'review_step',
    title: 'Review',
    description: 'Review and finalize',
    category: 'review',
    questions: ['review_complete']
  }
]

// Helper functions
export const getQuestionById = (id: string): InterviewQuestion | undefined =>
  interviewQuestions.find((q) => q.id === id)

export const getStepById = (id: string): InterviewStep | undefined =>
  interviewSteps.find((s) => s.id === id)

export const getCategoryById = (id: QuestionCategory): InterviewCategory | undefined =>
  interviewCategories.find((c) => c.id === id)

export const getQuestionsForStep = (stepId: string): InterviewQuestion[] => {
  const step = getStepById(stepId)
  if (!step) return []
  return step.questions
    .map((qId) => getQuestionById(qId))
    .filter((q): q is InterviewQuestion => q !== undefined)
}

// Check if a question should be shown based on current answers
export const shouldShowQuestion = (
  question: InterviewQuestion,
  answers: Record<string, unknown>
): boolean => {
  if (!question.showIf || question.showIf.length === 0) {
    return true
  }

  return question.showIf.every((condition) => {
    const answer = answers[condition.questionId]
    const operator = condition.operator || 'equals'

    switch (operator) {
      case 'equals':
        return answer === condition.value
      case 'not_equals':
        return answer !== condition.value
      case 'greater_than':
        return typeof answer === 'number' && answer > condition.value
      case 'less_than':
        return typeof answer === 'number' && answer < condition.value
      case 'contains':
        return (
          typeof answer === 'string' &&
          typeof condition.value === 'string' &&
          answer.toLowerCase().includes(condition.value.toLowerCase())
        )
      default:
        return answer === condition.value
    }
  })
}

// Get the next question to show based on skip logic
export const getNextQuestionId = (
  currentQuestion: InterviewQuestion,
  answers: Record<string, unknown>,
  allQuestions: InterviewQuestion[]
): string | null => {
  // Check skip logic
  if (currentQuestion.skipToIf) {
    for (const skipRule of currentQuestion.skipToIf) {
      const shouldSkip = skipRule.condition.every((condition) => {
        const answer = answers[condition.questionId]
        return answer === condition.value
      })
      if (shouldSkip) {
        return skipRule.targetQuestionId
      }
    }
  }

  // Find next question in sequence
  const currentIndex = allQuestions.findIndex((q) => q.id === currentQuestion.id)
  if (currentIndex === -1 || currentIndex === allQuestions.length - 1) {
    return null
  }

  // Find next visible question
  for (let i = currentIndex + 1; i < allQuestions.length; i++) {
    if (shouldShowQuestion(allQuestions[i], answers)) {
      return allQuestions[i].id
    }
  }

  return null
}
