import { FilingStatus, EstimatedTaxPayments } from 'ustaxes/core/data'
import { EstimatedTaxPaymentRecord } from 'ustaxes/redux/notificationSlice'
import {
  ESTIMATED_TAX_DATES_2025,
  DeadlineType,
  getDeadlineTypeForQuarter,
  daysBetween,
  formatDeadlineDate
} from './deadlineTracker'

// ============================================================================
// Types
// ============================================================================

export interface TaxLiabilityEstimate {
  totalTax: number
  withholding: number
  estimatedTaxDue: number
  quarterlyPayment: number
}

export interface SafeHarborResult {
  priorYearTax: number
  currentYearTax: number
  safeHarborAmount: number
  method: 'prior_year_100' | 'prior_year_110' | 'current_year_90'
  description: string
}

export interface QuarterlyPaymentInfo {
  quarter: 1 | 2 | 3 | 4
  dueDate: Date
  suggestedAmount: number
  paidAmount: number
  remaining: number
  status: 'paid' | 'partial' | 'unpaid' | 'overpaid'
  daysUntilDue: number
  isPastDue: boolean
}

export interface EstimatedTaxSummary {
  totalEstimatedTax: number
  totalPaid: number
  totalRemaining: number
  quarters: QuarterlyPaymentInfo[]
  nextDueQuarter: QuarterlyPaymentInfo | null
  safeHarbor: SafeHarborResult | null
}

export interface ReminderMessage {
  title: string
  body: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  actionText?: string
  actionUrl?: string
}

// ============================================================================
// Constants
// ============================================================================

// AGI thresholds for 110% safe harbor rule
const HIGH_INCOME_AGI_THRESHOLD = 150000
const HIGH_INCOME_AGI_THRESHOLD_MFS = 75000

// Minimum estimated tax to require payments
const MINIMUM_ESTIMATED_TAX_THRESHOLD = 1000

// ============================================================================
// Safe Harbor Calculations
// ============================================================================

/**
 * Determine if taxpayer is high income (for 110% safe harbor rule)
 * High income = AGI > $150,000 ($75,000 if MFS)
 */
export const isHighIncomeForSafeHarbor = (
  agi: number,
  filingStatus: FilingStatus
): boolean => {
  const threshold =
    filingStatus === FilingStatus.MFS
      ? HIGH_INCOME_AGI_THRESHOLD_MFS
      : HIGH_INCOME_AGI_THRESHOLD

  return agi > threshold
}

/**
 * Calculate safe harbor amount
 *
 * To avoid underpayment penalty, pay the lesser of:
 * 1. 90% of current year tax
 * 2. 100% of prior year tax (110% if high income)
 */
export const calculateSafeHarbor = (
  priorYearTax: number,
  currentYearEstimatedTax: number,
  priorYearAGI: number,
  filingStatus: FilingStatus
): SafeHarborResult => {
  const isHighIncome = isHighIncomeForSafeHarbor(priorYearAGI, filingStatus)

  // Calculate the two safe harbor options
  const currentYear90 = currentYearEstimatedTax * 0.9
  const priorYearMultiplier = isHighIncome ? 1.1 : 1.0
  const priorYearSafeHarbor = priorYearTax * priorYearMultiplier

  // Use the lesser amount
  if (priorYearSafeHarbor <= currentYear90) {
    return {
      priorYearTax,
      currentYearTax: currentYearEstimatedTax,
      safeHarborAmount: priorYearSafeHarbor,
      method: isHighIncome ? 'prior_year_110' : 'prior_year_100',
      description: isHighIncome
        ? `Pay 110% of prior year tax ($${priorYearSafeHarbor.toLocaleString()}) to meet safe harbor`
        : `Pay 100% of prior year tax ($${priorYearSafeHarbor.toLocaleString()}) to meet safe harbor`
    }
  }

  return {
    priorYearTax,
    currentYearTax: currentYearEstimatedTax,
    safeHarborAmount: currentYear90,
    method: 'current_year_90',
    description: `Pay 90% of current year tax ($${currentYear90.toLocaleString()}) to meet safe harbor`
  }
}

/**
 * Calculate quarterly safe harbor payment
 */
export const calculateQuarterlySafeHarbor = (
  safeHarborAmount: number,
  quartersPassed: number = 0
): number => {
  const remainingQuarters = 4 - quartersPassed
  if (remainingQuarters <= 0) return 0
  return safeHarborAmount / 4
}

// ============================================================================
// Quarterly Payment Calculations
// ============================================================================

/**
 * Get the due date for a specific quarter in 2025
 */
