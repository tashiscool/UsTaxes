export {
  calculateTax,
  calculateBracketTax,
  calculateSafeHarbor,
  calculateTaxSavingOpportunities,
  calculateChildTaxCredit,
  calculateEarnedIncomeCredit,
  projectNextYearTax,
  getFederalTaxData,
  getIRAContributionLimit,
  getHSAContributionLimit,
  federalTaxData2024,
  federalTaxData2025
} from './taxCalculator'

export type {
  TaxInputs,
  TaxBreakdown,
  TaxBrackets,
  FederalTaxData,
  BracketBreakdown,
  TaxSavingOpportunity
} from './taxCalculator'
