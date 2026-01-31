import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-MISC - Miscellaneous Information
 *
 * Reports miscellaneous income including:
 * - Rents
 * - Royalties
 * - Other income
 * - Fishing boat proceeds
 * - Medical and health care payments
 * - Crop insurance proceeds
 * - Payments to attorneys
 * - Section 409A deferrals
 * - Nonqualified deferred compensation
 *
 * Note: Nonemployee compensation (Box 7) moved to Form 1099-NEC starting 2020.
 */

export interface F1099MISCData {
  // Payer information
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
  // Amounts
  rents: number                    // Box 1
  royalties: number                // Box 2
  otherIncome: number              // Box 3
  federalTaxWithheld: number       // Box 4
  fishingBoatProceeds: number      // Box 5
  medicalHealthPayments: number    // Box 6
  // Box 7 is now on 1099-NEC
  substitutePayments: number       // Box 8
  cropInsurance: number            // Box 9
  grossProceedsAttorney: number    // Box 10
  fishPurchased: number            // Box 11
  section409ADeferrals: number     // Box 12
  // Box 13 is reserved
  excessGoldenParachute: number    // Box 14
  nonqualifiedDeferredComp: number // Box 15
  // State information
  stateTaxWithheld: number         // Box 16
  statePayerNumber: string         // Box 17
  stateIncome: number              // Box 18
}

export default class F1099MISC extends F1040Attachment {
  tag: FormTag = 'f1099misc'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099MISCData()
  }

  hasF1099MISCData = (): boolean => {
    return false  // Would check for 1099-MISC data
  }

  f1099MISCData = (): F1099MISCData | undefined => {
    return undefined
  }

  // Total income from 1099-MISC
  totalIncome = (): number => {
    const data = this.f1099MISCData()
    if (!data) return 0
    return data.rents + data.royalties + data.otherIncome +
           data.fishingBoatProceeds + data.medicalHealthPayments +
           data.cropInsurance + data.grossProceedsAttorney
  }

  // Rents go to Schedule E
  rentsToScheduleE = (): number => this.f1099MISCData()?.rents ?? 0

  // Royalties go to Schedule E
  royaltiesToScheduleE = (): number => this.f1099MISCData()?.royalties ?? 0

  // Other income goes to Schedule 1
  otherIncomeToSchedule1 = (): number => this.f1099MISCData()?.otherIncome ?? 0

  fields = (): Field[] => {
    const data = this.f1099MISCData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      data?.payerPhone ?? '',
      // Recipient info
      data?.recipientName ?? '',
      data?.recipientAddress ?? '',
      data?.recipientTIN ?? '',
      data?.accountNumber ?? '',
      // Amounts
      data?.rents ?? 0,                    // Box 1
      data?.royalties ?? 0,                // Box 2
      data?.otherIncome ?? 0,              // Box 3
      data?.federalTaxWithheld ?? 0,       // Box 4
      data?.fishingBoatProceeds ?? 0,      // Box 5
      data?.medicalHealthPayments ?? 0,    // Box 6
      data?.substitutePayments ?? 0,       // Box 8
      data?.cropInsurance ?? 0,            // Box 9
      data?.grossProceedsAttorney ?? 0,    // Box 10
      data?.fishPurchased ?? 0,            // Box 11
      data?.section409ADeferrals ?? 0,     // Box 12
      data?.excessGoldenParachute ?? 0,    // Box 14
      data?.nonqualifiedDeferredComp ?? 0, // Box 15
      // State
      data?.stateTaxWithheld ?? 0,
      data?.statePayerNumber ?? '',
      data?.stateIncome ?? 0,
      // Totals
      this.totalIncome()
    ]
  }
}
