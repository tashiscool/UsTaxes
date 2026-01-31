import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 433-A - Collection Information Statement for Wage Earners and Self-Employed Individuals
 *
 * Used by the IRS to evaluate a taxpayer's ability to pay when:
 * - Requesting an installment agreement (for amounts > $50,000)
 * - Submitting an Offer in Compromise
 * - Requesting currently not collectible status
 * - Requesting penalty abatement
 *
 * Collects detailed financial information including:
 * - Personal information and employment
 * - Bank accounts and investments
 * - Real property and vehicles
 * - Other assets
 * - Monthly income and expenses
 *
 * Note: Very detailed form - this implementation covers key sections.
 */

export interface CollectionPersonalInfo {
  // Section 1: Personal Information
  homePhone: string
  cellPhone: string
  maritalStatus: 'single' | 'married' | 'separated' | 'divorced' | 'widowed'

  // Employment
  employerName: string
  employerAddress: string
  occupationOrBusiness: string
  howLongEmployed: string

  // Self-employment (if applicable)
  selfEmployedBusinessName?: string
  selfEmployedBusinessType?: string
}

export interface CollectionBankAccount {
  bankName: string
  address: string
  accountType: 'checking' | 'savings' | 'moneyMarket' | 'cd' | 'other'
  accountNumber: string
  currentBalance: number
}

export interface CollectionInvestment {
  institutionName: string
  accountType: 'stocks' | 'bonds' | 'mutualFunds' | 'retirement' | 'other'
  currentValue: number
  loanBalance: number
}

export interface CollectionRealProperty {
  propertyDescription: string
  propertyAddress: string
  purchaseDate: Date
  currentMarketValue: number
  currentLoanBalance: number
  monthlyPayment: number
  lenderName: string
  equity: number
}

export interface CollectionVehicle {
  year: number
  make: string
  model: string
  mileage: number
  currentMarketValue: number
  loanBalance: number
  monthlyPayment: number
  lenderName: string
}

export interface CollectionMonthlyIncome {
  wagesGross: number
  wagesNet: number
  selfEmploymentIncome: number
  socialSecurity: number
  pension: number
  childSupport: number
  alimony: number
  rentalIncome: number
  interestDividends: number
  otherIncome: number
}

export interface CollectionMonthlyExpenses {
  foodClothingMisc: number
  housing: number
  utilities: number
  vehiclePayment: number
  vehicleOperating: number
  publicTransportation: number
  healthInsurance: number
  outOfPocketMedical: number
  courtOrderedPayments: number
  childDepCare: number
  lifeInsurance: number
  taxes: number
  securedDebts: number
  otherExpenses: number
}

export interface CollectionStatementInfo {
  personalInfo: CollectionPersonalInfo
  bankAccounts: CollectionBankAccount[]
  investments: CollectionInvestment[]
  realProperty: CollectionRealProperty[]
  vehicles: CollectionVehicle[]
  monthlyIncome: CollectionMonthlyIncome
  monthlyExpenses: CollectionMonthlyExpenses
  totalAssetsValue: number
  totalLiabilities: number
  taxDebtOwed: number
}

