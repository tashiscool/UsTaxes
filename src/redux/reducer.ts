/* eslint-disable indent */
import { CombinedState, combineReducers, Reducer } from 'redux'
import { Asset, FilingStatus, Information, TaxYear } from 'ustaxes/core/data'
import { YearsTaxesState } from '.'
import { ActionName, Actions } from './actions'
import { stringToDateInfo } from './data'

const DEFAULT_TAX_YEAR: TaxYear = 'Y2025'

export const blankState: Information = {
  f1099s: [],
  w2s: [],
  estimatedTaxes: [],
  realEstate: [],
  taxPayer: { dependents: [] },
  questions: {},
  f1098es: [],
  f3921s: [],
  scheduleK1Form1065s: [],
  itemizedDeductions: undefined,
  stateResidencies: [],
  healthSavingsAccounts: [],
  credits: [],
  individualRetirementArrangements: [],
  // OBBBA 2025 new fields
  overtimeIncome: undefined,
  tipIncome: undefined,
  autoLoanInterest: undefined,
  trumpSavingsAccounts: undefined,
  // Local Tax info
  localTaxInfo: undefined
}

const formReducer = (
  state: Information | undefined,
  action: Actions
): Information => {
  const newState: Information = state ?? blankState

  switch (action.type) {
    case ActionName.SAVE_PRIMARY_PERSON_INFO: {
      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          primaryPerson: {
            ...action.formData,
            dateOfBirth: new Date(action.formData.dateOfBirth)
          }
        }
      }
    }
    case ActionName.SAVE_CONTACT_INFO: {
      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          ...action.formData
        }
      }
    }
    case ActionName.SAVE_STATE_RESIDENCY: {
      return {
        ...newState,
        stateResidencies: [action.formData]
      }
    }
    case ActionName.SAVE_FILING_STATUS_INFO: {
      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          filingStatus: action.formData
        }
      }
    }
    case ActionName.ADD_DEPENDENT: {
      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          dependents: [
            ...newState.taxPayer.dependents,
            {
              ...action.formData,
              dateOfBirth: new Date(action.formData.dateOfBirth)
            }
          ]
        }
      }
    }

    // Replace dependent by index with a new object.
    case ActionName.EDIT_DEPENDENT: {
      const newDependents = [...newState.taxPayer.dependents]
      newDependents.splice(action.formData.index, 1, {
        ...action.formData.value,
        dateOfBirth: new Date(action.formData.value.dateOfBirth)
      })

      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          dependents: newDependents
        }
      }
    }

    case ActionName.REMOVE_DEPENDENT: {
      const newDependents = [...newState.taxPayer.dependents]
      newDependents.splice(action.formData, 1)

      const filingStatus = (() => {
        if (
          newDependents.length === 0 &&
          newState.taxPayer.filingStatus === FilingStatus.HOH
        ) {
          return undefined
        }
        return newState.taxPayer.filingStatus
      })()

      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          filingStatus,
          dependents: newDependents
        }
      }
    }
    case ActionName.SAVE_REFUND_INFO: {
      return {
        ...newState,
        refund: action.formData
      }
    }
    case ActionName.ADD_W2: {
      return {
        ...newState,
        w2s: [...newState.w2s, action.formData]
      }
    }
    case ActionName.EDIT_W2: {
      const newW2s = [...newState.w2s]
      newW2s.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        w2s: newW2s
      }
    }
    case ActionName.REMOVE_W2: {
      const newW2s = [...newState.w2s]
      newW2s.splice(action.formData, 1)
      return {
        ...newState,
        w2s: newW2s
      }
    }
    case ActionName.ADD_ESTIMATED_TAX: {
      return {
        ...newState,
        estimatedTaxes: [...newState.estimatedTaxes, action.formData]
      }
    }
    case ActionName.EDIT_ESTIMATED_TAX: {
      const newEstimatedTaxes = [...newState.estimatedTaxes]
      newEstimatedTaxes.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        estimatedTaxes: newEstimatedTaxes
      }
    }
    case ActionName.REMOVE_ESTIMATED_TAX: {
      const newEstimatedTaxes = [...newState.estimatedTaxes]
      newEstimatedTaxes.splice(action.formData, 1)
      return {
        ...newState,
        estimatedTaxes: newEstimatedTaxes
      }
    }
    case ActionName.ADD_1099: {
      return {
        ...newState,
        f1099s: [...newState.f1099s, action.formData]
      }
    }
    case ActionName.EDIT_1099: {
      const new1099s = [...newState.f1099s]
      new1099s.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        f1099s: new1099s
      }
    }
    case ActionName.REMOVE_1099: {
      const new1099s = [...newState.f1099s]
      new1099s.splice(action.formData, 1)
      return {
        ...newState,
        f1099s: new1099s
      }
    }
    case ActionName.ADD_SPOUSE: {
      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          spouse: {
            ...action.formData,
            dateOfBirth: new Date(action.formData.dateOfBirth)
          }
        }
      }
    }
    case ActionName.REMOVE_SPOUSE: {
      const filingStatus = (() => {
        const fs = newState.taxPayer.filingStatus
        if ([FilingStatus.MFS, FilingStatus.MFJ, undefined].includes(fs)) {
          return undefined
        }
        return fs
      })()

      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          filingStatus,
          spouse: undefined
        }
      }
    }
    case ActionName.ADD_PROPERTY: {
      return {
        ...newState,
        realEstate: [...newState.realEstate, action.formData]
      }
    }
    case ActionName.EDIT_PROPERTY: {
      const newProperties = [...newState.realEstate]
      newProperties.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        realEstate: newProperties
      }
    }
    case ActionName.REMOVE_PROPERTY: {
      const newProperties = [...newState.realEstate]
      newProperties.splice(action.formData, 1)
      return {
        ...newState,
        realEstate: newProperties
      }
    }
    case ActionName.ANSWER_QUESTION: {
      // must reset all questions
      return {
        ...newState,
        questions: action.formData
      }
    }
    case ActionName.ADD_1098e: {
      return {
        ...newState,
        f1098es: [...newState.f1098es, action.formData]
      }
    }
    case ActionName.EDIT_1098e: {
      const new1098es = [...newState.f1098es]
      new1098es.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        f1098es: new1098es
      }
    }
    case ActionName.REMOVE_1098e: {
      const new1098es = [...newState.f1098es]
      new1098es.splice(action.formData, 1)
      return {
        ...newState,
        f1098es: new1098es
      }
    }
    case ActionName.ADD_F3921: {
      return {
        ...newState,
        f3921s: [...newState.f3921s, action.formData]
      }
    }
    case ActionName.EDIT_F3921: {
      const newf3921s = [...newState.f3921s]
      newf3921s.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        f3921s: newf3921s
      }
    }
    case ActionName.REMOVE_F3921: {
      const newf3921s = [...newState.f3921s]
      newf3921s.splice(action.formData, 1)
      return {
        ...newState,
        f3921s: newf3921s
      }
    }
    case ActionName.ADD_SCHEDULE_K1_F1065: {
      return {
        ...newState,
        scheduleK1Form1065s: [...newState.scheduleK1Form1065s, action.formData]
      }
    }
    case ActionName.EDIT_SCHEDULE_K1_F1065: {
      const newK1s = [...newState.scheduleK1Form1065s]
      newK1s.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        scheduleK1Form1065s: newK1s
      }
    }
    case ActionName.REMOVE_SCHEDULE_K1_F1065: {
      const newK1s = [...newState.scheduleK1Form1065s]
      newK1s.splice(action.formData, 1)
      return {
        ...newState,
        scheduleK1Form1065s: newK1s
      }
    }
    case ActionName.SET_ITEMIZED_DEDUCTIONS: {
      return {
        ...newState,
        itemizedDeductions: action.formData
      }
    }
    case ActionName.SET_INFO: {
      return {
        ...newState,
        ...stringToDateInfo(action.formData)
      }
    }
    case ActionName.ADD_HSA: {
      return {
        ...newState,
        healthSavingsAccounts: [
          ...newState.healthSavingsAccounts,
          {
            ...action.formData,
            endDate: new Date(action.formData.endDate),
            startDate: new Date(action.formData.startDate)
          }
        ]
      }
    }
    case ActionName.EDIT_HSA: {
      const newHsa = [...newState.healthSavingsAccounts]
      newHsa.splice(action.formData.index, 1, {
        ...action.formData.value,
        endDate: new Date(action.formData.value.endDate),
        startDate: new Date(action.formData.value.startDate)
      })
      return {
        ...newState,
        healthSavingsAccounts: newHsa
      }
    }
    case ActionName.REMOVE_HSA: {
      const newHsa = [...newState.healthSavingsAccounts]
      newHsa.splice(action.formData, 1)
      return {
        ...newState,
        healthSavingsAccounts: newHsa
      }
    }
    case ActionName.ADD_IRA: {
      return {
        ...newState,
        individualRetirementArrangements: [
          ...newState.individualRetirementArrangements,
          action.formData
        ]
      }
    }
    case ActionName.EDIT_IRA: {
      const newIra = [...newState.individualRetirementArrangements]
      newIra.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        individualRetirementArrangements: newIra
      }
    }
    case ActionName.REMOVE_IRA: {
      const newIra = [...newState.individualRetirementArrangements]
      newIra.splice(action.formData, 1)
      return {
        ...newState,
        individualRetirementArrangements: newIra
      }
    }
    case ActionName.ADD_CREDIT: {
      return {
        ...newState,
        credits: [...newState.credits, action.formData]
      }
    }
    case ActionName.EDIT_CREDIT: {
      const newCredits = [...newState.credits]
      newCredits.splice(action.formData.index, 1, action.formData.value)
      return {
        ...newState,
        credits: newCredits
      }
    }
    case ActionName.REMOVE_CREDIT: {
      const newCredits = [...newState.credits]
      newCredits.splice(action.formData, 1)
      return {
        ...newState,
        credits: newCredits
      }
    }

    // =============================================================================
    // OBBBA 2025 Actions
    // =============================================================================
    case ActionName.SET_OVERTIME_INCOME: {
      return {
        ...newState,
        overtimeIncome: action.formData
      }
    }
    case ActionName.SET_TIP_INCOME: {
      return {
        ...newState,
        tipIncome: action.formData
      }
    }
    case ActionName.SET_AUTO_LOAN_INTEREST: {
      return {
        ...newState,
        autoLoanInterest: action.formData
      }
    }
    case ActionName.ADD_TRUMP_ACCOUNT: {
      return {
        ...newState,
        trumpSavingsAccounts: [
          ...(newState.trumpSavingsAccounts ?? []),
          {
            ...action.formData,
            beneficiaryDateOfBirth: new Date(
              action.formData.beneficiaryDateOfBirth
            ),
            accountOpenDate: action.formData.accountOpenDate
              ? new Date(action.formData.accountOpenDate)
              : undefined
          }
        ]
      }
    }
    case ActionName.EDIT_TRUMP_ACCOUNT: {
      const newAccounts = [...(newState.trumpSavingsAccounts ?? [])]
      newAccounts.splice(action.formData.index, 1, {
        ...action.formData.value,
        beneficiaryDateOfBirth: new Date(
          action.formData.value.beneficiaryDateOfBirth
        ),
        accountOpenDate: action.formData.value.accountOpenDate
          ? new Date(action.formData.value.accountOpenDate)
          : undefined
      })
      return {
        ...newState,
        trumpSavingsAccounts: newAccounts
      }
    }
    case ActionName.REMOVE_TRUMP_ACCOUNT: {
      const newAccounts = [...(newState.trumpSavingsAccounts ?? [])]
      newAccounts.splice(action.formData, 1)
      return {
        ...newState,
        trumpSavingsAccounts: newAccounts.length > 0 ? newAccounts : undefined
      }
    }

    // =============================================================================
    // Local Tax Actions
    // =============================================================================
    case ActionName.SET_LOCAL_TAX_INFO: {
      return {
        ...newState,
        localTaxInfo: action.formData
      }
    }

    // =============================================================================
    // Prior Year Import
    // =============================================================================
    case ActionName.IMPORT_PRIOR_YEAR_DATA: {
      const importedData = action.formData.data

      // Merge imported data with current state
      // Only import structural data (names, addresses, employers, bank info)
      // Do not import income amounts
      return {
        ...newState,
        taxPayer: {
          ...newState.taxPayer,
          // Import primary person if present in imported data
          primaryPerson: importedData.taxPayer?.primaryPerson
            ? {
                ...importedData.taxPayer.primaryPerson,
                dateOfBirth: new Date(
                  importedData.taxPayer.primaryPerson.dateOfBirth
                )
              }
            : newState.taxPayer.primaryPerson,
          // Import spouse if present in imported data
          spouse: importedData.taxPayer?.spouse
            ? {
                ...importedData.taxPayer.spouse,
                dateOfBirth: new Date(importedData.taxPayer.spouse.dateOfBirth)
              }
            : newState.taxPayer.spouse,
          // Import dependents if present
          dependents: importedData.taxPayer?.dependents
            ? importedData.taxPayer.dependents.map((d) => ({
                ...d,
                dateOfBirth: new Date(d.dateOfBirth)
              }))
            : newState.taxPayer.dependents,
          // Import contact info
          contactPhoneNumber:
            importedData.taxPayer?.contactPhoneNumber ??
            newState.taxPayer.contactPhoneNumber,
          contactEmail:
            importedData.taxPayer?.contactEmail ??
            newState.taxPayer.contactEmail
        },
        // Import refund/bank info
        refund: importedData.refund ?? newState.refund,
        // Import state residencies
        stateResidencies:
          importedData.stateResidencies &&
          importedData.stateResidencies.length > 0
            ? importedData.stateResidencies
            : newState.stateResidencies
      }
    }

    default: {
      return newState
    }
  }
}

