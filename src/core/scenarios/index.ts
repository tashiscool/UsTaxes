/**
 * Scenario Engine Module
 *
 * Provides functionality for what-if tax scenario analysis:
 * - Deep cloning of tax data
 * - Applying modifications to tax data
 * - Running tax calculations on modified data
 * - Comparing scenarios
 */

export {
  // Types
  type Scenario,
  type ScenarioModification,
  type ModificationType,
  type TaxCalculationResult,
  type ScenarioComparison,
  type ScenarioDifference,
  // Functions
  cloneInformation,
  cloneAssets,
  applyModification,
  applyModifications,
  calculateTaxes,
  compareScenarios,
  generateScenarioId,
  createEmptyScenario,
  createMax401kScenario,
  createAddChildScenario,
  createMaxHSAScenario,
  createSpouseWorksScenario
} from './scenarioEngine'
