import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { CleanVehicleCreditRecord } from 'ustaxes/core/data'

const defaultCleanVehicleCredit = (
  vehicle: CleanVehicleCreditRecord
): number => {
  const explicit = vehicle.estimatedCredit ?? 0
  if (explicit > 0) return explicit

  const purchasePrice = vehicle.purchasePrice ?? 0
  if (vehicle.newOrUsed === 'used') {
    const priceLimitedCredit =
      purchasePrice > 0 ? Math.min(4000, Math.round(purchasePrice * 0.3)) : 4000
    return Math.max(0, priceLimitedCredit)
  }

  return 7500
}

export default class F8936 extends F1040Attachment {
  tag: FormTag = 'f8936'
  sequenceIndex = 999
  isNeeded = (): boolean => this.cleanVehicleCredits().length > 0

  cleanVehicleCredits = (): CleanVehicleCreditRecord[] =>
    this.f1040.info.cleanVehicleCredits ?? []

  totalTentativeCredit = (): number =>
    this.cleanVehicleCredits().reduce(
      (sum, vehicle) => sum + defaultCleanVehicleCredit(vehicle),
      0
    )

  businessUseCredit = (): number =>
    this.cleanVehicleCredits().reduce((sum, vehicle) => {
      const pct = Math.max(0, Math.min(100, vehicle.businessUsePercentage ?? 0))
      return sum + Math.round(defaultCleanVehicleCredit(vehicle) * (pct / 100))
    }, 0)

  personalUseCredit = (): number =>
    Math.max(0, this.totalTentativeCredit() - this.businessUseCredit())

  nonrefundableCredit = (): number | undefined => {
    const credit = this.personalUseCredit()
    return credit > 0 ? credit : undefined
  }

  l15 = (): number | undefined => this.nonrefundableCredit()
  l23 = (): number | undefined => undefined

  fields = (): Field[] => {
    const first = this.cleanVehicleCredits()[0]
    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      first?.vin ?? '',
      [first?.year, first?.make, first?.model].filter(Boolean).join(' '),
      first?.purchaseDate instanceof Date
        ? first.purchaseDate.toLocaleDateString()
        : '',
      first?.purchasePrice ?? 0,
      this.totalTentativeCredit(),
      this.businessUseCredit(),
      this.personalUseCredit(),
      this.l15() ?? 0,
      this.l23() ?? 0
    ] as Field[]
  }
}