export default class F433A extends F1040Attachment {
  tag: FormTag = 'f433a'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasCollectionInfo()
  }

  hasCollectionInfo = (): boolean => {
    return this.collectionInfo() !== undefined
  }

  collectionInfo = (): CollectionStatementInfo | undefined => {
    return this.f1040.info.collectionStatement as CollectionStatementInfo | undefined
  }

  // Section 1: Personal Information
  personalInfo = (): CollectionPersonalInfo | undefined => {
    return this.collectionInfo()?.personalInfo
  }

  // Section 2: Employment
  employerName = (): string => this.personalInfo()?.employerName ?? ''
  employerAddress = (): string => this.personalInfo()?.employerAddress ?? ''
  occupation = (): string => this.personalInfo()?.occupationOrBusiness ?? ''

  // Section 3: Bank Accounts
  bankAccounts = (): CollectionBankAccount[] => {
    return this.collectionInfo()?.bankAccounts ?? []
  }

  totalBankBalance = (): number => {
    return this.bankAccounts().reduce((sum, a) => sum + a.currentBalance, 0)
  }

  // Section 4: Investments
  investments = (): CollectionInvestment[] => {
    return this.collectionInfo()?.investments ?? []
  }

  totalInvestmentValue = (): number => {
    return this.investments().reduce((sum, i) => sum + i.currentValue, 0)
  }

  // Section 5: Real Property
  realProperty = (): CollectionRealProperty[] => {
    return this.collectionInfo()?.realProperty ?? []
  }

  totalRealPropertyEquity = (): number => {
    return this.realProperty().reduce((sum, p) => sum + p.equity, 0)
  }

  // Section 6: Vehicles
  vehicles = (): CollectionVehicle[] => {
    return this.collectionInfo()?.vehicles ?? []
  }

  totalVehicleEquity = (): number => {
    return this.vehicles().reduce((sum, v) => sum + (v.currentMarketValue - v.loanBalance), 0)
  }

  // Section 7: Monthly Income
  monthlyIncome = (): CollectionMonthlyIncome | undefined => {
    return this.collectionInfo()?.monthlyIncome
  }

  totalMonthlyIncome = (): number => {
    const income = this.monthlyIncome()
    if (!income) return 0
    return sumFields([
      income.wagesNet,
      income.selfEmploymentIncome,
      income.socialSecurity,
      income.pension,
      income.childSupport,
      income.alimony,
      income.rentalIncome,
      income.interestDividends,
      income.otherIncome
    ])
  }

  // Section 8: Monthly Expenses
  monthlyExpenses = (): CollectionMonthlyExpenses | undefined => {
    return this.collectionInfo()?.monthlyExpenses
  }

  totalMonthlyExpenses = (): number => {
    const expenses = this.monthlyExpenses()
    if (!expenses) return 0
    return sumFields([
      expenses.foodClothingMisc,
      expenses.housing,
      expenses.utilities,
      expenses.vehiclePayment,
      expenses.vehicleOperating,
      expenses.publicTransportation,
      expenses.healthInsurance,
      expenses.outOfPocketMedical,
      expenses.courtOrderedPayments,
      expenses.childDepCare,
      expenses.lifeInsurance,
      expenses.taxes,
      expenses.securedDebts,
      expenses.otherExpenses
    ])
  }

  // Summary calculations
  monthlyDisposableIncome = (): number => {
    return Math.max(0, this.totalMonthlyIncome() - this.totalMonthlyExpenses())
  }

  totalAssets = (): number => {
    return this.collectionInfo()?.totalAssetsValue ??
           this.totalBankBalance() + this.totalInvestmentValue() +
           this.totalRealPropertyEquity() + this.totalVehicleEquity()
  }

  totalLiabilities = (): number => {
    return this.collectionInfo()?.totalLiabilities ?? 0
  }

  netWorth = (): number => {
    return this.totalAssets() - this.totalLiabilities()
  }

  taxDebtOwed = (): number => {
    return this.collectionInfo()?.taxDebtOwed ?? 0
  }

  // Collection potential calculation (for IRS use)
  // Based on assets that could be liquidated plus future income
  collectionPotential = (): number => {
    const assetsPotential = this.totalAssets() * 0.8  // 80% of quick sale value
    const incomePotential = this.monthlyDisposableIncome() * 12  // 12 months
    return assetsPotential + incomePotential
  }

  fields = (): Field[] => {
    const personal = this.personalInfo()
    const income = this.monthlyIncome()
    const expenses = this.monthlyExpenses()
    const accounts = this.bankAccounts()
    const props = this.realProperty()
    const cars = this.vehicles()

    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // Section 1: Personal
      personal?.homePhone ?? '',
      personal?.cellPhone ?? '',
      personal?.maritalStatus ?? '',
      // Section 2: Employment
      this.employerName(),
      this.employerAddress(),
      this.occupation(),
      personal?.howLongEmployed ?? '',
      // Section 3: Bank Accounts (first 2)
      accounts[0]?.bankName ?? '',
      accounts[0]?.accountType ?? '',
      accounts[0]?.currentBalance ?? 0,
      accounts[1]?.bankName ?? '',
      accounts[1]?.accountType ?? '',
      accounts[1]?.currentBalance ?? 0,
      this.totalBankBalance(),
      // Section 5: Real Property (first)
      props[0]?.propertyAddress ?? '',
      props[0]?.currentMarketValue ?? 0,
      props[0]?.currentLoanBalance ?? 0,
      props[0]?.monthlyPayment ?? 0,
      props[0]?.equity ?? 0,
      // Section 6: Vehicles (first 2)
      cars[0] ? `${cars[0].year} ${cars[0].make} ${cars[0].model}` : '',
      cars[0]?.currentMarketValue ?? 0,
      cars[0]?.loanBalance ?? 0,
      cars[1] ? `${cars[1].year} ${cars[1].make} ${cars[1].model}` : '',
      cars[1]?.currentMarketValue ?? 0,
      cars[1]?.loanBalance ?? 0,
      // Section 7: Monthly Income
      income?.wagesGross ?? 0,
      income?.wagesNet ?? 0,
      income?.selfEmploymentIncome ?? 0,
      income?.socialSecurity ?? 0,
      income?.pension ?? 0,
      income?.otherIncome ?? 0,
      this.totalMonthlyIncome(),
      // Section 8: Monthly Expenses
      expenses?.foodClothingMisc ?? 0,
      expenses?.housing ?? 0,
      expenses?.utilities ?? 0,
      expenses?.vehiclePayment ?? 0,
      expenses?.vehicleOperating ?? 0,
      expenses?.healthInsurance ?? 0,
      expenses?.outOfPocketMedical ?? 0,
      expenses?.taxes ?? 0,
      this.totalMonthlyExpenses(),
      // Summary
      this.totalAssets(),
      this.totalLiabilities(),
      this.netWorth(),
      this.monthlyDisposableIncome()
    ]
  }
}
