import { TaxYear, State } from 'ustaxes/core/data'

// ============================================================================
// Types
// ============================================================================

export enum DeadlineType {
  FEDERAL_FILING = 'FEDERAL_FILING',
  STATE_FILING = 'STATE_FILING',
  EXTENSION = 'EXTENSION',
  ESTIMATED_TAX_Q1 = 'ESTIMATED_TAX_Q1',
  ESTIMATED_TAX_Q2 = 'ESTIMATED_TAX_Q2',
  ESTIMATED_TAX_Q3 = 'ESTIMATED_TAX_Q3',
  ESTIMATED_TAX_Q4 = 'ESTIMATED_TAX_Q4'
}

export interface Deadline {
  id: string
  type: DeadlineType
  title: string
  description: string
  date: Date
  year: number
  state?: State
  isExtension?: boolean
}

export interface DeadlineWithStatus extends Deadline {
  daysRemaining: number
  isPast: boolean
  isToday: boolean
  isUpcoming: boolean // within 30 days
  isUrgent: boolean // within 7 days
}

// ============================================================================
// 2025 Tax Deadlines
// ============================================================================

/**
 * 2025 Estimated Tax Due Dates
 * Q1: April 15, 2025
 * Q2: June 16, 2025 (June 15 falls on Sunday)
 * Q3: September 15, 2025
 * Q4: January 15, 2026
 */
export const ESTIMATED_TAX_DATES_2025 = {
  Q1: new Date(2025, 3, 15), // April 15, 2025
  Q2: new Date(2025, 5, 16), // June 16, 2025
  Q3: new Date(2025, 8, 15), // September 15, 2025
  Q4: new Date(2026, 0, 15) // January 15, 2026
}

/**
 * Federal Filing Deadline for 2024 tax year (filed in 2025)
 */
export const FEDERAL_FILING_DEADLINE_2025 = new Date(2025, 3, 15) // April 15, 2025

/**
 * Extension Deadline for 2024 tax year (filed in 2025)
 */
export const EXTENSION_DEADLINE_2025 = new Date(2025, 9, 15) // October 15, 2025

// ============================================================================
// State-specific deadlines
// States that differ from the federal April 15 deadline
// ============================================================================

export const STATE_FILING_DEADLINES: Partial<Record<State, { date: Date; year: number }>> = {
  // Most states follow April 15, but some have different dates
  // Adding common exceptions:
  DE: { date: new Date(2025, 3, 30), year: 2025 }, // Delaware: April 30
  IA: { date: new Date(2025, 3, 30), year: 2025 }, // Iowa: April 30
  LA: { date: new Date(2025, 4, 15), year: 2025 }, // Louisiana: May 15
  VA: { date: new Date(2025, 4, 1), year: 2025 } // Virginia: May 1
}

// States with no income tax
export const NO_INCOME_TAX_STATES: State[] = [
  'AK', // Alaska
  'FL', // Florida
  'NV', // Nevada
  'SD', // South Dakota
  'TX', // Texas
  'WA', // Washington
  'WY' // Wyoming
  // Note: NH and TN have limited income taxes on dividends/interest
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the number of days between two dates
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
  return Math.round((d2.getTime() - d1.getTime()) / oneDay)
}

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Format a date as a human-readable string
 */
export const formatDeadlineDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Get a friendly description of days remaining
 */
export const getDaysRemainingText = (daysRemaining: number): string => {
  if (daysRemaining < 0) {
    const daysPast = Math.abs(daysRemaining)
    return daysPast === 1 ? '1 day ago' : `${daysPast} days ago`
  }
  if (daysRemaining === 0) {
    return 'Today'
  }
  if (daysRemaining === 1) {
    return 'Tomorrow'
  }
  if (daysRemaining <= 7) {
    return `${daysRemaining} days`
  }
  if (daysRemaining <= 30) {
    const weeks = Math.floor(daysRemaining / 7)
    return weeks === 1 ? '1 week' : `${weeks} weeks`
  }
  const months = Math.floor(daysRemaining / 30)
  return months === 1 ? '1 month' : `${months} months`
}

