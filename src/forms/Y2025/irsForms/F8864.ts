import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8864Data } from 'ustaxes/core/data'

/**
 * Form 8864 - Biodiesel and Renewable Diesel Fuels Credit
 *
 * Credit for producers, blenders, or retailers of biodiesel
 * and renewable diesel fuel mixtures.
 *
 * Credit rates (2025):
 * - Biodiesel: $1.00 per gallon
 * - Agri-biodiesel: $1.00 per gallon
 * - Renewable diesel: $1.00 per gallon
 * - Biodiesel/renewable diesel mixtures: $1.00 per gallon of biodiesel used
 *
 * Definitions:
 * - Biodiesel: Monoalkyl esters of long chain fatty acids from plant/animal matter
 * - Agri-biodiesel: Biodiesel from virgin agricultural products
 * - Renewable diesel: Liquid fuel from biomass meeting ASTM D975
 *
 * Requirements:
 * - Must be produced in the United States
 * - Must be used as fuel or sold for use as fuel
 * - Must meet EPA registration requirements
 */

// 2025 credit rates per gallon
const biodieselCreditRates = {
  biodiesel: 1.00,
  agribiodiesel: 1.00,
  renewableDiesel: 1.00
}

export default class F8864 extends F1040Attachment {
  tag: FormTag = 'f8864'
  sequenceIndex = 141

  isNeeded = (): boolean => {
    return this.hasBiodieselCredit()
  }

  hasBiodieselCredit = (): boolean => {
    const data = this.creditData()
    return data !== undefined && (
      data.biodieselGallons > 0 ||
      data.agribiodieselGallons > 0 ||
      data.renewableDieselGallons > 0 ||
      (data.passthrough8864Credit ?? 0) > 0
    )
  }

  creditData = (): Form8864Data | undefined => {
    // Would need to add to Information interface
    return undefined
  }

  // Part I - Biodiesel Credit

  // Line 1: Biodiesel (other than agri-biodiesel)
  l1a = (): number => this.creditData()?.biodieselGallons ?? 0
  l1b = (): number => biodieselCreditRates.biodiesel
  l1c = (): number => Math.round(this.l1a() * this.l1b())

  // Line 2: Agri-biodiesel
  l2a = (): number => this.creditData()?.agribiodieselGallons ?? 0
  l2b = (): number => biodieselCreditRates.agribiodiesel
  l2c = (): number => Math.round(this.l2a() * this.l2b())

  // Line 3: Renewable diesel
  l3a = (): number => this.creditData()?.renewableDieselGallons ?? 0
  l3b = (): number => biodieselCreditRates.renewableDiesel
  l3c = (): number => Math.round(this.l3a() * this.l3b())

  // Line 4: Add lines 1c, 2c, and 3c
  l4 = (): number => this.l1c() + this.l2c() + this.l3c()

  // Line 5: Biodiesel/renewable diesel credit from partnerships, S corps
  l5 = (): number => this.creditData()?.passthrough8864Credit ?? 0

  // Line 6: Add lines 4 and 5 (total credit)
  l6 = (): number => this.l4() + this.l5()

  // Part II - Registration Number (IRS-issued)
  registrationNumber = (): string => ''

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l6()

  // Total gallons
  totalGallons = (): number => this.l1a() + this.l2a() + this.l3a()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Biodiesel
    this.l1a(),
    this.l1b(),
    this.l1c(),
    // Agri-biodiesel
    this.l2a(),
    this.l2b(),
    this.l2c(),
    // Renewable diesel
    this.l3a(),
    this.l3b(),
    this.l3c(),
    // Totals
    this.l4(),
    this.l5(),
    this.l6(),
    this.registrationNumber()
  ]
}
