/**
 * St. Louis 2025 Earnings Tax Parameters
 *
 * St. Louis City imposes an earnings tax on:
 * - All residents (regardless of where they work)
 * - All non-residents who work in St. Louis City
 *
 * Note: This applies to St. Louis City, not St. Louis County.
 * County residents who work in the city must pay the earnings tax.
 *
 * Key features:
 * - Flat 1% rate on all earnings
 * - Applies to wages, salaries, commissions, and net profits
 * - Form E-5 equivalent for annual filing
 */
const parameters = {
  // Earnings tax rate for 2025
  // Same rate for residents and non-residents
  taxRate: 0.01, // 1.0%

  // Tax applies to both residents and non-residents who work in city
  taxAppliesTo: {
    residents: true, // Residents pay on all earnings
    nonResidentsWhoWorkInCity: true, // Non-residents pay on earnings in city
    selfEmployed: true // Net profits from self-employment
  },

  // Types of income subject to earnings tax
  taxableIncome: {
    wages: true,
    salaries: true,
    commissions: true,
    bonuses: true,
    tips: true,
    overtimePay: true,
    selfEmploymentNetProfit: true,
    partnershipIncome: true, // If from St. Louis business
    sCorpIncome: true, // If from St. Louis business
    // NOT subject to earnings tax
    interest: false,
    dividends: false,
    capitalGains: false,
    rentalIncome: false, // Unless part of trade/business
    socialSecurity: false,
    pension: false,
    unemployment: false
  },

  // Exemptions
  exemptions: {
    // Minimum income threshold (no tax if below)
    minimumFilingThreshold: 0, // No minimum, all earnings taxed
    // Exempt types
    militaryActiveDutyExempt: true,
    disabilityRetirementExempt: true,
    // Age exemptions
    under18Exempt: false // Minors are subject to tax
  },

  // Withholding requirements
  withholding: {
    // Employers must withhold from all employees
    employerWithholdingRequired: true,
    // Frequency of employer remittance
    remittanceFrequency: 'monthly' as const,
    // Self-employed estimated payment quarters
    estimatedPaymentDates: [
      'April 15',
      'June 15',
      'September 15',
      'January 15'
    ]
  },

  // Credits
  credits: {
    // No credit for taxes paid to other cities
    // (Unlike some cities, St. Louis does not provide reciprocal credits)
    otherCityTaxCredit: false,
    // No EITC enhancement
    eitcEnhancement: {
      percentage: 0
    }
  },

  // Form information
  formInfo: {
    formNumber: 'E-5',
    formName: 'St. Louis Earnings Tax Return',
    alternateFormNumber: 'E-1', // Employer quarterly form
    filingDeadline: 'April 15',
    extensionDeadline: 'October 15'
  },

  // Payment information
  payment: {
    // Electronic payment available
    electronicPaymentAvailable: true,
    // Collector office information
    collectorOffice: 'St. Louis City Collector of Revenue'
  },

  // Penalty and interest rates
  penalties: {
    // Late filing penalty
    lateFilingPenalty: 0.05, // 5% of tax due
    // Late payment penalty
    latePaymentPenalty: 0.05, // 5% of tax due
    // Interest rate on underpayment
    interestRate: 0.01 // 1% per month
  }
}

export default parameters
