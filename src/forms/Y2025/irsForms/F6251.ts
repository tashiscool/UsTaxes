import F1040Attachment from './F1040Attachment'
import { FilingStatus, PersonRole, type AmtAdjustmentData } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import federalBrackets, { amt } from '../data/federal'
import ScheduleK1_1041 from './ScheduleK1_1041'

type Part3 = Partial<{
  l12: number
  l13: number
  l14: number
  l15: number
  l16: number
  l17: number
  l18: number
  l19: number
  l20: number
  l21: number
  l22: number
  l23: number
  l24: number
  l25: number
  l26: number
  l27: number
  l28: number
  l29: number
  l30: number
  l31: number
  l32: number
  l33: number
  l34: number
  l35: number
  l36: number
  l37: number
  l38: number
  l39: number
  l40: number
}>

export default class F6251 extends F1040Attachment {
  tag: FormTag = 'f6251'
  sequenceIndex = 32

  amtAdjustment = (line: keyof AmtAdjustmentData): number | undefined => {
    const amount = this.f1040.info.amtAdjustmentData?.[line] ?? 0
    return amount === 0 ? undefined : amount
  }

  scheduleK1_1041Forms = (): ScheduleK1_1041[] => {
    const fiduciaryReturn = this.f1040.info.fiduciaryReturn as
      | { beneficiaries?: unknown[] }
      | undefined
    const beneficiaryCount = fiduciaryReturn?.beneficiaries?.length ?? 0
    return Array.from({ length: beneficiaryCount }, (_, index) => {
      return new ScheduleK1_1041(this.f1040, index)
    }).filter((form) => form.isNeeded())
  }

  isNeeded = (): boolean => {
    // See https://www.irs.gov/instructions/i6251

    // 1. Form 6251, line 7, is greater than line 10.
    if ((this.l7() ?? 0) > this.l10()) {
      return true
    }

    // 2. You claim any general business credit.
    if (this.f1040.f3800?.isNeeded() ?? false) {
      return true
    }

    // 3. You claim the credit for prior year minimum tax (Form 8801).
    if (this.f1040.f8801?.isNeeded() ?? false) {
      return true
    }

    // 4. The total of Form 6251, lines 2c through 3, is negative and line 7 would be greater than line 10 if you didn’t take into account lines 2c through 3.
    const l2cTo3Total =
      (this.l2c() ?? 0) +
      (this.l2d() ?? 0) +
      (this.l2e() ?? 0) +
      (this.l2f() ?? 0) +
      (this.l2g() ?? 0) +
      (this.l2h() ?? 0) +
      (this.l2i() ?? 0) +
      (this.l2j() ?? 0) +
      (this.l2k() ?? 0) +
      (this.l2l() ?? 0) +
      (this.l2m() ?? 0) +
      (this.l2n() ?? 0) +
      (this.l2o() ?? 0) +
      (this.l2p() ?? 0) +
      (this.l2q() ?? 0) +
      (this.l2r() ?? 0) +
      (this.l2s() ?? 0) +
      (this.l2t() ?? 0) +
      (this.l3() ?? 0)
    if (l2cTo3Total < 0 && (this.l7(-l2cTo3Total) ?? 0) > this.l10())
      return true

    return false
  }

  l1 = (): number | undefined => {
    const l15 = this.f1040.l15()
    if (l15 !== 0) {
      return l15
    }
    return this.f1040.l11() - this.f1040.l14()
  }

  l2a = (): number | undefined => {
    if (this.f1040.scheduleA.isNeeded()) {
      return this.f1040.scheduleA.l7()
    }
    return this.f1040.l12()
  }

  l2b = (): number | undefined => {
    return (this.f1040.schedule1.l1() ?? 0) + this.f1040.schedule1.l8z()
  }

  l2c = (): number | undefined =>
    this.amtAdjustment('line2cInvestmentInterestExpense')

  l2d = (): number | undefined => this.amtAdjustment('line2dDepletion')

  l2e = (): number | undefined => {
    return Math.abs(this.f1040.schedule1.l8a() ?? 0)
  }

