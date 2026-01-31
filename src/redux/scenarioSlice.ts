/**
 * Redux state management for What-If Scenarios
 *
 * This slice manages scenario state separately from the main tax data,
 * allowing users to create, save, load, and compare scenarios without
 * affecting their actual tax information.
 */

import { TaxYear } from 'ustaxes/core/data'
import {
  Scenario,
  ScenarioModification,
  TaxCalculationResult
} from 'ustaxes/core/scenarios/scenarioEngine'

/**
 * State shape for scenarios
 */
export interface ScenarioState {
  // Saved scenarios by year
  savedScenarios: { [year in TaxYear]?: Scenario[] }
  // Currently selected scenarios for comparison (up to 3)
  selectedScenarioIds: string[]
  // Cached calculation results
  calculationCache: { [scenarioId: string]: TaxCalculationResult }
  // UI state
  isLoading: boolean
  error: string | null
  lastCalculatedAt: string | null
}

/**
 * Initial state
 */
export const initialScenarioState: ScenarioState = {
  savedScenarios: {},
  selectedScenarioIds: [],
  calculationCache: {},
  isLoading: false,
  error: null,
  lastCalculatedAt: null
}

/**
 * Action types
 */
export enum ScenarioActionName {
  // CRUD operations
  CREATE_SCENARIO = 'SCENARIO/CREATE',
  UPDATE_SCENARIO = 'SCENARIO/UPDATE',
  DELETE_SCENARIO = 'SCENARIO/DELETE',
  DUPLICATE_SCENARIO = 'SCENARIO/DUPLICATE',

  // Modifications
  ADD_MODIFICATION = 'SCENARIO/ADD_MODIFICATION',
  UPDATE_MODIFICATION = 'SCENARIO/UPDATE_MODIFICATION',
  REMOVE_MODIFICATION = 'SCENARIO/REMOVE_MODIFICATION',
  CLEAR_MODIFICATIONS = 'SCENARIO/CLEAR_MODIFICATIONS',

  // Selection
  SELECT_SCENARIO = 'SCENARIO/SELECT',
  DESELECT_SCENARIO = 'SCENARIO/DESELECT',
  CLEAR_SELECTION = 'SCENARIO/CLEAR_SELECTION',

  // Calculations
  SET_CALCULATION_RESULT = 'SCENARIO/SET_CALCULATION_RESULT',
  CLEAR_CALCULATION_CACHE = 'SCENARIO/CLEAR_CACHE',

  // UI state
  SET_LOADING = 'SCENARIO/SET_LOADING',
  SET_ERROR = 'SCENARIO/SET_ERROR',
  CLEAR_ERROR = 'SCENARIO/CLEAR_ERROR',

  // Bulk operations
  IMPORT_SCENARIOS = 'SCENARIO/IMPORT',
  CLEAR_ALL_SCENARIOS = 'SCENARIO/CLEAR_ALL'
}

/**
 * Action interfaces
 */
interface CreateScenarioAction {
  type: typeof ScenarioActionName.CREATE_SCENARIO
  year: TaxYear
  scenario: Scenario
}

interface UpdateScenarioAction {
  type: typeof ScenarioActionName.UPDATE_SCENARIO
  year: TaxYear
  scenarioId: string
  updates: Partial<Omit<Scenario, 'id' | 'createdAt'>>
}

interface DeleteScenarioAction {
  type: typeof ScenarioActionName.DELETE_SCENARIO
  year: TaxYear
  scenarioId: string
}

interface DuplicateScenarioAction {
  type: typeof ScenarioActionName.DUPLICATE_SCENARIO
  year: TaxYear
  scenarioId: string
  newId: string
  newName: string
}

interface AddModificationAction {
  type: typeof ScenarioActionName.ADD_MODIFICATION
  year: TaxYear
  scenarioId: string
  modification: ScenarioModification
}

interface UpdateModificationAction {
  type: typeof ScenarioActionName.UPDATE_MODIFICATION
  year: TaxYear
  scenarioId: string
  modificationId: string
  updates: Partial<Omit<ScenarioModification, 'id'>>
}

