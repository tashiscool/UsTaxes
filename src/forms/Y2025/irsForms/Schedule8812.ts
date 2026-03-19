import F1040Attachment from './F1040Attachment'
import { CreditType, Dependent, FilingStatus } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { nextMultipleOf1000 } from 'ustaxes/core/util'
import { childTaxCredit } from '../data/federal'

const normalizeTin = (value?: string): string => value?.replace(/\D/g, '') ?? ''

const hasValidTin = (value?: string): boolean => {
  const normalized = normalizeTin(value)
  if (normalized.length !== 9) return false

  const area = normalized.slice(0, 3)
  const group = normalized.slice(3, 5)
  const serial = normalized.slice(5)

  return area !== '000' && area !== '666' && group !== '00' && serial !== '0000'
}

const isLikelyItin = (value?: string): boolean => {
  const normalized = normalizeTin(value)
  if (normalized.length !== 9 || !normalized.startsWith('9')) return false
  const middle = Number(normalized.slice(3, 5))
  return (
    (middle >= 70 && middle <= 88) ||
    (middle >= 90 && middle <= 92) ||
    (middle >= 94 && middle <= 99)
  )
}

const hasValidChildTaxCreditSsn = (value?: string): boolean =>
  hasValidTin(value) && !isLikelyItin(value)

type Part2a = { allowed: boolean } & Partial<{
  l16a: number
  l16bdeps: number
  l16b: number
  l17: number
  l18a: number
  l18b: number
  l19No: boolean
  l19Yes: boolean
  l19: number
  l20: number
  l20No: boolean
  l20Yes: boolean
  toLine27: number
}>

type Part2b = { allowed: boolean } & Partial<{
  l21: number
  l22: number
  l23: number
  l24: number
  l25: number
  l26: number
  toLine27: number
}>

export default class Schedule8812 extends F1040Attachment {
  tag: FormTag = 'f1040s8'
  sequenceIndex = 47

  isNeeded = (): boolean =>
    this.f1040.info.taxPayer.dependents.some(
      (dep) =>
        this.f1040.qualifyingDependents.qualifiesChild(dep) ||
        this.f1040.qualifyingDependents.qualifiesOther(dep)
    )

  puertoRicoExcludedIncome = (): number => {
    if (!this.isPuertoRicoResident()) return 0

    return this.f1040.f1040ss?.earnedIncome() ?? 0
  }

  l1 = (): number => this.f1040.l11()

  // 2025 instructions: include Puerto Rico income excluded from U.S. tax.
  l2a = (): number => this.puertoRicoExcludedIncome()

  l2b = (): number =>
    sumFields([this.f1040.f2555?.l45(), this.f1040.f2555?.l50()])

  l2c = (): number => this.f1040.f4563?.l15() ?? 0

  l2d = (): number => sumFields([this.l2a(), this.l2b(), this.l2c()])

  l3 = (): number => sumFields([this.l1(), this.l2d()])

  creditDependents = (): Dependent<Date | string>[] =>
    this.f1040.qualifyingDependents
      .qualifyingChildren()
      .filter((dep) => hasValidChildTaxCreditSsn(dep.ssid))

  otherCreditDependents = (): Dependent<Date | string>[] =>
    this.f1040.info.taxPayer.dependents.filter(
      (dep) =>
        this.f1040.qualifyingDependents.qualifiesOther(dep) ||
        (this.f1040.qualifyingDependents.qualifiesChild(dep) &&
          !hasValidChildTaxCreditSsn(dep.ssid))
    )

  isPuertoRicoResident = (): boolean => {
    if (this.f1040.f1040ss?.isPuertoRico() ?? false) {
      return true
    }

    const address = this.f1040.info.taxPayer.primaryPerson.address
    const addressState = String(address.state ?? '').toUpperCase()
    const foreignCountry = address.foreignCountry?.trim().toLowerCase()

    return addressState === 'PR' || foreignCountry === 'puerto rico'
  }

  canUsePart2B = (): boolean =>
    this.isPuertoRicoResident() || this.qualifyingChildrenCount() >= 3

  canClaimAdditionalChildTaxCredit = (): boolean =>
    !(this.f1040.f2555?.isNeeded() ?? false)

  l4 = (): number => this.creditDependents().length

  // TY2025: $2,200 per qualifying child with a valid SSN
  l5 = (): number => this.l4() * childTaxCredit.amountPerChild

