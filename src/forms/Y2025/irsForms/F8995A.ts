import F8995, { type QBIEntry, getF8995PhaseOutIncome } from './F8995'

import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'
import { qbid } from '../data/federal'

function ifNumber(
  num: number | undefined,
  f: (num: number) => number | undefined
) {
  return num !== undefined ? f(num) : undefined
}

export default class F8995A extends F8995 {
  tag: FormTag = 'f8995a'
  sequenceIndex = 55.5

  visibleEntries = (): ReturnType<F8995['qbiEntries']> =>
    this.qbiEntries().slice(0, 3)

  overflowEntries = (): ReturnType<F8995['qbiEntries']> =>
    this.qbiEntries().slice(3)

  needsAdditionalStatement = (): boolean => this.overflowEntries().length > 0

  overflowTotals = (): {
    qbi: number
    w2Wages: number
    ubia: number
    patronReduction: number
  } =>
    this.overflowEntries().reduce(
      (totals, entry) => ({
        qbi: totals.qbi + entry.qbi,
        w2Wages: totals.w2Wages + entry.w2Wages,
        ubia: totals.ubia + entry.ubia,
        patronReduction: totals.patronReduction + entry.patronReduction
      }),
      { qbi: 0, w2Wages: 0, ubia: 0, patronReduction: 0 }
    )

  overflowStatementEntries = (): Array<
    ReturnType<F8995['qbiEntries']>[number] & {
      deductionBeforePatronReduction: number
      deductionAfterPatronReduction: number
    }
  > =>
    this.overflowEntries().map((entry) => ({
      ...entry,
      deductionBeforePatronReduction: this.deductionForEntry(entry),
      deductionAfterPatronReduction: this.deductionAfterPatronReduction(entry)
    }))

  overflowStatementDeduction = (): number =>
    sumFields(
      this.overflowStatementEntries().map(
        (entry) => entry.deductionAfterPatronReduction
      )
    )

  statementSummary = (): {
    requiresAttachment: boolean
    visibleBusinessCount: number
    overflowBusinessCount: number
    totalBusinessCount: number
    thresholdStart: number
    thresholdEnd: number
    applicablePercentage: number
    sstbCount: number
    reitDividends: number
    ptpIncome: number
    ptpLossCarryforward: number
    dpadReduction: number
    overflowTotals: ReturnType<F8995A['overflowTotals']>
    overflowStatementDeduction: number
  } => ({
    requiresAttachment: this.needsAdditionalStatement(),
    visibleBusinessCount: this.visibleEntries().length,
    overflowBusinessCount: this.overflowEntries().length,
    totalBusinessCount: this.qbiEntries().length,
    thresholdStart: this.l21(),
    thresholdEnd: this.l21() + this.l23(),
    applicablePercentage: this.l24(),
    sstbCount: this.qbiEntries().filter((entry) => entry.isSSTB).length,
    reitDividends: this.reitDividends(),
    ptpIncome: this.currentYearPtpIncome(),
    ptpLossCarryforward: this.ptpLossCarryforward(),
    dpadReduction: this.l38(),
    overflowTotals: this.overflowTotals(),
    overflowStatementDeduction: this.overflowStatementDeduction()
  })

  deductionForEntry = (
    entry: QBIEntry
  ): number => {
    const line3 = entry.qbi * qbid.maxRate
    const line5 = entry.w2Wages * 0.5
    const line6 = entry.w2Wages * 0.25
    const line8 = entry.ubia * 0.025
    const line10 = Math.max(line5, line6 + line8)
    const line11 = Math.min(line3, line10)
    const line19 = line3 - line10
    const line25 = line19 * this.l24()
    const line26 = line3 - line25
    return Math.max(line26, line11)
  }

  deductionAfterPatronReduction = (
    entry: QBIEntry
  ): number =>
    Math.max(0, this.deductionForEntry(entry) - entry.patronReduction)

  allQualifiedBusinessDeductions = (): number[] =>
    this.qbiEntries()
      .filter((entry) => entry.qbi > 0)
      .map((entry) => this.deductionAfterPatronReduction(entry))

  l2a = (): number | undefined => this.visibleEntries()[0]?.qbi
  l2b = (): number | undefined => this.visibleEntries()[1]?.qbi
  l2c = (): number | undefined => this.visibleEntries()[2]?.qbi

  l3a = (): number | undefined =>
    ifNumber(this.l2a(), (num) => num * qbid.maxRate)
  l3b = (): number | undefined =>
    ifNumber(this.l2b(), (num) => num * qbid.maxRate)
  l3c = (): number | undefined =>
    ifNumber(this.l2c(), (num) => num * qbid.maxRate)

  l4a = (): number | undefined =>
    ifNumber(this.l2a(), () => this.visibleEntries()[0]?.w2Wages ?? 0)
  l4b = (): number | undefined =>
    ifNumber(this.l2b(), () => this.visibleEntries()[1]?.w2Wages ?? 0)
  l4c = (): number | undefined =>
    ifNumber(this.l2c(), () => this.visibleEntries()[2]?.w2Wages ?? 0)

