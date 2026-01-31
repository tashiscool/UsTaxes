import F1040Attachment from './F1040Attachment'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8379 - Injured Spouse Allocation
 *
 * Used when filing jointly and one spouse (the "injured spouse") wants to
 * receive their share of a refund that would otherwise be applied to the
 * other spouse's past-due obligations (child support, federal/state taxes,
 * federal non-tax debt).
 *
 * The form allocates income, adjustments, deductions, and credits between
 * spouses to determine each spouse's share of the refund.
 *
 * Key points:
 * - Only for MFJ returns
 * - Must have overpaid tax (refund expected)
 * - One spouse has past-due debt
 * - Can be filed with return or separately
 */

export interface InjuredSpouseInfo {
  injuredSpouse: PersonRole  // Which spouse is the injured spouse
  spouseHasPastDueChildSupport: boolean
  spouseHasPastDueFederalDebt: boolean
  spouseHasPastDueStateDebt: boolean
  isInCommunityPropertyState: boolean
  communityPropertyState?: string
}

// Community property states
const communityPropertyStates = [
  'AZ', 'CA', 'ID', 'LA', 'NV', 'NM', 'TX', 'WA', 'WI'
]

export default class F8379 extends F1040Attachment {
  tag: FormTag = 'f8379'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ &&
           this.hasInjuredSpouseInfo() &&
           this.f1040.l34() > 0  // Has refund
  }

  hasInjuredSpouseInfo = (): boolean => {
    return this.injuredSpouseInfo() !== undefined
  }

  injuredSpouseInfo = (): InjuredSpouseInfo | undefined => {
    return this.f1040.info.injuredSpouse as InjuredSpouseInfo | undefined
  }

  injuredSpouseRole = (): PersonRole => {
    return this.injuredSpouseInfo()?.injuredSpouse ?? PersonRole.PRIMARY
  }

  // Part I - Should You File This Form?

  // Line 1: Did you file a joint return?
  l1 = (): boolean => this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ

  // Line 2: Did you or do you expect to pay more tax than required?
  l2 = (): boolean => this.f1040.l34() > 0

  // Line 3: Is spouse obligated to pay past-due amount?
  l3 = (): boolean => {
    const info = this.injuredSpouseInfo()
    return (info?.spouseHasPastDueChildSupport ?? false) ||
           (info?.spouseHasPastDueFederalDebt ?? false) ||
           (info?.spouseHasPastDueStateDebt ?? false)
  }

  // Line 4: Did you make payments or claim refundable credits?
  l4 = (): boolean => {
    return this.f1040.l25d() > 0 || // Tax withholding
           this.f1040.l27() > 0 ||  // EIC
           (this.f1040.l28() ?? 0) > 0 ||  // Child tax credit
           (this.f1040.l29() ?? 0) > 0     // Education credit
  }

  // Part II - Information About the Joint Return

  // Line 6: Tax year
  l6 = (): string => '2025'

  // Line 7: Enter overpayment from joint return (Form 1040 line 34)
  l7 = (): number => this.f1040.l34()

  // Line 8: List injured spouse's name and SSN
  injuredSpouseName = (): string => {
    if (this.injuredSpouseRole() === PersonRole.PRIMARY) {
      const p = this.f1040.info.taxPayer.primaryPerson
      return `${p.firstName} ${p.lastName}`
    }
    const s = this.f1040.info.taxPayer.spouse
    return s ? `${s.firstName} ${s.lastName}` : ''
  }

  injuredSpouseSsn = (): string => {
    if (this.injuredSpouseRole() === PersonRole.PRIMARY) {
      return this.f1040.info.taxPayer.primaryPerson.ssid
    }
    return this.f1040.info.taxPayer.spouse?.ssid ?? ''
  }

  // Part III - Allocation Between Spouses

  // Allocate income between spouses
  incomeAllocation = (role: PersonRole): number => {
    // W-2 income
    const w2Income = this.f1040.validW2s()
      .filter(w => w.personRole === role)
      .reduce((sum, w) => sum + w.income, 0)

    // Add self-employment if applicable
    let seIncome = 0
    if (role === PersonRole.PRIMARY) {
      seIncome = this.f1040.scheduleC?.netProfit() ?? 0
    }

    return w2Income + seIncome
  }

  // Line 9: Income shown on joint return
  l9Total = (): number => this.f1040.l9()

  l9Injured = (): number => this.incomeAllocation(this.injuredSpouseRole())

  l9Other = (): number => {
    const other = this.injuredSpouseRole() === PersonRole.PRIMARY
      ? PersonRole.SPOUSE
      : PersonRole.PRIMARY
    return this.incomeAllocation(other)
  }

  // Line 10: Adjustments to income
  l10Total = (): number => this.f1040.l10() ?? 0

  // Allocate adjustments proportionally based on income
  l10Injured = (): number => {
    const ratio = this.l9Injured() / Math.max(1, this.l9Total())
    return Math.round(this.l10Total() * ratio)
  }

  l10Other = (): number => this.l10Total() - this.l10Injured()

  // Line 11: Subtract line 10 from line 9
  l11Total = (): number => this.l9Total() - this.l10Total()
  l11Injured = (): number => this.l9Injured() - this.l10Injured()
  l11Other = (): number => this.l9Other() - this.l10Other()

  // Line 12: Deductions (standard or itemized)
  l12Total = (): number => this.f1040.l12()

  l12Injured = (): number => {
    // Allocate deductions proportionally
    const ratio = this.l11Injured() / Math.max(1, this.l11Total())
    return Math.round(this.l12Total() * ratio)
  }

  l12Other = (): number => this.l12Total() - this.l12Injured()

  // Line 13: Number of exemptions (dependents claimed by each)
  l13Total = (): number => {
    return 2 + (this.f1040.info.taxPayer.dependents?.length ?? 0)
  }

  l13Injured = (): number => {
    // Simplified: split equally or allocate based on relationship
    return 1  // At minimum, the injured spouse claims themselves
  }

  l13Other = (): number => this.l13Total() - this.l13Injured()

  // Line 14: Tax shown on joint return
  l14Total = (): number => this.f1040.l24()

  // Allocate tax proportionally based on taxable income after deductions
  l14Injured = (): number => {
    const injuredTaxable = Math.max(0, this.l11Injured() - this.l12Injured())
    const totalTaxable = Math.max(1, this.l11Total() - this.l12Total())
    const ratio = injuredTaxable / totalTaxable
    return Math.round(this.l14Total() * ratio)
  }

  l14Other = (): number => this.l14Total() - this.l14Injured()

  // Line 15: Tax payments (withholding, estimated payments)
  l15Total = (): number => this.f1040.l25d() + this.f1040.l26()

  l15Injured = (): number => {
    // Allocate based on W-2 withholding for each spouse
    const injured = this.injuredSpouseRole()
    const withholding = this.f1040.validW2s()
      .filter(w => w.personRole === injured)
      .reduce((sum, w) => sum + w.fedWithholding, 0)
    // Add proportional share of estimated payments
    const estimatedRatio = this.l9Injured() / Math.max(1, this.l9Total())
    const estimatedPayment = Math.round(this.f1040.l26() * estimatedRatio)
    return withholding + estimatedPayment
  }

  l15Other = (): number => this.l15Total() - this.l15Injured()

  // Line 16: Refundable credits (EIC, child tax credit, etc.)
  l16Total = (): number => this.f1040.l32()

  l16Injured = (): number => {
    // EIC and child tax credit typically go to primary or based on dependents
    // Simplified allocation
    const ratio = this.l13Injured() / Math.max(1, this.l13Total())
    return Math.round(this.l16Total() * ratio)
  }

  l16Other = (): number => this.l16Total() - this.l16Injured()

  // Line 17: Total credits and payments (line 15 + line 16)
  l17Total = (): number => this.l15Total() + this.l16Total()
  l17Injured = (): number => this.l15Injured() + this.l16Injured()
  l17Other = (): number => this.l15Other() + this.l16Other()

  // Line 18: Subtract line 14 from line 17 (overpayment for each)
  l18Total = (): number => Math.max(0, this.l17Total() - this.l14Total())
  l18Injured = (): number => Math.max(0, this.l17Injured() - this.l14Injured())
  l18Other = (): number => Math.max(0, this.l17Other() - this.l14Other())

  // Injured spouse's share of refund
  injuredSpouseRefund = (): number => this.l18Injured()

  fields = (): Field[] => [
    // Part I
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    // Part II
    this.l6(),
    this.l7(),
    this.injuredSpouseName(),
    this.injuredSpouseSsn(),
    // Part III - Allocation
    // Line 9
    this.l9Total(),
    this.l9Injured(),
    this.l9Other(),
    // Line 10
    this.l10Total(),
    this.l10Injured(),
    this.l10Other(),
    // Line 11
    this.l11Total(),
    this.l11Injured(),
    this.l11Other(),
    // Line 12
    this.l12Total(),
    this.l12Injured(),
    this.l12Other(),
    // Line 13
    this.l13Total(),
    this.l13Injured(),
    this.l13Other(),
    // Line 14
    this.l14Total(),
    this.l14Injured(),
    this.l14Other(),
    // Line 15
    this.l15Total(),
    this.l15Injured(),
    this.l15Other(),
    // Line 16
    this.l16Total(),
    this.l16Injured(),
    this.l16Other(),
    // Line 17
    this.l17Total(),
    this.l17Injured(),
    this.l17Other(),
    // Line 18
    this.l18Total(),
    this.l18Injured(),
    this.l18Other()
  ]
}