// ============================================================================
// Deadline Generation
// ============================================================================

/**
 * Generate all estimated tax deadlines for a given tax year
 */
export const getEstimatedTaxDeadlines = (taxYear: number): Deadline[] => {
  // For 2025 tax year, estimated payments are due during 2025
  const dates =
    taxYear === 2025
      ? ESTIMATED_TAX_DATES_2025
      : {
          // Default pattern for other years
          Q1: new Date(taxYear, 3, 15),
          Q2: new Date(taxYear, 5, 15),
          Q3: new Date(taxYear, 8, 15),
          Q4: new Date(taxYear + 1, 0, 15)
        }

  return [
    {
      id: `estimated-q1-${taxYear}`,
      type: DeadlineType.ESTIMATED_TAX_Q1,
      title: `Q1 ${taxYear} Estimated Tax Payment`,
      description: `First quarter estimated tax payment for ${taxYear}`,
      date: dates.Q1,
      year: taxYear
    },
    {
      id: `estimated-q2-${taxYear}`,
      type: DeadlineType.ESTIMATED_TAX_Q2,
      title: `Q2 ${taxYear} Estimated Tax Payment`,
      description: `Second quarter estimated tax payment for ${taxYear}`,
      date: dates.Q2,
      year: taxYear
    },
    {
      id: `estimated-q3-${taxYear}`,
      type: DeadlineType.ESTIMATED_TAX_Q3,
      title: `Q3 ${taxYear} Estimated Tax Payment`,
      description: `Third quarter estimated tax payment for ${taxYear}`,
      date: dates.Q3,
      year: taxYear
    },
    {
      id: `estimated-q4-${taxYear}`,
      type: DeadlineType.ESTIMATED_TAX_Q4,
      title: `Q4 ${taxYear} Estimated Tax Payment`,
      description: `Fourth quarter estimated tax payment for ${taxYear}`,
      date: dates.Q4,
      year: taxYear
    }
  ]
}

/**
 * Get federal filing deadline for a tax year
 */
export const getFederalFilingDeadline = (taxYear: number): Deadline => {
  // Filing deadline is in the year after the tax year
  const filingYear = taxYear + 1
  const date =
    filingYear === 2025
      ? FEDERAL_FILING_DEADLINE_2025
      : new Date(filingYear, 3, 15)

  return {
    id: `federal-filing-${taxYear}`,
    type: DeadlineType.FEDERAL_FILING,
    title: `${taxYear} Federal Tax Return Due`,
    description: `File your ${taxYear} federal income tax return`,
    date,
    year: taxYear
  }
}

/**
 * Get extension deadline for a tax year
 */
export const getExtensionDeadline = (taxYear: number): Deadline => {
  const filingYear = taxYear + 1
  const date =
    filingYear === 2025 ? EXTENSION_DEADLINE_2025 : new Date(filingYear, 9, 15)

  return {
    id: `extension-${taxYear}`,
    type: DeadlineType.EXTENSION,
    title: `${taxYear} Extension Deadline`,
    description: `Extended filing deadline for ${taxYear} federal tax return`,
    date,
    year: taxYear,
    isExtension: true
  }
}

/**
 * Get state filing deadline for a specific state and tax year
 */
export const getStateFilingDeadline = (
  state: State,
  taxYear: number
): Deadline | null => {
  // No deadline for states without income tax
  if (NO_INCOME_TAX_STATES.includes(state)) {
    return null
  }

  const stateDeadline = STATE_FILING_DEADLINES[state]
  const filingYear = taxYear + 1

  // Use state-specific date if available, otherwise use federal date
  const date = stateDeadline?.date ?? new Date(filingYear, 3, 15)

  return {
    id: `state-filing-${state}-${taxYear}`,
    type: DeadlineType.STATE_FILING,
    title: `${taxYear} ${state} State Tax Return Due`,
    description: `File your ${taxYear} ${state} state income tax return`,
    date,
    year: taxYear,
    state
  }
}

