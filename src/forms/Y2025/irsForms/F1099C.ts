/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { CancellationOfDebtRecord } from 'ustaxes/core/data'

/**
 * Form 1099-C - Cancellation of Debt
 *
 * Reports cancellation of debt of $600 or more.
 * Cancelled debt is generally taxable income unless an exception applies.
 *
 * Exceptions include:
 * - Bankruptcy (Title 11)
 * - Insolvency
 * - Qualified farm debt
 * - Qualified real property business debt
 * - Qualified principal residence indebtedness
 *
 * Reported on Schedule 1 Line 8c unless excluded via Form 982.
 */

export interface F1099CData {
  // Creditor information
  creditorName: string
  creditorAddress: string
  creditorTIN: string
  creditorPhone: string
  // Debtor information
  debtorName: string
  debtorAddress: string
  debtorTIN: string
  // Account number
  accountNumber?: string
  // Debt cancellation details
  dateOfIdentifiableEvent: Date // Box 1
  amountOfDebtCancelled: number // Box 2
  interestIncludedInBox2: number // Box 3
  debtDescription: string // Box 4
  personallyLiable: boolean // Box 5 checkbox
  identifiableEventCode: string // Box 6
  fairMarketValueOfProperty: number // Box 7
  totalExcludedFromGrossIncome?: number
  exclusionReason?: string
}

// Identifiable event codes
const EVENT_CODES: Record<string, string> = {
  A: 'Bankruptcy',
  B: 'Other judicial debt relief',
  C: 'Statute of limitations or expiration of deficiency period',
  D: 'Foreclosure election',
  E: 'Debt relief from probate or similar proceeding',
  F: 'By agreement',
  G: 'Decision or policy to discontinue collection',
  H: 'Other actual discharge'
}

export default class F1099C extends F1040Attachment {
  tag: FormTag = 'f1099c'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099CData()
  }

  hasF1099CData = (): boolean => {
    return this.f1099CRecords().length > 0
  }

  f1099CData = (): F1099CData | undefined => {
    return this.f1099CRecords()[0]
  }

  f1099CRecords = (): F1099CData[] =>
    (this.f1040.info.cancellationOfDebtRecords ?? []).map(
      (record: CancellationOfDebtRecord): F1099CData => ({
        creditorName: record.creditorName ?? '',
        creditorAddress: record.creditorAddress ?? '',
        creditorTIN: record.creditorTIN ?? '',
        creditorPhone: record.creditorPhone ?? '',
        debtorName: record.debtorName ?? this.f1040.namesString(),
        debtorAddress: record.debtorAddress ?? '',
        debtorTIN: record.debtorTIN ?? this.f1040.info.taxPayer.primaryPerson.ssid,
        accountNumber: record.accountNumber,
        dateOfIdentifiableEvent:
          record.dateOfIdentifiableEvent instanceof Date
            ? record.dateOfIdentifiableEvent
            : new Date('2025-12-31'),
        amountOfDebtCancelled: record.amountOfDebtCancelled,
        interestIncludedInBox2: record.interestIncludedInBox2 ?? 0,
        debtDescription: record.debtDescription ?? '',
        personallyLiable: record.personallyLiable ?? false,
        identifiableEventCode: record.identifiableEventCode ?? '',
        fairMarketValueOfProperty: record.fairMarketValueOfProperty ?? 0,
        totalExcludedFromGrossIncome: record.totalExcludedFromGrossIncome,
        exclusionReason: record.exclusionReason
      })
    )

  // Box 2: Amount of debt cancelled
  amountOfDebtCancelled = (): number => {
    return this.f1099CRecords().reduce(
      (sum, record) => sum + record.amountOfDebtCancelled,
      0
    )
  }

  excludedFromGrossIncome = (): number => {
    return this.f1099CRecords().reduce(
      (sum, record) => sum + (record.totalExcludedFromGrossIncome ?? 0),
      0
    )
  }

  // Box 3: Interest included
  interestIncluded = (): number => {
    return this.f1099CData()?.interestIncludedInBox2 ?? 0
  }

  // Box 6: Identifiable event code
  eventCode = (): string => {
    return this.f1099CData()?.identifiableEventCode ?? ''
  }

  eventCodeDescription = (): string => {
    return EVENT_CODES[this.eventCode()] ?? 'Unknown'
  }

  // Box 7: FMV of property (for foreclosures)
  fairMarketValueOfProperty = (): number => {
    return this.f1099CData()?.fairMarketValueOfProperty ?? 0
  }

  // Was debtor personally liable?
  wasPersonallyLiable = (): boolean => {
    return this.f1099CData()?.personallyLiable ?? false
  }

  // Is this excludable from income? (Needs Form 982 analysis)
  mayBeExcludable = (): boolean => {
    const code = this.eventCode()
    // Bankruptcy is typically excludable
    return code === 'A'
  }

  // To Schedule 1 Line 8c (unless excluded)
  toSchedule1Line8c = (): number =>
    Math.max(0, this.amountOfDebtCancelled() - this.excludedFromGrossIncome())

  fields = (): Field[] => {
    const data = this.f1099CData()

    return [
      // Creditor info
      data?.creditorName ?? '',
      data?.creditorAddress ?? '',
      data?.creditorTIN ?? '',
      data?.creditorPhone ?? '',
      // Debtor info
      data?.debtorName ?? '',
      data?.debtorAddress ?? '',
      data?.debtorTIN ?? '',
      data?.accountNumber ?? '',
      // Debt details
      data?.dateOfIdentifiableEvent.toLocaleDateString() ?? '', // Box 1
      data?.amountOfDebtCancelled ?? 0, // Box 2
      data?.interestIncludedInBox2 ?? 0, // Box 3
      data?.debtDescription ?? '', // Box 4
      data?.personallyLiable ?? false, // Box 5
      data?.identifiableEventCode ?? '', // Box 6
      data?.fairMarketValueOfProperty ?? 0, // Box 7
      // Analysis
      this.eventCodeDescription(),
      this.wasPersonallyLiable(),
      this.mayBeExcludable(),
      this.toSchedule1Line8c()
    ]
  }
}
