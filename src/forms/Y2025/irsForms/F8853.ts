import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

export default class F8853 extends F1040Attachment {
  tag: FormTag = 'f8853'
  sequenceIndex = 999
  isNeeded = (): boolean => this.taxableLongTermCareBenefits() > 0

  taxableLongTermCareBenefits = (): number =>
    this.f1040.f1099ltc?.toForm8853() ?? 0

  l1 = (): number | undefined => {
    const amount = this.f1040.f1099ltc?.grossBenefitsPaid() ?? 0
    return amount > 0 ? amount : undefined
  }

  l2 = (): number | undefined => {
    const amount = this.taxableLongTermCareBenefits()
    return amount > 0 ? amount : undefined
  }

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1(),
    this.l2()
  ]
}
