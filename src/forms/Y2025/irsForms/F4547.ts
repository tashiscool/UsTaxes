/**
 * Form 4547 - MAGA/Trump Savings Account Elections
 *
 * New form for OBBBA 2025 Trump Savings Account provisions
 * Source: docs/obbba/new-provisions/TRUMP_ACCOUNT.md
 *
 * This form reports:
 * - New account establishment
 * - Annual contributions ($5,000 max)
 * - Government initial contribution ($1,000 for newborns)
 * - Fair market value
 *
 * Effective: 2025-2028 (sunsets for new accounts)
 */

import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { TrumpSavingsAccount } from 'ustaxes/core/data'
import { trumpSavingsAccount, CURRENT_YEAR } from '../data/federal'

export default class F4547 extends F1040Attachment {
  tag: FormTag = 'f4547'
  sequenceIndex = 99 // New form, sequence TBD

  // Get all Trump Savings Accounts from taxpayer info
  accounts = (): TrumpSavingsAccount[] => {
    return this.f1040.info.trumpSavingsAccounts ?? []
  }

  isNeeded = (): boolean => {
    return this.accounts().length > 0 && trumpSavingsAccount.enabled
  }

  // Part I: Account Holder Information

  // Line 1: Number of accounts
  l1 = (): number => this.accounts().length

  // Line 2: Total contributions made during tax year
  l2 = (): number => {
    return this.accounts().reduce((sum, acct) => {
      return sum + acct.contributionAmount
    }, 0)
  }

  // Line 3: Government initial contributions (for accounts opened this year)
  l3 = (): number => {
    return (
      this.accounts().filter((acct) => {
        // Check if account was opened this year
        if (!acct.accountOpenDate) return false
        const openYear = new Date(acct.accountOpenDate).getFullYear()
        return openYear === CURRENT_YEAR
      }).length * trumpSavingsAccount.initialContribution
    )
  }

  // Line 4: Total contributions (taxpayer + government)
  l4 = (): number => this.l2() + this.l3()

  // Line 5: Excess contributions (amounts over $5,000 per account per year)
  l5 = (): number => {
    return this.accounts().reduce((sum, acct) => {
      const excess = Math.max(
        0,
        acct.contributionAmount - trumpSavingsAccount.annualContributionLimit
      )
      return sum + excess
    }, 0)
  }

  // Line 6: Allowable contributions (Line 4 minus Line 5)
  l6 = (): number => Math.max(0, this.l4() - this.l5())

  // Part II: Fair Market Value

  // Line 7: Total fair market value of all Trump Accounts at year end
  l7 = (): number => {
    return this.accounts().reduce((sum, acct) => {
      return sum + (acct.fairMarketValue ?? 0)
    }, 0)
  }

  // Part III: Eligibility Verification

  // Line 8: All beneficiaries are U.S. citizens?
  l8 = (): boolean => {
    return this.accounts().every((acct) => acct.beneficiaryIsCitizen === true)
  }

  // Line 9: All beneficiaries under age 18?
  l9 = (): boolean => {
    return this.accounts().every((acct) => {
      const birthDate = new Date(acct.beneficiaryDateOfBirth)
      const taxYearEnd = new Date(CURRENT_YEAR, 11, 31)
      const ageInMs = taxYearEnd.getTime() - birthDate.getTime()
      const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25)
      return ageInYears < trumpSavingsAccount.maxBeneficiaryAge
    })
  }

  // Line 10: Number of qualifying accounts
  l10 = (): number => {
    return this.accounts().filter((acct) => {
      // Check citizenship
      if (
        trumpSavingsAccount.citizenshipRequired &&
        !acct.beneficiaryIsCitizen
      ) {
        return false
      }
      // Check age
      const birthDate = new Date(acct.beneficiaryDateOfBirth)
      const taxYearEnd = new Date(CURRENT_YEAR, 11, 31)
      const ageInMs = taxYearEnd.getTime() - birthDate.getTime()
      const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25)
      return ageInYears < trumpSavingsAccount.maxBeneficiaryAge
    }).length
  }

  fields = (): Field[] => {
    const accounts = this.accounts()

    return [
      // Taxpayer info
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,

      // Part I
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),

      // Part II
      this.l7(),

      // Part III
      this.l8(),
      this.l9(),
      this.l10(),

      // Account details (up to 4 accounts)
      accounts[0]?.beneficiaryName,
      accounts[0]?.beneficiarySSN,
      accounts[0]?.contributionAmount,
      accounts[0]?.fairMarketValue,

      accounts[1]?.beneficiaryName,
      accounts[1]?.beneficiarySSN,
      accounts[1]?.contributionAmount,
      accounts[1]?.fairMarketValue,

      accounts[2]?.beneficiaryName,
      accounts[2]?.beneficiarySSN,
      accounts[2]?.contributionAmount,
      accounts[2]?.fairMarketValue,

      accounts[3]?.beneficiaryName,
      accounts[3]?.beneficiarySSN,
      accounts[3]?.contributionAmount,
      accounts[3]?.fairMarketValue
    ]
  }
}