  l2f = (): number | undefined =>
    this.amtAdjustment('line2fAlternativeTaxNetOperatingLossDeduction')
  // Interest from specified private activity bonds exempt from the regular tax
  l2g = (): number | undefined => {
    const total = this.f1040
      .f1099Ints()
      .reduce(
        (sum, record) => sum + (record.form.privateActivityBondInterest ?? 0),
        0
      )
    return total === 0 ? undefined : total
  }
  l2h = (): number | undefined =>
    this.amtAdjustment('line2hQualifiedSmallBusinessStock')

  // Exercise of incentive stock options (excess of AMT income over regular tax income)
  l2i = (): number | undefined => {
    let f3921s = this.f1040.info.f3921s
    if (this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS) {
      f3921s = f3921s.filter((w2) => w2.personRole === PersonRole.PRIMARY)
    }
    return f3921s.reduce(
      (amount, f) => (f.fmv - f.exercisePricePerShare) * f.numShares + amount,
      0
    )
  }

  // Estates and trusts (amount from Schedule K-1 (Form 1041), box 12, code A)
  l2j = (): number | undefined => {
    const totalAmtAdjustment = this.scheduleK1_1041Forms().reduce(
      (sum, schedule) => sum + schedule.l12(),
      0
    )
    return totalAmtAdjustment === 0 ? undefined : totalAmtAdjustment
  }
  l2k = (): number | undefined =>
    this.amtAdjustment('line2kPropertyDisposition')
  l2l = (): number | undefined =>
    this.amtAdjustment('line2lPost1986Depreciation')
  // TODO: Passive activities (difference between AMT and regular tax income or loss)
  l2m = (): number | undefined =>
    this.amtAdjustment('line2mPassiveActivities')
  // TODO: Loss limitations (difference between AMT and regular tax income or loss)
  l2n = (): number | undefined =>
    this.amtAdjustment('line2nLossLimitations')
  // TODO: Circulation costs (difference between regular tax and AMT)
  l2o = (): number | undefined =>
    this.amtAdjustment('line2oCirculationCosts')
  // TODO: Long-term contracts (difference between AMT and regular tax income)
  l2p = (): number | undefined =>
    this.amtAdjustment('line2pLongTermContracts')
  // TODO: Mining costs (difference between regular tax and AMT)
  l2q = (): number | undefined =>
    this.amtAdjustment('line2qMiningCosts')
  // TODO: Research and experimental costs (difference between regular tax and AMT)
  l2r = (): number | undefined =>
    this.amtAdjustment('line2rResearchExperimentalCosts')
  // TODO: Income from certain installment sales before January 1, 1987
  l2s = (): number | undefined =>
    this.amtAdjustment('line2sPre1987InstallmentSales')
  // TODO: Intangible drilling costs preference
  l2t = (): number | undefined =>
    this.amtAdjustment('line2tIntangibleDrillingCosts')

  // TODO: Other adjustments, including income-based related adjustments
  l3 = (): number | undefined => this.amtAdjustment('line3OtherAdjustments')

  l4 = (additionalAmount = 0): number | undefined =>
    additionalAmount +
    (this.l1() ?? 0) +
    (this.l2a() ?? 0) -
    (this.l2b() ?? 0) +
    (this.l2c() ?? 0) +
    (this.l2d() ?? 0) +
    (this.l2e() ?? 0) -
    (this.l2f() ?? 0) +
    (this.l2g() ?? 0) +
    (this.l2h() ?? 0) +
    (this.l2i() ?? 0) +
    (this.l2j() ?? 0) +
    (this.l2k() ?? 0) +
    (this.l2l() ?? 0) +
    (this.l2m() ?? 0) +
    (this.l2n() ?? 0) +
    (this.l2o() ?? 0) +
    (this.l2p() ?? 0) +
    (this.l2q() ?? 0) +
    (this.l2r() ?? 0) -
    (this.l2s() ?? 0) +
    (this.l2t() ?? 0) +
    (this.l3() ?? 0)

  l5 = (additionalAmount = 0): number | undefined => {
    const l4 = this.l4(additionalAmount) ?? 0
    return amt.exemption(this.f1040.info.taxPayer.filingStatus, l4)
  }

