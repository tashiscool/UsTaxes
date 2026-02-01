import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 8833 - Treaty-Based Return Position Disclosure
 *
 * Required disclosure when a taxpayer takes a position on a tax return
 * that overrides or modifies any provision of the Internal Revenue Code
 * based on a US tax treaty.
 *
 * Common treaty-based positions:
 * - Reduced withholding rates on dividends, interest, royalties
 * - Exemption of income under treaty (e.g., teachers, students, researchers)
 * - Residence determination under treaty tie-breaker rules
 * - Business profits exempt due to no permanent establishment
 * - Capital gains exempted
 *
 * Penalties for non-disclosure: $1,000 per failure ($10,000 for C corps)
 */

export interface TreatyPosition {
  treatyCountry: string
  treatyArticle: string
  irsCodeSections: string[] // IRC sections being overridden
  positionDescription: string
  incomeAmount: number
  taxReductionAmount: number
  isResidenceTiebreaker: boolean
  isWithholdingRate: boolean
}

export default class F8833 extends F1040Attachment {
  tag: FormTag = 'f8833'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasTreatyPositions()
  }

  hasTreatyPositions = (): boolean => {
    return this.treatyPositions().length > 0
  }

  treatyPositions = (): TreatyPosition[] => {
    return (
      (this.f1040.info.treatyPositions as TreatyPosition[] | undefined) ?? []
    )
  }

  // Get the primary treaty position (form handles one at a time)
  primaryPosition = (): TreatyPosition | undefined => {
    return this.treatyPositions()[0]
  }

  // Line 1: Treaty country
  l1 = (): string => this.primaryPosition()?.treatyCountry ?? ''

  // Line 2: Article(s) of treaty relied upon
  l2 = (): string => this.primaryPosition()?.treatyArticle ?? ''

  // Line 3: IRC sections overridden by treaty
  l3 = (): string => this.primaryPosition()?.irsCodeSections.join(', ') ?? ''

  // Line 4: Check appropriate box
  // 4a: Treaty-based position for reduced rate of withholding
  l4a = (): boolean => this.primaryPosition()?.isWithholdingRate ?? false

  // 4b: Treaty-based position for exemption from tax
  l4b = (): boolean => !this.l4a()

  // 4c: Treaty-based position for other purposes
  l4c = (): boolean => false

  // Line 5: Name of payor (if withholding position)
  l5 = (): string => '' // Would need to capture from 1099 data

  // Line 6: Check if this is a "residence" position under tie-breaker rules
  l6 = (): boolean => this.primaryPosition()?.isResidenceTiebreaker ?? false

  // Line 7: Amount of income
  l7 = (): number => this.primaryPosition()?.incomeAmount ?? 0

  // Line 8: Amount of tax benefit (reduction)
  l8 = (): number => this.primaryPosition()?.taxReductionAmount ?? 0

  // Line 9: Explanation of treaty-based position
  l9 = (): string => this.primaryPosition()?.positionDescription ?? ''

  // Check if additional forms needed for multiple positions
  hasMultiplePositions = (): boolean => this.treatyPositions().length > 1

  additionalPositionsCount = (): number =>
    Math.max(0, this.treatyPositions().length - 1)

  // Total tax benefit from all treaty positions
  totalTaxBenefit = (): number => {
    return this.treatyPositions().reduce(
      (sum, p) => sum + p.taxReductionAmount,
      0
    )
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // Treaty information
    this.l1(),
    this.l2(),
    this.l3(),
    // Position type
    this.l4a(),
    this.l4b(),
    this.l4c(),
    // Details
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9()
  ]
}
