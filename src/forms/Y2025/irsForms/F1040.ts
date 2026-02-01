import {
  AccountType,
  Dependent,
  FilingStatus,
  IncomeW2,
  PersonRole,
  PlanType1099,
  Asset
} from 'ustaxes/core/data'
import federalBrackets, { CURRENT_YEAR } from '../data/federal'
import F4972 from './F4972'
import F5695 from './F5695'
import F8814 from './F8814'
import F8888 from './F8888'
import F8889 from './F8889'
import F8910 from './F8910'
import F8936 from './F8936'
import F8959 from './F8959'
import F8995, { getF8995PhaseOutIncome } from './F8995'
import F8995A from './F8995A'
import Schedule1 from './Schedule1'
import Schedule1A from './Schedule1A'
import Schedule2 from './Schedule2'
import Schedule3 from './Schedule3'
import Schedule8812 from './Schedule8812'
import ScheduleA from './ScheduleA'
import ScheduleD from './ScheduleD'
import ScheduleE from './ScheduleE'
import ScheduleSE from './ScheduleSE'
import ScheduleEIC from './ScheduleEIC'
import ScheduleR from './ScheduleR'
import Form, { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import ScheduleB from './ScheduleB'
import { computeOrdinaryTax } from './TaxTable'
import SDQualifiedAndCapGains from './worksheets/SDQualifiedAndCapGains'
import QualifyingDependents from './worksheets/QualifyingDependents'
import SocialSecurityBenefitsWorksheet from './worksheets/SocialSecurityBenefits'
import F4797 from './F4797'
import StudentLoanInterestWorksheet from './worksheets/StudentLoanInterestWorksheet'
import F1040V from './F1040v'
import _ from 'lodash'
import F8960 from './F8960'
import F4952 from './F4952'
import F2555 from './F2555'
import F4563 from './F4563'
import F8863 from './F8863'
import F8962 from './F8962'
import F4136 from './F4136'
import F2439 from './F2439'
import F2441 from './F2441'
import ScheduleC from './ScheduleC'
import F8949 from './F8949'
import F6251 from './F6251'
import F4137 from './F4137'
import F8919 from './F8919'
import F8853 from './F8853'
import F8582 from './F8582'
import F4547 from './F4547' // OBBBA 2025: Trump Account Elections
// Phase 1: High-Priority Forms
import F8880 from './F8880' // Saver's Credit
import F1116 from './F1116' // Foreign Tax Credit
import F8606 from './F8606' // Nondeductible IRAs
import F5329 from './F5329' // Additional Taxes on Retirement Plans
import F8615 from './F8615' // Kiddie Tax
import F8801 from './F8801' // Prior Year AMT Credit
import F2210 from './F2210' // Underpayment Penalty
import F4868 from './F4868' // Extension Request
import F8839 from './F8839' // Adoption Credit
import F1040ES from './F1040ES' // Estimated Tax for Individuals
import F2106 from './F2106' // Employee Business Expenses
// Phase 2: Medium-Priority Forms
import ScheduleF from './ScheduleF' // Farm Income
import ScheduleH from './ScheduleH' // Household Employment Taxes
import F4562 from './F4562' // Depreciation and Amortization
import F6252 from './F6252' // Installment Sales
import F8824 from './F8824' // Like-Kind Exchanges
import F4684 from './F4684' // Casualties and Thefts
// Phase 3: Specialized Forms
import F8829 from './F8829' // Business Use of Home
import F6198 from './F6198' // At-Risk Limitations
import F3903 from './F3903' // Moving Expenses (Military)
import F8938 from './F8938' // FATCA Foreign Financial Assets
import ScheduleJ from './ScheduleJ' // Farm Income Averaging
// Phase 4: Collection, Credits, Foreign Forms
import F9465 from './F9465' // Installment Agreement Request
import F8379 from './F8379' // Injured Spouse Allocation
import F8862 from './F8862' // Credits After Disallowance
import F8582CR from './F8582CR' // Passive Activity Credit Limitations
import F8833 from './F8833' // Treaty-Based Return Position
import F8843 from './F8843' // Statement for Exempt Individuals
import F8840 from './F8840' // Closer Connection Exception
import F8915F from './F8915F' // Qualified Disaster Distributions
import F4255 from './F4255' // Recapture of Investment Credit
// Phase 5: Additional Forms
import F8941 from './F8941' // Small Employer Health Insurance Credit
import F8810 from './F8810' // Corporate Passive Activity Loss
import F7004 from './F7004' // Business Extension
import F843 from './F843' // Claim for Refund
import F8868 from './F8868' // Exempt Organization Extension
import F2350 from './F2350' // Extension for Citizens Abroad
// Phase 6: Collection & Information Returns
import F8809 from './F8809' // Information Return Extension
import F433A from './F433A' // Collection Statement for Individuals
import F433B from './F433B' // Collection Statement for Businesses
// Phase 7: Foreign Forms & Retirement Plans
import F656 from './F656' // Offer in Compromise
import F5471 from './F5471' // Foreign Corporation Information Return
import F5472 from './F5472' // Foreign-Owned US Corporation
import F8865 from './F8865' // Foreign Partnership
import F8966 from './F8966' // FATCA Certification
import F5500 from './F5500' // Employee Benefit Plan
import F5500EZ from './F5500EZ' // One-Participant Plan
import F5330 from './F5330' // Excise Taxes on Retirement Plans
// Phase 8: 1040 Variants
import F1040SR from './F1040SR' // Senior Return
import F1040NR from './F1040NR' // Non-Resident Alien Return
import F1040SS from './F1040SS' // Self-Employment Tax for Territories
// Phase 9: Estate, Gift, Fiduciary, and Exempt Organization Forms
import F706 from './F706' // Estate Tax Return
import F709 from './F709' // Gift Tax Return
import F1041 from './F1041' // Fiduciary Income Tax Return
import F990 from './F990' // Exempt Organization Return
import F990EZ from './F990EZ' // Short Form Exempt Organization
import F990T from './F990T' // Exempt Organization Business Income Tax
import F990PF from './F990PF' // Private Foundation Return
import FinCEN114 from './FinCEN114' // FBAR Report
// Phase 10: Additional International Forms
import F3520 from './F3520' // Foreign Trusts and Gifts
import F3520A from './F3520A' // Foreign Trust Annual Return
import F8621 from './F8621' // PFIC Annual Information
import F8858 from './F8858' // Foreign Disregarded Entity
import F926 from './F926' // Return of Transferred Property to Foreign Corp
// Phase 11: Business Entity Schedules
import ScheduleK1065 from './ScheduleK1065' // Partners' Distributive Share (1065)
import ScheduleK1120S from './ScheduleK1120S' // Shareholders' Pro Rata Share (1120-S)
import ScheduleL from './ScheduleL' // Balance Sheets
import ScheduleM1 from './ScheduleM1' // Book-to-Tax Reconciliation
import Schedule990A from './Schedule990A' // Public Charity Status (990)
import ScheduleK1_1041 from './ScheduleK1_1041' // Beneficiary's Share (1041)
import F8283 from './F8283' // Noncash Charitable Contributions
// Phase 12: Additional Business Entity Schedules
import ScheduleM3 from './ScheduleM3' // Net Income Reconciliation (Large Entities)
import ScheduleD1120 from './ScheduleD1120' // Corporate Capital Gains/Losses
import ScheduleC1120 from './ScheduleC1120' // Dividends Received Deduction
import ScheduleE1120 from './ScheduleE1120' // Compensation of Officers
import ScheduleJ1120 from './ScheduleJ1120' // Corporate Tax Computation
import ScheduleB1065 from './ScheduleB1065' // Partnership Other Information
// Phase 13: Form 990 Schedules (Non-Profit)
import Schedule990B from './Schedule990B' // Schedule of Contributors
import Schedule990C from './Schedule990C' // Political Campaign and Lobbying Activities
import Schedule990D from './Schedule990D' // Supplemental Financial Statements
import Schedule990G from './Schedule990G' // Fundraising and Gaming Activities
import Schedule990J from './Schedule990J' // Compensation Information
import Schedule990O from './Schedule990O' // Supplemental Information
import Schedule990R from './Schedule990R' // Related Organizations
// Phase 14: Form 1041 Schedules (Estates and Trusts)
import Schedule1041A from './Schedule1041A' // Charitable Deduction
import Schedule1041B from './Schedule1041B' // Income Distribution Deduction
import Schedule1041D from './Schedule1041D' // Capital Gains and Losses
import Schedule1041G from './Schedule1041G' // Tax Computation and Payments
import Schedule1041I from './Schedule1041I' // Alternative Minimum Tax
import Schedule1041J from './Schedule1041J' // Accumulation Distribution
// Phase 15: Additional Tax Forms
import F990N from './F990N' // e-Postcard for Small Exempt Organizations
import F4720 from './F4720' // Excise Taxes on Private Foundations
import F941X from './F941X' // Adjusted Employment Tax Return
import F943X from './F943X' // Adjusted Agricultural Employment Tax
import F944X from './F944X' // Adjusted Annual Employment Tax
import F945X from './F945X' // Adjusted Withholding Return
import F1040X from './F1040X' // Amended Individual Return
import F1041A from './F1041A' // Trust Charitable Amounts
import F1041ES from './F1041ES' // Estimated Tax for Estates/Trusts
// Phase 16: Additional Form 990 Schedules
import Schedule990F from './Schedule990F' // Foreign Activities
import Schedule990I from './Schedule990I' // Domestic Grants
import Schedule990K from './Schedule990K' // Tax-Exempt Bonds
import Schedule990L from './Schedule990L' // Interested Persons Transactions
import Schedule990M from './Schedule990M' // Noncash Contributions
import Schedule990N from './Schedule990N' // Liquidation/Dissolution
// Phase 17: 1099 Series and Authorization Forms
import F1099MISC from './F1099MISC' // Miscellaneous Income
import F1099NEC from './F1099NEC' // Nonemployee Compensation
import F1099K from './F1099K' // Payment Card Transactions
import F2848 from './F2848' // Power of Attorney
import F8821 from './F8821' // Tax Information Authorization
import F8879 from './F8879' // IRS e-file Signature Authorization
import F8332 from './F8332' // Release of Claim to Exemption
import F8453 from './F8453' // E-file Transmittal
// Phase 18: Additional 1099 Series
import F1099B from './F1099B' // Broker Proceeds
import F1099DIV from './F1099DIV' // Dividends and Distributions
import F1099INT from './F1099INT' // Interest Income
import F1099R from './F1099R' // Retirement Distributions
import F1099G from './F1099G' // Government Payments
import F1099S from './F1099S' // Real Estate Transactions
import F1099C from './F1099C' // Cancellation of Debt
import F1099Q from './F1099Q' // Qualified Education Programs
import F1099SA from './F1099SA' // HSA/MSA Distributions
// Phase 19: Withholding and Application Forms
import W4 from './W4' // Employee's Withholding Certificate
import W9 from './W9' // Request for Taxpayer ID
import SS4 from './SS4' // Application for EIN
// Phase 20: Remaining 1099 Series and Specialized Forms
import W2G from './W2G' // Gambling Winnings
import F1099A from './F1099A' // Acquisition or Abandonment
import F1099LTC from './F1099LTC' // Long-Term Care Benefits
import F56 from './F56' // Notice Concerning Fiduciary Relationship
import F8822 from './F8822' // Change of Address
import F8958 from './F8958' // Community Property Allocation
import F8857 from './F8857' // Innocent Spouse Relief
import F4506 from './F4506' // Request for Copy of Tax Return
import F4506T from './F4506T' // Request for Transcript
import F8867 from './F8867' // Paid Preparer's Due Diligence
import W2c from './W2c' // Corrected W-2
import F8948 from './F8948' // Preparer Explanation for Not Filing Electronically
import F8508 from './F8508' // Request for Waiver From Filing Info Returns
import F8822B from './F8822B' // Change of Address (Business)
// Phase 10: Business Credits (General Business Credit components)
import F3468 from './F3468' // Investment Credit
import F3800 from './F3800' // General Business Credit
import F5884 from './F5884' // Work Opportunity Credit
import F6765 from './F6765' // Research Credit
import F8586 from './F8586' // Low-Income Housing Credit
import F8820 from './F8820' // Orphan Drug Credit
import F8826 from './F8826' // Disabled Access Credit
import F8835 from './F8835' // Renewable Electricity Credit
import F8844 from './F8844' // Empowerment Zone Employment Credit
import F8845 from './F8845' // Indian Employment Credit
import F8846 from './F8846' // Employer-Provided Childcare Credit
import F8864 from './F8864' // Biodiesel and Renewable Diesel Credit
import F8874 from './F8874' // New Markets Credit
import F8881 from './F8881' // Small Employer Pension Startup Credit
import F8882 from './F8882' // Credit for Employer Social Security
import F8932 from './F8932' // Employer Differential Wage Payment Credit
import F8933 from './F8933' // Carbon Oxide Sequestration Credit
import F8994 from './F8994' // Paid Family and Medical Leave Credit
import { Field } from 'ustaxes/core/pdfFiller'
import F1040Base, { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040Attachment from './F1040Attachment'

export default class F1040 extends F1040Base {
  tag: FormTag = 'f1040'
  sequenceIndex = 0

  assets: Asset<Date>[]

  schedule1: Schedule1
  schedule1A: Schedule1A // OBBBA 2025: Additional Deductions
  schedule2: Schedule2
  schedule3: Schedule3
  scheduleA: ScheduleA
  scheduleB: ScheduleB
  scheduleC?: ScheduleC
  scheduleD: ScheduleD
  scheduleE: ScheduleE
  scheduleSE: ScheduleSE
  scheduleEIC: ScheduleEIC
  scheduleR?: ScheduleR
  schedule8812: Schedule8812
  f2439?: F2439
  f2441?: F2441
  f2555?: F2555
  f4136?: F4136
  f4137?: F4137
  f4563?: F4563
  f4797?: F4797
  f4952?: F4952
  f4972?: F4972
  f5695?: F5695
  f6251: F6251
  f8814?: F8814
  f8582?: F8582
  f8853?: F8853
  f8863?: F8863
  f8888?: F8888
  f8889: F8889
  f8889Spouse?: F8889
  f8910?: F8910
  f8919?: F8919
  f8936?: F8936
  f8949: F8949
  _f8949s?: F8949[]
  f8959: F8959
  f8960: F8960
  f8962?: F8962
  f8995?: F8995 | F8995A
  f4547?: F4547 // OBBBA 2025: Trump Account Elections
  // Phase 1: High-Priority Forms
  f8880?: F8880 // Saver's Credit
  f1116?: F1116 // Foreign Tax Credit
  f8606?: F8606 // Nondeductible IRAs
  f5329?: F5329 // Additional Taxes on Retirement Plans
  f8615?: F8615 // Kiddie Tax
  f8801?: F8801 // Prior Year AMT Credit
  f2210?: F2210 // Underpayment Penalty
  f4868?: F4868 // Extension Request
  f8839?: F8839 // Adoption Credit
  f1040es?: F1040ES // Estimated Tax for Individuals
  f2106?: F2106 // Employee Business Expenses
  // Phase 2: Medium-Priority Forms
  scheduleF?: ScheduleF // Farm Income
  scheduleH?: ScheduleH // Household Employment Taxes
  f4562?: F4562 // Depreciation and Amortization
  f6252?: F6252 // Installment Sales
  f8824?: F8824 // Like-Kind Exchanges
  f4684?: F4684 // Casualties and Thefts
  // Phase 3: Specialized Forms
  f8829?: F8829 // Business Use of Home
  f6198?: F6198 // At-Risk Limitations
  f3903?: F3903 // Moving Expenses (Military)
  f8938?: F8938 // FATCA Foreign Financial Assets
  scheduleJ?: ScheduleJ // Farm Income Averaging
  // Phase 4: Collection, Credits, Foreign Forms
  f9465?: F9465 // Installment Agreement Request
  f8379?: F8379 // Injured Spouse Allocation
  f8862?: F8862 // Credits After Disallowance
  f8582cr?: F8582CR // Passive Activity Credit Limitations
  f8833?: F8833 // Treaty-Based Return Position
  f8843?: F8843 // Statement for Exempt Individuals
  f8840?: F8840 // Closer Connection Exception
  f8915f?: F8915F // Qualified Disaster Distributions
  f4255?: F4255 // Recapture of Investment Credit
  // Phase 5: Additional Forms
  f8941?: F8941 // Small Employer Health Insurance Credit
  f8810?: F8810 // Corporate Passive Activity Loss
  f7004?: F7004 // Business Extension
  f843?: F843 // Claim for Refund
  f8868?: F8868 // Exempt Organization Extension
  f2350?: F2350 // Extension for Citizens Abroad
  // Phase 6: Collection & Information Returns
  f8809?: F8809 // Information Return Extension
  f433a?: F433A // Collection Statement for Individuals
  f433b?: F433B // Collection Statement for Businesses
  // Phase 7: Foreign Forms & Retirement Plans
  f656?: F656 // Offer in Compromise
  f5471?: F5471 // Foreign Corporation Information Return
  f5472?: F5472 // Foreign-Owned US Corporation
  f8865?: F8865 // Foreign Partnership
  f8966?: F8966 // FATCA Certification
  f5500?: F5500 // Employee Benefit Plan
  f5500ez?: F5500EZ // One-Participant Plan
  f5330?: F5330 // Excise Taxes on Retirement Plans
  // Phase 8: 1040 Variants
  f1040sr?: F1040SR // Senior Return
  f1040nr?: F1040NR // Non-Resident Alien Return
  f1040ss?: F1040SS // Self-Employment Tax for Territories
  // Phase 9: Estate, Gift, Fiduciary, and Exempt Organization Forms
  f706?: F706 // Estate Tax Return
  f709?: F709 // Gift Tax Return
  f1041?: F1041 // Fiduciary Income Tax Return
  f990?: F990 // Exempt Organization Return
  f990ez?: F990EZ // Short Form Exempt Organization
  f990t?: F990T // Exempt Organization Business Income Tax
  f990pf?: F990PF // Private Foundation Return
  fincen114?: FinCEN114 // FBAR Report
  // Phase 10: Additional International Forms
  f3520?: F3520 // Foreign Trusts and Gifts
  f3520a?: F3520A // Foreign Trust Annual Return
  f8621?: F8621 // PFIC Annual Information
  f8858?: F8858 // Foreign Disregarded Entity
  f926?: F926 // Return of Transferred Property to Foreign Corp
  // Phase 11: Business Entity Schedules
  scheduleK1065?: ScheduleK1065 // Partners' Distributive Share (1065)
  scheduleK1120S?: ScheduleK1120S // Shareholders' Pro Rata Share (1120-S)
  scheduleL?: ScheduleL // Balance Sheets
  scheduleM1?: ScheduleM1 // Book-to-Tax Reconciliation
  schedule990A?: Schedule990A // Public Charity Status (990)
  scheduleK1_1041?: ScheduleK1_1041 // Beneficiary's Share (1041)
  f8283?: F8283 // Noncash Charitable Contributions
  // Phase 12: Additional Business Entity Schedules
  scheduleM3?: ScheduleM3 // Net Income Reconciliation (Large Entities)
  scheduleD1120?: ScheduleD1120 // Corporate Capital Gains/Losses
  scheduleC1120?: ScheduleC1120 // Dividends Received Deduction
  scheduleE1120?: ScheduleE1120 // Compensation of Officers
  scheduleJ1120?: ScheduleJ1120 // Corporate Tax Computation
  scheduleB1065?: ScheduleB1065 // Partnership Other Information
  // Phase 13: Form 990 Schedules (Non-Profit)
  schedule990B?: Schedule990B // Schedule of Contributors
  schedule990C?: Schedule990C // Political Campaign and Lobbying Activities
  schedule990D?: Schedule990D // Supplemental Financial Statements
  schedule990G?: Schedule990G // Fundraising and Gaming Activities
  schedule990J?: Schedule990J // Compensation Information
  schedule990O?: Schedule990O // Supplemental Information
  schedule990R?: Schedule990R // Related Organizations
  // Phase 14: Form 1041 Schedules (Estates and Trusts)
  schedule1041A?: Schedule1041A // Charitable Deduction
  schedule1041B?: Schedule1041B // Income Distribution Deduction
  schedule1041D?: Schedule1041D // Capital Gains and Losses
  schedule1041G?: Schedule1041G // Tax Computation and Payments
  schedule1041I?: Schedule1041I // Alternative Minimum Tax
  schedule1041J?: Schedule1041J // Accumulation Distribution
  // Phase 15: Additional Tax Forms
  f990n?: F990N // e-Postcard for Small Exempt Organizations
  f4720?: F4720 // Excise Taxes on Private Foundations
  f941x?: F941X // Adjusted Employment Tax Return
  f943x?: F943X // Adjusted Agricultural Employment Tax
  f944x?: F944X // Adjusted Annual Employment Tax
  f945x?: F945X // Adjusted Withholding Return
  f1040x?: F1040X // Amended Individual Return
  f1041a?: F1041A // Trust Charitable Amounts
  f1041es?: F1041ES // Estimated Tax for Estates/Trusts
  // Phase 16: Additional Form 990 Schedules
  schedule990F?: Schedule990F // Foreign Activities
  schedule990I?: Schedule990I // Domestic Grants
  schedule990K?: Schedule990K // Tax-Exempt Bonds
  schedule990L?: Schedule990L // Interested Persons Transactions
  schedule990M?: Schedule990M // Noncash Contributions
  schedule990N?: Schedule990N // Liquidation/Dissolution
  // Phase 17: 1099 Series and Authorization Forms
  f1099misc?: F1099MISC // Miscellaneous Income
  f1099nec?: F1099NEC // Nonemployee Compensation
  f1099k?: F1099K // Payment Card Transactions
  f2848?: F2848 // Power of Attorney
  f8821?: F8821 // Tax Information Authorization
  f8879?: F8879 // IRS e-file Signature Authorization
  f8332?: F8332 // Release of Claim to Exemption
  f8453?: F8453 // E-file Transmittal
  // Phase 18: Additional 1099 Series
  f1099b?: F1099B // Broker Proceeds
  f1099div?: F1099DIV // Dividends and Distributions
  f1099int?: F1099INT // Interest Income
  f1099r?: F1099R // Retirement Distributions
  f1099g?: F1099G // Government Payments
  f1099s?: F1099S // Real Estate Transactions
  f1099c?: F1099C // Cancellation of Debt
  f1099q?: F1099Q // Qualified Education Programs
  f1099sa?: F1099SA // HSA/MSA Distributions
  // Phase 19: Withholding and Application Forms
  w4?: W4 // Employee's Withholding Certificate
  w9?: W9 // Request for Taxpayer ID
  ss4?: SS4 // Application for EIN
  // Phase 20: Remaining 1099 Series and Specialized Forms
  w2g?: W2G // Gambling Winnings
  f1099a?: F1099A // Acquisition or Abandonment
  f1099ltc?: F1099LTC // Long-Term Care Benefits
  f56?: F56 // Notice Concerning Fiduciary Relationship
  f8822?: F8822 // Change of Address
  f8958?: F8958 // Community Property Allocation
  f8857?: F8857 // Innocent Spouse Relief
  f4506?: F4506 // Request for Copy of Tax Return
  f4506t?: F4506T // Request for Transcript
  f8867?: F8867 // Paid Preparer's Due Diligence
  w2c?: W2c // Corrected W-2
  f8948?: F8948 // Preparer Explanation for Not Filing Electronically
  f8508?: F8508 // Request for Waiver From Filing Info Returns
  f8822b?: F8822B // Change of Address (Business)
  // Phase 10: Business Credits
  f3468?: F3468 // Investment Credit
  f3800?: F3800 // General Business Credit
  f5884?: F5884 // Work Opportunity Credit
  f6765?: F6765 // Research Credit
  f8586?: F8586 // Low-Income Housing Credit
  f8820?: F8820 // Orphan Drug Credit
  f8826?: F8826 // Disabled Access Credit
  f8835?: F8835 // Renewable Electricity Credit
  f8844?: F8844 // Empowerment Zone Employment Credit
  f8845?: F8845 // Indian Employment Credit
  f8846?: F8846 // Employer-Provided Childcare Credit
  f8864?: F8864 // Biodiesel and Renewable Diesel Credit
  f8874?: F8874 // New Markets Credit
  f8881?: F8881 // Small Employer Pension Startup Credit
  f8882?: F8882 // Credit for Employer Social Security
  f8932?: F8932 // Employer Differential Wage Payment Credit
  f8933?: F8933 // Carbon Oxide Sequestration Credit
  f8994?: F8994 // Paid Family and Medical Leave Credit
  qualifiedAndCapGainsWorksheet?: SDQualifiedAndCapGains
  studentLoanInterestWorksheet?: StudentLoanInterestWorksheet
  socialSecurityBenefitsWorksheet?: SocialSecurityBenefitsWorksheet

  qualifyingDependents: QualifyingDependents

  constructor(info: ValidatedInformation, assets: Asset<Date>[]) {
    super(info)
    this.assets = assets
    this.qualifyingDependents = new QualifyingDependents(this)

    this.scheduleA = new ScheduleA(this)
    this.scheduleB = new ScheduleB(this)
    this.scheduleD = new ScheduleD(this)
    this.scheduleE = new ScheduleE(this)
    this.scheduleEIC = new ScheduleEIC(this)
    this.scheduleSE = new ScheduleSE(this)

    this.schedule1 = new Schedule1(this)
    this.schedule1A = new Schedule1A(this) // OBBBA 2025: Additional Deductions
    this.schedule2 = new Schedule2(this)
    this.schedule3 = new Schedule3(this)
    this.schedule8812 = new Schedule8812(this)
    this.scheduleC = new ScheduleC(this) // Self-employment income
    this.scheduleR = new ScheduleR(this) // Credit for Elderly/Disabled
    this.f8863 = new F8863(this) // Education Credits
    this.f4797 = new F4797(this) // Sale of Business Property
    this.f4952 = new F4952(this) // Investment Interest Expense
    this.f4972 = new F4972(this) // Tax on Lump-Sum Distributions
    this.f5695 = new F5695(this) // Residential Energy Credits
    this.f8814 = new F8814(this) // Child's Interest and Dividends
    this.f8888 = new F8888(this) // Direct Deposit of Refund
    this.f8910 = new F8910(this) // Alternative Motor Vehicle Credit
    this.f8936 = new F8936(this) // Clean Vehicle Credit

    this.f6251 = new F6251(this)
    this.f8949 = new F8949(this)
    this.f8889 = new F8889(this, this.info.taxPayer.primaryPerson)

    // add in separate form 8889 for the spouse
    if (this.info.taxPayer.spouse) {
      this.f8889Spouse = new F8889(this, this.info.taxPayer.spouse)
    }

    this.f8959 = new F8959(this)
    this.f8960 = new F8960(this)

    if (this.f1099ssas().length > 0) {
      const ssws = new SocialSecurityBenefitsWorksheet(this)
      this.socialSecurityBenefitsWorksheet = ssws
    }

    if (this.info.f1098es.length > 0) {
      this.studentLoanInterestWorksheet = new StudentLoanInterestWorksheet(
        this,
        this.info.f1098es
      )
    }

    if (this.totalQbi() > 0) {
      const formAMinAmount = getF8995PhaseOutIncome(
        this.info.taxPayer.filingStatus
      )
      if (this.l11() - this.l12() >= formAMinAmount) {
        this.f8995 = new F8995A(this)
      } else {
        this.f8995 = new F8995(this)
      }
    }

    // OBBBA 2025: Trump Account Elections
    if (
      this.info.trumpSavingsAccounts &&
      this.info.trumpSavingsAccounts.length > 0
    ) {
      this.f4547 = new F4547(this)
    }

    // Phase 1: High-Priority Forms - Always instantiate (isNeeded checks internally)
    this.f8880 = new F8880(this)
    this.f1116 = new F1116(this)
    this.f8606 = new F8606(this)
    this.f5329 = new F5329(this)
    this.f8615 = new F8615(this)
    this.f8801 = new F8801(this)
    this.f2210 = new F2210(this)
    this.f4868 = new F4868(this)
    this.f8839 = new F8839(this)
    this.f1040es = new F1040ES(this)
    this.f2106 = new F2106(this)

    // Phase 2: Medium-Priority Forms
    this.scheduleF = new ScheduleF(this)
    this.scheduleH = new ScheduleH(this)
    this.f4562 = new F4562(this)
    this.f6252 = new F6252(this)
    this.f8824 = new F8824(this)
    this.f4684 = new F4684(this)

    // Phase 3: Specialized Forms
    this.f8829 = new F8829(this)
    this.f6198 = new F6198(this)
    this.f3903 = new F3903(this)
    this.f8938 = new F8938(this)
    this.scheduleJ = new ScheduleJ(this)

    // Phase 4: Collection, Credits, Foreign Forms
    this.f9465 = new F9465(this)
    this.f8379 = new F8379(this)
    this.f8862 = new F8862(this)
    this.f8582cr = new F8582CR(this)
    this.f8833 = new F8833(this)
    this.f8843 = new F8843(this)
    this.f8840 = new F8840(this)
    this.f8915f = new F8915F(this)
    this.f4255 = new F4255(this)

    // Phase 5: Additional Forms
    this.f8941 = new F8941(this)
    this.f8810 = new F8810(this)
    this.f7004 = new F7004(this)
    this.f843 = new F843(this)
    this.f8868 = new F8868(this)
    this.f2350 = new F2350(this)

    // Phase 6: Collection & Information Returns
    this.f8809 = new F8809(this)
    this.f433a = new F433A(this)
    this.f433b = new F433B(this)

    // Phase 7: Foreign Forms & Retirement Plans
    this.f656 = new F656(this)
    this.f5471 = new F5471(this)
    this.f5472 = new F5472(this)
    this.f8865 = new F8865(this)
    this.f8966 = new F8966(this)
    this.f5500 = new F5500(this)
    this.f5500ez = new F5500EZ(this)
    this.f5330 = new F5330(this)

    // Phase 8: 1040 Variants
    this.f1040sr = new F1040SR(this)
    this.f1040nr = new F1040NR(this)
    this.f1040ss = new F1040SS(this)

    // Phase 9: Estate, Gift, Fiduciary, and Exempt Organization Forms
    this.f706 = new F706(this)
    this.f709 = new F709(this)
    this.f1041 = new F1041(this)
    this.f990 = new F990(this)
    this.f990ez = new F990EZ(this)
    this.f990t = new F990T(this)
    this.f990pf = new F990PF(this)
    this.fincen114 = new FinCEN114(this)

    // Phase 10: Additional International Forms
    this.f3520 = new F3520(this)
    this.f3520a = new F3520A(this)
    this.f8621 = new F8621(this)
    this.f8858 = new F8858(this)
    this.f926 = new F926(this)

    // Phase 11: Business Entity Schedules
    this.scheduleK1065 = new ScheduleK1065(this)
    this.scheduleK1120S = new ScheduleK1120S(this)
    this.scheduleL = new ScheduleL(this)
    this.scheduleM1 = new ScheduleM1(this)
    this.schedule990A = new Schedule990A(this)
    this.scheduleK1_1041 = new ScheduleK1_1041(this)
    this.f8283 = new F8283(this)

    // Phase 12: Additional Business Entity Schedules
    this.scheduleM3 = new ScheduleM3(this)
    this.scheduleD1120 = new ScheduleD1120(this)
    this.scheduleC1120 = new ScheduleC1120(this)
    this.scheduleE1120 = new ScheduleE1120(this)
    this.scheduleJ1120 = new ScheduleJ1120(this)
    this.scheduleB1065 = new ScheduleB1065(this)

    // Phase 13: Form 990 Schedules (Non-Profit)
    this.schedule990B = new Schedule990B(this)
    this.schedule990C = new Schedule990C(this)
    this.schedule990D = new Schedule990D(this)
    this.schedule990G = new Schedule990G(this)
    this.schedule990J = new Schedule990J(this)
    this.schedule990O = new Schedule990O(this)
    this.schedule990R = new Schedule990R(this)

    // Phase 14: Form 1041 Schedules (Estates and Trusts)
    this.schedule1041A = new Schedule1041A(this)
    this.schedule1041B = new Schedule1041B(this)
    this.schedule1041D = new Schedule1041D(this)
    this.schedule1041G = new Schedule1041G(this)
    this.schedule1041I = new Schedule1041I(this)
    this.schedule1041J = new Schedule1041J(this)

    // Phase 15: Additional Tax Forms
    this.f990n = new F990N(this)
    this.f4720 = new F4720(this)
    this.f941x = new F941X(this)
    this.f943x = new F943X(this)
    this.f944x = new F944X(this)
    this.f945x = new F945X(this)
    this.f1040x = new F1040X(this)
    this.f1041a = new F1041A(this)
    this.f1041es = new F1041ES(this)

    // Phase 16: Additional Form 990 Schedules
    this.schedule990F = new Schedule990F(this)
    this.schedule990I = new Schedule990I(this)
    this.schedule990K = new Schedule990K(this)
    this.schedule990L = new Schedule990L(this)
    this.schedule990M = new Schedule990M(this)
    this.schedule990N = new Schedule990N(this)

    // Phase 17: 1099 Series and Authorization Forms
    this.f1099misc = new F1099MISC(this)
    this.f1099nec = new F1099NEC(this)
    this.f1099k = new F1099K(this)
    this.f2848 = new F2848(this)
    this.f8821 = new F8821(this)
    this.f8879 = new F8879(this)
    this.f8332 = new F8332(this)
    this.f8453 = new F8453(this)

    // Phase 18: Additional 1099 Series
    this.f1099b = new F1099B(this)
    this.f1099div = new F1099DIV(this)
    this.f1099int = new F1099INT(this)
    this.f1099r = new F1099R(this)
    this.f1099g = new F1099G(this)
    this.f1099s = new F1099S(this)
    this.f1099c = new F1099C(this)
    this.f1099q = new F1099Q(this)
    this.f1099sa = new F1099SA(this)

    // Phase 19: Withholding and Application Forms
    this.w4 = new W4(this)
    this.w9 = new W9(this)
    this.ss4 = new SS4(this)

    // Phase 20: Remaining 1099 Series and Specialized Forms
    this.w2g = new W2G(this)
    this.f1099a = new F1099A(this)
    this.f1099ltc = new F1099LTC(this)
    this.f56 = new F56(this)
    this.f8822 = new F8822(this)
    this.f8958 = new F8958(this)
    this.f8857 = new F8857(this)
    this.f4506 = new F4506(this)
    this.f4506t = new F4506T(this)
    this.f8867 = new F8867(this)
    this.w2c = new W2c(this)
    this.f8948 = new F8948(this)
    this.f8508 = new F8508(this)
    this.f8822b = new F8822B(this)

    // Phase 9: Previously Imported but Not Instantiated Forms
    this.f2439 = new F2439(this) // Undistributed Capital Gains
    this.f2441 = new F2441(this) // Child and Dependent Care Credit
    this.f2555 = new F2555(this) // Foreign Earned Income Exclusion
    this.f4136 = new F4136(this) // Credit for Federal Tax Paid on Fuels
    this.f4137 = new F4137(this) // SS/Medicare Tax on Unreported Tips
    this.f4563 = new F4563(this) // Exclusion of Income (American Samoa)
    this.f8582 = new F8582(this) // Passive Activity Loss Limitations
    this.f8853 = new F8853(this) // Archer MSAs and Long-Term Care
    this.f8919 = new F8919(this) // Uncollected SS/Medicare Tax on Wages
    this.f8962 = new F8962(this) // Premium Tax Credit (ACA)

    // Phase 10: Business Credits
    this.f3468 = new F3468(this) // Investment Credit
    this.f3800 = new F3800(this) // General Business Credit
    this.f5884 = new F5884(this) // Work Opportunity Credit
    this.f6765 = new F6765(this) // Research Credit
    this.f8586 = new F8586(this) // Low-Income Housing Credit
    this.f8820 = new F8820(this) // Orphan Drug Credit
    this.f8826 = new F8826(this) // Disabled Access Credit
    this.f8835 = new F8835(this) // Renewable Electricity Credit
    this.f8844 = new F8844(this) // Empowerment Zone Employment Credit
    this.f8845 = new F8845(this) // Indian Employment Credit
    this.f8846 = new F8846(this) // Employer-Provided Childcare Credit
    this.f8864 = new F8864(this) // Biodiesel and Renewable Diesel Credit
    this.f8874 = new F8874(this) // New Markets Credit
    this.f8881 = new F8881(this) // Small Employer Pension Startup Credit
    this.f8882 = new F8882(this) // Credit for Employer Social Security
    this.f8932 = new F8932(this) // Employer Differential Wage Payment Credit
    this.f8933 = new F8933(this) // Carbon Oxide Sequestration Credit
    this.f8994 = new F8994(this) // Paid Family and Medical Leave Credit
  }

  get f8949s(): F8949[] {
    if (this._f8949s === undefined) {
      this._f8949s = [this.f8949, ...this.f8949.copies()]
    }
    return this._f8949s
  }

  totalQbi = () =>
    this.info.scheduleK1Form1065s
      .map((k1) => k1.section199AQBI)
      .reduce((c, a) => c + a, 0)

  toString = (): string => `
    Form 1040 generated from information:
    Information:
    ${JSON.stringify(this.info)}
  `

  // TODO - get from W2 box 12, code Q
  nonTaxableCombatPay = (): number | undefined => undefined

  schedules = (): Form[] => {
    const res1: (F1040Attachment | undefined)[] = [
      this.scheduleA,
      this.scheduleB,
      this.scheduleD,
      this.scheduleE,
      this.scheduleSE,
      this.scheduleR,
      this.scheduleEIC,
      this.schedule8812,
      this.f4797,
      this.f4952,
      this.f4972,
      this.f5695,
      this.f6251,
      this.f8814,
      this.f8888,
      this.f8889,
      this.f8889Spouse,
      this.f8910,
      this.f8936,
      this.f8949,
      this.f8959,
      this.f8960,
      this.f8995,
      this.schedule1,
      this.schedule1A, // OBBBA 2025: Additional Deductions
      this.schedule2,
      this.schedule3,
      this.f4547, // OBBBA 2025: Trump Account Elections
      // Phase 1: High-Priority Forms
      this.f8880, // Saver's Credit
      this.f1116, // Foreign Tax Credit
      this.f8606, // Nondeductible IRAs
      this.f5329, // Additional Taxes on Retirement Plans
      this.f8615, // Kiddie Tax
      this.f8801, // Prior Year AMT Credit
      this.f2210, // Underpayment Penalty
      this.f4868, // Extension Request
      this.f8839, // Adoption Credit
      this.f1040es, // Estimated Tax for Individuals
      this.f2106, // Employee Business Expenses
      // Phase 2: Medium-Priority Forms
      this.scheduleF, // Farm Income
      this.scheduleH, // Household Employment Taxes
      this.f4562, // Depreciation and Amortization
      this.f6252, // Installment Sales
      this.f8824, // Like-Kind Exchanges
      this.f4684, // Casualties and Thefts
      // Phase 3: Specialized Forms
      this.f8829, // Business Use of Home
      this.f6198, // At-Risk Limitations
      this.f3903, // Moving Expenses (Military)
      this.f8938, // FATCA Foreign Financial Assets
      this.scheduleJ, // Farm Income Averaging
      // Phase 4: Collection, Credits, Foreign Forms
      this.f9465, // Installment Agreement Request
      this.f8379, // Injured Spouse Allocation
      this.f8862, // Credits After Disallowance
      this.f8582cr, // Passive Activity Credit Limitations
      this.f8833, // Treaty-Based Return Position
      this.f8843, // Statement for Exempt Individuals
      this.f8840, // Closer Connection Exception
      this.f8915f, // Qualified Disaster Distributions
      this.f4255, // Recapture of Investment Credit
      // Phase 5: Additional Forms
      this.f8941, // Small Employer Health Insurance Credit
      this.f8810, // Corporate Passive Activity Loss
      this.f7004, // Business Extension
      this.f843, // Claim for Refund
      this.f8868, // Exempt Organization Extension
      this.f2350, // Extension for Citizens Abroad
      // Phase 6: Collection & Information Returns
      this.f8809, // Information Return Extension
      this.f433a, // Collection Statement for Individuals
      this.f433b, // Collection Statement for Businesses
      // Phase 7: Foreign Forms & Retirement Plans
      this.f656, // Offer in Compromise
      this.f5471, // Foreign Corporation Information Return
      this.f5472, // Foreign-Owned US Corporation
      this.f8865, // Foreign Partnership
      this.f8966, // FATCA Certification
      this.f5500, // Employee Benefit Plan
      this.f5500ez, // One-Participant Plan
      this.f5330, // Excise Taxes on Retirement Plans
      // Phase 8: 1040 Variants
      this.f1040sr, // Senior Return
      this.f1040nr, // Non-Resident Alien Return
      this.f1040ss, // Self-Employment Tax for Territories
      // Phase 9: Previously Imported but Not Instantiated
      this.f2439, // Undistributed Capital Gains
      this.f2441, // Child and Dependent Care Credit
      this.f2555, // Foreign Earned Income Exclusion
      this.f4136, // Credit for Federal Tax Paid on Fuels
      this.f4137, // SS/Medicare Tax on Unreported Tips
      this.f4563, // Exclusion of Income (American Samoa)
      this.f8582, // Passive Activity Loss Limitations
      this.f8853, // Archer MSAs and Long-Term Care
      this.f8919, // Uncollected SS/Medicare Tax on Wages
      this.f8962, // Premium Tax Credit (ACA)
      this.f8863, // American Opportunity/Lifetime Learning Credit
      // Phase 10: Business Credits
      this.f3468, // Investment Credit
      this.f3800, // General Business Credit
      this.f5884, // Work Opportunity Credit
      this.f6765, // Research Credit
      this.f8586, // Low-Income Housing Credit
      this.f8820, // Orphan Drug Credit
      this.f8826, // Disabled Access Credit
      this.f8835, // Renewable Electricity Credit
      this.f8844, // Empowerment Zone Employment Credit
      this.f8845, // Indian Employment Credit
      this.f8846, // Employer-Provided Childcare Credit
      this.f8864, // Biodiesel and Renewable Diesel Credit
      this.f8874, // New Markets Credit
      this.f8881, // Small Employer Pension Startup Credit
      this.f8882, // Credit for Employer Social Security
      this.f8932, // Employer Differential Wage Payment Credit
      this.f8933, // Carbon Oxide Sequestration Credit
      this.f8994, // Paid Family and Medical Leave Credit
      // Phase 9: Estate, Gift, Fiduciary, and Exempt Organization Forms
      this.f706, // Estate Tax Return
      this.f709, // Gift Tax Return
      this.f1041, // Fiduciary Income Tax Return
      this.f990, // Exempt Organization Return
      this.f990ez, // Short Form Exempt Organization
      this.f990t, // Exempt Organization Business Income Tax
      this.f990pf, // Private Foundation Return
      this.fincen114, // FBAR Report
      // Phase 10: Additional International Forms
      this.f3520, // Foreign Trusts and Gifts
      this.f3520a, // Foreign Trust Annual Return
      this.f8621, // PFIC Annual Information
      this.f8858, // Foreign Disregarded Entity
      this.f926, // Return of Transferred Property to Foreign Corp
      // Phase 11: Business Entity Schedules
      this.scheduleK1065, // Partners' Distributive Share (1065)
      this.scheduleK1120S, // Shareholders' Pro Rata Share (1120-S)
      this.scheduleL, // Balance Sheets
      this.scheduleM1, // Book-to-Tax Reconciliation
      this.schedule990A, // Public Charity Status (990)
      this.scheduleK1_1041, // Beneficiary's Share (1041)
      this.f8283, // Noncash Charitable Contributions
      // Phase 12: Additional Business Entity Schedules
      this.scheduleM3, // Net Income Reconciliation (Large Entities)
      this.scheduleD1120, // Corporate Capital Gains/Losses
      this.scheduleC1120, // Dividends Received Deduction
      this.scheduleE1120, // Compensation of Officers
      this.scheduleJ1120, // Corporate Tax Computation
      this.scheduleB1065, // Partnership Other Information
      // Phase 13: Form 990 Schedules (Non-Profit)
      this.schedule990B, // Schedule of Contributors
      this.schedule990C, // Political Campaign and Lobbying Activities
      this.schedule990D, // Supplemental Financial Statements
      this.schedule990G, // Fundraising and Gaming Activities
      this.schedule990J, // Compensation Information
      this.schedule990O, // Supplemental Information
      this.schedule990R, // Related Organizations
      // Phase 14: Form 1041 Schedules (Estates and Trusts)
      this.schedule1041A, // Charitable Deduction
      this.schedule1041B, // Income Distribution Deduction
      this.schedule1041D, // Capital Gains and Losses
      this.schedule1041G, // Tax Computation and Payments
      this.schedule1041I, // Alternative Minimum Tax
      this.schedule1041J, // Accumulation Distribution
      // Phase 15: Additional Tax Forms
      this.f990n, // e-Postcard for Small Exempt Organizations
      this.f4720, // Excise Taxes on Private Foundations
      this.f941x, // Adjusted Employment Tax Return
      this.f943x, // Adjusted Agricultural Employment Tax
      this.f944x, // Adjusted Annual Employment Tax
      this.f945x, // Adjusted Withholding Return
      this.f1040x, // Amended Individual Return
      this.f1041a, // Trust Charitable Amounts
      this.f1041es, // Estimated Tax for Estates/Trusts
      // Phase 16: Additional Form 990 Schedules
      this.schedule990F, // Foreign Activities
      this.schedule990I, // Domestic Grants
      this.schedule990K, // Tax-Exempt Bonds
      this.schedule990L, // Interested Persons Transactions
      this.schedule990M, // Noncash Contributions
      this.schedule990N, // Liquidation/Dissolution
      // Phase 17: 1099 Series and Authorization Forms
      this.f1099misc, // Miscellaneous Income
      this.f1099nec, // Nonemployee Compensation
      this.f1099k, // Payment Card Transactions
      this.f2848, // Power of Attorney
      this.f8821, // Tax Information Authorization
      this.f8879, // IRS e-file Signature Authorization
      this.f8332, // Release of Claim to Exemption
      this.f8453, // E-file Transmittal
      // Phase 18: Additional 1099 Series
      this.f1099b, // Broker Proceeds
      this.f1099div, // Dividends and Distributions
      this.f1099int, // Interest Income
      this.f1099r, // Retirement Distributions
      this.f1099g, // Government Payments
      this.f1099s, // Real Estate Transactions
      this.f1099c, // Cancellation of Debt
      this.f1099q, // Qualified Education Programs
      this.f1099sa, // HSA/MSA Distributions
      // Phase 19: Withholding and Application Forms
      this.w4, // Employee's Withholding Certificate
      this.w9, // Request for Taxpayer ID
      this.ss4, // Application for EIN
      // Phase 20: Remaining 1099 Series and Specialized Forms
      this.w2g, // Gambling Winnings
      this.f1099a, // Acquisition or Abandonment
      this.f1099ltc, // Long-Term Care Benefits
      this.f56, // Notice Concerning Fiduciary Relationship
      this.f8822, // Change of Address
      this.f8958, // Community Property Allocation
      this.f8857, // Innocent Spouse Relief
      this.f4506, // Request for Copy of Tax Return
      this.f4506t, // Request for Transcript
      this.f8867, // Paid Preparer's Due Diligence
      this.w2c, // Corrected W-2
      this.f8948, // Preparer Explanation for Not Filing Electronically
      this.f8508, // Request for Waiver From Filing Info Returns
      this.f8822b // Change of Address (Business)
    ]
    const res = _.compact(res1)
      .filter((f) => f.isNeeded())
      .flatMap((f) => [f, ...f.copies()])

    // Attach payment voucher to front if there is a payment due
    if (this.l37() > 0) {
      res.push(new F1040V(this))
    }

    return [this, ...res].sort((a, b) => a.sequenceIndex - b.sequenceIndex)
  }

  // born before 1959/01/02
  bornBeforeDate = (): boolean =>
    this.info.taxPayer.primaryPerson.dateOfBirth <
    new Date(CURRENT_YEAR - 64, 0, 2)

  blind = (): boolean => this.info.taxPayer.primaryPerson.isBlind

  spouseBeforeDate = (): boolean =>
    (this.info.taxPayer.spouse?.dateOfBirth ?? new Date()) <
    new Date(CURRENT_YEAR - 64, 0, 2)

  spouseBlind = (): boolean => this.info.taxPayer.spouse?.isBlind ?? false

  validW2s = (): IncomeW2[] => {
    if (this.info.taxPayer.filingStatus === FilingStatus.MFS) {
      return this.info.w2s.filter((w2) => w2.personRole === PersonRole.PRIMARY)
    }
    return this.info.w2s
  }

  wages = (): number => this.validW2s().reduce((res, w2) => res + w2.income, 0)
  medicareWages = (): number =>
    this.validW2s().reduce((res, w2) => res + w2.medicareIncome, 0)

  occupation = (r: PersonRole): string | undefined =>
    this.info.w2s.find((w2) => w2.personRole === r && w2.occupation !== '')
      ?.occupation

  standardDeduction = (): number | undefined => {
    const filingStatus = this.info.taxPayer.filingStatus

    const allowances = [
      this.bornBeforeDate(),
      this.blind(),
      this.spouseBeforeDate(),
      this.spouseBlind()
    ].reduce((res, e) => res + +!!e, 0)

    if (
      this.info.taxPayer.primaryPerson.isTaxpayerDependent ||
      (this.info.taxPayer.spouse?.isTaxpayerDependent ?? false)
    ) {
      const l4a = Math.min(
        federalBrackets.ordinary.status[filingStatus].deductions[0].amount,
        this.wages() > 750 ? this.wages() + 350 : 1100
      )
      if (allowances > 0) {
        if (
          filingStatus === FilingStatus.HOH ||
          filingStatus === FilingStatus.S
        ) {
          return l4a + allowances * 1700
        } else {
          return l4a + allowances * 1350
        }
      } else {
        return l4a
      }
    }

    return federalBrackets.ordinary.status[filingStatus].deductions[allowances]
      .amount
  }

  totalQualifiedDividends = (): number =>
    this.f1099Divs()
      .map((f) => f.form.qualifiedDividends)
      .reduce((l, r) => l + r, 0)

  totalGrossDistributionsFromIra = (): number =>
    this.info.individualRetirementArrangements.reduce(
      (res, i) => res + i.grossDistribution,
      0
    )

  totalTaxableFromIra = (): number =>
    this.info.individualRetirementArrangements.reduce(
      (r, i) => r + i.taxableAmount,
      0
    )

  totalGrossDistributionsFrom1099R = (planType: PlanType1099): number =>
    this.f1099rs()
      .filter((element) => element.form.planType === planType)
      .reduce((res, f1099) => res + f1099.form.grossDistribution, 0)

  totalTaxableFrom1099R = (planType: PlanType1099): number =>
    this.f1099rs()
      .filter((element) => element.form.planType === planType)
      .reduce((res, f1099) => res + f1099.form.taxableAmount, 0)

  l1a = (): number => this.wages()
  l1b = (): number | undefined => undefined
  l1c = (): number | undefined => undefined
  l1d = (): number | undefined => undefined
  l1e = (): number | undefined => undefined
  l1f = (): number | undefined => undefined
  l1g = (): number | undefined => undefined
  l1h = (): number | undefined => undefined
  l1i = (): number | undefined => undefined
  l1z = (): number =>
    sumFields([
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f(),
      this.l1g(),
      this.l1h()
    ])
  l2a = (): number | undefined => this.scheduleB.l3()
  l2b = (): number | undefined => this.scheduleB.to1040l2b()
  l3a = (): number | undefined => this.totalQualifiedDividends()
  l3b = (): number | undefined => this.scheduleB.to1040l3b()
  // This is the value of box 1 in 1099-R forms coming from IRAs
  l4a = (): number | undefined => this.totalGrossDistributionsFromIra()
  // This should be the value of box 2a in 1099-R coming from IRAs
  l4b = (): number | undefined => this.totalTaxableFromIra()
  // This is the value of box 1 in 1099-R forms coming from pensions/annuities
  l5a = (): number | undefined =>
    this.totalGrossDistributionsFrom1099R(PlanType1099.Pension)
  // this is the value of box 2a in 1099-R forms coming from pensions/annuities
  l5b = (): number | undefined =>
    this.totalTaxableFrom1099R(PlanType1099.Pension)
  // The sum of box 5 from SSA-1099
  l6a = (): number | undefined => this.socialSecurityBenefitsWorksheet?.l1()
  // calculation of the taxable amount of line 6a based on other income
  l6b = (): number | undefined =>
    this.socialSecurityBenefitsWorksheet?.taxableAmount()
  // TODO: change this so that it is not hard coded
  l6c = (): boolean => false
  l7Box = (): boolean => !this.scheduleD.isNeeded()
  l7 = (): number | undefined => this.scheduleD.to1040()
  l8 = (): number | undefined => this.schedule1.l10()
  l9 = (): number =>
    sumFields([
      this.l1z(),
      this.l2b(),
      this.l3b(),
      this.l4b(),
      this.l5b(),
      this.l6b(),
      this.l7(),
      this.l8()
    ])

  // OBBBA 2025: Line 10 now includes Schedule 1-A additional deductions
  l10 = (): number | undefined => {
    const schedule1Amount = this.schedule1.to1040Line10()
    const schedule1AAmount = this.schedule1A.isNeeded()
      ? this.schedule1A.to1040()
      : 0
    return schedule1Amount + schedule1AAmount
  }

  l11 = (): number => Math.max(0, this.l9() - (this.l10() ?? 0))

  l12 = (): number => {
    let deduction: number
    if (this.scheduleA.isNeeded()) {
      deduction = this.scheduleA.deductions()
    } else {
      deduction = this.standardDeduction() ?? 0
    }

    // OBBBA 2025: Add senior additional deduction ($6,000 per person 65+)
    // This is added to standard deduction OR itemized deductions
    // Source: docs/obbba/form-1040/STANDARD_DEDUCTION.md
    if (this.schedule1A.isNeeded()) {
      const seniorDeduction = this.schedule1A.seniorDeductionTo1040()
      deduction += seniorDeduction
    }

    return deduction
  }

  l13 = (): number | undefined => this.f8995?.deductions()
  l14 = (): number => sumFields([this.l12(), this.l13()])

  l15 = (): number => Math.max(0, this.l11() - this.l14())

  f8814Box = (): boolean | undefined => this.f8814 !== undefined
  f4972Box = (): boolean | undefined => this.f4972 !== undefined
  // TODO: tax from other form?
  otherFormBox = (): boolean => false
  otherFormName = (): string | undefined => undefined

  computeTax = (): number | undefined => {
    if (
      this.scheduleD.computeTaxOnQDWorksheet() ||
      this.totalQualifiedDividends() > 0
    ) {
      this.qualifiedAndCapGainsWorksheet = new SDQualifiedAndCapGains(this)
      return this.qualifiedAndCapGainsWorksheet.tax()
    }

    return computeOrdinaryTax(this.info.taxPayer.filingStatus, this.l15())
  }

  l16 = (): number | undefined =>
    sumFields([this.f8814?.tax(), this.f4972?.tax(), this.computeTax()])

  l17 = (): number | undefined => this.schedule2.l3()
  l18 = (): number => sumFields([this.l16(), this.l17()])

  l19 = (): number | undefined => this.schedule8812.to1040Line19()
  l20 = (): number | undefined =>
    this.schedule3.isNeeded() ? this.schedule3.l8() : undefined

  l21 = (): number => sumFields([this.l19(), this.l20()])

  l22 = (): number => Math.max(0, this.l18() - this.l21())

  l23 = (): number | undefined => this.schedule2.l21()

  l24 = (): number => sumFields([this.l22(), this.l23()])

  l25a = (): number =>
    this.validW2s().reduce((res, w2) => res + w2.fedWithholding, 0)

  // tax withheld from 1099s
  l25b = (): number =>
    this.f1099rs().reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    ) +
    this.f1099ssas().reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    )

  // TODO: form(s) W-2G box 4, schedule K-1, form 1042-S, form 8805, form 8288-A
  l25c = (): number | undefined => this.f8959.l24()

  l25d = (): number => sumFields([this.l25a(), this.l25b(), this.l25c()])

  l26 = (): number =>
    this.info.estimatedTaxes.reduce((res, et) => res + et.payment, 0)

  l27 = (): number =>
    this.scheduleEIC.isNeeded() ? this.scheduleEIC.credit() : 0

  // TODO: handle taxpayers between 1998 and 2004 that
  // can claim themselves for eic.
  //l27acheckBox = (): boolean => false

  // TODO: nontaxable combat pay
  //l27b = (): number | undefined => undefined

  // TODO: prior year earned income
  //l27c = (): number | undefined => undefined

  l28 = (): number | undefined => this.schedule8812.to1040Line28()

  l29 = (): number | undefined => this.f8863?.l8()

  // TODO: recovery rebate credit?
  l30 = (): number | undefined => undefined

  l31 = (): number | undefined =>
    this.schedule3.isNeeded() ? this.schedule3.l15() : undefined

  l32 = (): number =>
    sumFields([this.l27(), this.l28(), this.l29(), this.l30(), this.l31()])

  l33 = (): number => sumFields([this.l25d(), this.l26(), this.l32()])

  l34 = (): number => Math.max(0, this.l33() - this.l24())

  // TODO: assuming user wants amount refunded
  // rather than applied to estimated tax
  l35a = (): number => this.l34()
  l36 = (): number => Math.max(0, this.l34() - this.l35a())

  l37 = (): number => Math.max(0, this.l24() - this.l33())

  // TODO - estimated tax penalty
  l38 = (): number | undefined => undefined

  _depField = (idx: number): string | boolean => {
    const deps: Dependent[] = this.info.taxPayer.dependents

    // Based on the PDF row we are on, select correct dependent
    const depIdx = Math.floor(idx / 5)
    const depFieldIdx = idx % 5

    let fieldArr = ['', '', '', false, false]

    if (depIdx < deps.length) {
      const dep = deps[depIdx]
      // Based on the PDF column, select the correct field
      fieldArr = [
        `${dep.firstName} ${dep.lastName}`,
        dep.ssid,
        dep.relationship,
        this.qualifyingDependents.qualifiesChild(dep),
        this.qualifyingDependents.qualifiesOther(dep)
      ]
    }

    return fieldArr[depFieldIdx]
  }

  // 1040 allows 4 dependents listed without a supplemental schedule,
  // so create field mappings for 4x5 grid of fields
  _depFieldMappings = (): Array<string | boolean> =>
    Array.from(Array(20)).map((u, n: number) => this._depField(n))

  fields = (): Field[] =>
    [
      '',
      '',
      '',
      this.info.taxPayer.primaryPerson.firstName,
      this.info.taxPayer.primaryPerson.lastName,
      this.info.taxPayer.primaryPerson.ssid,
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.firstName
        : '',
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.lastName ?? ''
        : '',
      this.info.taxPayer.spouse?.ssid,
      this.info.taxPayer.primaryPerson.address.address,
      this.info.taxPayer.primaryPerson.address.aptNo,
      this.info.taxPayer.primaryPerson.address.city,
      this.info.taxPayer.primaryPerson.address.state,
      this.info.taxPayer.primaryPerson.address.zip,
      this.info.taxPayer.primaryPerson.address.foreignCountry,
      this.info.taxPayer.primaryPerson.address.province,
      this.info.taxPayer.primaryPerson.address.postalCode,
      false, // election campaign boxes
      false,
      this.info.taxPayer.filingStatus === FilingStatus.S,
      this.info.taxPayer.filingStatus === FilingStatus.HOH,
      this.info.taxPayer.filingStatus === FilingStatus.MFJ,
      this.info.taxPayer.filingStatus === FilingStatus.MFS,
      this.info.taxPayer.filingStatus === FilingStatus.W,
      // TODO: implement non dependent child for HOH and QW
      this.info.taxPayer.filingStatus === 'MFS' ? this.spouseFullName() : '',
      false, //teating non-resident alien
      '',
      this.info.questions.CRYPTO ?? false,
      !(this.info.questions.CRYPTO ?? false),
      this.info.taxPayer.primaryPerson.isTaxpayerDependent,
      this.info.taxPayer.spouse?.isTaxpayerDependent ?? false,
      false, // TODO: spouse itemizes separately,
      this.bornBeforeDate(),
      this.blind(),
      this.spouseBeforeDate(),
      this.spouseBlind(),
      this.info.taxPayer.dependents.length > 4,
      ...this._depFieldMappings(),
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f(),
      this.l1g(),
      this.l1h(),
      this.l1i(),
      this.l1z(),
      this.l2a(),
      this.l2b(),
      this.l3a(),
      this.l3b(),
      this.l4a(),
      this.l4b(),
      this.l5a(),
      this.l5b(),
      this.l6a(),
      this.l6b(),
      this.l6c(),
      this.l7Box(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.f8814Box(),
      this.f4972Box(),
      this.otherFormBox(),
      this.otherFormName(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21(),
      this.l22(),
      this.l23(),
      this.l24(),
      this.l25a(),
      this.l25b(),
      this.l25c(),
      this.l25d(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      undefined, //this.l30(),
      this.l31(),
      this.l32(),
      this.l33(),
      this.l34(),
      this.f8888 !== undefined,
      this.l35a(),
      this.info.refund?.routingNumber,
      this.info.refund?.accountType === AccountType.checking,
      this.info.refund?.accountType === AccountType.savings,
      this.info.refund?.accountNumber,
      this.l36(),
      this.l37(),
      this.l38(),
      // TODO: 3rd party
      false,
      false,
      '',
      '',
      '',
      this.occupation(PersonRole.PRIMARY),
      // TODO: pin numbers
      '',
      this.occupation(PersonRole.SPOUSE),
      '',
      this.info.taxPayer.contactPhoneNumber,
      this.info.taxPayer.contactEmail,
      // Paid preparer fields:
      '',
      '',
      false,
      '',
      '',
      '',
      ''
    ].map((x) => (x === undefined ? '' : x))
}
