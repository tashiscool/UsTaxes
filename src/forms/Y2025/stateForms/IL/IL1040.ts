import Form, { FormMethods } from 'ustaxes/core/stateForms/Form'
import F1040 from '../../irsForms/F1040'
import { Field } from 'ustaxes/core/pdfFiller'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { AccountType, FilingStatus, State } from 'ustaxes/core/data'
import parameters from './Parameters'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Illinois Form IL-1040 - Individual Income Tax Return
 *
 * Illinois uses a flat 4.95% income tax rate
 * Exemptions phase out at higher income levels
 */
export class IL1040 extends Form {
  info: ValidatedInformation
  f1040: F1040
  formName: string
  state: State
  formOrder = 0
  methods: FormMethods

  constructor(f1040: F1040) {
    super()
    this.info = f1040.info
    this.f1040 = f1040
    this.formName = 'IL-1040'
    this.state = 'IL'
    this.methods = new FormMethods(this)
  }

  attachments = (): Form[] => []

  // Taxpayer information
  primaryFirstName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.firstName

  primaryLastName = (): string | undefined =>
    this.info.taxPayer.primaryPerson.lastName

  primarySSN = (): string | undefined => this.info.taxPayer.primaryPerson.ssid

  spouseFirstName = (): string | undefined =>
    this.info.taxPayer.spouse?.firstName

  spouseLastName = (): string | undefined => this.info.taxPayer.spouse?.lastName

  spouseSSN = (): string | undefined => this.info.taxPayer.spouse?.ssid

  address = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.address

  city = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.city

  stateField = (): string | undefined =>
    this.info.taxPayer.primaryPerson.address.state

  zip = (): string | undefined => this.info.taxPayer.primaryPerson.address.zip

  filingStatus = (): FilingStatus | undefined => this.info.taxPayer.filingStatus

  // Line 1 - Federal adjusted gross income
  l1 = (): number => this.f1040.l11()

  // Line 2 - Federally tax-exempt interest and dividend income
  l2 = (): number | undefined => undefined

  // Line 3 - Other additions from Schedule M
  l3 = (): number | undefined => undefined

  // Line 4 - Total income (add Lines 1, 2, and 3)
  l4 = (): number => sumFields([this.l1(), this.l2(), this.l3()])

  // Line 5 - Social Security benefits and retirement income
  // IL doesn't tax Social Security or most retirement income
  l5 = (): number | undefined => this.f1040.l6b()

  // Line 6 - Illinois Income Tax overpayment from prior year
  l6 = (): number | undefined => undefined

  // Line 7 - Other subtractions from Schedule M
  l7 = (): number | undefined => undefined

  // Line 8 - Total subtractions (add Lines 5, 6, and 7)
  l8 = (): number => sumFields([this.l5(), this.l6(), this.l7()])

  // Line 9 - Illinois base income (Line 4 minus Line 8)
  l9 = (): number => Math.max(0, this.l4() - this.l8())

  // Line 10 - Exemption allowance
  l10 = (): number => {
    const status = this.filingStatus() ?? FilingStatus.S
    const exemptionInfo = parameters.exemptions[status]
    const income = this.l9()

    // Check if income is within exemption eligibility range
    if (income < exemptionInfo.incomeLowerLimit) {
      return 0
    }
    if (income > exemptionInfo.incomeUpperLimit) {
      return 0
    }

    let totalExemption = exemptionInfo.exemptionAmount

    // Add dependent exemptions
    const numDependents = this.info.taxPayer.dependents.length
    totalExemption += numDependents * parameters.dependentExemption

    // Add senior exemption (65+) for primary
    const primaryAge = this.info.taxPayer.primaryPerson.dateOfBirth
      ? new Date().getFullYear() -
        new Date(this.info.taxPayer.primaryPerson.dateOfBirth).getFullYear()
      : 0
    if (primaryAge >= 65) {
      totalExemption += parameters.seniorExemption
    }

    // Add senior exemption for spouse if MFJ
    if (status === FilingStatus.MFJ && this.info.taxPayer.spouse?.dateOfBirth) {
      const spouseAge =
        new Date().getFullYear() -
        new Date(this.info.taxPayer.spouse.dateOfBirth).getFullYear()
      if (spouseAge >= 65) {
        totalExemption += parameters.seniorExemption
      }
    }

    return totalExemption
  }

  // Line 11 - Net income (Line 9 minus Line 10)
  l11 = (): number => Math.max(0, this.l9() - this.l10())