  // TODO: Verify:
  // Number of other dependents, including any qualifying children, who are not under age 18 or who do not have the required SSN. Do not include yourself, your spouse,
  // or anyone who is not a US citizen/national/resident alien,
  // or do not have the required SSN.
  l6 = (): number => this.otherCreditDependents().length

  l7 = (): number => this.l6() * childTaxCredit.amountPerOtherDependent

  l8 = (): number => sumFields([this.l5(), this.l7()])

  l9 = (): number =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ ? 400000 : 200000

  l10 = (): number => nextMultipleOf1000(Math.max(0, this.l3() - this.l9()))

  l11 = (): number => this.l10() * 0.05

  l12 = (): number => Math.max(0, this.l8() - this.l11())
  l12yes = (): boolean => this.l8() > this.l11()
  l12no = (): boolean => !this.l12yes()
  // you and spouse have residence in US for more than half of year.
  // TODO: Assuming true
  l13 = (): number => this.creditLimitWorksheetA()

  l14 = (): number => (this.l12no() ? 0 : Math.min(this.l12(), this.l13()))

  // 2025 instructions reserve line 15 for future use.
  l15 = (): number | undefined => undefined

  creditLimitWorksheetB = (): number | undefined => undefined

  creditLimitWorksheetA = (): number => {
    const wsl1 = this.f1040.l18()
    const schedule3Fields = this.f1040.schedule3.isNeeded()
      ? [
          this.f1040.schedule3.l1(),
          this.f1040.schedule3.l2(),
          this.f1040.schedule3.l3(),
          this.f1040.schedule3.l4(),
          this.f1040.schedule3.l6l()
        ]
      : []

    const wsl2 = sumFields([
      ...schedule3Fields,
      this.f1040.f5695?.l30(),
      this.f1040.f8936?.l15(),
      this.f1040.f8936?.l23(),
      this.f1040.scheduleR?.l22()
    ])
    const wsl3 = Math.max(0, wsl1 - wsl2)
    const wsl4 = this.creditLimitWorksheetB() ?? 0
    const wsl5 = Math.max(0, wsl3 - wsl4)
    return wsl5
  }

  // Legacy 2021 advance Child Tax Credit payments may still exist in imported
  // data, but 2025 Schedule 8812 line 15 is reserved and does not use them.
  letter6419Payments = (): number | undefined =>
    this.f1040.info.credits
      .filter((c) => c.type === CreditType.AdvanceChildTaxCredit)
      .reduce((sum, c) => sum + c.amount, 0)

  to1040Line19 = (): number => this.l14()

  to1040Line28 = (): number | undefined => this.l27()

  earnedIncomeWorksheet = (): number => {
    const l1a = this.f1040.l1z()
    const l1b = this.f1040.nonTaxableCombatPay()
    const l2a = this.f1040.scheduleC?.statutoryEmployeeIncome() ?? 0
    const l2b = sumFields([
      this.f1040.scheduleC?.l31(),
      this.f1040.info.scheduleK1Form1065s.reduce(
        (total, k1) => total + k1.selfEmploymentEarningsA,
        0
      )
    ])
    const l2c = sumFields([
      this.f1040.scheduleF?.netProfit(),
      this.f1040.info.scheduleK1Form1065s.reduce(
        (total, k1) => total + k1.selfEmploymentEarningsB + k1.selfEmploymentEarningsC,
        0
      )
    ])
    // Farm optional method is not modeled yet; when absent, carry line 2c through.
    const l2d = 0
    const l2e = l2c < 0 ? l2c : l2d > 0 ? Math.min(l2c, l2d) : l2c

    const l3 = sumFields([l1a, l1b, l2a, l2b, l2e])

    const allowed = l3 > 0

    const l4a = !allowed ? undefined : this.f1040.schedule1.l8r() ?? 0

    const l4b = !allowed ? undefined : this.f1040.schedule1.l8u() ?? 0

    const l4c = !allowed ? undefined : this.f1040.schedule1.l8t() ?? 0

    const includeMedicaidWaiverInEarnedIncome =
      this.f1040.info.schedule8812EarnedIncomeAdjustments
        ?.includeMedicaidWaiverInEarnedIncome ?? false
    const l4d = !allowed
      ? undefined
      : includeMedicaidWaiverInEarnedIncome
        ? 0
        : this.f1040.schedule1.l8s() ?? 0

    const l5 = this.f1040.schedule1.l15() ?? 0

    const l6 = sumFields([l4a, l4b, l4c, l4d, l5])

    const l7 = Math.max(0, l3 - l6)

    return l7
  }

