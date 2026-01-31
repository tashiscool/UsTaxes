import {
  Asset,
  BusinessEntity,
  Form1065Data,
  Form1120Data,
  Form1120SData,
  Form940Data,
  Form941Data,
  Information,
  Person,
  QuarterlyPayrollData,
  TaxYear
} from 'ustaxes/core/data'
import { blankState } from './reducer'

/**
 * This is a simplified form of our global TaxesState
 * which allows TaxesState to be viewed as if if contained
 * data for a single year.
 */
export type TaxesState = { information: Information }

export type YearsTaxesState<D = Date> = { [K in TaxYear]: Information<D> } & {
  assets: Asset<D>[]
  activeYear: TaxYear
}

export const blankYearTaxesState: YearsTaxesState = {
  assets: [],
  Y2019: blankState,
  Y2020: blankState,
  Y2021: blankState,
  Y2022: blankState,
  Y2023: blankState,
  Y2024: blankState,
  Y2025: blankState,
  activeYear: 'Y2025'
}

export const dateToStringPerson = <P extends Person<Date>>(
  p: P
): Omit<P, 'dateOfBirth'> & { dateOfBirth: string } => ({
  ...p,
  dateOfBirth: p.dateOfBirth.toISOString()
})

export const stringToDatePerson = <P extends Person<string>>(
  p: P
): Omit<P, 'dateOfBirth'> & { dateOfBirth: Date } => ({
  ...p,
  dateOfBirth: new Date(p.dateOfBirth)
})

// Business entity date conversion helpers
const stringToDateBusinessEntity = (
  e: BusinessEntity<string>
): BusinessEntity<Date> => ({
  ...e,
  dateIncorporated: e.dateIncorporated ? new Date(e.dateIncorporated) : undefined
})

const dateToStringBusinessEntity = (
  e: BusinessEntity<Date>
): BusinessEntity<string> => ({
  ...e,
  dateIncorporated: e.dateIncorporated?.toISOString()
})

const stringToDateQuarterlyPayroll = (
  q: QuarterlyPayrollData<string>
): QuarterlyPayrollData<Date> => ({
  ...q,
  endDate: new Date(q.endDate)
})

const dateToStringQuarterlyPayroll = (
  q: QuarterlyPayrollData<Date>
): QuarterlyPayrollData<string> => ({
  ...q,
  endDate: q.endDate.toISOString()
})

const stringToDateForm1120S = (
  f: Form1120SData<string>
): Form1120SData<Date> => ({
  ...f,
  entity: stringToDateBusinessEntity(f.entity)
})

const dateToStringForm1120S = (
  f: Form1120SData<Date>
): Form1120SData<string> => ({
  ...f,
  entity: dateToStringBusinessEntity(f.entity)
})

const stringToDateForm1120 = (
  f: Form1120Data<string>
): Form1120Data<Date> => ({
  ...f,
  entity: stringToDateBusinessEntity(f.entity)
})

const dateToStringForm1120 = (
  f: Form1120Data<Date>
): Form1120Data<string> => ({
  ...f,
  entity: dateToStringBusinessEntity(f.entity)
})

const stringToDateForm1065 = (
  f: Form1065Data<string>
): Form1065Data<Date> => ({
  ...f,
  entity: stringToDateBusinessEntity(f.entity)
})

const dateToStringForm1065 = (
  f: Form1065Data<Date>
): Form1065Data<string> => ({
  ...f,
  entity: dateToStringBusinessEntity(f.entity)
})

const stringToDateForm941 = (
  f: Form941Data<string>
): Form941Data<Date> => ({
  ...f,
  entity: stringToDateBusinessEntity(f.entity),
  quarterData: stringToDateQuarterlyPayroll(f.quarterData)
})

const dateToStringForm941 = (
  f: Form941Data<Date>
): Form941Data<string> => ({
  ...f,
  entity: dateToStringBusinessEntity(f.entity),
  quarterData: dateToStringQuarterlyPayroll(f.quarterData)
})

const stringToDateForm940 = (
  f: Form940Data<string>
): Form940Data<Date> => ({
  ...f,
  entity: stringToDateBusinessEntity(f.entity)
})

const dateToStringForm940 = (
  f: Form940Data<Date>
): Form940Data<string> => ({
  ...f,
  entity: dateToStringBusinessEntity(f.entity)
})

