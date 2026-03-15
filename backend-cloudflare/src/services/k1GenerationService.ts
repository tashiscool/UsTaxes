/**
 * K-1 Generation Service
 *
 * Takes a BusinessEntityResult with ownerAllocations from an S-Corp (1120-S)
 * or Partnership (1065) calculation and generates per-owner Schedule K-1
 * line items suitable for downstream tax filing or reporting.
 */

import type {
  BusinessEntityResult,
  OwnerAllocation
} from './taxCalculationService'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A single line item on a Schedule K-1.
 * Each line corresponds to a specific category of income, deduction, or credit
 * that flows through to the owner's individual return.
 */
export interface K1LineItem {
  /** K-1 line number (e.g., '1' for ordinary income, '4a' for interest) */
  lineNumber: string
  /** Human-readable description of the line */
  description: string
  /** Dollar amount (negative for losses/deductions) */
  amount: number
  /** IRS code, if applicable (e.g., 'A' for charitable contributions) */
  code?: string
}

/**
 * A complete Schedule K-1 package for a single owner/partner/shareholder.
 * Contains the entity metadata, owner identification, and all line items.
 */
export interface K1Package {
  /** Form type: 'K-1 (1120-S)' or 'K-1 (1065)' or 'K-1 (1041)' */
  formType: string
  /** Tax year for the K-1 */
  taxYear: number
  /** Entity (partnership/S-Corp) name */
  entityName: string
  /** Entity EIN */
  entityEin?: string
  /** Owner/partner/shareholder name */
  ownerName: string
  /** Ownership percentage */
  ownershipPct: number
  /** All K-1 line items for this owner */
  lineItems: K1LineItem[]
  /** Total income allocated to this owner (sum of all income line items) */
  totalIncome: number
  /** Total deductions allocated to this owner */
  totalDeductions: number
  /** Net amount flowing through to owner's return */
  netAmount: number
}

// ─── Line item builders ─────────────────────────────────────────────────────

const buildSCorpK1Lines = (alloc: OwnerAllocation): K1LineItem[] => {
  const lines: K1LineItem[] = []

  if (alloc.ordinaryIncome !== 0) {
    lines.push({
      lineNumber: '1',
      description: 'Ordinary business income (loss)',
      amount: alloc.ordinaryIncome
    })
  }
  if (alloc.netRentalIncome !== 0) {
    lines.push({
      lineNumber: '2',
      description: 'Net rental real estate income (loss)',
      amount: alloc.netRentalIncome
    })
  }
  if (alloc.interestIncome !== 0) {
    lines.push({
      lineNumber: '4',
      description: 'Interest income',
      amount: alloc.interestIncome
    })
  }
  if (alloc.dividendIncome !== 0) {
    lines.push({
      lineNumber: '5a',
      description: 'Ordinary dividends',
      amount: alloc.dividendIncome
    })
  }
  if (alloc.capitalGains !== 0) {
    lines.push({
      lineNumber: '8a',
      description: 'Net long-term capital gain (loss)',
      amount: alloc.capitalGains
    })
  }
  if (alloc.otherIncome !== 0) {
    lines.push({
      lineNumber: '10',
      description: 'Other income (loss)',
      amount: alloc.otherIncome
    })
  }
  if (alloc.section179Deduction !== 0) {
    lines.push({
      lineNumber: '11',
      description: 'Section 179 deduction',
      amount: alloc.section179Deduction
    })
  }
  if (alloc.otherDeductions !== 0) {
    lines.push({
      lineNumber: '12',
      description: 'Other deductions',
      amount: alloc.otherDeductions,
      code: 'A'
    })
  }

  return lines
}

