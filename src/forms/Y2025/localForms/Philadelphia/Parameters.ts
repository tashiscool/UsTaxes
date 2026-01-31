/**
 * Philadelphia 2025 Tax Parameters
 *
 * Philadelphia imposes wage tax on all wages earned by:
 * - Philadelphia residents (regardless of where they work)
 * - Non-residents who work in Philadelphia
 *
 * Additionally, self-employed individuals pay Net Profits Tax (NPT)
 * and Business Income & Receipts Tax (BIRT) may apply.
 */
const parameters = {
  // Wage Tax Rates for 2025
  // Residents pay a higher rate than non-residents
  wageTax: {
    resident: 0.0375, // 3.75% for residents
    nonResident: 0.0344 // 3.44% for non-residents
  },

  // Net Profits Tax (NPT) for self-employed
  // Based on net profits from trade/business
  netProfitsTax: {
    resident: 0.0375, // Same as wage tax for residents
    nonResident: 0.0344 // Same as wage tax for non-residents
  },

  // School Income Tax (SIT) - part of wage tax, already included above
  // The rates above include both city wage tax and school income tax

  // Earnings Tax - applied to certain types of income
  // Generally same as wage tax rates
  earningsTax: {
    resident: 0.0375,
    nonResident: 0.0344
  },

  // Local Services Tax (LST) - small flat tax
  // Employers must withhold $52/year for employees earning above threshold
  localServicesTax: {
    annualAmount: 52,
    incomeThreshold: 12000, // Exempt if earning less than this
    perPayPeriodWeekly: 1,
    perPayPeriodBiWeekly: 2,
    perPayPeriodMonthly: 4.33
  },

  // Use and Occupancy Tax - for businesses (informational only)
  useAndOccupancyTax: {
    rate: 0.01415, // 1.415% of assessed value for commercial properties
    residentialExempt: true
  },

  // Exemptions
  exemptions: {
    // Low-income exemption threshold
    povertyExemption: {
      singleNoDependent: 13200,
      headOfHousehold: 18400,
      married: 19800,
      perAdditionalDependent: 4400
    },
    // Military active duty is exempt
    militaryActiveDutyExempt: true,
    // Clergy housing allowance may be exempt
    clergyHousingAllowanceExempt: true
  },

  // Credits
  credits: {
    // Credit for taxes paid to other PA municipalities
    // Philadelphia provides credit for wage tax paid to another jurisdiction
    otherMunicipalityTaxCredit: {
      maxCreditRate: 0.0175 // Max credit is limited
    },
    // EITC enhancement - Philadelphia may enhance federal EITC
    eitcEnhancement: {
      percentage: 0 // Currently no enhancement, placeholder
    }
  },

  // Filing thresholds
  filingThresholds: {
    // Must file if gross income exceeds these amounts
    grossIncomeThreshold: 100
  }
}

export default parameters
