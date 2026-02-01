import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8586Data } from 'ustaxes/core/data'

/**
 * Form 8586 - Low-Income Housing Credit
 *
 * Credit for owners of qualified low-income housing projects.
 * The credit encourages investment in rental housing for
 * lower-income families.
 *
 * Credit calculation:
 * - Generally 4% for existing buildings or federally subsidized new
 * - Generally ~9% for new construction without federal subsidies
 * - Based on qualified basis (eligible basis × applicable fraction)
 *
 * Requirements:
 * - Buildings must be part of qualified low-income housing project
 * - Must meet income and rent restrictions for tenants
 * - Credit claimed over 10 years
 * - 15-year compliance period
 */

export default class F8586 extends F1040Attachment {
  tag: FormTag = 'f8586'
  sequenceIndex = 36

  isNeeded = (): boolean => {
    return this.hasLowIncomeHousingCredit()
  }

  hasLowIncomeHousingCredit = (): boolean => {
    const data = this.creditData()
    return (
      data !== undefined &&
      (data.buildings.length > 0 || (data.passthrough8586Credit ?? 0) > 0)
    )
  }

  creditData = (): Form8586Data | undefined => {
    return this.f1040.info.generalBusinessCredits?.creditComponents
      .lowIncomeHousingCredit
      ? ({
          buildings: [],
          totalCredit:
            this.f1040.info.generalBusinessCredits.creditComponents
              .lowIncomeHousingCredit
        } as Form8586Data)
      : undefined
  }

  // Part I - Current Year Credit

  // Line 1: Credit from eligible buildings (Form 8609-A)
  l1 = (): number => {
    const data = this.creditData()
    if (!data) return 0
    return data.buildings.reduce((sum, b) => sum + b.creditAmount, 0)
  }

  // Line 2: Low-income housing credit from partnerships, S corps, etc.
  l2 = (): number => this.creditData()?.passthrough8586Credit ?? 0

  // Line 3: Add lines 1 and 2
  l3 = (): number => this.l1() + this.l2()

  // Line 4: Buildings placed in service after 2007 in the Gulf Opportunity Zone
  l4 = (): number => 0

  // Line 5: Add lines 3 and 4 (total credit)
  l5 = (): number => this.l3() + this.l4()

  // Part II - Carryforward

  // Credit carryforward from prior years
  carryforwardFromPriorYears = (): number => 0

  // Total available credit
  totalAvailableCredit = (): number =>
    this.l5() + this.carryforwardFromPriorYears()

  // Credit for Form 3800
  credit = (): number => this.creditData()?.totalCredit ?? this.l5()

  // Number of qualified buildings
  numberOfBuildings = (): number => this.creditData()?.buildings.length ?? 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.numberOfBuildings()
  ]
}
