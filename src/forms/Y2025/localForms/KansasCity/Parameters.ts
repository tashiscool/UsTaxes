/**
 * Kansas City 2025 Earnings Tax Parameters
 *
 * Kansas City, Missouri imposes an earnings tax on:
 * - All residents (regardless of where they work)
 * - All non-residents who work in Kansas City
 *
 * The tax is commonly called the "E-Tax" or earnings tax.
 *
 * Key features:
 * - Flat 1% rate on all earnings
 * - Applies to wages, salaries, commissions, and net profits
 * - Same rate for residents and non-residents
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
    partnershipIncome: true, // If from KC business
    sCorpIncome: true, // If from KC business
    // NOT subject to earnings tax
    interest: false,
    dividends: false,
    capitalGains: false,
    rentalIncome: false, // Unless trade/business
    socialSecurity: false,
    pension: false,
    unemployment: false,
    retirementDistributions: false
  },

  // Exemptions
  exemptions: {
    // Minimum income threshold
    minimumFilingThreshold: 0, // All earnings subject to tax
    // Exempt categories
    militaryActiveDutyExempt: true,
    under16Exempt: true, // Minors under 16 may be exempt
    disabilityExempt: false // Disability income is generally not exempt
  },

  // Withholding requirements
  withholding: {
    // Employers must withhold from all employees
    employerWithholdingRequired: true,
    // Frequency of employer remittance
    remittanceFrequency: 'quarterly' as const,
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
    // Limited credit for taxes paid to other MO cities
    otherCityTaxCredit: {
      available: false, // KC does not provide reciprocal credits
      maxCreditRate: 0
    },
    // No EITC enhancement
    eitcEnhancement: {
      percentage: 0
    }
  },

  // Form information
  formInfo: {
    formNumber: 'RD-109',
    formName: 'Kansas City Earnings Tax Return',
    employerForm: 'RD-110', // Employer quarterly form
    filingDeadline: 'April 15',
    extensionDeadline: 'October 15'
  },

  // Administration
  administration: {
    // Revenue Division handles collection
    collectingAgency: 'Kansas City Revenue Division',
    // Electronic filing available
    electronicFilingAvailable: true,
    // Electronic payment available
    electronicPaymentAvailable: true
  },

  // Penalty and interest rates
  penalties: {
    // Late filing penalty
    lateFilingPenalty: 0.05, // 5% of tax due per month, max 25%
    lateFilingPenaltyMax: 0.25, // Maximum 25%
    // Late payment penalty
    latePaymentPenalty: 0.01, // 1% per month
    // Interest rate on underpayment
    interestRate: 0.12 // 12% annual
  },

  // Special provisions
  specialProvisions: {
    // Remote work provisions (post-COVID)
    // If work city differs from where work is performed
    remoteWorkRules: 'work_location', // Tax based on where work performed
    // Reciprocity with other cities
    reciprocityAgreements: false
  }
}

export default parameters
