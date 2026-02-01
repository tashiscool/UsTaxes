import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form 1099-A - Acquisition or Abandonment of Secured Property
 *
 * Reports information about:
 * - Foreclosure on property securing a loan
 * - Deed in lieu of foreclosure
 * - Abandonment of secured property
 * - Short sale of secured property
 *
 * This form helps determine gain or loss on the disposition
 * of the property for tax purposes.
 */

export interface F1099AData {
  // Lender information
  lenderName: string
  lenderAddress: string
  lenderTIN: string
  lenderPhone: string
  // Borrower information
  borrowerName: string
  borrowerAddress: string
  borrowerTIN: string
  // Account number
  accountNumber?: string
  // Property/Transaction details
  dateOfAcquisition: Date // Box 1
  principalBalance: number // Box 2
  fairMarketValue: number // Box 4
  wasPersonallyLiable: boolean // Box 5
  propertyDescription: string // Box 6
}

export default class F1099A extends F1040Attachment {
  tag: FormTag = 'f1099a'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasF1099AData()
  }

  hasF1099AData = (): boolean => {
    return false
  }

  f1099AData = (): F1099AData | undefined => {
    return undefined
  }

  // Box 1: Date of lender's acquisition or knowledge of abandonment
  dateOfAcquisition = (): Date | undefined => {
    return this.f1099AData()?.dateOfAcquisition
  }

  // Box 2: Balance of principal outstanding
  principalBalance = (): number => {
    return this.f1099AData()?.principalBalance ?? 0
  }

  // Box 4: Fair market value of property
  fairMarketValue = (): number => {
    return this.f1099AData()?.fairMarketValue ?? 0
  }

  // Box 5: Was borrower personally liable for repayment?
  wasPersonallyLiable = (): boolean => {
    return this.f1099AData()?.wasPersonallyLiable ?? false
  }

  // Box 6: Description of property
  propertyDescription = (): string => {
    return this.f1099AData()?.propertyDescription ?? ''
  }

  // Calculate potential gain/loss
  // If personally liable: Amount realized = lesser of FMV or debt
  // If not personally liable: Amount realized = debt amount
  amountRealized = (): number => {
    if (this.wasPersonallyLiable()) {
      return Math.min(this.fairMarketValue(), this.principalBalance())
    }
    return this.principalBalance()
  }

  // Cancellation of debt income (if personally liable and FMV < debt)
  cancellationOfDebtIncome = (): number => {
    if (
      this.wasPersonallyLiable() &&
      this.fairMarketValue() < this.principalBalance()
    ) {
      return this.principalBalance() - this.fairMarketValue()
    }
    return 0
  }

  // Is this residential property?
  isResidentialProperty = (): boolean => {
    const desc = this.propertyDescription().toLowerCase()
    return (
      desc.includes('home') ||
      desc.includes('residence') ||
      desc.includes('house')
    )
  }

  fields = (): Field[] => {
    const data = this.f1099AData()

    return [
      // Lender info
      data?.lenderName ?? '',
      data?.lenderAddress ?? '',
      data?.lenderTIN ?? '',
      data?.lenderPhone ?? '',
      // Borrower info
      data?.borrowerName ?? '',
      data?.borrowerAddress ?? '',
      data?.borrowerTIN ?? '',
      data?.accountNumber ?? '',
      // Transaction details
      data?.dateOfAcquisition.toLocaleDateString() ?? '', // Box 1
      data?.principalBalance ?? 0, // Box 2
      data?.fairMarketValue ?? 0, // Box 4
      data?.wasPersonallyLiable ?? false, // Box 5
      data?.propertyDescription ?? '', // Box 6
      // Calculations
      this.amountRealized(),
      this.cancellationOfDebtIncome(),
      this.isResidentialProperty()
    ]
  }
}