const buildPartnershipK1Lines = (alloc: OwnerAllocation): K1LineItem[] => {
  const lines: K1LineItem[] = []

  if (alloc.ordinaryIncome !== 0) {
    lines.push({
      lineNumber: '1',
      description: 'Ordinary business income (loss)',
      amount: alloc.ordinaryIncome
    })
  }
  if (alloc.netRentalIncome !== 0) {
    lines.push({
      lineNumber: '2',
      description: 'Net rental real estate income (loss)',
      amount: alloc.netRentalIncome
    })
  }
  if (alloc.interestIncome !== 0) {
    lines.push({
      lineNumber: '5',
      description: 'Interest income',
      amount: alloc.interestIncome
    })
  }
  if (alloc.dividendIncome !== 0) {
    lines.push({
      lineNumber: '6a',
      description: 'Ordinary dividends',
      amount: alloc.dividendIncome
    })
  }
  if (alloc.capitalGains !== 0) {
    lines.push({
      lineNumber: '9a',
      description: 'Net long-term capital gain (loss)',
      amount: alloc.capitalGains
    })
  }
  if (alloc.otherIncome !== 0) {
    lines.push({
      lineNumber: '11',
      description: 'Other income (loss)',
      amount: alloc.otherIncome
    })
  }
  if (alloc.section179Deduction !== 0) {
    lines.push({
      lineNumber: '12',
      description: 'Section 179 deduction',
      amount: alloc.section179Deduction
    })
  }
  if (alloc.otherDeductions !== 0) {
    lines.push({
      lineNumber: '13',
      description: 'Other deductions',
      amount: alloc.otherDeductions,
      code: 'A'
    })
  }
  if (alloc.selfEmploymentEarnings !== 0) {
    lines.push({
      lineNumber: '14a',
      description: 'Net earnings (loss) from self-employment',
      amount: alloc.selfEmploymentEarnings
    })
  }

  return lines
}

// ─── K1 Generation Service ──────────────────────────────────────────────────

export class K1GenerationService {
  /**
   * Generate Schedule K-1 packages for all owners in a business entity result.
   *
   * @param entityResult - The completed business entity calculation result.
   *   Must have `ownerAllocations` populated (S-Corp or Partnership).
   * @returns An array of K1Package objects, one per owner.
   *   Returns an empty array if no owner allocations are present
   *   (e.g., C-Corp or Trust returns that do not generate K-1s).
   */
  generateK1s(entityResult: BusinessEntityResult): K1Package[] {
    const allocations = entityResult.ownerAllocations
    if (!allocations || allocations.length === 0) {
      return []
    }

    const isSCorp = entityResult.formType === '1120-S'
    const isPartnership = entityResult.formType === '1065'

    const k1FormType = isSCorp
      ? 'K-1 (1120-S)'
      : isPartnership
      ? 'K-1 (1065)'
      : `K-1 (${entityResult.formType})`

    return allocations.map((alloc) => {
      const lineItems = isSCorp
        ? buildSCorpK1Lines(alloc)
        : buildPartnershipK1Lines(alloc)

      const totalIncome = lineItems
        .filter((li) => li.amount > 0)
        .reduce((sum, li) => sum + li.amount, 0)

      const totalDeductions =
        lineItems
          .filter((li) => li.amount < 0)
          .reduce((sum, li) => sum + Math.abs(li.amount), 0) +
        (alloc.section179Deduction > 0 ? alloc.section179Deduction : 0) +
        (alloc.otherDeductions > 0 ? alloc.otherDeductions : 0)

      // Net amount: positive income items minus deduction items
      const netAmount = lineItems.reduce((sum, li) => sum + li.amount, 0)

      return {
        formType: k1FormType,
        taxYear: entityResult.taxYear,
        entityName: entityResult.entityName,
        ownerName: alloc.name,
        ownershipPct: alloc.ownershipPct,
        lineItems,
        totalIncome,
        totalDeductions,
        netAmount
      }
    })
  }

  /**
   * Convenience: generate K-1s and return a summary suitable for review UI.
   */
  generateK1Summary(entityResult: BusinessEntityResult): {
    count: number
    packages: K1Package[]
    aggregateTotalIncome: number
    aggregateTotalDeductions: number
  } {
    const packages = this.generateK1s(entityResult)
    return {
      count: packages.length,
      packages,
      aggregateTotalIncome: packages.reduce((s, p) => s + p.totalIncome, 0),
      aggregateTotalDeductions: packages.reduce(
        (s, p) => s + p.totalDeductions,
        0
      )
    }
  }
}
