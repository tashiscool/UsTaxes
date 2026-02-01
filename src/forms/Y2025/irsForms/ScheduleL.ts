/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule L - Balance Sheets per Books
 *
 * Used by Form 1065 (Partnerships), Form 1120 (C-Corps), and Form 1120-S (S-Corps)
 * to report assets, liabilities, and capital at beginning and end of tax year.
 *
 * Required unless:
 * - Partnerships: Gross receipts < $250,000 AND total assets < $1,000,000
 * - S-Corps: Similar small business exception
 *
 * Shows reconciliation of book equity with Schedule M-2
 */

export interface BalanceSheetData {
  // Assets - Beginning of Year (column a) and End of Year (column d)
  cashBeginning: number
  cashEnding: number
  tradeNotesReceivableBeginning: number
  tradeNotesReceivableEnding: number
  lessAllowanceBeginning: number
  lessAllowanceEnding: number
  inventoriesBeginning: number
  inventoriesEnding: number
  usGovernmentObligationsBeginning: number
  usGovernmentObligationsEnding: number
  taxExemptSecuritiesBeginning: number
  taxExemptSecuritiesEnding: number
  otherCurrentAssetsBeginning: number
  otherCurrentAssetsEnding: number
  loansToPartnersBeginning: number
  loansToPartnersEnding: number
  mortgageLoansBeginning: number
  mortgageLoansEnding: number
  otherInvestmentsBeginning: number
  otherInvestmentsEnding: number
  buildingsBeginning: number
  buildingsEnding: number
  lessBuildingsDepreciationBeginning: number
  lessBuildingsDepreciationEnding: number
  depletableAssetsBeginning: number
  depletableAssetsEnding: number
  lessDepletionBeginning: number
  lessDepletionEnding: number
  landBeginning: number
  landEnding: number
  intangibleAssetsBeginning: number
  intangibleAssetsEnding: number
  lessAmortizationBeginning: number
  lessAmortizationEnding: number
  otherAssetsBeginning: number
  otherAssetsEnding: number

  // Liabilities
  accountsPayableBeginning: number
  accountsPayableEnding: number
  mortgagesPayableBeginning: number
  mortgagesPayableEnding: number
  otherCurrentLiabilitiesBeginning: number
  otherCurrentLiabilitiesEnding: number
  loansFromPartnersBeginning: number
  loansFromPartnersEnding: number
  nonrecourseLiabilitiesBeginning: number
  nonrecourseLiabilitiesEnding: number
  otherLiabilitiesBeginning: number
  otherLiabilitiesEnding: number

  // Partners'/Shareholders' Capital
  capitalAccountsBeginning: number
  capitalAccountsEnding: number
  retainedEarningsBeginning: number
  retainedEarningsEnding: number
}

export type EntityType = 'partnership' | 'scorp' | 'ccorp'

export default class ScheduleL extends F1040Attachment {
  tag: FormTag = 'schedulel'
  sequenceIndex = 999
  entityType: EntityType = 'partnership'

  isNeeded = (): boolean => {
    return this.hasBalanceSheetData()
  }

  hasBalanceSheetData = (): boolean => {
    // Check if any business entity data exists
    const partnerships = this.f1040.info.partnershipOwnership
    const sCorps = this.f1040.info.sCorpOwnership
    const cCorps = this.f1040.info.cCorpOwnership
    return (
      (partnerships !== undefined && partnerships.length > 0) ||
      (sCorps !== undefined && sCorps.length > 0) ||
      (cCorps !== undefined && cCorps.length > 0)
    )
  }

  balanceSheetData = (): BalanceSheetData | undefined => {
    // Would be populated from entity data
    return undefined
  }

  // Assets calculations
  totalAssetsBeginning = (): number => {
    const data = this.balanceSheetData()
    if (!data) return 0
    return sumFields([
      data.cashBeginning,
      data.tradeNotesReceivableBeginning - data.lessAllowanceBeginning,
      data.inventoriesBeginning,
      data.usGovernmentObligationsBeginning,
      data.taxExemptSecuritiesBeginning,
      data.otherCurrentAssetsBeginning,
      data.loansToPartnersBeginning,
      data.mortgageLoansBeginning,
      data.otherInvestmentsBeginning,
      data.buildingsBeginning - data.lessBuildingsDepreciationBeginning,
      data.depletableAssetsBeginning - data.lessDepletionBeginning,
      data.landBeginning,
      data.intangibleAssetsBeginning - data.lessAmortizationBeginning,
      data.otherAssetsBeginning
    ])
  }

  totalAssetsEnding = (): number => {
    const data = this.balanceSheetData()
    if (!data) return 0
    return sumFields([
      data.cashEnding,
      data.tradeNotesReceivableEnding - data.lessAllowanceEnding,
      data.inventoriesEnding,
      data.usGovernmentObligationsEnding,
      data.taxExemptSecuritiesEnding,
      data.otherCurrentAssetsEnding,
      data.loansToPartnersEnding,
      data.mortgageLoansEnding,
      data.otherInvestmentsEnding,
      data.buildingsEnding - data.lessBuildingsDepreciationEnding,
      data.depletableAssetsEnding - data.lessDepletionEnding,
      data.landEnding,
      data.intangibleAssetsEnding - data.lessAmortizationEnding,
      data.otherAssetsEnding
    ])
  }

  // Liabilities calculations
  totalLiabilitiesBeginning = (): number => {
    const data = this.balanceSheetData()
    if (!data) return 0
    return sumFields([
      data.accountsPayableBeginning,
      data.mortgagesPayableBeginning,
      data.otherCurrentLiabilitiesBeginning,
      data.loansFromPartnersBeginning,
      data.nonrecourseLiabilitiesBeginning,
      data.otherLiabilitiesBeginning
    ])
  }

