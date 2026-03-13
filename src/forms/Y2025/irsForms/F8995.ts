import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Income1099Type, F1099DivData } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import { qbid } from '../data/federal'
import { BusinessInfo } from './ScheduleC'

type QBIEntry = {
  name: string
  ein?: string
  qbi: number
  w2Wages: number
  ubia: number
  patronReduction: number
}

export function getF8995PhaseOutIncome(filingStatus: FilingStatus): number {
  let formAMinAmount = 197300
  if (filingStatus === FilingStatus.MFJ || filingStatus === FilingStatus.W) {
    formAMinAmount = 394600
  }
  return formAMinAmount
}

function ifNumber(
  num: number | undefined,
  f: (num: number) => number | undefined
) {
  return num !== undefined ? f(num) : undefined
}

export default class F8995 extends F1040Attachment {
  tag: FormTag = 'f8995'
  sequenceIndex = 55

  scheduleCQBIBusinesses = (): QBIEntry[] =>
    (((this.f1040.info.businesses as BusinessInfo[] | undefined) ?? [])
      .map((business) => {
        const expenses = business.expenses
        const totalExpenses =
          expenses.advertising +
          expenses.carAndTruck +
          expenses.commissions +
          expenses.contractLabor +
          expenses.depletion +
          expenses.depreciation +
          expenses.employeeBenefits +
          expenses.insurance +
          expenses.interestMortgage +
          expenses.interestOther +
          expenses.legal +
          expenses.office +
          expenses.pensionPlans +
          expenses.rentVehicles +
          expenses.rentOther +
          expenses.repairs +
          expenses.supplies +
          expenses.taxes +
          expenses.travel +
          expenses.deductibleMeals +
          expenses.utilities +
          expenses.wages +
          expenses.otherExpenses
        const cogs =
          (business.costOfGoodsSold?.beginningInventory ?? 0) +
          (business.costOfGoodsSold?.purchases ?? 0) +
          (business.costOfGoodsSold?.laborCost ?? 0) +
          (business.costOfGoodsSold?.materials ?? 0) +
          (business.costOfGoodsSold?.otherCosts ?? 0) -
          (business.costOfGoodsSold?.endingInventory ?? 0)
        const grossIncome =
          Math.max(0, business.income.grossReceipts - business.income.returns) +
          business.income.otherIncome
        const netProfit =
          grossIncome - cogs - totalExpenses - (business.homeOfficeDeduction ?? 0)
        return {
          name: business.name,
          ein: business.ein,
          qbi: netProfit,
          w2Wages: business.qbiW2Wages ?? business.expenses.wages,
          ubia: business.qbiUbia ?? 0,
          patronReduction: business.qbiPatronReduction ?? 0
        }
      })
      .filter((business) => business.qbi > 0)) as QBIEntry[]

  applicableK1s = (): QBIEntry[] =>
    this.f1040.info.scheduleK1Form1065s
      .filter((k1) => k1.section199AQBI > 0)
      .map((k1) => ({
        name: k1.partnershipName,
        ein: k1.partnershipEin,
        qbi: k1.section199AQBI,
        w2Wages: k1.section199AW2Wages ?? 0,
        ubia: k1.section199AUbia ?? 0,
        patronReduction: k1.section199APatronReduction ?? 0
      }))

  qbiEntries = (): QBIEntry[] => [
    ...this.scheduleCQBIBusinesses(),
    ...this.applicableK1s()
  ]

  priorYearQualifiedBusinessLossCarryforward = (): number =>
    Math.abs(
      this.f1040.info.qbiDeductionData?.priorYearQualifiedBusinessLossCarryforward ??
        0
    )

  reitDividends = (): number =>
    this.f1040.f1099Divs().reduce((total, form) => {
      if (form.type !== Income1099Type.DIV) {
        return total
      }
      return total + ((form.form as F1099DivData).section199ADividends ?? 0)
    }, 0) + (this.f1040.info.qbiDeductionData?.reitDividends ?? 0)

  currentYearPtpIncome = (): number =>
    this.f1040.info.scheduleK1Form1065s.reduce((total, k1) => {
      if (k1.ptpSection199AIncome !== undefined) {
        return total + k1.ptpSection199AIncome
      }
      if (k1.isPubliclyTradedPartnership) {
        return total + k1.section199AQBI
      }
      return total
    }, 0) + (this.f1040.info.qbiDeductionData?.ptpIncome ?? 0)

  ptpLossCarryforward = (): number =>
    this.f1040.info.scheduleK1Form1065s.reduce(
      (total, k1) => total + (k1.ptpSection199ALossCarryforward ?? 0),
      0
    ) + (this.f1040.info.qbiDeductionData?.ptpLossCarryforward ?? 0)

  netPtpIncome = (): number =>
    this.currentYearPtpIncome() - this.ptpLossCarryforward()

  netCapitalGains = (): number => {
    let rtn = this.f1040.l3a() ?? 0
    if (this.f1040.scheduleD.isNeeded()) {
      const l15 = this.f1040.scheduleD.l15()
      const l16 = this.f1040.scheduleD.l16()
      const min = Math.min(l15, l16)
      if (min > 0) rtn += min
    } else {
      rtn += this.f1040.l7() ?? 0
    }
    return rtn
  }

  l2 = (): number | undefined =>
    this.qbiEntries()
      .map((entry) => entry.qbi)
      .reduce((c, a) => c + a, 0)
  l3 = (): number | undefined => {
    const carryforward = this.priorYearQualifiedBusinessLossCarryforward()
    return carryforward > 0 ? -carryforward : undefined
  }
  l4 = (): number | undefined =>
    ifNumber(this.l2(), (num) => num + (this.l3() ?? 0))
  l5 = (): number | undefined =>
    ifNumber(this.l4(), (num) => num * qbid.maxRate)

  l6 = (): number => this.reitDividends()
  l7 = (): number => this.netPtpIncome()
  l8 = (): number | undefined => ifNumber(this.l6(), (num) => num + this.l7())
  l9 = (): number | undefined =>
    ifNumber(this.l8(), (num) => num * qbid.maxRate)

  l10 = (): number | undefined =>
    ifNumber(this.l5(), (num) => num + (this.l9() ?? 0))
  l11 = (): number => this.f1040.taxableIncomeBeforeQBIDeduction()
  l12 = (): number => this.netCapitalGains()
  l13 = (): number => Math.max(0, this.l11() - this.l12())
  l14 = (): number => this.l13() * qbid.maxRate
  l15 = (): number => Math.min(this.l10() ?? 0, this.l14())
  l16 = (): number => Math.min(0, (this.l2() ?? 0) + (this.l3() ?? 0))
  l17 = (): number => Math.min(0, this.l6() + this.l7())

  deductions = (): number => this.l15()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.qbiEntries()[0]?.name,
    this.qbiEntries()[0]?.ein,
    this.qbiEntries()[0]?.qbi,
    this.qbiEntries()[1]?.name,
    this.qbiEntries()[1]?.ein,
    this.qbiEntries()[1]?.qbi,
    this.qbiEntries()[2]?.name,
    this.qbiEntries()[2]?.ein,
    this.qbiEntries()[2]?.qbi,
    this.qbiEntries()[3]?.name,
    this.qbiEntries()[3]?.ein,
    this.qbiEntries()[3]?.qbi,
    this.qbiEntries()[4]?.name,
    this.qbiEntries()[4]?.ein,
    this.qbiEntries()[4]?.qbi,
    this.l2(),
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
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17()
  ]
}