  l6 = (additionalAmount = 0): number =>
    Math.max(
      0,
      (this.l4(additionalAmount) ?? 0) - (this.l5(additionalAmount) ?? 0)
    )

  requiresPartIII = (): boolean => {
    // If you reported capital gain distributions directly on Form 1040 or 1040-SR, line 7;
    // you reported qualified dividends on Form 1040 or 1040-SR, line 3a;
    // or you had a gain on both lines 15 and 16 of Schedule D (Form 1040) (as refigured for the AMT, if necessary),
    // complete Part III on the back and enter the amount from line 40 here.
    return (
      (this.f1040.l7() ?? 0) > 0 ||
      (this.f1040.l3a() ?? 0) > 0 ||
      (this.f1040.scheduleD.l15() > 0 && this.f1040.scheduleD.l16() > 0)
    )
  }

  amtFlatTax = (amount: number): number => {
    const cap = amt.cap(this.f1040.info.taxPayer.filingStatus)
    if (amount <= cap) {
      return amount * 0.26
    }
    return (
      amount * 0.28 -
      (this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS ? 2207 : 4414)
    )
  }

  foreignEarnedIncomeWorksheetLine2c = (): number => {
    const f2555 = this.f1040.f2555
    if (
      f2555 === undefined ||
      (f2555.l36() <= 0 && f2555.l33() <= 0 && f2555.l42() <= 0)
    ) {
      return 0
    }

    return f2555.foreignEarnedIncomeTaxWorksheetLine2c()
  }

  l7 = (additionalAmount = 0): number | undefined => {
    const l6 = this.l6(additionalAmount)
    if (l6 === 0) {
      return 0
    }

    // TODO: Handle Form 2555
    const f2555 = this.f1040.f2555
    if (
      f2555 !== undefined &&
      (f2555.l36() > 0 || f2555.l42() > 0 || f2555.l50() > 0)
    ) {
      const line2c = this.foreignEarnedIncomeWorksheetLine2c()
      const line3 = l6 + line2c
      const line4 = this.requiresPartIII()
        ? (this.part3(line3).l40 ?? 0)
        : this.amtFlatTax(line3)
      const line5 = this.amtFlatTax(line2c)
      return Math.max(0, line4 - line5)
    }

    // Use line 40 if Part III is required
    if (this.requiresPartIII()) {
      return this.part3().l40
    }

    return this.amtFlatTax(l6)
  }

  // Approximate the AMT foreign tax credit from the currently modeled Form 1116 FTC.
  l8 = (): number | undefined => {
    if ((this.l10() ?? 0) >= (this.l7() ?? 0)) {
      return undefined
    }

    const regularForeignTaxCredit = this.f1040.f1116?.credit() ?? 0
    if (regularForeignTaxCredit <= 0) {
      return undefined
    }
    return Math.min(regularForeignTaxCredit, this.l7() ?? 0)
  }

  l9 = (additionalAmount = 0): number => {
    const l6 = this.l6(additionalAmount)
    if (l6 === 0) {
      return 0
    }
    return (this.l7(additionalAmount) ?? 0) - (this.l8() ?? 0)
  }

  // Add Form 1040 or 1040-SR, line 16 (minus any tax from Form 4972),
  // and Schedule 2 (Form 1040), line 1z.
  // Subtract from the result Schedule 3 (Form 1040), line 1
  // and any negative amount reported on Form 8978, line 14 (treated as a positive number).
  // If zero or less, enter -0-.
  l10 = (): number => {
    const f1040L16 = this.f1040.incomeTaxBeforeScheduleJ() ?? 0
    const f4972 = this.f1040.f4972?.tax() ?? 0
    const sch2L2 = this.f1040.schedule2.l1z()
    const sch3L1 = this.f1040.schedule3.l1() ?? 0
    const f8978L14 = Math.abs(
      this.f1040.info.amtAdjustmentData?.line10Form8978NegativeAdjustment ?? 0
    )
    return Math.max(0, f1040L16 - f4972 + sch2L2 - sch3L1 - f8978L14)
  }