/**
 * Add status information to a deadline based on current date
 */
export const addDeadlineStatus = (
  deadline: Deadline,
  referenceDate: Date = new Date()
): DeadlineWithStatus => {
  const daysRemaining = daysBetween(referenceDate, deadline.date)
  const isPast = daysRemaining < 0
  const isToday = daysRemaining === 0
  const isUpcoming = daysRemaining > 0 && daysRemaining <= 30
  const isUrgent = daysRemaining > 0 && daysRemaining <= 7

  return {
    ...deadline,
    daysRemaining,
    isPast,
    isToday,
    isUpcoming,
    isUrgent
  }
}

/**
 * Get all deadlines for a tax year with status
 */
export const getAllDeadlinesForYear = (
  taxYear: number,
  states: State[] = [],
  includeExtension: boolean = true,
  referenceDate: Date = new Date()
): DeadlineWithStatus[] => {
  const deadlines: Deadline[] = [
    getFederalFilingDeadline(taxYear),
    ...getEstimatedTaxDeadlines(taxYear)
  ]

  if (includeExtension) {
    deadlines.push(getExtensionDeadline(taxYear))
  }

  // Add state deadlines
  states.forEach((state) => {
    const stateDeadline = getStateFilingDeadline(state, taxYear)
    if (stateDeadline) {
      deadlines.push(stateDeadline)
    }
  })

  return deadlines
    .map((d) => addDeadlineStatus(d, referenceDate))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Get upcoming deadlines (not past, sorted by date)
 */
export const getUpcomingDeadlines = (
  taxYear: number,
  states: State[] = [],
  referenceDate: Date = new Date()
): DeadlineWithStatus[] => {
  return getAllDeadlinesForYear(taxYear, states, true, referenceDate).filter(
    (d) => !d.isPast
  )
}

/**
 * Get the next upcoming deadline
 */
export const getNextDeadline = (
  taxYear: number,
  states: State[] = [],
  referenceDate: Date = new Date()
): DeadlineWithStatus | null => {
  const upcoming = getUpcomingDeadlines(taxYear, states, referenceDate)
  return upcoming.length > 0 ? upcoming[0] : null
}

/**
 * Get urgent deadlines (within 7 days)
 */
export const getUrgentDeadlines = (
  taxYear: number,
  states: State[] = [],
  referenceDate: Date = new Date()
): DeadlineWithStatus[] => {
  return getAllDeadlinesForYear(taxYear, states, true, referenceDate).filter(
    (d) => d.isUrgent || d.isToday
  )
}

/**
 * Check if there are any deadlines today
 */
export const hasDeadlinesToday = (
  taxYear: number,
  states: State[] = [],
  referenceDate: Date = new Date()
): boolean => {
  return getAllDeadlinesForYear(taxYear, states, true, referenceDate).some(
    (d) => d.isToday
  )
}

/**
 * Get the quarter number for an estimated tax deadline type
 */
export const getQuarterFromDeadlineType = (
  type: DeadlineType
): 1 | 2 | 3 | 4 | null => {
  switch (type) {
    case DeadlineType.ESTIMATED_TAX_Q1:
      return 1
    case DeadlineType.ESTIMATED_TAX_Q2:
      return 2
    case DeadlineType.ESTIMATED_TAX_Q3:
      return 3
    case DeadlineType.ESTIMATED_TAX_Q4:
      return 4
    default:
      return null
  }
}

/**
 * Get deadline type for a specific quarter
 */
export const getDeadlineTypeForQuarter = (quarter: 1 | 2 | 3 | 4): DeadlineType => {
  switch (quarter) {
    case 1:
      return DeadlineType.ESTIMATED_TAX_Q1
    case 2:
      return DeadlineType.ESTIMATED_TAX_Q2
    case 3:
      return DeadlineType.ESTIMATED_TAX_Q3
    case 4:
      return DeadlineType.ESTIMATED_TAX_Q4
  }
}