export const getQuarterDueDate = (
  quarter: 1 | 2 | 3 | 4,
  year: number = 2025
): Date => {
  if (year === 2025) {
    switch (quarter) {
      case 1:
        return ESTIMATED_TAX_DATES_2025.Q1
      case 2:
        return ESTIMATED_TAX_DATES_2025.Q2
      case 3:
        return ESTIMATED_TAX_DATES_2025.Q3
      case 4:
        return ESTIMATED_TAX_DATES_2025.Q4
    }
  }

  // Default pattern for other years
  switch (quarter) {
    case 1:
      return new Date(year, 3, 15)
    case 2:
      return new Date(year, 5, 15)
    case 3:
      return new Date(year, 8, 15)
    case 4:
      return new Date(year + 1, 0, 15)
  }
}

/**
 * Get payment status based on paid vs suggested amount
 */
export const getPaymentStatus = (
  paid: number,
  suggested: number
): 'paid' | 'partial' | 'unpaid' | 'overpaid' => {
  if (paid === 0) return 'unpaid'
  if (paid >= suggested) return paid > suggested ? 'overpaid' : 'paid'
  return 'partial'
}

/**
 * Calculate quarterly payment information
 */
export const calculateQuarterlyPayment = (
  quarter: 1 | 2 | 3 | 4,
  year: number,
  totalEstimatedTax: number,
  payments: EstimatedTaxPaymentRecord[],
  referenceDate: Date = new Date()
): QuarterlyPaymentInfo => {
  const dueDate = getQuarterDueDate(quarter, year)
  const suggestedAmount = totalEstimatedTax / 4

  // Find payment for this quarter
  const payment = payments.find(p => p.quarter === quarter && p.year === year)
  const paidAmount = payment?.amount ?? 0

  const daysUntilDue = daysBetween(referenceDate, dueDate)
  const isPastDue = daysUntilDue < 0

  return {
    quarter,
    dueDate,
    suggestedAmount,
    paidAmount,
    remaining: Math.max(0, suggestedAmount - paidAmount),
    status: getPaymentStatus(paidAmount, suggestedAmount),
    daysUntilDue,
    isPastDue
  }
}

/**
 * Get complete estimated tax summary for a year
 */
export const getEstimatedTaxSummary = (
  totalEstimatedTax: number,
  payments: EstimatedTaxPaymentRecord[],
  priorYearTax?: number,
  priorYearAGI?: number,
  filingStatus?: FilingStatus,
  year: number = 2025,
  referenceDate: Date = new Date()
): EstimatedTaxSummary => {
  const quarters: QuarterlyPaymentInfo[] = [1, 2, 3, 4].map((q) =>
    calculateQuarterlyPayment(
      q as 1 | 2 | 3 | 4,
      year,
      totalEstimatedTax,
      payments,
      referenceDate
    )
  )

  const totalPaid = quarters.reduce((sum, q) => sum + q.paidAmount, 0)
  const totalRemaining = Math.max(0, totalEstimatedTax - totalPaid)

  // Find next due quarter
  const nextDueQuarter =
    quarters.find((q) => !q.isPastDue && q.status !== 'paid' && q.status !== 'overpaid') ??
    null

  // Calculate safe harbor if prior year info available
  let safeHarbor: SafeHarborResult | null = null
  if (priorYearTax !== undefined && priorYearAGI !== undefined && filingStatus) {
    safeHarbor = calculateSafeHarbor(
      priorYearTax,
      totalEstimatedTax,
      priorYearAGI,
      filingStatus
    )
  }

  return {
    totalEstimatedTax,
    totalPaid,
    totalRemaining,
    quarters,
    nextDueQuarter,
    safeHarbor
  }
}

// ============================================================================
// Reminder Message Generation
// ============================================================================

/**
 * Get urgency level based on days until deadline
 */
export const getUrgencyLevel = (
  daysUntilDue: number
): 'low' | 'medium' | 'high' | 'critical' => {
  if (daysUntilDue < 0) return 'critical' // Past due
  if (daysUntilDue === 0) return 'critical' // Due today
  if (daysUntilDue <= 3) return 'high'
  if (daysUntilDue <= 7) return 'medium'
  return 'low'
}

/**
 * Generate reminder message for a quarterly payment
 */