  l11 = (): number => {
    const l6 = this.l6()
    if (l6 === 0) {
      return 0
    }
    return Math.max(0, this.l9() - this.l10())
  }

  regularTaxPart3FallbackAmount = (): number => {
    if (this.f1040.f2555?.isNeeded()) {
      return Math.max(0, this.f1040.f2555.l3() ?? 0)
    }
    return Math.max(0, this.f1040.l15())
  }

  form2555AmtCapitalGainExcess = (): number => {
    const f2555 = this.f1040.f2555
    if (
      f2555 === undefined ||
      !f2555.isNeeded() ||
      !this.requiresPartIII()
    ) {
      return 0
    }

    const qdivWorksheet = this.f1040.qualifiedAndCapGainsWorksheet
    const schDWksht = this.f1040.scheduleD.taxWorksheet
    const worksheetBase = schDWksht.isNeeded()
      ? (schDWksht.l10() ?? 0)
      : (qdivWorksheet?.l4() ?? 0)

    return Math.max(0, worksheetBase - this.l6())
  }

  part3WorksheetValues = (): {
    usingTaxWorksheet: boolean
    line13: number
    line15Cap: number
    line20: number
    line27: number
  } => {
    const qdivWorksheet = this.f1040.qualifiedAndCapGainsWorksheet
    const schDWksht = this.f1040.scheduleD.taxWorksheet
    const usingTaxWorksheet = schDWksht.isNeeded()
    const regularTaxFallback = this.regularTaxPart3FallbackAmount()

    const regularLine20 = (() => {
      if (usingTaxWorksheet) {
        return schDWksht.l14() ?? regularTaxFallback
      }

      if (qdivWorksheet !== undefined) {
        return qdivWorksheet.l5()
      }

      return regularTaxFallback
    })()

    const regularLine27 = (() => {
      if (usingTaxWorksheet) {
        return schDWksht.l21() ?? regularLine20
      }

      if (qdivWorksheet !== undefined) {
        return qdivWorksheet.l5()
      }

      return regularLine20
    })()

    const amtCapitalGainExcess = this.form2555AmtCapitalGainExcess()
    if (amtCapitalGainExcess <= 0) {
      return {
        usingTaxWorksheet,
        line13: usingTaxWorksheet
          ? (schDWksht.l13() ?? 0)
          : (qdivWorksheet?.l4() ?? 0),
        line15Cap: usingTaxWorksheet
          ? (schDWksht.l10() ?? 0)
          : (qdivWorksheet?.l4() ?? 0),
        line20: regularLine20,
        line27: regularLine27
      }
    }

    if (usingTaxWorksheet) {
      const scheduleD = this.f1040.scheduleD
      const taxWorksheetReference = schDWksht.reference()
      const regularLine6 = taxWorksheetReference.l6()
      const regularLine9 = taxWorksheetReference.l9()
      const adjustedLine9 = Math.max(0, regularLine9 - amtCapitalGainExcess)
      const remainingExcess = Math.max(0, amtCapitalGainExcess - regularLine9)
      const adjustedLine6 = Math.max(0, regularLine6 - remainingExcess)
      const adjustedLine10 = adjustedLine6 + adjustedLine9
      const adjustedScheduleDLine18 = Math.max(
        0,
        (scheduleD.l18() ?? 0) - amtCapitalGainExcess
      )
      const adjustedLine11 = adjustedScheduleDLine18 + (scheduleD.l19() ?? 0)
      const adjustedLine12 = Math.min(adjustedLine9, adjustedLine11)
      const adjustedLine13 = adjustedLine10 - adjustedLine12

      return {
        usingTaxWorksheet,
        line13: adjustedLine13,
        line15Cap: adjustedLine10,
        line20: regularLine20,
        line27: regularLine27
      }
    }

    const regularLine2 = qdivWorksheet?.l2() ?? 0
    const regularLine3 = qdivWorksheet?.l3() ?? 0
    const adjustedLine3 = Math.max(0, regularLine3 - amtCapitalGainExcess)
    const remainingExcess = Math.max(0, amtCapitalGainExcess - regularLine3)
    const adjustedLine2 = Math.max(0, regularLine2 - remainingExcess)
    const adjustedLine4 = adjustedLine2 + adjustedLine3

    return {
      usingTaxWorksheet,
      line13: adjustedLine4,
      line15Cap: adjustedLine4,
      line20: regularLine20,
      line27: regularLine27
    }
  }