  // Line 12 - Illinois Income Tax (Line 11 × 4.95%)
  l12 = (): number => Math.round(this.l11() * parameters.taxRate)

  // Line 13 - Recapture of investment credits
  l13 = (): number | undefined => undefined

  // Line 14 - Total tax (add Lines 12 and 13)
  l14 = (): number => sumFields([this.l12(), this.l13()])

  // Credits
  // Line 15 - Income tax paid to other states
  l15 = (): number | undefined => undefined

  // Line 16 - Property tax credit (5% of property taxes paid)
  l16 = (): number | undefined => {
    // Simplified: would need property tax data
    return undefined
  }

  // Line 17 - K-12 education expense credit
  l17 = (): number | undefined => {
    // Simplified: would need education expense data
    return undefined
  }

  // Line 18 - Earned Income Credit (20% of federal EIC)
  l18 = (): number | undefined => {
    const federalEIC = this.f1040.scheduleEIC.credit()
    if (federalEIC && federalEIC > 0) {
      return Math.round(federalEIC * parameters.earnedIncomeCreditFactor)
    }
    return undefined
  }

  // Line 19 - Other credits from Schedule 1299-C
  l19 = (): number | undefined => undefined

  // Line 20 - Total credits (add Lines 15 through 19)
  l20 = (): number =>
    sumFields([this.l15(), this.l16(), this.l17(), this.l18(), this.l19()])

  // Line 21 - Net tax (Line 14 minus Line 20, but not less than zero)
  l21 = (): number => Math.max(0, this.l14() - this.l20())

  // Line 22 - Household employment tax
  l22 = (): number | undefined => undefined

  // Line 23 - Use tax on internet/mail order purchases
  l23 = (): number | undefined => undefined

  // Line 24 - Compassionate Use of Medical Cannabis Fund surcharge
  l24 = (): number | undefined => undefined

  // Line 25 - Total tax and other amounts (add Lines 21 through 24)
  l25 = (): number =>
    sumFields([this.l21(), this.l22(), this.l23(), this.l24()])

  // Payments
  // Line 26 - Illinois income tax withheld
  l26 = (): number | undefined => this.methods.witholdingForState('IL')

  // Line 27 - Estimated tax payments
  l27 = (): number | undefined => undefined

  // Line 28 - Pass-through entity payments
  l28 = (): number | undefined => undefined

  // Line 29 - Credit for tax paid to other states
  l29 = (): number | undefined => undefined

  // Line 30 - Total payments (add Lines 26 through 29)
  l30 = (): number =>
    sumFields([this.l26(), this.l27(), this.l28(), this.l29()])

  // Results
  // Line 31 - Overpayment (if Line 30 > Line 25)
  l31 = (): number => Math.max(0, this.l30() - this.l25())

  // Line 32 - Amount due (if Line 25 > Line 30)
  l32 = (): number => Math.max(0, this.l25() - this.l30())

  // Line 33 - Refund amount
  l33 = (): number => this.l31()

  payment = (): number | undefined => {
    const due = this.l32()
    return due > 0 ? due : undefined
  }

  // Bank information for direct deposit
  routingNumber = (): string | undefined => this.info.refund?.routingNumber
  accountNumber = (): string | undefined => this.info.refund?.accountNumber
  accountType = (): AccountType | undefined => this.info.refund?.accountType

  fields = (): Field[] => [
    this.primaryFirstName(),
    this.primaryLastName(),
    this.primarySSN(),
    this.spouseFirstName(),
    this.spouseLastName(),
    this.spouseSSN(),
    this.address(),
    this.city(),
    this.stateField(),
    this.zip(),
    this.filingStatus() === FilingStatus.S,
    this.filingStatus() === FilingStatus.MFJ,
    this.filingStatus() === FilingStatus.MFS,
    this.filingStatus() === FilingStatus.HOH,
    this.filingStatus() === FilingStatus.W,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    this.l18(),
    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24(),
    this.l25(),
    this.l26(),
    this.l27(),
    this.l28(),
    this.l29(),
    this.l30(),
    this.l31(),
    this.l32(),
    this.l33(),
    this.routingNumber(),
    this.accountNumber(),
    this.accountType() === AccountType.checking,
    this.accountType() === AccountType.savings
  ]
}

const makeIL1040 = (f1040: F1040): IL1040 => new IL1040(f1040)

export default makeIL1040
