/**
 * Pittsburgh 2025 Earned Income Tax (EIT) Parameters
 *
 * Pittsburgh imposes an Earned Income Tax (EIT) as part of
 * Pennsylvania's local tax system. The tax is levied by both
 * the city and the school district.
 *
 * Key features:
 * - Residents pay 3.0% (city + school district combined)
 * - Non-residents who work in Pittsburgh pay 1.0%
 * - Administered by Jordan Tax Service
 * - Applies to wages, salaries, and net profits
 */
const parameters = {
  // Tax rates for 2025
  taxRates: {
    // Total resident rate (city + school district)
    resident: 0.03, // 3.0% total
    // Breakdown of resident rate
    residentCity: 0.01, // 1.0% city portion
    residentSchoolDistrict: 0.02, // 2.0% Pittsburgh School District

    // Non-resident rate
    nonResident: 0.01 // 1.0% (only city portion)
  },

  // Pennsylvania EIT structure
  paEitSystem: {
    // Political Subdivision Code (PSD)
    psdCode: '020201', // Pittsburgh city code
    // School district code
    schoolDistrictCode: '020201',
    // Tax collector
    taxCollector: 'Jordan Tax Service',
    // Combined collection with school district
    combinedCollection: true
  },

  // Types of income subject to EIT
  taxableIncome: {
    wages: true,
    salaries: true,
    commissions: true,
    bonuses: true,
    tips: true,
    overtimePay: true,
    selfEmploymentNetProfit: true,
    partnershipIncome: true,
    sCorpWages: true, // S-Corp officer wages
    // NOT subject to EIT
    interest: false,
    dividends: false,
    capitalGains: false,
    rentalIncome: false,
    socialSecurity: false,
    pension: false,
    retirement: false,
    unemployment: false
  },

  // Exemptions
  exemptions: {
    // No minimum filing threshold in PA
    minimumFilingThreshold: 0,
    // Exempt categories
    militaryActiveDutyExempt: true,
    under16Exempt: false, // No age exemption
    disabilityExempt: false,
    // Clergy housing allowance may be exempt
    clergyHousingExempt: true
  },

  // Credits
  credits: {
    // Credit for taxes paid to work location
    workLocationCredit: {
      // Residents get credit for EIT paid to work municipality
      available: true,
      // Credit cannot exceed resident rate
      maxCreditRate: 0.03,
      // Non-residents paying work city tax get no additional credit
      nonResidentCredit: false
    },
    // No EITC enhancement at local level
    eitcEnhancement: {
      percentage: 0
    }
  },

  // Withholding
  withholding: {
    // Employers must withhold EIT
    employerWithholdingRequired: true,
    // Withholding based on Form PA-W3
    stateWithholdingForm: 'PA-W3',
    // Local withholding reported separately
    separateLocalWithholding: true,
    // Quarterly remittance required
    remittanceFrequency: 'quarterly' as const
  },

  // Form information
  formInfo: {
    // Local EIT return
    formNumber: 'PITTS-EIT',
    formName: 'Pittsburgh Earned Income Tax Return',
    // PA state form
    stateForm: 'PA-40',
    filingDeadline: 'April 15',
    extensionDeadline: 'October 15'
  },

  // Administration
  administration: {
    // Jordan Tax Service handles collection
    collectingAgency: 'Jordan Tax Service',
    // Online filing available
    electronicFilingAvailable: true,
    // Electronic payment available
    electronicPaymentAvailable: true
  },

  // Special provisions
  specialProvisions: {
    // Credit for non-resident work location tax
    nonResidentWorkCredit: true,
    // Reciprocity - Pittsburgh has no tax treaties
    reciprocityAgreements: false,
    // Part-year resident allocation
    partYearAllocation: true
  },

  // Penalty and interest
  penalties: {
    // Late filing penalty
    lateFilingPenalty: 0.05, // 5%
    // Late payment interest
    interestRate: 0.06 // 6% annual
  }
}

export default parameters
