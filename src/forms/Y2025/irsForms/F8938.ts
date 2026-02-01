import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'

/**
 * Form 8938 - Statement of Specified Foreign Financial Assets (FATCA)
 *
 * Required if you have specified foreign financial assets exceeding thresholds:
 *
 * Living in US:
 * - Single: >$50,000 end of year OR >$75,000 any time during year
 * - MFJ: >$100,000 end of year OR >$150,000 any time during year
 *
 * Living abroad:
 * - Single: >$200,000 end of year OR >$300,000 any time during year
 * - MFJ: >$400,000 end of year OR >$600,000 any time during year
 */

export interface ForeignFinancialAsset {
  type: 'depositAccount' | 'custodialAccount' | 'equity' | 'debt' | 'other'
  description: string
  institution: string
  country: string
  accountNumber?: string
  maxValueDuringYear: number
  valueAtYearEnd: number
  incomeEarned: number
  gainLoss: number
  isJointAccount: boolean
  acquisitionDate?: Date
  dispositionDate?: Date
}

export default class F8938 extends F1040Attachment {
  tag: FormTag = 'f8938'
  sequenceIndex = 170

  isNeeded = (): boolean => {
    return this.meetsThreshold()
  }

  assets = (): ForeignFinancialAsset[] => {
    return (
      (this.f1040.info.foreignFinancialAssets as
        | ForeignFinancialAsset[]
        | undefined) ?? []
    )
  }

  livingAbroad = (): boolean => {
    // Check if taxpayer qualifies as living abroad
    return this.f1040.f2555?.isNeeded() ?? false
  }

  // Get reporting thresholds based on filing status and residence
  thresholds = (): { yearEnd: number; anyTime: number } => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const abroad = this.livingAbroad()

    if (abroad) {
      if (fs === FilingStatus.MFJ || fs === FilingStatus.W) {
        return { yearEnd: 400000, anyTime: 600000 }
      }
      return { yearEnd: 200000, anyTime: 300000 }
    } else {
      if (fs === FilingStatus.MFJ || fs === FilingStatus.W) {
        return { yearEnd: 100000, anyTime: 150000 }
      }
      return { yearEnd: 50000, anyTime: 75000 }
    }
  }

  totalValueAtYearEnd = (): number => {
    return this.assets().reduce((sum, a) => sum + a.valueAtYearEnd, 0)
  }

  totalMaxValueDuringYear = (): number => {
    return this.assets().reduce((sum, a) => sum + a.maxValueDuringYear, 0)
  }

  meetsThreshold = (): boolean => {
    const thresholds = this.thresholds()
    return (
      this.totalValueAtYearEnd() > thresholds.yearEnd ||
      this.totalMaxValueDuringYear() > thresholds.anyTime
    )
  }

  // Part I - Foreign Deposit and Custodial Accounts Summary

  depositAccounts = (): ForeignFinancialAsset[] => {
    return this.assets().filter((a) => a.type === 'depositAccount')
  }

  custodialAccounts = (): ForeignFinancialAsset[] => {
    return this.assets().filter((a) => a.type === 'custodialAccount')
  }

  // Line 1: Number of deposit accounts
  l1 = (): number => this.depositAccounts().length

  // Line 2: Max value of all deposit accounts
  l2 = (): number => {
    return this.depositAccounts().reduce(
      (sum, a) => sum + a.maxValueDuringYear,
      0
    )
  }

  // Line 3: Number of custodial accounts
  l3 = (): number => this.custodialAccounts().length

  // Line 4: Max value of all custodial accounts
  l4 = (): number => {
    return this.custodialAccounts().reduce(
      (sum, a) => sum + a.maxValueDuringYear,
      0
    )
  }

  // Part II - Other Foreign Assets Summary

  otherAssets = (): ForeignFinancialAsset[] => {
    return this.assets().filter(
      (a) => a.type !== 'depositAccount' && a.type !== 'custodialAccount'
    )
  }

  // Line 5: Number of other foreign assets
  l5 = (): number => this.otherAssets().length

  // Line 6: Max value of other foreign assets
  l6 = (): number => {
    return this.otherAssets().reduce((sum, a) => sum + a.maxValueDuringYear, 0)
  }

  // Part III - Summary of Tax Items

  // Line 7a: Interest
  l7a = (): number => {
    return this.assets()
      .filter((a) => a.type === 'depositAccount')
      .reduce((sum, a) => sum + a.incomeEarned, 0)
  }

  // Line 7b: Dividends
  l7b = (): number => {
    return this.assets()
      .filter((a) => a.type === 'equity' || a.type === 'custodialAccount')
      .reduce((sum, a) => sum + a.incomeEarned, 0)
  }

  // Line 7c: Royalties
  l7c = (): number => 0

  // Line 7d: Other income
  l7d = (): number => {
    return this.assets()
      .filter((a) => a.type === 'other' || a.type === 'debt')
      .reduce((sum, a) => sum + a.incomeEarned, 0)
  }

  // Line 7e: Gains/losses
  l7e = (): number => {
    return this.assets().reduce((sum, a) => sum + a.gainLoss, 0)
  }

  // Line 7f: Deductions
  l7f = (): number => 0

  // Line 7g: Credits
  l7g = (): number => 0

  fields = (): Field[] => {
    const assetFields: Field[] = []

    // Add details for each asset (up to 10 per form)
    for (let i = 0; i < Math.min(10, this.assets().length); i++) {
      const asset = this.assets()[i]
      assetFields.push(
        asset.type,
        asset.description,
        asset.institution,
        asset.country,
        asset.accountNumber ?? '',
        asset.maxValueDuringYear,
        asset.valueAtYearEnd,
        asset.incomeEarned,
        asset.gainLoss,
        asset.isJointAccount,
        asset.acquisitionDate?.toLocaleDateString() ?? '',
        asset.dispositionDate?.toLocaleDateString() ?? ''
      )
    }

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Summary
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      // Tax items
      this.l7a(),
      this.l7b(),
      this.l7c(),
      this.l7d(),
      this.l7e(),
      this.l7f(),
      this.l7g(),
      ...assetFields
    ]
  }
}