  l5a = (): number | undefined => ifNumber(this.l4a(), (num) => num * 0.5)
  l5b = (): number | undefined => ifNumber(this.l4b(), (num) => num * 0.5)
  l5c = (): number | undefined => ifNumber(this.l4c(), (num) => num * 0.5)

  l6a = (): number | undefined => ifNumber(this.l4a(), (num) => num * 0.25)
  l6b = (): number | undefined => ifNumber(this.l4b(), (num) => num * 0.25)
  l6c = (): number | undefined => ifNumber(this.l4c(), (num) => num * 0.25)

  l7a = (): number | undefined =>
    ifNumber(this.l2a(), () => this.visibleEntries()[0]?.ubia ?? 0)
  l7b = (): number | undefined =>
    ifNumber(this.l2b(), () => this.visibleEntries()[1]?.ubia ?? 0)
  l7c = (): number | undefined =>
    ifNumber(this.l2c(), () => this.visibleEntries()[2]?.ubia ?? 0)

  l8a = (): number | undefined => ifNumber(this.l7a(), (num) => num * 0.025)
  l8b = (): number | undefined => ifNumber(this.l7b(), (num) => num * 0.025)
  l8c = (): number | undefined => ifNumber(this.l7c(), (num) => num * 0.025)

  l9a = (): number | undefined =>
    ifNumber(this.l6a(), (num) => num + (this.l8a() ?? 0))
  l9b = (): number | undefined =>
    ifNumber(this.l6b(), (num) => num + (this.l8b() ?? 0))
  l9c = (): number | undefined =>
    ifNumber(this.l6c(), (num) => num + (this.l8c() ?? 0))

  l10a = (): number | undefined =>
    ifNumber(this.l5a(), (num) => Math.max(num, this.l9a() ?? 0))
  l10b = (): number | undefined =>
    ifNumber(this.l5b(), (num) => Math.max(num, this.l9b() ?? 0))
  l10c = (): number | undefined =>
    ifNumber(this.l5c(), (num) => Math.max(num, this.l9c() ?? 0))

  l11a = (): number | undefined =>
    ifNumber(this.l3a(), (num) => Math.min(num, this.l10a() ?? 0))
  l11b = (): number | undefined =>
    ifNumber(this.l3b(), (num) => Math.min(num, this.l10b() ?? 0))
  l11c = (): number | undefined =>
    ifNumber(this.l3c(), (num) => Math.min(num, this.l10c() ?? 0))

  l12a = (): number | undefined => ifNumber(this.l26a(), (num) => num)
  l12b = (): number | undefined => ifNumber(this.l26b(), (num) => num)
  l12c = (): number | undefined => ifNumber(this.l26c(), (num) => num)

  l13a = (): number | undefined =>
    ifNumber(this.l12a(), (num) => Math.max(num, this.l11a() ?? 0))
  l13b = (): number | undefined =>
    ifNumber(this.l12b(), (num) => Math.max(num, this.l11b() ?? 0))
  l13c = (): number | undefined =>
    ifNumber(this.l12c(), (num) => Math.max(num, this.l11c() ?? 0))

  l14a = (): number | undefined =>
    ifNumber(this.l2a(), () => this.visibleEntries()[0]?.patronReduction ?? 0)
  l14b = (): number | undefined =>
    ifNumber(this.l2b(), () => this.visibleEntries()[1]?.patronReduction ?? 0)
  l14c = (): number | undefined =>
    ifNumber(this.l2c(), () => this.visibleEntries()[2]?.patronReduction ?? 0)

  l15a = (): number | undefined =>
    ifNumber(this.l13a(), (num) => Math.max(0, num - (this.l14a() ?? 0)))
  l15b = (): number | undefined =>
    ifNumber(this.l13b(), (num) => Math.max(0, num - (this.l14b() ?? 0)))
  l15c = (): number | undefined =>
    ifNumber(this.l13c(), (num) => Math.max(0, num - (this.l14c() ?? 0)))

  l16 = (): number => sumFields(this.allQualifiedBusinessDeductions())

  l17a = (): number | undefined => ifNumber(this.l3a(), (num) => num)
  l17b = (): number | undefined => ifNumber(this.l3b(), (num) => num)
  l17c = (): number | undefined => ifNumber(this.l3c(), (num) => num)

  l18a = (): number | undefined => ifNumber(this.l10a(), (num) => num)
  l18b = (): number | undefined => ifNumber(this.l10b(), (num) => num)
  l18c = (): number | undefined => ifNumber(this.l10c(), (num) => num)

