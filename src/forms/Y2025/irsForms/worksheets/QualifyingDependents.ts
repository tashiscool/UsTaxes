import F1040 from '../F1040'
import { Dependent } from 'ustaxes/core/data'
import * as federal from '../../data/federal'

/** Birth year from Date or ISO string (persist/rehydration-safe). */
function birthYear(d: Dependent<Date | string>): number {
  const dob = d.dateOfBirth
  if (dob instanceof Date) return dob.getFullYear()
  const parsed = new Date(dob)
  return isNaN(parsed.getTime()) ? 0 : parsed.getFullYear()
}

/**
 * As of TY2021, the Child Tax Credit worksheet
 * is no longer published. This just implements
 * the qualifying dependent logic.
 */
export default class QualifyingDependents {
  f1040: F1040
  year = federal.CURRENT_YEAR

  constructor(f1040: F1040) {
    this.f1040 = f1040
  }

  qualifiesChild = (d: Dependent<Date | string>): boolean =>
    this.year - birthYear(d) < federal.QualifyingDependents.childMaxAge

  qualifiesOther = (d: Dependent<Date | string>): boolean =>
    d.qualifyingInfo !== undefined &&
    !this.qualifiesChild(d) &&
    this.year - birthYear(d) <
      (d.qualifyingInfo.isStudent
        ? federal.QualifyingDependents.qualifyingDependentMaxAge
        : federal.QualifyingDependents.qualifyingStudentMaxAge)

  qualifyingChildren = (): Dependent<Date | string>[] =>
    this.f1040.info.taxPayer.dependents.filter((dep) =>
      this.qualifiesChild(dep)
    )
}
