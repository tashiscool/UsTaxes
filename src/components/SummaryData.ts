import Form from 'ustaxes/core/irsForms/Form'
import { TaxYear } from 'ustaxes/core/data'
import F1040For2020 from 'ustaxes/forms/Y2020/irsForms/F1040'
import F1040For2021 from 'ustaxes/forms/Y2021/irsForms/F1040'
import F1040For2022 from 'ustaxes/forms/Y2022/irsForms/F1040'
import F1040For2023 from 'ustaxes/forms/Y2023/irsForms/F1040'
import F1040For2024 from 'ustaxes/forms/Y2024/irsForms/F1040'
import F1040For2025 from 'ustaxes/forms/Y2025/irsForms/F1040'

interface Credit {
  name: string
  value?: number
  notes?: string
  allowed: boolean
}

export interface WorksheetLine {
  line: number | string
  value: string | number | undefined
}
export interface WorksheetData {
  name: string
  lines: WorksheetLine[]
}

export interface SummaryData {
  credits: Credit[]
  worksheets: WorksheetData[]
  refundAmount?: number
  amountOwed?: number
}

interface SummaryCreator<A> {
  summary: (a: A) => SummaryData
}

const emptySummary = {
  credits: [],
  worksheets: []
}

export const SummaryCreatorFor2020: SummaryCreator<F1040For2020> = {
  summary: (f: F1040For2020): SummaryData => ({
    credits: [
      {
        name: 'Earned Income Credit',
        value: f.scheduleEIC.credit(),
        allowed: f.scheduleEIC.allowed()
      },
      {
        name: 'Children and Other Dependents',
        value: f.childTaxCreditWorksheet.credit(),
        allowed: f.childTaxCreditWorksheet.isAllowed()
      }
    ],
    worksheets: [],
    refundAmount: f.l35a(),
    amountOwed: f.l37()
  })
}

export const SummaryCreatorFor2021: SummaryCreator<F1040For2021> = {
  summary: (f: F1040For2021): SummaryData => ({
    credits: [
      {
        name: 'Earned income credit',
        value: f.scheduleEIC.credit(),
        allowed: f.scheduleEIC.allowed()
      }
    ],
    worksheets: [
      ...(f.qualifiedAndCapGainsWorksheet !== undefined
        ? [f.qualifiedAndCapGainsWorksheet.getSummaryData()]
        : [])
    ],
    refundAmount: f.l35a(),
    amountOwed: f.l37()
  })
}

// Shared summary structure for 2022–2025: EIC, Child Tax Credit (Schedule 8812), qualified/cap gains worksheet
const summaryFor2022To2025 = (
  f: F1040For2022 | F1040For2023 | F1040For2024 | F1040For2025
): SummaryData => ({
  credits: [
    {
      name: 'Earned income credit',
      value: f.scheduleEIC.credit(),
      allowed: f.scheduleEIC.allowed()
    },
    {
      name: 'Child and Other Dependents (Schedule 8812)',
      value: f.schedule8812.isNeeded()
        ? (f.schedule8812.to1040Line19() ?? 0) +
          (f.schedule8812.to1040Line28() ?? 0)
        : undefined,
      allowed: f.schedule8812.isNeeded()
    }
  ],
  worksheets: [
    ...(f.qualifiedAndCapGainsWorksheet !== undefined
      ? [f.qualifiedAndCapGainsWorksheet.getSummaryData()]
      : [])
  ],
  refundAmount: f.l35a(),
  amountOwed: f.l37()
})

export const createSummary = (
  year: TaxYear,
  forms: Form[]
): SummaryData | undefined => {
  const f1040 = forms.find((f) => f.tag === 'f1040')
  if (f1040 === undefined) {
    return undefined
  }

  switch (year) {
    case 'Y2019': {
      return emptySummary
    }
    case 'Y2020': {
      return SummaryCreatorFor2020.summary(f1040 as F1040For2020)
    }
    case 'Y2021': {
      return SummaryCreatorFor2021.summary(f1040 as F1040For2021)
    }
    case 'Y2022': {
      return summaryFor2022To2025(f1040 as F1040For2022)
    }
    case 'Y2023': {
      return summaryFor2022To2025(f1040 as F1040For2023)
    }
    case 'Y2024': {
      return summaryFor2022To2025(f1040 as F1040For2024)
    }
    case 'Y2025': {
      return summaryFor2022To2025(f1040 as F1040For2025)
    }
  }
}
