import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Asset, Income1099B, isSold, SoldAsset } from 'ustaxes/core/data'
import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { CURRENT_YEAR } from '../data/federal'
import { Field } from 'ustaxes/core/pdfFiller'

type EmptyLine = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
]

type Line =
  | [string, string, string, number, number, undefined, undefined, number]
  | EmptyLine
type Form8949Row = {
  description: string
  dateAcquired?: Date
  dateSold?: Date
  proceeds: number
  costBasis: number
  adjustments: number
  gainLoss: number
}
const emptyLine: EmptyLine = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
]

const showDate = (date: Date): string =>
  `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`

const rowToLine = (row: Form8949Row): Line => [
  row.description,
  row.dateAcquired ? showDate(row.dateAcquired) : '',
  row.dateSold ? showDate(row.dateSold) : '',
  row.proceeds,
  row.costBasis,
  undefined,
  undefined,
  row.gainLoss
]

const NUM_SHORT_LINES = 14
const NUM_LONG_LINES = 14

const padUntil = <A, B>(xs: A[], v: B, n: number): (A | B)[] => {
  if (xs.length >= n) {
    return xs
  }
  return [...xs, ...Array.from(Array(n - xs.length)).map(() => v)]
}

const hasRowAmounts = (proceeds: number, costBasis: number): boolean =>
  proceeds !== 0 || costBasis !== 0

const summaryRowFrom1099B = (
  payer: string,
  proceeds: number,
  costBasis: number
): Form8949Row | undefined => {
  if (!hasRowAmounts(proceeds, costBasis)) {
    return undefined
  }

  return {
    description: payer || '1099-B summary',
    proceeds,
    costBasis,
    adjustments: 0,
    gainLoss: proceeds - costBasis
  }
}

const soldAssetRow = (position: SoldAsset<Date>): Form8949Row => {
  const proceeds = position.closePrice * position.quantity - (position.closeFee ?? 0)
  const costBasis = position.openPrice * position.quantity + position.openFee
  return {
    description: position.name,
    dateAcquired: position.openDate,
    dateSold: position.closeDate,
    proceeds,
    costBasis,
    adjustments: 0,
    gainLoss: proceeds - costBasis
  }
}

export default class F8949 extends F1040Attachment {
  tag: FormTag = 'f8949'
  sequenceIndex = 12.1

  index = 0

  constructor(f1040: F1040, index = 0) {
    super(f1040)
    this.index = index
  }

  hasSummarySales = (): boolean =>
    this.f1040.f1099Bs().some((f1099b: Income1099B) =>
      hasRowAmounts(
        f1099b.form.shortTermProceeds,
        f1099b.form.shortTermCostBasis
      )
    ) ||
    this.f1040.f1099Bs().some((f1099b: Income1099B) =>
      hasRowAmounts(
        f1099b.form.longTermProceeds,
        f1099b.form.longTermCostBasis
      )
    )

  isNeeded = (): boolean =>
    this.hasSummarySales() || this.thisYearSales().length > 0

  copies = (): F8949[] => {
    if (this.index === 0) {
      const extraCopiesNeeded = Math.max(this.totalPages() - 1, 0)
      return Array.from(Array(extraCopiesNeeded)).map(
        (_, i) => new F8949(this.f1040, i + 1)
      )
    }
    return []
  }

  reportedSales = (): Income1099B[] => this.f1040.f1099Bs()

  reportedShortTermRows = (): Form8949Row[] =>
    this.reportedSales()
      .map((f1099b) =>
        summaryRowFrom1099B(
          f1099b.payer,
          f1099b.form.shortTermProceeds,
          f1099b.form.shortTermCostBasis
        )
      )
      .filter((row): row is Form8949Row => row !== undefined)

  reportedLongTermRows = (): Form8949Row[] =>
    this.reportedSales()
      .map((f1099b) =>
        summaryRowFrom1099B(
          f1099b.payer,
          f1099b.form.longTermProceeds,
          f1099b.form.longTermCostBasis
        )
      )
      .filter((row): row is Form8949Row => row !== undefined)

  shortTermAssetRows = (): Form8949Row[] =>
    this.thisYearShortTermSales().map((position) => soldAssetRow(position))

  longTermAssetRows = (): Form8949Row[] =>
    this.thisYearLongTermSales().map((position) => soldAssetRow(position))

  hasSummaryPage = (): boolean => this.hasSummarySales()

  summaryPageCount = (): number =>
    this.hasSummaryPage()
      ? Math.max(
          Math.ceil(this.reportedShortTermRows().length / NUM_SHORT_LINES),
          Math.ceil(this.reportedLongTermRows().length / NUM_LONG_LINES)
        )
      : 0

  assetPageCount = (): number =>
    Math.max(
      Math.ceil(this.shortTermAssetRows().length / NUM_SHORT_LINES),
      Math.ceil(this.longTermAssetRows().length / NUM_LONG_LINES)
    )