interface RemoveModificationAction {
  type: typeof ScenarioActionName.REMOVE_MODIFICATION
  year: TaxYear
  scenarioId: string
  modificationId: string
}

interface ClearModificationsAction {
  type: typeof ScenarioActionName.CLEAR_MODIFICATIONS
  year: TaxYear
  scenarioId: string
}

interface SelectScenarioAction {
  type: typeof ScenarioActionName.SELECT_SCENARIO
  scenarioId: string
}

interface DeselectScenarioAction {
  type: typeof ScenarioActionName.DESELECT_SCENARIO
  scenarioId: string
}

interface ClearSelectionAction {
  type: typeof ScenarioActionName.CLEAR_SELECTION
}

interface SetCalculationResultAction {
  type: typeof ScenarioActionName.SET_CALCULATION_RESULT
  scenarioId: string
  result: TaxCalculationResult
}

interface ClearCalculationCacheAction {
  type: typeof ScenarioActionName.CLEAR_CALCULATION_CACHE
}

interface SetLoadingAction {
  type: typeof ScenarioActionName.SET_LOADING
  isLoading: boolean
}

interface SetErrorAction {
  type: typeof ScenarioActionName.SET_ERROR
  error: string
}

interface ClearErrorAction {
  type: typeof ScenarioActionName.CLEAR_ERROR
}

interface ImportScenariosAction {
  type: typeof ScenarioActionName.IMPORT_SCENARIOS
  year: TaxYear
  scenarios: Scenario[]
}

interface ClearAllScenariosAction {
  type: typeof ScenarioActionName.CLEAR_ALL_SCENARIOS
  year: TaxYear
}

export type ScenarioAction =
  | CreateScenarioAction
  | UpdateScenarioAction
  | DeleteScenarioAction
  | DuplicateScenarioAction
  | AddModificationAction
  | UpdateModificationAction
  | RemoveModificationAction
  | ClearModificationsAction
  | SelectScenarioAction
  | DeselectScenarioAction
  | ClearSelectionAction
  | SetCalculationResultAction
  | ClearCalculationCacheAction
  | SetLoadingAction
  | SetErrorAction
  | ClearErrorAction
  | ImportScenariosAction
  | ClearAllScenariosAction

/**
 * Scenario reducer
 */
