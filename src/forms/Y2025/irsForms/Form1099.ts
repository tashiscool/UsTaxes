import Form from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  Form1099NECGenerated,
  Form1099MISCGenerated,
  Form1099INTGenerated,
  Form1099DIVGenerated,
  Form1099BGenerated,
  Form1099RGenerated,
  Form1099SGenerated,
  Generated1099Form
} from 'ustaxes/core/data'

/**
 * Form 1099 Series - Information Returns
 *
 * Businesses use 1099 forms to report various types of payments to recipients
 * and the IRS. The payer files these forms.
 *
 * Common 1099 forms:
 * - 1099-NEC: Nonemployee compensation ($600+ threshold)
 * - 1099-MISC: Rents, royalties, prizes, other income
 * - 1099-INT: Interest income ($10+ threshold)
 * - 1099-DIV: Dividends ($10+ threshold)
 * - 1099-B: Broker transactions
 * - 1099-R: Retirement distributions
 * - 1099-S: Real estate transactions
 * - 1099-K: Payment card/network transactions
 *
 * Filing deadlines (2025 for 2024 tax year):
 * - 1099-NEC: January 31 to recipient AND IRS
 * - Other 1099s: January 31 to recipient, February 28/March 31 to IRS
 *
 * Electronic filing required for 10+ forms
 */

// Base class for all 1099 form types
export abstract class Form1099Base extends Form {
  abstract formType: string
  abstract formData: Generated1099Form

