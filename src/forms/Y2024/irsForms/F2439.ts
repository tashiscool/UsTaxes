import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { F2439Data } from 'ustaxes/core/data'

/**
 * Form 2439 - Notice to Shareholder of Undistributed Long-Term Capital Gains
 *
 * This form reports undistributed long-term capital gains from a RIC (mutual fund)
 * or REIT that the shareholder must include in income, even though the gains
 * were not actually distributed. The shareholder gets credit for the tax paid
 * by the fund on these gains.
 *
 * IRC Section 852(b)(3)(D) - RICs
 * IRC Section 857(b)(3)(D) - REITs
 *
 * Referenced by:
 * - Schedule D, Part II, Line 11 (undistributed capital gains)
 * - Schedule 3, Line 13a (credit for tax paid)
 */
export default class F2439 extends F1040Attachment {
  tag: FormTag = 'f2439'
  sequenceIndex = 174

  get f2439s(): F2439Data[] {
    return this.f1040.info.f2439s ?? []
  }

  isNeeded = (): boolean => this.f2439s.length > 0

  /**
   * Line 1a - Total undistributed long-term capital gains
   * This amount is included in Schedule D, Part II, Line 11
   */
  l1a = (): number =>
    this.f2439s.reduce((total, f) => total + f.box1a, 0)

  /**
   * Line 1b - Unrecaptured section 1250 gain
   * Portion of gains from depreciation recapture on real property
   */
  l1b = (): number =>
    this.f2439s.reduce((total, f) => total + (f.box1b ?? 0), 0)

  /**
   * Line 1c - Section 1202 gain
   * Qualified small business stock gain (excluded from tax)
   */
  l1c = (): number =>
    this.f2439s.reduce((total, f) => total + (f.box1c ?? 0), 0)

  /**
   * Line 1d - Collectibles (28%) gain
   * Gains taxed at 28% rate (art, antiques, gems, stamps, coins, etc.)
   */
  l1d = (): number =>
    this.f2439s.reduce((total, f) => total + (f.box1d ?? 0), 0)

  /**
   * Line 2 - Tax paid by the RIC or REIT
   * This is the credit amount that goes to Schedule 3, Line 13a
   */
  l2 = (): number =>
    this.f2439s.reduce((total, f) => total + f.box2, 0)

  /**
   * Credit for tax paid by RIC/REIT
   * This goes to Schedule 3, Line 13a
   */
  credit = (): number | undefined => {
    const creditAmount = this.l2()
    return creditAmount > 0 ? creditAmount : undefined
  }

  /**
   * Undistributed capital gains to include on Schedule D
   * This goes to Schedule D, Part II, Line 11
   */
  undistributedCapitalGains = (): number | undefined => {
    const gains = this.l1a()
    return gains > 0 ? gains : undefined
  }

  /**
   * Unrecaptured 1250 gain portion
   * Used in Schedule D worksheets
   */
  unrecaptured1250Gain = (): number | undefined => {
    const gain = this.l1b()
    return gain > 0 ? gain : undefined
  }

  /**
   * Section 1202 exclusion
   * Qualified small business stock gain exclusion
   */
  section1202Gain = (): number | undefined => {
    const gain = this.l1c()
    return gain > 0 ? gain : undefined
  }

  /**
   * Collectibles gain at 28% rate
   */
  collectiblesGain = (): number | undefined => {
    const gain = this.l1d()
    return gain > 0 ? gain : undefined
  }

  /**
   * Adjustment to basis of stock
   * The shareholder can increase the basis of their stock by the difference
   * between the undistributed gains and the tax paid:
   * Basis increase = Line 1a - Line 2
   */
  basisAdjustment = (): number => {
    return this.l1a() - this.l2()
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // For each F2439 received, we would list payer info
    // Since the form can have multiple payers, we aggregate totals
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l1d(),
    this.l2()
  ]
}