  l19a = (): number | undefined =>
    ifNumber(this.l17a(), (num) => num - (this.l18a() ?? 0))
  l19b = (): number | undefined =>
    ifNumber(this.l17b(), (num) => num - (this.l18b() ?? 0))
  l19c = (): number | undefined =>
    ifNumber(this.l17c(), (num) => num - (this.l18c() ?? 0))

  l20 = (): number => this.f1040.taxableIncomeBeforeQBIDeduction()
  l21 = (): number =>
    getF8995PhaseOutIncome(this.f1040.info.taxPayer.filingStatus)
  l22 = (): number => this.l20() - this.l21()
  l23 = (): number =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ ||
    this.f1040.info.taxPayer.filingStatus === FilingStatus.W
      ? 100000
      : 50000
  l24 = (): number => Math.round((this.l22() / this.l23()) * 10000) / 10000 // We want xx.xx%

  l25a = (): number | undefined =>
    ifNumber(this.l19a(), (num) => num * this.l24())
  l25b = (): number | undefined =>
    ifNumber(this.l19b(), (num) => num * this.l24())
  l25c = (): number | undefined =>
    ifNumber(this.l19c(), (num) => num * this.l24())

  l26a = (): number | undefined =>
    ifNumber(this.l17a(), (num) => num - (this.l25a() ?? 0))
  l26b = (): number | undefined =>
    ifNumber(this.l17b(), (num) => num - (this.l25b() ?? 0))
  l26c = (): number | undefined =>
    ifNumber(this.l17c(), (num) => num - (this.l25c() ?? 0))

  l27 = (): number => this.l16()

  l28 = (): number => this.reitDividends() + this.currentYearPtpIncome()
  l29 = (): number => -this.ptpLossCarryforward()

  l30 = (): number => Math.max(0, this.l28() + this.l29())
  l31 = (): number => this.l30() * qbid.maxRate

  l32 = (): number => this.l27() + this.l31()
  l33 = (): number => this.l20()
  l34 = (): number => this.netCapitalGains()
  l35 = (): number => this.l33() - this.l34()
  l36 = (): number => this.l35() * qbid.maxRate
  l37 = (): number => Math.min(this.l32(), this.l36())

  l38 = (): number => this.f1040.info.qbiDeductionData?.dpadReduction ?? 0

  l39 = (): number => this.l37() - this.l38()
  deductions = (): number => this.l39()
  l40 = (): number => Math.min(0, this.l28() + this.l29())

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.visibleEntries()[0]?.name,
    false, // 1Ab
    false, // 1Ac
    this.visibleEntries()[0]?.ein,
    false, // 1Ae
    this.visibleEntries()[1]?.name,
    false, // 1Bb
    false, // 1Bc
    this.visibleEntries()[1]?.ein,
    false, // 1Be
    this.visibleEntries()[2]?.name,
    false, // 1Cb
    false, // 1Cc
    this.visibleEntries()[2]?.ein,
    false, // 1Ce
    this.l2a(),
    this.l2b(),
    this.l2c(),
    this.l3a(),
    this.l3b(),
    this.l3c(),
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l5a(),
    this.l5b(),
    this.l5c(),
    this.l6a(),
    this.l6b(),
    this.l6c(),
    this.l7a(),
    this.l7b(),
    this.l7c(),
    this.l8a(),
    this.l8b(),
    this.l8c(),
    this.l9a(),
    this.l9b(),
    this.l9c(),
    this.l10a(),
    this.l10b(),
    this.l10c(),
    this.l11a(),
    this.l11b(),
    this.l11c(),
    this.l12a(),
    this.l12b(),
    this.l12c(),
    this.l13a(),
    this.l13b(),
    this.l13c(),
    this.l14a(),
    this.l14b(),
    this.l14c(),
    this.l15a(),
    this.l15b(),
    this.l15c(),
    this.l16(),
    undefined, // Gray
    undefined, // Gray
    this.l17a(),
    this.l17b(),
    this.l17c(),
    this.l18a(),
    this.l18b(),
    this.l18c(),
    this.l19a(),
    this.l19b(),
    this.l19c(),
    this.l20(),
    undefined, // Gray
    undefined, // Gray
    undefined, // Gray
    this.l21(),
    undefined, // Gray
    undefined, // Gray
    undefined, // Gray
    this.l22(),
    undefined, // Gray
    undefined, // Gray
    undefined, // Gray
    this.l23(),
    undefined, // Gray
    undefined, // Gray
    undefined, // Gray
    (this.l24() * 100).toFixed(2) + '%', // TODO: Percent sign is duplicated, but it prevents Fill.ts from rounding this
    undefined, // Gray
    undefined, // Gray
    undefined, // Gray
    this.l25a(),
    this.l25b(),
    this.l25c(),
    this.l26a(),
    this.l26b(),
    this.l26c(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33(),
    this.l34(),
    this.l35(),
    this.l36(),
    this.l37(),
    this.l38(),
    this.l39(),
    this.l40()
  ]
}