  // Common payer fields
  payerName = (): string => this.formData.payerName
  payerTIN = (): string => this.formData.payerTIN
  payerAddress = (): string => {
    const addr = this.formData.payerAddress
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${addr.zip ?? ''}`
  }

  // Common recipient fields
  recipientName = (): string => this.formData.recipientName
  recipientTIN = (): string => this.formData.recipientTIN
  recipientAddress = (): string => {
    const addr = this.formData.recipientAddress
    if (!addr) return ''
    return `${addr.address}, ${addr.city}, ${addr.state ?? ''} ${addr.zip ?? ''}`
  }

  accountNumber = (): string => this.formData.accountNumber ?? ''
  taxYear = (): number => this.formData.taxYear
}

/**
 * Form 1099-NEC - Nonemployee Compensation
 */
export class Form1099NEC extends Form1099Base {
  tag: FormTag = 'f1099nec'
  sequenceIndex = 999
  formType = '1099-NEC'

  formData: Form1099NECGenerated

  constructor(data: Form1099NECGenerated) {
    super()
    this.formData = data
  }

  // Box 1: Nonemployee compensation
  box1 = (): number => this.formData.box1NonemployeeCompensation

  // Box 4: Federal income tax withheld
  box4 = (): number => this.formData.box4FederalWithholding ?? 0

  // Box 5: State tax withheld
  box5 = (): number => this.formData.box5StateTaxWithheld ?? 0

  // Box 6: State/Payer's state no.
  box6 = (): string => this.formData.box6StateId ?? ''

  // Box 7: State income
  box7 = (): number => this.formData.box7StateIncome ?? 0

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.payerAddress(),
    this.recipientName(),
    this.recipientTIN(),
    this.recipientAddress(),
    this.accountNumber(),
    this.box1(),
    this.box4(),
    this.box5(),
    this.box6(),
    this.box7()
  ]
}

/**
 * Form 1099-MISC - Miscellaneous Information
 */
export class Form1099MISC extends Form1099Base {
  tag: FormTag = 'f1099misc'
  sequenceIndex = 999
  formType = '1099-MISC'

  formData: Form1099MISCGenerated

  constructor(data: Form1099MISCGenerated) {
    super()
    this.formData = data
  }

  box1 = (): number => this.formData.box1Rents ?? 0
  box2 = (): number => this.formData.box2Royalties ?? 0
  box3 = (): number => this.formData.box3OtherIncome ?? 0
  box4 = (): number => this.formData.box4FederalWithholding ?? 0
  box5 = (): number => this.formData.box5FishingBoatProceeds ?? 0
  box6 = (): number => this.formData.box6MedicalPayments ?? 0
  box8 = (): number => this.formData.box8SubstitutePayments ?? 0
  box9 = (): number => this.formData.box9CropInsurance ?? 0
  box10 = (): number => this.formData.box10GrossProceedsAttorney ?? 0
  box11 = (): number => this.formData.box11FishPurchased ?? 0
  box12 = (): number => this.formData.box12Section409A ?? 0
  box14 = (): number => this.formData.box14NonqualifiedDeferredComp ?? 0

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.recipientName(),
    this.recipientTIN(),
    this.box1(),
    this.box2(),
    this.box3(),
    this.box4(),
    this.box5(),
    this.box6(),
    this.box8(),
    this.box9(),
    this.box10(),
    this.box11(),
    this.box12(),
    this.box14()
  ]
}

/**
 * Form 1099-INT - Interest Income
 */
export class Form1099INT extends Form1099Base {
  tag: FormTag = 'f1099int'
  sequenceIndex = 999
  formType = '1099-INT'

  formData: Form1099INTGenerated

  constructor(data: Form1099INTGenerated) {
    super()
    this.formData = data
  }

  box1 = (): number => this.formData.box1Interest
  box2 = (): number => this.formData.box2EarlyWithdrawalPenalty ?? 0
  box3 = (): number => this.formData.box3USBondInterest ?? 0
  box4 = (): number => this.formData.box4FederalWithholding ?? 0
  box5 = (): number => this.formData.box5InvestmentExpenses ?? 0
  box6 = (): number => this.formData.box6ForeignTaxPaid ?? 0
  box8 = (): number => this.formData.box8TaxExemptInterest ?? 0

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.recipientName(),
    this.recipientTIN(),
    this.box1(),
    this.box2(),
    this.box3(),
    this.box4(),
    this.box5(),
    this.box6(),
    this.box8()
  ]
}

/**
 * Form 1099-DIV - Dividends and Distributions
 */
export class Form1099DIV extends Form1099Base {
  tag: FormTag = 'f1099div'
  sequenceIndex = 999
  formType = '1099-DIV'

  formData: Form1099DIVGenerated

  constructor(data: Form1099DIVGenerated) {
    super()
    this.formData = data
  }

  box1a = (): number => this.formData.box1aTotalOrdinaryDividends
  box1b = (): number => this.formData.box1bQualifiedDividends
  box2a = (): number => this.formData.box2aTotalCapitalGainDist ?? 0
  box2b = (): number => this.formData.box2bUnrecaptured1250Gain ?? 0
  box2c = (): number => this.formData.box2cSection1202Gain ?? 0
  box2d = (): number => this.formData.box2dCollectiblesGain ?? 0
  box3 = (): number => this.formData.box3NondividendDistributions ?? 0
  box4 = (): number => this.formData.box4FederalWithholding ?? 0
  box5 = (): number => this.formData.box5Section199ADividends ?? 0

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.recipientName(),
    this.recipientTIN(),
    this.box1a(),
    this.box1b(),
    this.box2a(),
    this.box2b(),
    this.box2c(),
    this.box2d(),
    this.box3(),
    this.box4(),
    this.box5()
  ]
}

/**
 * Form 1099-B - Proceeds from Broker Transactions
 */
export class Form1099B extends Form1099Base {
  tag: FormTag = 'f1099b'
  sequenceIndex = 999
  formType = '1099-B'

  formData: Form1099BGenerated

  constructor(data: Form1099BGenerated) {
    super()
    this.formData = data
  }

  box1a = (): string => this.formData.box1aDescription
  box1b = (): string => this.formData.box1bDateAcquired ?? ''
  box1c = (): string => this.formData.box1cDateSold
  box1d = (): number => this.formData.box1dProceeds
  box1e = (): number => this.formData.box1eCostBasis ?? 0
  box1f = (): number => this.formData.box1fAccruedMarketDiscount ?? 0
  box1g = (): number => this.formData.box1gWashSaleDisallowed ?? 0
  box4 = (): number => this.formData.box4FederalWithholding ?? 0

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.recipientName(),
    this.recipientTIN(),
    this.box1a(),
    this.box1b(),
    this.box1c(),
    this.box1d(),
    this.box1e(),
    this.box1f(),
    this.box1g(),
    this.box4()
  ]
}

/**
 * Form 1099-R - Distributions from Pensions, Annuities, etc.
 */
export class Form1099R extends Form1099Base {
  tag: FormTag = 'f1099r'
  sequenceIndex = 999
  formType = '1099-R'

  formData: Form1099RGenerated

  constructor(data: Form1099RGenerated) {
    super()
    this.formData = data
  }

  box1 = (): number => this.formData.box1GrossDistribution
  box2a = (): number => this.formData.box2aTaxableAmount
  box2bNotDetermined = (): boolean => this.formData.box2bTaxableNotDetermined ?? false
  box2bTotal = (): boolean => this.formData.box2bTotalDistribution ?? false
  box3 = (): number => this.formData.box3CapitalGain ?? 0
  box4 = (): number => this.formData.box4FederalWithholding ?? 0
  box5 = (): number => this.formData.box5EmployeeContributions ?? 0
  box6 = (): number => this.formData.box6NetUnrealizedAppreciation ?? 0
  box7 = (): string => this.formData.box7DistributionCode
  box7IRA = (): boolean => this.formData.box7IRASEPSimple ?? false

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.recipientName(),
    this.recipientTIN(),
    this.box1(),
    this.box2a(),
    this.box2bNotDetermined(),
    this.box2bTotal(),
    this.box3(),
    this.box4(),
    this.box5(),
    this.box6(),
    this.box7(),
    this.box7IRA()
  ]
}

/**
 * Form 1099-S - Proceeds from Real Estate Transactions
 */
export class Form1099S extends Form1099Base {
  tag: FormTag = 'f1099s'
  sequenceIndex = 999
  formType = '1099-S'

  formData: Form1099SGenerated

  constructor(data: Form1099SGenerated) {
    super()
    this.formData = data
  }

  box1 = (): string => this.formData.box1DateOfClosing
  box2 = (): number => this.formData.box2GrossProceeds
  box3 = (): string => this.formData.box3AddressOfProperty
  box4 = (): boolean => this.formData.box4BuyerReceivedPropertyTax ?? false
  box5 = (): number => this.formData.box5BuyerPart ?? 0
  box6 = (): boolean => this.formData.box6ForeignPerson ?? false

  fields = (): Field[] => [
    this.payerName(),
    this.payerTIN(),
    this.recipientName(),
    this.recipientTIN(),
    this.box1(),
    this.box2(),
    this.box3(),
    this.box4(),
    this.box5(),
    this.box6()
  ]
}