export const stringToDateInfo = <I extends Information<string>>(
  info: I
): Information<Date> => ({
  ...info,
  healthSavingsAccounts: info.healthSavingsAccounts.map((h) => ({
    ...h,
    startDate: new Date(h.startDate),
    endDate: new Date(h.endDate)
  })),
  trumpSavingsAccounts: info.trumpSavingsAccounts?.map((t) => ({
    ...t,
    beneficiaryDateOfBirth: new Date(t.beneficiaryDateOfBirth),
    accountOpenDate: t.accountOpenDate ? new Date(t.accountOpenDate) : undefined
  })),
  taxPayer: {
    ...info.taxPayer,
    primaryPerson: info.taxPayer.primaryPerson
      ? stringToDatePerson(info.taxPayer.primaryPerson)
      : undefined,
    dependents: info.taxPayer.dependents.map((d) => stringToDatePerson(d)),
    spouse: info.taxPayer.spouse
      ? stringToDatePerson(info.taxPayer.spouse)
      : undefined
  },
  foreignEarnedIncome: info.foreignEarnedIncome ? {
    ...info.foreignEarnedIncome,
    residenceStartDate: info.foreignEarnedIncome.residenceStartDate
      ? new Date(info.foreignEarnedIncome.residenceStartDate) : undefined,
    residenceEndDate: info.foreignEarnedIncome.residenceEndDate
      ? new Date(info.foreignEarnedIncome.residenceEndDate) : undefined,
    physicalPresenceStartDate: info.foreignEarnedIncome.physicalPresenceStartDate
      ? new Date(info.foreignEarnedIncome.physicalPresenceStartDate) : undefined,
    physicalPresenceEndDate: info.foreignEarnedIncome.physicalPresenceEndDate
      ? new Date(info.foreignEarnedIncome.physicalPresenceEndDate) : undefined
  } : undefined,
  healthInsuranceMarketplace: info.healthInsuranceMarketplace?.map((h) => ({
    ...h,
    coverageStartDate: new Date(h.coverageStartDate),
    coverageEndDate: new Date(h.coverageEndDate)
  })),
  energyImprovements: info.energyImprovements?.map((e) => ({
    ...e,
    dateInstalled: new Date(e.dateInstalled)
  })),
  // Business entity data conversions
  sCorpOwnership: info.sCorpOwnership?.map(stringToDateForm1120S),
  partnershipOwnership: info.partnershipOwnership?.map(stringToDateForm1065),
  cCorpOwnership: info.cCorpOwnership?.map(stringToDateForm1120),
  payrollData: info.payrollData?.map(stringToDateForm941),
  futaData: info.futaData ? stringToDateForm940(info.futaData) : undefined
})

export const infoToStringInfo = <I extends Information<Date>>(
  info: I
): Information<string> => ({
  ...info,
  healthSavingsAccounts: info.healthSavingsAccounts.map((h) => ({
    ...h,
    startDate: h.startDate.toISOString(),
    endDate: h.endDate.toISOString()
  })),
  trumpSavingsAccounts: info.trumpSavingsAccounts?.map((t) => ({
    ...t,
    beneficiaryDateOfBirth: t.beneficiaryDateOfBirth.toISOString(),
    accountOpenDate: t.accountOpenDate?.toISOString()
  })),
  taxPayer: {
    ...info.taxPayer,
    primaryPerson: info.taxPayer.primaryPerson
      ? dateToStringPerson(info.taxPayer.primaryPerson)
      : undefined,
    dependents: info.taxPayer.dependents.map((d) => dateToStringPerson(d)),
    spouse: info.taxPayer.spouse
      ? dateToStringPerson(info.taxPayer.spouse)
      : undefined
  },
  foreignEarnedIncome: info.foreignEarnedIncome ? {
    ...info.foreignEarnedIncome,
    residenceStartDate: info.foreignEarnedIncome.residenceStartDate?.toISOString(),
    residenceEndDate: info.foreignEarnedIncome.residenceEndDate?.toISOString(),
    physicalPresenceStartDate: info.foreignEarnedIncome.physicalPresenceStartDate?.toISOString(),
    physicalPresenceEndDate: info.foreignEarnedIncome.physicalPresenceEndDate?.toISOString()
  } : undefined,
  healthInsuranceMarketplace: info.healthInsuranceMarketplace?.map((h) => ({
    ...h,
    coverageStartDate: h.coverageStartDate.toISOString(),
    coverageEndDate: h.coverageEndDate.toISOString()
  })),
  energyImprovements: info.energyImprovements?.map((e) => ({
    ...e,
    dateInstalled: e.dateInstalled.toISOString()
  })),
  // Business entity data conversions
  sCorpOwnership: info.sCorpOwnership?.map(dateToStringForm1120S),
  partnershipOwnership: info.partnershipOwnership?.map(dateToStringForm1065),
  cCorpOwnership: info.cCorpOwnership?.map(dateToStringForm1120),
  payrollData: info.payrollData?.map(dateToStringForm941),
  futaData: info.futaData ? dateToStringForm940(info.futaData) : undefined
})