  totalPages = (): number =>
    this.summaryPageCount() > 0
      ? this.summaryPageCount() + this.assetPageCount()
      : this.assetPageCount()

  isSummaryPage = (): boolean =>
    this.summaryPageCount() > 0 && this.index < this.summaryPageCount()

  pageIndex = (): number =>
    this.isSummaryPage() ? this.index : this.index - this.summaryPageCount()

  pageShortTermRows = (): Form8949Row[] => {
    const rows = this.isSummaryPage()
      ? this.reportedShortTermRows()
      : this.shortTermAssetRows()
    return rows.slice(
      this.pageIndex() * NUM_SHORT_LINES,
      (this.pageIndex() + 1) * NUM_SHORT_LINES
    )
  }

  pageLongTermRows = (): Form8949Row[] => {
    const rows = this.isSummaryPage()
      ? this.reportedLongTermRows()
      : this.longTermAssetRows()
    return rows.slice(
      this.pageIndex() * NUM_LONG_LINES,
      (this.pageIndex() + 1) * NUM_LONG_LINES
    )
  }

  // Summary pages are reported to IRS, asset pages are not reported.
  part1BoxA = (): boolean => this.isSummaryPage()
  part1BoxB = (): boolean => false
  part1BoxC = (): boolean => !this.isSummaryPage()
  part2BoxD = (): boolean => this.isSummaryPage()
  part2BoxE = (): boolean => false
  part2BoxF = (): boolean => !this.isSummaryPage()

  thisYearSales = (): SoldAsset<Date>[] =>
    this.f1040.assets.filter(
      (p) => isSold(p) && p.closeDate.getFullYear() === CURRENT_YEAR
    ) as SoldAsset<Date>[]

  thisYearLongTermSales = (): SoldAsset<Date>[] =>
    this.thisYearSales().filter((p) => this.isLongTerm(p))

  thisYearShortTermSales = (): SoldAsset<Date>[] =>
    this.thisYearSales().filter((p) => !this.isLongTerm(p))

  // in milliseconds
  oneDay = 1000 * 60 * 60 * 24

  isLongTerm = (p: Asset<Date>): boolean => {
    if (p.closeDate === undefined || p.closePrice === undefined) return false
    const milliInterval = p.closeDate.getTime() - p.openDate.getTime()
    return milliInterval / this.oneDay > 366
  }

  /**
   * Take the short term transactions that fit on this copy of the 8949
   */
  shortTermSales = (): Form8949Row[] => this.pageShortTermRows()

  /**
   * Take the long term transactions that fit on this copy of the 8949
   */
  longTermSales = (): Form8949Row[] => this.pageLongTermRows()

  shortTermLines = (): Line[] =>
    padUntil(
      this.shortTermSales().map((p) => rowToLine(p)),
      emptyLine,
      NUM_SHORT_LINES
    )
  longTermLines = (): Line[] =>
    padUntil(
      this.longTermSales().map((p) => rowToLine(p)),
      emptyLine,
      NUM_LONG_LINES
    )

  shortTermTotalProceeds = (): number =>
    this.shortTermSales().reduce(
      (acc, p) => acc + p.proceeds,
      0
    )

  shortTermTotalCost = (): number =>
    this.shortTermSales().reduce((acc, p) => acc + p.costBasis, 0)

  shortTermTotalGain = (): number =>
    this.shortTermTotalProceeds() - this.shortTermTotalCost()

  shortTermTotalAdjustments = (): number =>
    this.shortTermSales().reduce((acc, p) => acc + p.adjustments, 0)

  longTermTotalProceeds = (): number =>
    this.longTermSales().reduce(
      (acc, p) => acc + p.proceeds,
      0
    )

  longTermTotalCost = (): number =>
    this.longTermSales().reduce((acc, p) => acc + p.costBasis, 0)

  longTermTotalGain = (): number =>
    this.longTermTotalProceeds() - this.longTermTotalCost()

  longTermTotalAdjustments = (): number =>
    this.longTermSales().reduce((acc, p) => acc + p.adjustments, 0)

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.part1BoxA(),
    this.part1BoxB(),
    this.part1BoxC(),
    ...this.shortTermLines().flat(),
    this.shortTermTotalProceeds(),
    this.shortTermTotalCost(),
    undefined, // greyed out field
    this.shortTermTotalAdjustments(),
    this.shortTermTotalGain(),
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.part2BoxD(),
    this.part2BoxE(),
    this.part2BoxF(),
    ...this.longTermLines().flat(),
    this.longTermTotalProceeds(),
    this.longTermTotalCost(),
    undefined, // greyed out field
    this.longTermTotalAdjustments(),
    this.longTermTotalGain()
  ]
}