  part3 = (line12Base = this.l6()): Part3 => {
    if (!this.requiresPartIII()) {
      return {}
    }
    const fs = this.f1040.info.taxPayer.filingStatus
    const worksheetValues = this.part3WorksheetValues()
    const usingTaxWorksheet = worksheetValues.usingTaxWorksheet

    const l18Consts: [number, number] = (() => {
      const breakpoint = amt.cap(fs)
      return [breakpoint, breakpoint * 0.02]
    })()

    const [l19, l25] = federalBrackets.longTermCapGains.status[fs].brackets

    const l12 = line12Base

    const l13 = worksheetValues.line13

    const l14 = this.f1040.scheduleD.l19() ?? 0

    const l15 = (() => {
      if (!usingTaxWorksheet) {
        return l13
      }
      return Math.min(l13 + l14, worksheetValues.line15Cap)
    })()

    const l16 = Math.min(l12, l15)

    const l17 = l12 - l16

    const l18 = (() => {
      const [c1, c2] = l18Consts

      if (l17 <= c1) {
        return l17 * 0.26
      }
      return l17 * 0.28 - c2
    })()

    const l20 = worksheetValues.line20

    const l21 = Math.max(0, l19 - l20)

    const l22 = Math.min(l12, l13)

    const l23 = Math.min(l21, l22)

    const l24 = Math.max(0, l22 - l23)

    const l26 = l21

    const l27 = worksheetValues.line27

    const l28 = l26 + l27

    const l29 = Math.max(0, l25 - l28)

    const l30 = Math.min(l24, l29)

    const l31 = l30 * 0.15

    const l32 = l23 + l30

    const l33 = l22 - l32

    const l34 = l33 * 0.2

    const l35 = l17 + l32 + l33

    const l36 = l12 - l35

    const l37 = l36 * 0.25

    const l38 = l18 + l31 + l34 + l37

    const l39 = (() => {
      // numbers referenced here are the same as l18.
      const [c1, c2] = l18Consts
      if (l12 <= c1) {
        return l12 * 0.26
      }
      return l12 * 0.28 - c2
    })()

    const l40 = Math.min(l38, l39)

    return {
      l12,
      l13,
      l14,
      l15,
      l16,
      l17,
      l18,
      l19,
      l20,
      l21,
      l22,
      l23,
      l24,
      l25,
      l26,
      l27,
      l28,
      l29,
      l30,
      l31,
      l32,
      l33,
      l34,
      l35,
      l36,
      l37,
      l38,
      l39,
      l40
    }
  }

  fields = (): Field[] => {
    const p3 = this.part3()
    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Part I
      this.l1(),
      this.l2a(),
      this.l2b(),
      this.l2c(),
      this.l2d(),
      this.l2e(),
      this.l2f(),
      this.l2g(),
      this.l2h(),
      this.l2i(),
      this.l2j(),
      this.l2k(),
      this.l2l(),
      this.l2m(),
      this.l2n(),
      this.l2o(),
      this.l2p(),
      this.l2q(),
      this.l2r(),
      this.l2s(),
      this.l2t(),
      this.l3(),
      this.l4(),
      // Part II
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      // Part III
      p3.l12,
      p3.l13,
      p3.l14,
      p3.l15,
      p3.l16,
      p3.l17,
      p3.l18,
      p3.l19,
      p3.l20,
      p3.l21,
      p3.l22,
      p3.l23,
      p3.l24,
      p3.l25,
      p3.l26,
      p3.l27,
      p3.l28,
      p3.l29,
      p3.l30,
      p3.l31,
      p3.l32,
      p3.l33,
      p3.l34,
      p3.l35,
      p3.l36,
      p3.l37,
      p3.l38,
      p3.l39,
      p3.l40
    ]
  }
}
