import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 990 - Return of Organization Exempt From Income Tax
 *
 * Filed by tax-exempt organizations under Section 501(c) with gross receipts
 * of $200,000+ or total assets of $500,000+.
 *
 * Organization Types:
 * - 501(c)(3): Charitable, religious, educational, scientific
 * - 501(c)(4): Social welfare organizations
 * - 501(c)(5): Labor, agricultural organizations
 * - 501(c)(6): Business leagues, chambers of commerce
 * - 501(c)(7): Social and recreational clubs
 *
 * Key Schedules:
 * - Schedule A: Public Charity Status
 * - Schedule B: Contributors
 * - Schedule C: Political and Lobbying Activities
 * - Schedule D: Supplemental Financial Statements
 * - Schedule F: Statement of Activities Outside the US
 * - Schedule G: Supplemental Information on Fundraising
 * - Schedule I: Grants and Other Assistance
 * - Schedule J: Compensation Information
 * - Schedule K: Tax-Exempt Bonds
 * - Schedule L: Transactions with Interested Persons
 * - Schedule M: Noncash Contributions
 * - Schedule N: Liquidation, Termination, or Dissolution
 * - Schedule O: Supplemental Information
 * - Schedule R: Related Organizations
 *
 * Due Date: 15th day of 5th month after fiscal year end
 */

export type ExemptionType = '501c3' | '501c4' | '501c5' | '501c6' | '501c7' | '501c8' | '501c9' | '501c10' | 'other'
export type PublicCharityStatus = 'church' | 'school' | 'hospital' | 'publicCharity' | 'supportingOrg' | 'other'

export interface OrganizationInfo {
  name: string
  ein: string
  address: string
  city: string
  state: string
  zip: string
  website?: string
  yearFormed: number
  stateOfIncorporation: string
  exemptionType: ExemptionType
  groupExemptionNumber?: string
  publicCharityStatus?: PublicCharityStatus
}

export interface RevenueInfo {
  contributions: number
  programServiceRevenue: number
  membershipDues: number
  investmentIncome: number
  grossRents: number
  netRentalIncome: number
  grossSalesOfAssets: number
  netGainFromSales: number
  fundraisingEvents: number
  grossSalesOfInventory: number
  otherRevenue: number
}

export interface ExpenseInfo {
  grants: number
  benefitsPaid: number
  salariesAndWages: number
  employeeBenefits: number
  payrollTaxes: number
  managementFees: number
  legalFees: number
  accountingFees: number
  lobbyingExpenses: number
  professionalFundraising: number
  advertising: number
  officeExpenses: number
  informationTechnology: number
  occupancy: number
  travel: number
  conferences: number
  interest: number
  depreciation: number
  insurance: number
  otherExpenses: number
}

export interface BalanceSheetInfo {
  // Assets
  cashNonInterest: number
  savingsAndInvestments: number
  pledgesReceivable: number
  accountsReceivable: number
  loansReceivable: number
  inventories: number
  prepaidExpenses: number
  landBuildingsEquipment: number
  investments: number
  intangibleAssets: number
  otherAssets: number
  // Liabilities
  accountsPayable: number
  grantsPayable: number
  deferredRevenue: number
  taxExemptBonds: number
  mortgages: number
  otherLiabilities: number
  // Net Assets
  unrestrictedNetAssets: number
  temporarilyRestricted: number
  permanentlyRestricted: number
}

export interface GovernanceInfo {
  numberOfVotingMembers: number
  numberOfIndependentMembers: number
  totalEmployees: number
  totalVolunteers: number
  hasWrittenConflictPolicy: boolean
  hasDocumentRetentionPolicy: boolean
  hasWhistleblowerPolicy: boolean
  hasCompensationProcess: boolean
}

export interface Form990Info {
  organization: OrganizationInfo
  fiscalYearStart: Date
  fiscalYearEnd: Date
  isFinalReturn: boolean
  isAmendedReturn: boolean
  isGroupReturn: boolean
  // Financial
  revenue: RevenueInfo
  expenses: ExpenseInfo
  balanceSheet: BalanceSheetInfo
  // Governance
  governance: GovernanceInfo
  // Compensation
  highestCompensatedEmployees?: {
    name: string
    title: string
    compensation: number
  }[]
  // Activities
  missionStatement: string
  programAccomplishments: string[]
}

