import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-B - Proceeds from Broker and Barter Exchange Transactions
 *
 * Reports sales or exchanges of:
 * - Stocks, bonds, commodities
 * - Regulated futures contracts
 * - Foreign currency contracts
 * - Forward contracts
 * - Securities futures contracts
 * - Barter exchange transactions
 *
 * Critical for Schedule D and Form 8949 calculations.
 */

export interface F1099BTransaction {
  // Box 1a: Description
  description: string
  cusip?: string
  // Box 1b: Date acquired
  dateAcquired?: Date
  // Box 1c: Date sold
  dateSold: Date
  // Box 1d: Proceeds
  proceeds: number
  // Box 1e: Cost or other basis
  costBasis?: number
  // Box 1f: Accrued market discount
  accruedMarketDiscount?: number
  // Box 1g: Wash sale loss disallowed
  washSaleLossDisallowed?: number
  // Box 2: Short-term or long-term
  shortTermLongTerm: 'short' | 'long' | 'unknown'
  // Box 3: Type of gain/loss
  ordinaryGainLoss: boolean
  // Box 4: Federal tax withheld
  federalTaxWithheld: number
  // Box 5: Check if noncovered security
  noncoveredSecurity: boolean
  // Box 6: Reported to IRS (gross or net)
  reportedToIRS: 'gross' | 'net'
  // Box 7: Check if loss not allowed based on amount in 1d
  lossNotAllowed: boolean
  // Basis reporting
  basisReportedToIRS: boolean
  // Bartering
  isBarterExchange: boolean
  barterExchangeValue?: number
}

export interface F1099BData {
  // Payer (broker) information
  payerName: string
  payerAddress: string
  payerTIN: string
  payerPhone: string
  // Recipient information
  recipientName: string
  recipientAddress: string
  recipientTIN: string
  // Account number
  accountNumber?: string
  // Transactions
  transactions: F1099BTransaction[]
  // State information
  stateTaxWithheld: number
  stateId: string
  stateIncome: number
}

export default class F1099B extends F1040Attachment {
  tag: FormTag = 'f1099b'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099BData()
  }

  hasF1099BData = (): boolean => {
    return false
  }

  f1099BData = (): F1099BData | undefined => {
    return undefined
  }

  // Transactions
  transactions = (): F1099BTransaction[] => {
    return this.f1099BData()?.transactions ?? []
  }

  // Summary calculations
  totalProceeds = (): number => {
    return this.transactions().reduce((sum, t) => sum + t.proceeds, 0)
  }

  totalCostBasis = (): number => {
    return this.transactions().reduce((sum, t) => sum + (t.costBasis ?? 0), 0)
  }

  totalGainLoss = (): number => {
    return this.totalProceeds() - this.totalCostBasis()
  }

  // Short-term transactions
  shortTermTransactions = (): F1099BTransaction[] => {
    return this.transactions().filter((t) => t.shortTermLongTerm === 'short')
  }

  shortTermProceeds = (): number => {
    return this.shortTermTransactions().reduce((sum, t) => sum + t.proceeds, 0)
  }

  shortTermCostBasis = (): number => {
    return this.shortTermTransactions().reduce(
      (sum, t) => sum + (t.costBasis ?? 0),
      0
    )
  }

  shortTermGainLoss = (): number => {
    return this.shortTermProceeds() - this.shortTermCostBasis()
  }

  // Long-term transactions
  longTermTransactions = (): F1099BTransaction[] => {
    return this.transactions().filter((t) => t.shortTermLongTerm === 'long')
  }

  longTermProceeds = (): number => {
    return this.longTermTransactions().reduce((sum, t) => sum + t.proceeds, 0)
  }

  longTermCostBasis = (): number => {
    return this.longTermTransactions().reduce(
      (sum, t) => sum + (t.costBasis ?? 0),
      0
    )
  }

  longTermGainLoss = (): number => {
    return this.longTermProceeds() - this.longTermCostBasis()
  }

  // Wash sales
  totalWashSaleDisallowed = (): number => {
    return this.transactions().reduce(
      (sum, t) => sum + (t.washSaleLossDisallowed ?? 0),
      0
    )
  }

  // Federal tax withheld
  totalFederalTaxWithheld = (): number => {
    return this.transactions().reduce((sum, t) => sum + t.federalTaxWithheld, 0)
  }

  fields = (): Field[] => {
    const data = this.f1099BData()
    const transactions = this.transactions()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      // Recipient info
      data?.recipientName ?? '',
      data?.recipientAddress ?? '',
      data?.recipientTIN ?? '',
      data?.accountNumber ?? '',
      // Transaction 1
      transactions[0]?.description ?? '',
      transactions[0]?.dateAcquired?.toLocaleDateString() ?? '',
      transactions[0]?.dateSold?.toLocaleDateString() ?? '',
      transactions[0]?.proceeds ?? 0,
      transactions[0]?.costBasis ?? 0,
      transactions[0]?.washSaleLossDisallowed ?? 0,
      transactions[0]?.shortTermLongTerm ?? '',
      transactions[0]?.federalTaxWithheld ?? 0,
      transactions[0]?.noncoveredSecurity ?? false,
      transactions[0]?.basisReportedToIRS ?? false,
      // Transaction 2
      transactions[1]?.description ?? '',
      transactions[1]?.proceeds ?? 0,
      transactions[1]?.costBasis ?? 0,
      // Summary
      this.transactions().length,
      this.totalProceeds(),
      this.totalCostBasis(),
      this.totalGainLoss(),
      this.shortTermGainLoss(),
      this.longTermGainLoss(),
      this.totalWashSaleDisallowed(),
      this.totalFederalTaxWithheld(),
      // State
      data?.stateTaxWithheld ?? 0,
      data?.stateId ?? '',
      data?.stateIncome ?? 0
    ]
  }
}
