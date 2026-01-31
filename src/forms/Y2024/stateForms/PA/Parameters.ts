import { FilingStatus } from 'ustaxes/core/data'

/**
 * Pennsylvania 2024 Tax Parameters
 * Pennsylvania uses a flat 3.07% income tax rate
 * Note: PA also has local Earned Income Tax (EIT) which varies by municipality
 */
const parameters = {
  // Pennsylvania flat tax rate (3.07%)
  taxRate: 0.0307,

  // PA does not have standard deductions or personal exemptions
  // Tax is calculated on all taxable income

  // Tax forgiveness (poverty provisions)
  // Single: $6,500 eligibility income
  // MFJ: $13,000 eligibility income
  // Plus $9,500 per dependent
  taxForgiveness: {
    eligibilityIncome: {
      [FilingStatus.S]: 6500,
      [FilingStatus.MFJ]: 13000,
      [FilingStatus.MFS]: 6500,
      [FilingStatus.HOH]: 6500,
      [FilingStatus.W]: 13000
    },
    perDependent: 9500,
    // Forgiveness percentage table (simplified)
    // Full forgiveness if income <= eligibility
    // Partial forgiveness phases out
    phaseOutRate: 0.1
  },

  // PA does not tax:
  // - Social Security benefits
  // - Railroad retirement benefits
  // - Military pay
  // - Unemployment compensation
  // - Most retirement/pension income (if retired)

  // Classes of income (PA taxes 8 classes separately)
  incomeClasses: [
    'compensation', // Wages, salaries, tips
    'interest', // Interest income
    'dividends', // Dividend income
    'netProfits', // Business/profession net profits
    'netGains', // Net gains from property sales
    'netRents', // Rents and royalties
    'estateOrTrust', // Estate or trust income
    'gambling' // Gambling/lottery winnings
  ],

  // Local Earned Income Tax (EIT) - varies by municipality
  // This is separate from state tax and collected locally
  // Average is around 1% but can range from 0% to 3%+
  localEITNote: 'Local EIT varies by municipality - not calculated here',

  // Use tax rate (same as sales tax)
  useTaxRate: 0.06
}

export default parameters