export default class F990 extends F1040Attachment {
  tag: FormTag = 'f990'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasForm990Info()
  }

  hasForm990Info = (): boolean => {
    return this.f990Info() !== undefined
  }

  f990Info = (): Form990Info | undefined => {
    return this.f1040.info.exemptOrgReturn as Form990Info | undefined
  }

  // Organization Information
  organization = (): OrganizationInfo | undefined => this.f990Info()?.organization
  orgName = (): string => this.organization()?.name ?? ''
  ein = (): string => this.organization()?.ein ?? ''
  exemptionType = (): ExemptionType => this.organization()?.exemptionType ?? '501c3'

  // Part I: Summary

  // Revenue
  revenue = (): RevenueInfo | undefined => this.f990Info()?.revenue

  // Line 8: Contributions and grants
  l8 = (): number => this.revenue()?.contributions ?? 0

  // Line 9: Program service revenue
  l9 = (): number => this.revenue()?.programServiceRevenue ?? 0

  // Line 10: Investment income
  l10 = (): number => this.revenue()?.investmentIncome ?? 0

  // Line 11: Other revenue
  l11 = (): number => {
    const rev = this.revenue()
    if (!rev) return 0
    return sumFields([
      rev.membershipDues,
      rev.netRentalIncome,
      rev.netGainFromSales,
      rev.fundraisingEvents,
      rev.otherRevenue
    ])
  }

  // Line 12: Total revenue
  l12 = (): number => {
    return this.l8() + this.l9() + this.l10() + this.l11()
  }

  // Expenses
  expenses = (): ExpenseInfo | undefined => this.f990Info()?.expenses

  // Line 13: Grants and similar amounts
  l13 = (): number => this.expenses()?.grants ?? 0

  // Line 14: Benefits paid to members
  l14 = (): number => this.expenses()?.benefitsPaid ?? 0

  // Line 15: Salaries and compensation
  l15 = (): number => {
    const exp = this.expenses()
    if (!exp) return 0
    return sumFields([exp.salariesAndWages, exp.employeeBenefits, exp.payrollTaxes])
  }

  // Line 16: Professional fundraising fees
  l16 = (): number => this.expenses()?.professionalFundraising ?? 0

  // Line 17: Other expenses
  l17 = (): number => {
    const exp = this.expenses()
    if (!exp) return 0
    return sumFields([
      exp.managementFees, exp.legalFees, exp.accountingFees,
      exp.advertising, exp.officeExpenses, exp.occupancy,
      exp.travel, exp.depreciation, exp.insurance, exp.otherExpenses
    ])
  }

  // Line 18: Total expenses
  l18 = (): number => {
    return sumFields([this.l13(), this.l14(), this.l15(), this.l16(), this.l17()])
  }

  // Line 19: Revenue less expenses
  l19 = (): number => this.l12() - this.l18()

  // Balance Sheet
  balanceSheet = (): BalanceSheetInfo | undefined => this.f990Info()?.balanceSheet

  // Line 20: Total assets (beginning of year)
  totalAssetsBOY = (): number => {
    // Would need prior year data
    return 0
  }

  // Line 21: Total assets (end of year)
  l21 = (): number => {
    const bs = this.balanceSheet()
    if (!bs) return 0
    return sumFields([
      bs.cashNonInterest, bs.savingsAndInvestments, bs.pledgesReceivable,
      bs.accountsReceivable, bs.loansReceivable, bs.inventories,
      bs.prepaidExpenses, bs.landBuildingsEquipment, bs.investments,
      bs.intangibleAssets, bs.otherAssets
    ])
  }

  // Line 22: Total liabilities (end of year)
  l22 = (): number => {
    const bs = this.balanceSheet()
    if (!bs) return 0
    return sumFields([
      bs.accountsPayable, bs.grantsPayable, bs.deferredRevenue,
      bs.taxExemptBonds, bs.mortgages, bs.otherLiabilities
    ])
  }

  // Line 22: Net assets (end of year)
  netAssets = (): number => {
    const bs = this.balanceSheet()
    if (!bs) return 0
    return sumFields([
      bs.unrestrictedNetAssets, bs.temporarilyRestricted, bs.permanentlyRestricted
    ])
  }

  // Part VI: Governance
  governance = (): GovernanceInfo | undefined => this.f990Info()?.governance

  numberOfVotingMembers = (): number => this.governance()?.numberOfVotingMembers ?? 0
  numberOfIndependentMembers = (): number => this.governance()?.numberOfIndependentMembers ?? 0
  totalEmployees = (): number => this.governance()?.totalEmployees ?? 0
  totalVolunteers = (): number => this.governance()?.totalVolunteers ?? 0

  // Functional Expense Allocation
  programExpenses = (): number => Math.round(this.l18() * 0.85)  // Typical allocation
  managementExpenses = (): number => Math.round(this.l18() * 0.10)
  fundraisingExpenses = (): number => Math.round(this.l18() * 0.05)

  // Program efficiency ratio
  programEfficiencyRatio = (): number => {
    if (this.l18() === 0) return 0
    return Math.round((this.programExpenses() / this.l18()) * 100)
  }

  fields = (): Field[] => {
    const org = this.organization()
    const gov = this.governance()
    const bs = this.balanceSheet()

    return [
      // Header
      this.orgName(),
      this.ein(),
      org?.address ?? '',
      `${org?.city ?? ''}, ${org?.state ?? ''} ${org?.zip ?? ''}`,
      org?.website ?? '',
      this.exemptionType(),
      org?.yearFormed ?? 0,
      org?.stateOfIncorporation ?? '',
      // Dates
      this.f990Info()?.fiscalYearStart?.toLocaleDateString() ?? '',
      this.f990Info()?.fiscalYearEnd?.toLocaleDateString() ?? '',
      this.f990Info()?.isFinalReturn ?? false,
      this.f990Info()?.isAmendedReturn ?? false,
      // Part I: Summary - Revenue
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      // Part I: Summary - Expenses
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      // Part I: Balance Sheet
      this.l21(),
      this.l22(),
      this.netAssets(),
      // Part VI: Governance
      this.numberOfVotingMembers(),
      this.numberOfIndependentMembers(),
      this.totalEmployees(),
      this.totalVolunteers(),
      gov?.hasWrittenConflictPolicy ?? false,
      gov?.hasDocumentRetentionPolicy ?? false,
      gov?.hasWhistleblowerPolicy ?? false,
      gov?.hasCompensationProcess ?? false,
      // Functional Expenses
      this.programExpenses(),
      this.managementExpenses(),
      this.fundraisingExpenses(),
      this.programEfficiencyRatio()
    ]
  }
}