  part2a = (): Part2a => {
    if (!this.canClaimAdditionalChildTaxCredit()) {
      return { allowed: false }
    }

    const l16a = Math.max(0, this.l12() - this.l14())
    const l16bdeps = this.l4()

    const l16b = l16bdeps * childTaxCredit.refundableAmount

    const l17 = Math.min(l16a, l16b)
    const l18a = this.earnedIncomeWorksheet()
    const l18b = this.f1040.nonTaxableCombatPay() ?? 0
    const l19No = l18a <= childTaxCredit.phaseInThreshold
    const l19Yes = l18a > childTaxCredit.phaseInThreshold
    const l19 = Math.max(0, l18a - childTaxCredit.phaseInThreshold)
    const l20 = l19 * childTaxCredit.phaseInRate
    // Check if 3+ children (threshold = 3 * refundable amount)
    const threeChildThreshold = 3 * childTaxCredit.refundableAmount
    const l20No = l16b < threeChildThreshold
    const l20Yes = l16b >= threeChildThreshold

    const toLine27 = (() => {
      if (!this.canUsePart2B()) {
        return Math.min(l17, l20)
      }

      if (!this.isPuertoRicoResident() && l20 >= l17) {
        return l17
      }
    })()

    return {
      allowed: true,
      l16a,
      l16bdeps,
      l16b,
      l17,
      l18a,
      l18b,
      l19No,
      l19Yes,
      l19,
      l20,
      l20No,
      l20Yes,
      toLine27
    }
  }

  part2b = (): Part2b => {
    const part2a = this.part2a()
    // three or more qualifying children.
    const allowed = part2a.allowed && this.canUsePart2B()

    if (!allowed) return { allowed: false }

    const ssWithholding = this.f1040
      .validW2s()
      .reduce((res, w2) => res + w2.ssWithholding, 0)

    const medicareWithholding = this.f1040
      .validW2s()
      .reduce((res, w2) => res + w2.medicareWithholding, 0)

    const l21 = ssWithholding + medicareWithholding

    const l22 = sumFields([
      this.f1040.schedule1.l15(),
      this.f1040.schedule2.l5(),
      this.f1040.schedule2.l6(),
      this.f1040.schedule2.l13()
    ])

    const l23 = sumFields([l21, l22])

    const l24 = this.f1040.f1040nr?.hasNonresidentInfo()
      ? this.f1040.schedule3.l11()
      : sumFields([this.f1040.l27(), this.f1040.schedule3.l11()])

    const l25 = Math.max(0, l23 - l24)

    const l26 = Math.max(part2a.l20 ?? 0, l25)

    const toLine27 = Math.min(part2a.l17 ?? 0, l26)

    return {
      allowed: true,
      l21,
      l22,
      l23,
      l24,
      l25,
      l26,
      toLine27
    }
  }

  l27 = (): number | undefined =>
    this.l12no() || !this.canClaimAdditionalChildTaxCredit()
      ? 0
      : this.part2a().toLine27 ?? this.part2b().toLine27 ?? 0

  qualifyingChildrenCount = (): number => this.l4()

  otherDependentsCount = (): number => this.l6()

  modifiedAGI = (): number => this.l3()

  childTaxCredit = (): number => this.l5()

  otherDependentCredit = (): number => this.l7()

  totalCredit = (): number => this.l8()

  additionalChildTaxCredit = (): number => this.l27() ?? 0

  fields = (): Field[] => {
    const part2a = this.part2a()
    const part2b = this.part2b()

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      this.l1(),
      this.l2a(),
      this.l2b(),
      this.l2c(),
      this.l2d(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l12no(),
      this.l12yes(),
      this.l13(),
      this.l14(),
      this.l15(),
      part2a.l16a,
      part2a.l16bdeps,
      part2a.l16b,
      part2a.l17,
      part2a.l18a,
      part2a.l18b,
      part2a.l19No,
      part2a.l19Yes,
      part2a.l19,
      part2a.l20,
      part2a.l20No,
      part2a.l20Yes,
      part2b.l21,
      part2b.l22,
      part2b.l23,
      part2b.l24,
      part2b.l25,
      part2b.l26,
      this.l27()
    ]
  }
}
