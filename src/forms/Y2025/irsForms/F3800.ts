import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form3800Data, GeneralBusinessCreditComponents } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 3800 - General Business Credit
 *
 * Aggregates various business credits into a single form and calculates
 * the allowable credit based on tax liability limitations.
 *
 * Key features:
 * - Combines multiple business credits into one
 * - Applies tentative minimum tax limitation
 * - Handles carrybacks (1 year) and carryforwards (20 years)
 * - Some credits are eligible for refund/payroll tax offset
 *
 * Common business credits included:
 * - Investment credit (Form 3468)
 * - Work opportunity credit (Form 5884)
 * - Research credit (Form 6765)
 * - Low-income housing credit (Form 8586)
 * - Disabled access credit (Form 8826)
 * - Small employer health insurance credit (Form 8941)
 * - Employer credit for paid family/medical leave (Form 8994)
 * - New energy efficient home credit (Form 8908)
 *
 * The credit is limited to net income tax minus the greater of:
 * 1. Tentative minimum tax, or
 * 2. 25% of net regular tax liability over $25,000
 */

export default class F3800 extends F1040Attachment {
  tag: FormTag = 'f3800'
  sequenceIndex = 22

  isNeeded = (): boolean => {
    return this.hasGeneralBusinessCredits()
  }

  hasGeneralBusinessCredits = (): boolean => {
    const credits = this.creditData()
    if (!credits) return false
    return this.totalCurrentYearCredits() > 0 ||
           credits.carryforwardFromPriorYears > 0
  }

  creditData = (): Form3800Data | undefined => {
    return this.f1040.info.generalBusinessCredits
  }

  creditComponents = (): GeneralBusinessCreditComponents => {
    return this.creditData()?.creditComponents ?? {}
  }

  // =========================================================================
  // Part I - Current Year General Business Credits
  // =========================================================================

  // Line 1a: Investment credit (Form 3468)
  l1a = (): number => this.creditComponents().investmentCredit ?? 0

  // Line 1b: Work opportunity credit (Form 5884)
  l1b = (): number => this.creditComponents().workOpportunityCredit ?? 0

  // Line 1c: Biofuel producer credit (Form 6478)
  l1c = (): number => this.creditComponents().alcoholFuelsCredit ?? 0

  // Line 1d: Credit for increasing research activities (Form 6765)
  l1d = (): number => this.creditComponents().researchCredit ?? 0

  // Line 1e: Low-income housing credit (Form 8586)
  l1e = (): number => this.creditComponents().lowIncomeHousingCredit ?? 0

  // Line 1f: Disabled access credit (Form 8826)
  l1f = (): number => this.creditComponents().disabledAccessCredit ?? 0

  // Line 1g: Renewable electricity production credit (Form 8835)
  l1g = (): number => this.creditComponents().renewableElectricityCredit ?? 0

  // Line 1h: Empowerment zone employment credit (Form 8844)
  l1h = (): number => this.creditComponents().empowermentZoneCredit ?? 0

  // Line 1i: Indian employment credit (Form 8845)
  l1i = (): number => this.creditComponents().indianEmploymentCredit ?? 0

  // Line 1j: Orphan drug credit (Form 8820)
  l1j = (): number => this.creditComponents().orphanDrugCredit ?? 0

  // Line 1k: New markets credit (Form 8874)
  l1k = (): number => this.creditComponents().newMarketsCredit ?? 0

  // Line 1l: Credit for employer social security and Medicare taxes paid on tips (Form 8846)
  l1l = (): number => this.creditComponents().creditForEmployerSSOnTips ?? 0

  // Line 1m: Biodiesel and renewable diesel fuels credit (Form 8864)
  l1m = (): number => this.creditComponents().biodieselFuelsCredit ?? 0

  // Line 1n: Credit for small employer pension plan startup costs (Form 8881)
  l1n = (): number => this.creditComponents().smallEmployerPensionStartup ?? 0

  // Line 1o: Employer-provided childcare credit (Form 8882)
  l1o = (): number => this.creditComponents().employerProvidedChildcareCredit ?? 0

  // Line 1p: Employer differential wage credit (Form 8932)
  l1p = (): number => this.creditComponents().differentialWageCredit ?? 0

  // Line 1q: Carbon oxide sequestration credit (Form 8933)
  l1q = (): number => this.creditComponents().carbonOxideSequestration ?? 0

  // Line 1r: Qualified plug-in electric drive motor vehicle credit (Form 8936)
  l1r = (): number => this.creditComponents().qualifiedPlugInCredit ?? 0

  // Line 1s: Credit for small employer health insurance premiums (Form 8941)
  l1s = (): number => this.creditComponents().smallEmployerHealthInsurance ?? 0

