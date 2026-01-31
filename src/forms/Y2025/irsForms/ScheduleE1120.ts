import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Schedule E (Form 1120) - Compensation of Officers
 *
 * Used by C-Corporations to report compensation paid to corporate officers.
 *
 * Required information:
 * - Names and SSNs of officers
 * - Percentage of time devoted to business
 * - Percentage of stock owned (common and preferred)
 * - Amount of compensation
 *
 * Reasonable compensation limitation applies - IRS can disallow
 * excessive compensation as disguised dividends.
 */

export interface OfficerCompensation {
  name: string
  ssn: string
  title: string
  percentTimeDevoted: number
  percentCommonStock: number
  percentPreferredStock: number
  compensation: number
  expenseAccountAllowances: number
}

export interface ScheduleE1120Data {
  officers: OfficerCompensation[]
}

export default class ScheduleE1120 extends F1040Attachment {
  tag: FormTag = 'f1120se'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasOfficerData()
  }

  hasOfficerData = (): boolean => {
    const cCorps = this.f1040.info.cCorpOwnership
    return cCorps !== undefined && cCorps.length > 0
  }

  scheduleE1120Data = (): ScheduleE1120Data | undefined => {
    return undefined  // Would be populated from entity data
  }

  officers = (): OfficerCompensation[] => {
    return this.scheduleE1120Data()?.officers ?? []
  }

  numberOfOfficers = (): number => this.officers().length

  // Total compensation of all officers
  totalCompensation = (): number => {
    return this.officers().reduce((sum, o) => sum + o.compensation, 0)
  }

  // Total expense account allowances
  totalExpenseAllowances = (): number => {
    return this.officers().reduce((sum, o) => sum + o.expenseAccountAllowances, 0)
  }

  // Total to Form 1120 Line 12
  toForm1120Line12 = (): number => {
    return this.totalCompensation() + this.totalExpenseAllowances()
  }

  // Officers owning more than 10%
  majorOfficers = (): OfficerCompensation[] => {
    return this.officers().filter(o =>
      o.percentCommonStock > 10 || o.percentPreferredStock > 10
    )
  }

  // Percentage of total stock owned by officers
  totalOfficerStockOwnership = (): number => {
    return this.officers().reduce((sum, o) =>
      sum + o.percentCommonStock + o.percentPreferredStock, 0
    )
  }

  fields = (): Field[] => {
    const officers = this.officers()

    return [
      // Officer 1
      officers[0]?.name ?? '',
      officers[0]?.ssn ?? '',
      officers[0]?.title ?? '',
      officers[0]?.percentTimeDevoted ?? 0,
      officers[0]?.percentCommonStock ?? 0,
      officers[0]?.percentPreferredStock ?? 0,
      officers[0]?.compensation ?? 0,
      officers[0]?.expenseAccountAllowances ?? 0,
      // Officer 2
      officers[1]?.name ?? '',
      officers[1]?.ssn ?? '',
      officers[1]?.title ?? '',
      officers[1]?.percentTimeDevoted ?? 0,
      officers[1]?.percentCommonStock ?? 0,
      officers[1]?.percentPreferredStock ?? 0,
      officers[1]?.compensation ?? 0,
      officers[1]?.expenseAccountAllowances ?? 0,
      // Officer 3
      officers[2]?.name ?? '',
      officers[2]?.ssn ?? '',
      officers[2]?.title ?? '',
      officers[2]?.percentTimeDevoted ?? 0,
      officers[2]?.percentCommonStock ?? 0,
      officers[2]?.percentPreferredStock ?? 0,
      officers[2]?.compensation ?? 0,
      officers[2]?.expenseAccountAllowances ?? 0,
      // Officer 4
      officers[3]?.name ?? '',
      officers[3]?.ssn ?? '',
      officers[3]?.title ?? '',
      officers[3]?.compensation ?? 0,
      // Officer 5
      officers[4]?.name ?? '',
      officers[4]?.compensation ?? 0,
      // Totals
      this.numberOfOfficers(),
      this.totalCompensation(),
      this.totalExpenseAllowances(),
      this.toForm1120Line12(),
      this.totalOfficerStockOwnership()
    ]
  }
}