export const scenarioReducer = (
  state: ScenarioState = initialScenarioState,
  action: ScenarioAction
): ScenarioState => {
  switch (action.type) {
    case ScenarioActionName.CREATE_SCENARIO: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: [...yearScenarios, action.scenario]
        }
      }
    }

    case ScenarioActionName.UPDATE_SCENARIO: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: yearScenarios.map((s) =>
            s.id === action.scenarioId
              ? { ...s, ...action.updates, modifiedAt: new Date() }
              : s
          )
        },
        // Clear cached result for this scenario
        calculationCache: {
          ...state.calculationCache,
          [action.scenarioId]: undefined as unknown as TaxCalculationResult
        }
      }
    }

    case ScenarioActionName.DELETE_SCENARIO: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      const { [action.scenarioId]: deleted, ...restCache } =
        state.calculationCache
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: yearScenarios.filter((s) => s.id !== action.scenarioId)
        },
        selectedScenarioIds: state.selectedScenarioIds.filter(
          (id) => id !== action.scenarioId
        ),
        calculationCache: restCache
      }
    }

    case ScenarioActionName.DUPLICATE_SCENARIO: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      const original = yearScenarios.find((s) => s.id === action.scenarioId)
      if (!original) return state

      const duplicate: Scenario = {
        ...original,
        id: action.newId,
        name: action.newName,
        createdAt: new Date(),
        modifiedAt: new Date(),
        modifications: [...original.modifications]
      }

      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: [...yearScenarios, duplicate]
        }
      }
    }

    case ScenarioActionName.ADD_MODIFICATION: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: yearScenarios.map((s) =>
            s.id === action.scenarioId
              ? {
                  ...s,
                  modifications: [...s.modifications, action.modification],
                  modifiedAt: new Date()
                }
              : s
          )
        },
        calculationCache: {
          ...state.calculationCache,
          [action.scenarioId]: undefined as unknown as TaxCalculationResult
        }
      }
    }

    case ScenarioActionName.UPDATE_MODIFICATION: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: yearScenarios.map((s) =>
            s.id === action.scenarioId
              ? {
                  ...s,
                  modifications: s.modifications.map((m) =>
                    m.id === action.modificationId
                      ? { ...m, ...action.updates }
                      : m
                  ),
                  modifiedAt: new Date()
                }
              : s
          )
        },
        calculationCache: {
          ...state.calculationCache,
          [action.scenarioId]: undefined as unknown as TaxCalculationResult
        }
      }
    }

    case ScenarioActionName.REMOVE_MODIFICATION: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: yearScenarios.map((s) =>
            s.id === action.scenarioId
              ? {
                  ...s,
                  modifications: s.modifications.filter(
                    (m) => m.id !== action.modificationId
                  ),
                  modifiedAt: new Date()
                }
              : s
          )
        },
        calculationCache: {
          ...state.calculationCache,
          [action.scenarioId]: undefined as unknown as TaxCalculationResult
        }
      }
    }

    case ScenarioActionName.CLEAR_MODIFICATIONS: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: yearScenarios.map((s) =>
            s.id === action.scenarioId
              ? { ...s, modifications: [], modifiedAt: new Date() }
              : s
          )
        },
        calculationCache: {
          ...state.calculationCache,
          [action.scenarioId]: undefined as unknown as TaxCalculationResult
        }
      }
    }

    case ScenarioActionName.SELECT_SCENARIO: {
      if (state.selectedScenarioIds.includes(action.scenarioId)) {
        return state
      }
      // Limit to 3 scenarios
      const newSelection = [...state.selectedScenarioIds, action.scenarioId]
      if (newSelection.length > 3) {
        newSelection.shift()
      }
      return {
        ...state,
        selectedScenarioIds: newSelection
      }
    }

    case ScenarioActionName.DESELECT_SCENARIO: {
      return {
        ...state,
        selectedScenarioIds: state.selectedScenarioIds.filter(
          (id) => id !== action.scenarioId
        )
      }
    }

    case ScenarioActionName.CLEAR_SELECTION: {
      return {
        ...state,
        selectedScenarioIds: []
      }
    }

    case ScenarioActionName.SET_CALCULATION_RESULT: {
      return {
        ...state,
        calculationCache: {
          ...state.calculationCache,
          [action.scenarioId]: action.result
        },
        lastCalculatedAt: new Date().toISOString()
      }
    }

    case ScenarioActionName.CLEAR_CALCULATION_CACHE: {
      return {
        ...state,
        calculationCache: {}
      }
    }

    case ScenarioActionName.SET_LOADING: {
      return {
        ...state,
        isLoading: action.isLoading
      }
    }

    case ScenarioActionName.SET_ERROR: {
      return {
        ...state,
        error: action.error,
        isLoading: false
      }
    }

    case ScenarioActionName.CLEAR_ERROR: {
      return {
        ...state,
        error: null
      }
    }

    case ScenarioActionName.IMPORT_SCENARIOS: {
      const yearScenarios = state.savedScenarios[action.year] ?? []
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: [...yearScenarios, ...action.scenarios]
        }
      }
    }

    case ScenarioActionName.CLEAR_ALL_SCENARIOS: {
      return {
        ...state,
        savedScenarios: {
          ...state.savedScenarios,
          [action.year]: []
        },
        selectedScenarioIds: [],
        calculationCache: {}
      }
    }

    default:
      return state
  }
}

/**
 * Action creators
 */
export const createScenario = (
  year: TaxYear,
  scenario: Scenario
): CreateScenarioAction => ({
  type: ScenarioActionName.CREATE_SCENARIO,
  year,
  scenario
})

export const updateScenario = (
  year: TaxYear,
  scenarioId: string,
  updates: Partial<Omit<Scenario, 'id' | 'createdAt'>>
): UpdateScenarioAction => ({
  type: ScenarioActionName.UPDATE_SCENARIO,
  year,
  scenarioId,
  updates
})

export const deleteScenario = (
  year: TaxYear,
  scenarioId: string
): DeleteScenarioAction => ({
  type: ScenarioActionName.DELETE_SCENARIO,
  year,
  scenarioId
})

