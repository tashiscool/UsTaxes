import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { F2439Data } from 'ustaxes/core/data'

/**
 * Form 2439 - Notice to Shareholder of Undistributed Long-Term Capital Gains
 *
 * This form is issued by a Regulated Investment Company (RIC) or Real Estate
 * Investment Trust (REIT) to report your share of the company's undistributed
 * long-term capital gains.
 *
 * Key points:
 * - The RIC or REIT paid tax on these gains at the corporate rate
 * - You report the gains on Schedule D
 * - You get a credit for your share of the tax paid (goes to Schedule 3, line 13a)
 * - You increase your basis in the RIC/REIT shares
 *
 * The form shows:
 * - Box 1a: Total undistributed long-term capital gains
 * - Box 1b: Unrecaptured section 1250 gain (taxed at max 25%)
 * - Box 1c: Section 1202 gain (50%/60%/75%/100% exclusion for QSBS)
 * - Box 1d: Collectibles (28%) gain
 * - Box 2: Tax paid by the RIC/REIT on your behalf
 */

export default class F2439 extends F1040Attachment {
  tag: FormTag = 'f2439'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.f2439Data().length > 0
  }

  f2439Data = (): F2439Data[] => {
    return this.f1040.info.f2439s ?? []
  }

  // Total undistributed long-term capital gains (Box 1a)
  totalUndistributedLTCG = (): number => {
    return this.f2439Data().reduce((sum, f) => sum + f.box1a, 0)
  }

  // Total unrecaptured section 1250 gain (Box 1b)
  totalUnrecapturedSection1250 = (): number => {
    return this.f2439Data().reduce((sum, f) => sum + (f.box1b ?? 0), 0)
  }

  // Total section 1202 gain (Box 1c)
  totalSection1202Gain = (): number => {
    return this.f2439Data().reduce((sum, f) => sum + (f.box1c ?? 0), 0)
  }

  // Total collectibles gain (Box 1d)
  totalCollectiblesGain = (): number => {
    return this.f2439Data().reduce((sum, f) => sum + (f.box1d ?? 0), 0)
  }

  // Total tax paid by RIC/REIT (Box 2) - this is your credit
  totalTaxPaid = (): number => {
    return this.f2439Data().reduce((sum, f) => sum + f.box2, 0)
  }

  // Credit for Schedule 3 line 13a
  credit = (): number => this.totalTaxPaid()

  // Amount to include on Schedule D
  // This is the total LTCG (Box 1a) that gets reported on Schedule D
  scheduleDAmount = (): number => this.totalUndistributedLTCG()

  // Basis increase for your shares
  // Your basis increases by the LTCG minus the tax paid
  basisIncrease = (): number => {
    return this.totalUndistributedLTCG() - this.totalTaxPaid()
  }

  // 28% rate gain (collectibles) for Schedule D
  collectibles28Gain = (): number => this.totalCollectiblesGain()

  // Unrecaptured 1250 gain (25% rate) for Schedule D
  unrecaptured1250Gain = (): number => this.totalUnrecapturedSection1250()

  fields = (): Field[] => {
    // For multiple 2439s, we aggregate the totals
    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson?.ssid,
      // Aggregate amounts
      this.totalUndistributedLTCG(),
      this.totalUnrecapturedSection1250(),
      this.totalSection1202Gain(),
      this.totalCollectiblesGain(),
      this.totalTaxPaid(),
      this.credit()
    ]
  }
}