const guardByYear =
  (year: TaxYear) =>
  (state: Information | undefined, action: Actions): Information => {
    const newState: Information = state ?? blankState

    if (action.year !== year) {
      return newState
    }

    return formReducer(newState, action)
  }

const activeYear = (state: TaxYear | undefined, action: Actions): TaxYear => {
  const newState = state ?? DEFAULT_TAX_YEAR

  switch (action.type) {
    case ActionName.SET_ACTIVE_YEAR: {
      return action.formData
    }
    default: {
      return newState
    }
  }
}

const assetReducer = (
  state: Asset<Date>[] | undefined,
  action: Actions
): Asset<Date>[] => {
  const newState = state ?? []

  switch (action.type) {
    case ActionName.ADD_ASSET: {
      return [...newState, action.formData]
    }
    case ActionName.ADD_ASSETS: {
      return [...newState, ...action.formData]
    }
    case ActionName.EDIT_ASSET: {
      const newAssets = [...newState]
      newAssets.splice(action.formData.index, 1, action.formData.value)
      return newAssets
    }
    case ActionName.REMOVE_ASSET: {
      const newAssets = [...newState]
      newAssets.splice(action.formData, 1)
      return newAssets
    }
    case ActionName.REMOVE_ASSETS: {
      return newState.filter((_, i) => !action.formData.includes(i))
    }
    case ActionName.IMPORT_BROKERAGE_TRANSACTIONS: {
      // Import transactions from brokerage CSV
      return [...newState, ...action.formData.transactions]
    }
    default: {
      return newState
    }
  }
}

const rootReducer: Reducer<
  CombinedState<YearsTaxesState>,
  Actions
> = combineReducers({
  assets: assetReducer,
  Y2019: guardByYear('Y2019'),
  Y2020: guardByYear('Y2020'),
  Y2021: guardByYear('Y2021'),
  Y2022: guardByYear('Y2022'),
  Y2023: guardByYear('Y2023'),
  Y2024: guardByYear('Y2024'),
  Y2025: guardByYear('Y2025'),
  activeYear
}) as Reducer<CombinedState<YearsTaxesState>, Actions>

export default rootReducer