export const generateQuarterlyReminder = (
  quarterInfo: QuarterlyPaymentInfo
): ReminderMessage => {
  const { quarter, dueDate, suggestedAmount, remaining, daysUntilDue, isPastDue, status } =
    quarterInfo

  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterName = quarterNames[quarter - 1]
  const formattedDate = formatDeadlineDate(dueDate)
  const urgency = getUrgencyLevel(daysUntilDue)

  // Already paid
  if (status === 'paid' || status === 'overpaid') {
    return {
      title: `${quarterName} Estimated Tax - Paid`,
      body: `Your ${quarterName} estimated tax payment has been recorded. Thank you!`,
      urgency: 'low'
    }
  }

  // Past due
  if (isPastDue) {
    return {
      title: `${quarterName} Estimated Tax - Past Due`,
      body: `Your ${quarterName} estimated tax payment was due on ${formattedDate}. Pay $${remaining.toLocaleString()} as soon as possible to minimize penalties.`,
      urgency: 'critical',
      actionText: 'Make Payment',
      actionUrl: '/payments/estimated-taxes'
    }
  }

  // Due today
  if (daysUntilDue === 0) {
    return {
      title: `${quarterName} Estimated Tax Due Today!`,
      body: `Your ${quarterName} estimated tax payment of $${remaining.toLocaleString()} is due today. Make sure to submit your payment before midnight.`,
      urgency: 'critical',
      actionText: 'Pay Now',
      actionUrl: '/payments/estimated-taxes'
    }
  }

  // Due soon (within a week)
  if (daysUntilDue <= 7) {
    return {
      title: `${quarterName} Estimated Tax Due ${daysUntilDue === 1 ? 'Tomorrow' : `in ${daysUntilDue} Days`}`,
      body: `Your ${quarterName} estimated tax payment of $${remaining.toLocaleString()} is due on ${formattedDate}. Plan your payment to avoid penalties.`,
      urgency: daysUntilDue <= 3 ? 'high' : 'medium',
      actionText: 'Review Payment',
      actionUrl: '/payments/estimated-taxes'
    }
  }

  // Future payment
  return {
    title: `Upcoming: ${quarterName} Estimated Tax`,
    body: `Your ${quarterName} estimated tax payment of $${suggestedAmount.toLocaleString()} is due on ${formattedDate}.`,
    urgency: 'low',
    actionText: 'View Details',
    actionUrl: '/payments/estimated-taxes'
  }
}

/**
 * Generate a summary reminder for all upcoming payments
 */
export const generateSummaryReminder = (
  summary: EstimatedTaxSummary
): ReminderMessage | null => {
  if (!summary.nextDueQuarter) {
    // All payments made
    if (summary.totalPaid >= summary.totalEstimatedTax) {
      return {
        title: 'Estimated Taxes Complete',
        body: `All quarterly estimated tax payments for the year have been made. Total paid: $${summary.totalPaid.toLocaleString()}`,
        urgency: 'low'
      }
    }
    return null
  }

  const { quarter, daysUntilDue, remaining } = summary.nextDueQuarter
  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterName = quarterNames[quarter - 1]

  // Check for past due quarters
  const pastDueQuarters = summary.quarters.filter(
    (q) => q.isPastDue && q.status !== 'paid' && q.status !== 'overpaid'
  )

  if (pastDueQuarters.length > 0) {
    const totalPastDue = pastDueQuarters.reduce((sum, q) => sum + q.remaining, 0)
    return {
      title: 'Estimated Tax Payments Past Due',
      body: `You have ${pastDueQuarters.length} past due estimated tax payment(s) totaling $${totalPastDue.toLocaleString()}. Pay as soon as possible to minimize penalties.`,
      urgency: 'critical',
      actionText: 'Make Payment',
      actionUrl: '/payments/estimated-taxes'
    }
  }

  return generateQuarterlyReminder(summary.nextDueQuarter)
}

// ============================================================================
// Payment Tracking
// ============================================================================

/**
 * Convert existing EstimatedTaxPayments to payment records
 * Attempts to match payments to quarters based on labels/dates
 */
export const convertExistingPayments = (
  payments: EstimatedTaxPayments[],
  year: number = 2025
): EstimatedTaxPaymentRecord[] => {
  const quarterPatterns = {
    1: /q1|quarter\s*1|first|jan|feb|mar|apr/i,
    2: /q2|quarter\s*2|second|may|jun/i,
    3: /q3|quarter\s*3|third|jul|aug|sep/i,
    4: /q4|quarter\s*4|fourth|oct|nov|dec|jan/i
  }

  return payments
    .map((payment): EstimatedTaxPaymentRecord | null => {
      // Try to determine quarter from label
      for (const [q, pattern] of Object.entries(quarterPatterns)) {
        if (pattern.test(payment.label)) {
          return {
            quarter: parseInt(q) as 1 | 2 | 3 | 4,
            year,
            amount: payment.payment
          }
        }
      }

      // If no quarter detected, return null (user should manually assign)
      return null
    })
    .filter((p): p is EstimatedTaxPaymentRecord => p !== null)
}

/**
 * Calculate total payments made for a year
 */
export const getTotalPaymentsForYear = (
  payments: EstimatedTaxPaymentRecord[],
  year: number
): number => {
  return payments
    .filter((p) => p.year === year)
    .reduce((sum, p) => sum + p.amount, 0)
}

/**
 * Check if estimated tax payments are required
 * Generally required if expecting to owe $1,000+ after withholding
 */
export const isEstimatedTaxRequired = (
  totalTaxLiability: number,
  totalWithholding: number
): boolean => {
  const estimatedDue = totalTaxLiability - totalWithholding
  return estimatedDue >= MINIMUM_ESTIMATED_TAX_THRESHOLD
}