  totalLiabilitiesEnding = (): number => {
    const data = this.balanceSheetData()
    if (!data) return 0
    return sumFields([
      data.accountsPayableEnding,
      data.mortgagesPayableEnding,
      data.otherCurrentLiabilitiesEnding,
      data.loansFromPartnersEnding,
      data.nonrecourseLiabilitiesEnding,
      data.otherLiabilitiesEnding
    ])
  }

  // Capital calculations
  totalCapitalBeginning = (): number => {
    const data = this.balanceSheetData()
    if (!data) return 0
    return data.capitalAccountsBeginning + (data.retainedEarningsBeginning ?? 0)
  }

  totalCapitalEnding = (): number => {
    const data = this.balanceSheetData()
    if (!data) return 0
    return data.capitalAccountsEnding + (data.retainedEarningsEnding ?? 0)
  }

  // Total liabilities and capital
  totalLiabilitiesAndCapitalBeginning = (): number => {
    return this.totalLiabilitiesBeginning() + this.totalCapitalBeginning()
  }

  totalLiabilitiesAndCapitalEnding = (): number => {
    return this.totalLiabilitiesEnding() + this.totalCapitalEnding()
  }

  // Balance check
  isBalanced = (): boolean => {
    return (
      this.totalAssetsBeginning() ===
        this.totalLiabilitiesAndCapitalBeginning() &&
      this.totalAssetsEnding() === this.totalLiabilitiesAndCapitalEnding()
    )
  }

  fields = (): Field[] => {
    const data = this.balanceSheetData()

    return [
      // Assets
      // Line 1: Cash
      data?.cashBeginning ?? 0,
      data?.cashEnding ?? 0,
      // Line 2: Trade notes and accounts receivable
      data?.tradeNotesReceivableBeginning ?? 0,
      data?.tradeNotesReceivableEnding ?? 0,
      data?.lessAllowanceBeginning ?? 0,
      data?.lessAllowanceEnding ?? 0,
      // Line 3: Inventories
      data?.inventoriesBeginning ?? 0,
      data?.inventoriesEnding ?? 0,
      // Line 4: U.S. government obligations
      data?.usGovernmentObligationsBeginning ?? 0,
      data?.usGovernmentObligationsEnding ?? 0,
      // Line 5: Tax-exempt securities
      data?.taxExemptSecuritiesBeginning ?? 0,
      data?.taxExemptSecuritiesEnding ?? 0,
      // Line 6: Other current assets
      data?.otherCurrentAssetsBeginning ?? 0,
      data?.otherCurrentAssetsEnding ?? 0,
      // Line 7: Loans to partners/shareholders
      data?.loansToPartnersBeginning ?? 0,
      data?.loansToPartnersEnding ?? 0,
      // Line 8: Mortgage and real estate loans
      data?.mortgageLoansBeginning ?? 0,
      data?.mortgageLoansEnding ?? 0,
      // Line 9: Other investments
      data?.otherInvestmentsBeginning ?? 0,
      data?.otherInvestmentsEnding ?? 0,
      // Line 10: Buildings and other depreciable assets
      data?.buildingsBeginning ?? 0,
      data?.buildingsEnding ?? 0,
      data?.lessBuildingsDepreciationBeginning ?? 0,
      data?.lessBuildingsDepreciationEnding ?? 0,
      // Line 11: Depletable assets
      data?.depletableAssetsBeginning ?? 0,
      data?.depletableAssetsEnding ?? 0,
      data?.lessDepletionBeginning ?? 0,
      data?.lessDepletionEnding ?? 0,
      // Line 12: Land
      data?.landBeginning ?? 0,
      data?.landEnding ?? 0,
      // Line 13: Intangible assets
      data?.intangibleAssetsBeginning ?? 0,
      data?.intangibleAssetsEnding ?? 0,
      data?.lessAmortizationBeginning ?? 0,
      data?.lessAmortizationEnding ?? 0,
      // Line 14: Other assets
      data?.otherAssetsBeginning ?? 0,
      data?.otherAssetsEnding ?? 0,
      // Line 15: Total assets
      this.totalAssetsBeginning(),
      this.totalAssetsEnding(),

      // Liabilities
      // Line 16: Accounts payable
      data?.accountsPayableBeginning ?? 0,
      data?.accountsPayableEnding ?? 0,
      // Line 17: Mortgages, notes, bonds payable in less than 1 year
      data?.mortgagesPayableBeginning ?? 0,
      data?.mortgagesPayableEnding ?? 0,
      // Line 18: Other current liabilities
      data?.otherCurrentLiabilitiesBeginning ?? 0,
      data?.otherCurrentLiabilitiesEnding ?? 0,
      // Line 19: Loans from partners/shareholders
      data?.loansFromPartnersBeginning ?? 0,
      data?.loansFromPartnersEnding ?? 0,
      // Line 20: Nonrecourse liabilities (partnerships only)
      data?.nonrecourseLiabilitiesBeginning ?? 0,
      data?.nonrecourseLiabilitiesEnding ?? 0,
      // Line 21: Other liabilities
      data?.otherLiabilitiesBeginning ?? 0,
      data?.otherLiabilitiesEnding ?? 0,

      // Capital
      // Line 22: Partners'/shareholders' capital accounts
      data?.capitalAccountsBeginning ?? 0,
      data?.capitalAccountsEnding ?? 0,
      // Line 23 (C-Corp): Retained earnings
      data?.retainedEarningsBeginning ?? 0,
      data?.retainedEarningsEnding ?? 0,

      // Totals
      this.totalLiabilitiesAndCapitalBeginning(),
      this.totalLiabilitiesAndCapitalEnding()
    ]
  }
}