  // Line 1t: Other credits
  l1t = (): number => this.creditComponents().otherCredits ?? 0

  // Line 2: Add lines 1a through 1t (total current year credits)
  l2 = (): number => {
    return sumFields([
      this.l1a(), this.l1b(), this.l1c(), this.l1d(), this.l1e(),
      this.l1f(), this.l1g(), this.l1h(), this.l1i(), this.l1j(),
      this.l1k(), this.l1l(), this.l1m(), this.l1n(), this.l1o(),
      this.l1p(), this.l1q(), this.l1r(), this.l1s(), this.l1t()
    ])
  }

  totalCurrentYearCredits = (): number => this.l2()

  // =========================================================================
  // Part II - Allowable Credit
  // =========================================================================

  // Line 3: Carryforward from prior years
  l3 = (): number => this.creditData()?.carryforwardFromPriorYears ?? 0

  // Line 4: Carryback from future years (if applicable)
  l4 = (): number => this.creditData()?.carrybackFromFutureYears ?? 0

  // Line 5: Add lines 2, 3, and 4 (total available credit)
  l5 = (): number => this.l2() + this.l3() + this.l4()

  // Line 6: Regular tax before credits
  l6 = (): number => this.creditData()?.regularTaxLiability ?? this.f1040.l16() ?? 0

  // Line 7: Alternative minimum tax (if applicable)
  l7 = (): number => this.creditData()?.tentativeMinimumTax ?? 0

  // Line 8: Add lines 6 and 7 (net income tax)
  l8 = (): number => this.l6() + this.l7()

  // Line 9: Net regular tax liability (line 6 minus certain credits)
  l9 = (): number => this.creditData()?.netRegularTaxLiability ?? this.l6()

  // Line 10: Tentative minimum tax for purposes of credit limitation
  l10 = (): number => this.l7()

  // Line 11: Net income tax minus certain credits
  l11 = (): number => this.creditData()?.netIncomeTax ?? this.l8()

  // Line 12: Tentative minimum tax
  l12 = (): number => this.l10()

  // Line 13: Subtract line 12 from line 11 (if zero or less, enter -0-)
  l13 = (): number => Math.max(0, this.l11() - this.l12())

  // Line 14: Enter 25% of excess of line 9 over $25,000
  l14 = (): number => {
    const excess = Math.max(0, this.l9() - 25000)
    return Math.round(excess * 0.25)
  }

  // Line 15: Tentative minimum tax (same as line 12)
  l15 = (): number => this.l12()

  // Line 16: Greater of line 14 or line 15
  l16 = (): number => Math.max(this.l14(), this.l15())

  // Line 17: Subtract line 16 from line 13 (credit limitation)
  l17 = (): number => Math.max(0, this.l13() - this.l16())

  // Line 18: Enter smaller of line 5 or line 17 (allowable credit)
  l18 = (): number => Math.min(this.l5(), this.l17())

  // =========================================================================
  // Part III - Tax Liability Limit Based on Amount of Tax
  // =========================================================================

  // Special limitation for specified credits (empowerment zone, etc.)
  specifiedCredits = (): number => {
    // Credits allowed against AMT
    return sumFields([
      this.l1e(),  // Low-income housing
      this.l1h(),  // Empowerment zone
      this.l1k()   // New markets
    ])
  }

  // =========================================================================
  // Results
  // =========================================================================

  // Total allowable credit for Schedule 3
  allowableCredit = (): number => this.l18()

  // Credit to carry forward to next year
  carryforwardToNextYear = (): number => {
    const unused = this.l5() - this.l18()
    return Math.max(0, unused)
  }

  // Credit for Schedule 3, Line 6a
  credit = (): number => this.allowableCredit()

  // =========================================================================
  // Passthrough Credit Summary
  // =========================================================================

  /**
   * For pass-through entities (S-Corps, partnerships), the credit
   * flows through to shareholders/partners on Schedule K-1
   */
  scheduleK1Credit = (): number => {
    // Would be allocated based on ownership percentage
    return this.totalCurrentYearCredits()
  }

  // =========================================================================
  // PDF Fields
  // =========================================================================

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Part I - Current Year Credits
    this.l1a(),
    this.l1b(),
    this.l1c(),
    this.l1d(),
    this.l1e(),
    this.l1f(),
    this.l1g(),
    this.l1h(),
    this.l1i(),
    this.l1j(),
    this.l1k(),
    this.l1l(),
    this.l1m(),
    this.l1n(),
    this.l1o(),
    this.l1p(),
    this.l1q(),
    this.l1r(),
    this.l1s(),
    this.l1t(),
    this.l2(),
    // Part II - Allowable Credit
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
    this.l17(),
    this.l18(),
    // Carryforward
    this.carryforwardToNextYear()
  ]
}