export const duplicateScenario = (
  year: TaxYear,
  scenarioId: string,
  newId: string,
  newName: string
): DuplicateScenarioAction => ({
  type: ScenarioActionName.DUPLICATE_SCENARIO,
  year,
  scenarioId,
  newId,
  newName
})

export const addModification = (
  year: TaxYear,
  scenarioId: string,
  modification: ScenarioModification
): AddModificationAction => ({
  type: ScenarioActionName.ADD_MODIFICATION,
  year,
  scenarioId,
  modification
})

export const updateModification = (
  year: TaxYear,
  scenarioId: string,
  modificationId: string,
  updates: Partial<Omit<ScenarioModification, 'id'>>
): UpdateModificationAction => ({
  type: ScenarioActionName.UPDATE_MODIFICATION,
  year,
  scenarioId,
  modificationId,
  updates
})

export const removeModification = (
  year: TaxYear,
  scenarioId: string,
  modificationId: string
): RemoveModificationAction => ({
  type: ScenarioActionName.REMOVE_MODIFICATION,
  year,
  scenarioId,
  modificationId
})

export const clearModifications = (
  year: TaxYear,
  scenarioId: string
): ClearModificationsAction => ({
  type: ScenarioActionName.CLEAR_MODIFICATIONS,
  year,
  scenarioId
})

export const selectScenario = (scenarioId: string): SelectScenarioAction => ({
  type: ScenarioActionName.SELECT_SCENARIO,
  scenarioId
})

export const deselectScenario = (
  scenarioId: string
): DeselectScenarioAction => ({
  type: ScenarioActionName.DESELECT_SCENARIO,
  scenarioId
})

export const clearSelection = (): ClearSelectionAction => ({
  type: ScenarioActionName.CLEAR_SELECTION
})

export const setCalculationResult = (
  scenarioId: string,
  result: TaxCalculationResult
): SetCalculationResultAction => ({
  type: ScenarioActionName.SET_CALCULATION_RESULT,
  scenarioId,
  result
})

export const clearCalculationCache = (): ClearCalculationCacheAction => ({
  type: ScenarioActionName.CLEAR_CALCULATION_CACHE
})

export const setLoading = (isLoading: boolean): SetLoadingAction => ({
  type: ScenarioActionName.SET_LOADING,
  isLoading
})

export const setError = (error: string): SetErrorAction => ({
  type: ScenarioActionName.SET_ERROR,
  error
})

export const clearError = (): ClearErrorAction => ({
  type: ScenarioActionName.CLEAR_ERROR
})

export const importScenarios = (
  year: TaxYear,
  scenarios: Scenario[]
): ImportScenariosAction => ({
  type: ScenarioActionName.IMPORT_SCENARIOS,
  year,
  scenarios
})

export const clearAllScenarios = (year: TaxYear): ClearAllScenariosAction => ({
  type: ScenarioActionName.CLEAR_ALL_SCENARIOS,
  year
})

/**
 * Selectors
 */
export const selectScenariosForYear = (
  state: { scenarios: ScenarioState },
  year: TaxYear
): Scenario[] => state.scenarios.savedScenarios[year] ?? []

export const selectScenarioById = (
  state: { scenarios: ScenarioState },
  year: TaxYear,
  scenarioId: string
): Scenario | undefined =>
  selectScenariosForYear(state, year).find((s) => s.id === scenarioId)

export const selectSelectedScenarios = (
  state: { scenarios: ScenarioState },
  year: TaxYear
): Scenario[] => {
  const scenarios = selectScenariosForYear(state, year)
  return state.scenarios.selectedScenarioIds
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is Scenario => s !== undefined)
}

export const selectCalculationResult = (
  state: { scenarios: ScenarioState },
  scenarioId: string
): TaxCalculationResult | undefined =>
  state.scenarios.calculationCache[scenarioId]

export const selectIsLoading = (state: {
  scenarios: ScenarioState
}): boolean => state.scenarios.isLoading

export const selectError = (state: {
  scenarios: ScenarioState
}): string | null => state.scenarios.error

export default scenarioReducer
