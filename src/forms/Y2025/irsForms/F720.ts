import { BusinessForm } from './BusinessForm'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form720Data, BusinessEntity, ExciseTaxItem } from 'ustaxes/core/data'

/**
 * Form 720 - Quarterly Federal Excise Tax Return
 *
 * Used to report federal excise taxes including:
 * - Fuel taxes (gasoline, diesel, aviation fuel)
 * - Environmental taxes (ozone-depleting chemicals, petroleum)
 * - Communications taxes (local/toll telephone service)
 * - Air transportation taxes (passenger and freight)
 * - Heavy truck/trailer first retail sale tax
 * - Indoor tanning services tax
 * - Vaccines taxes
 * - Manufacturer's taxes on various products
 *
 * Due dates:
 * - Q1: April 30
 * - Q2: July 31
 * - Q3: October 31
 * - Q4: January 31
 */

export default class F720 extends BusinessForm {
  tag: FormTag = 'f720'
  sequenceIndex = 0

  formData: Form720Data

  constructor(data: Form720Data) {
    super()
    this.formData = data
  }

  get entityData(): BusinessEntity {
    return this.formData.entity
  }

  quarter = (): 1 | 2 | 3 | 4 => this.formData.quarter
  year = (): number => this.formData.year

  exciseTaxItems = (): ExciseTaxItem[] => this.formData.exciseTaxItems

  // Part I - IRS No. taxes grouped by category

  // Fuel taxes
  fuelTaxItems = (): ExciseTaxItem[] => {
    return this.exciseTaxItems().filter((i) => i.category === 'fuel')
  }

  fuelTaxTotal = (): number => {
    return this.fuelTaxItems().reduce((sum, i) => sum + i.taxAmount, 0)
  }

  // Environmental taxes
  environmentalTaxItems = (): ExciseTaxItem[] => {
    return this.exciseTaxItems().filter((i) => i.category === 'environmental')
  }

  environmentalTaxTotal = (): number => {
    return this.environmentalTaxItems().reduce((sum, i) => sum + i.taxAmount, 0)
  }

  // Communications taxes
  communicationsTaxItems = (): ExciseTaxItem[] => {
    return this.exciseTaxItems().filter((i) => i.category === 'communications')
  }

  communicationsTaxTotal = (): number => {
    return this.communicationsTaxItems().reduce(
      (sum, i) => sum + i.taxAmount,
      0
    )
  }

  // Air transportation taxes
  airTransportationTaxItems = (): ExciseTaxItem[] => {
    return this.exciseTaxItems().filter(
      (i) => i.category === 'airTransportation'
    )
  }

  airTransportationTaxTotal = (): number => {
    return this.airTransportationTaxItems().reduce(
      (sum, i) => sum + i.taxAmount,
      0
    )
  }

  // Manufacturer's taxes
  manufacturerTaxItems = (): ExciseTaxItem[] => {
    return this.exciseTaxItems().filter((i) => i.category === 'manufacturer')
  }

  manufacturerTaxTotal = (): number => {
    return this.manufacturerTaxItems().reduce((sum, i) => sum + i.taxAmount, 0)
  }

  // Indoor tanning
  indoorTanningTaxItems = (): ExciseTaxItem[] => {
    return this.exciseTaxItems().filter((i) => i.category === 'indoorTanning')
  }

  indoorTanningTaxTotal = (): number => {
    return this.indoorTanningTaxItems().reduce((sum, i) => sum + i.taxAmount, 0)
  }

  // Part I Total
  partITotal = (): number => {
    return this.formData.totalTaxLiability
  }

  // Part II - Adjustments
  adjustments = (): number => this.formData.adjustments

  // Part III - Total tax liability
  totalTaxLiability = (): number => this.partITotal() + this.adjustments()

  // Part IV - Deposits
  depositsForQuarter = (): number => this.formData.depositsForQuarter

  // Part V - Claims for refund/credit
  claimsForRefund = (): number => this.formData.claimsForRefund

  // Net tax
  netTax = (): number => this.formData.netTax

  // Balance due or overpayment
  balanceDue = (): number =>
    Math.max(
      0,
      this.totalTaxLiability() -
        this.depositsForQuarter() -
        this.claimsForRefund()
    )
  overpayment = (): number =>
    Math.max(
      0,
      this.depositsForQuarter() +
        this.claimsForRefund() -
        this.totalTaxLiability()
    )

  // Due date
  dueDate = (): string => {
    const q = this.quarter()
    const year = this.year()
    switch (q) {
      case 1:
        return `April 30, ${year}`
      case 2:
        return `July 31, ${year}`
      case 3:
        return `October 31, ${year}`
      case 4:
        return `January 31, ${year + 1}`
    }
  }

  fields = (): Field[] => [
    this.entityName(),
    this.ein(),
    this.address(),
    this.addressLine(),
    this.quarter(),
    this.year(),
    // Part I totals by category
    this.fuelTaxTotal(),
    this.environmentalTaxTotal(),
    this.communicationsTaxTotal(),
    this.airTransportationTaxTotal(),
    this.manufacturerTaxTotal(),
    this.indoorTanningTaxTotal(),
    this.partITotal(),
    // Part II
    this.adjustments(),
    // Part III
    this.totalTaxLiability(),
    // Part IV
    this.depositsForQuarter(),
    // Part V
    this.claimsForRefund(),
    // Net
    this.netTax(),
    this.balanceDue(),
    this.overpayment()
  ]
}
