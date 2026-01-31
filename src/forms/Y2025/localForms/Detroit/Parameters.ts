/**
 * Detroit 2025 City Income Tax Parameters
 *
 * Detroit imposes a city income tax on:
 * - Residents (at a higher rate)
 * - Non-residents who work in Detroit
 *
 * Renaissance Zone exemptions may apply for qualifying businesses/residents.
 *
 * Key features:
 * - Progressive rate structure for residents vs non-residents
 * - Credits for taxes paid to other Michigan cities
 * - Integration with Michigan state return
 */
const parameters = {
  // Tax rates for 2025
  taxRates: {
    resident: 0.024, // 2.4% for residents
    nonResident: 0.012 // 1.2% for non-residents who work in Detroit
  },

  // Renaissance Zone Exemptions
  // Qualifying businesses and residents in designated zones
  // may receive full or partial exemption from city income tax
  renaissanceZone: {
    // Full exemption for businesses in qualified zones
    businessExemptionPercent: 1.0, // 100% exempt
    // Partial exemption for residential property owners
    residentialExemptionPercent: 0.5, // 50% exempt (varies by zone)
    // Qualified zones (zone names/numbers)
    qualifiedZones: [
      'Downtown',
      'Midtown',
      'Corktown',
      'Eastern Market',
      'New Center',
      'North End',
      'Southwest',
      'Livernois-McNichols',
      'Grandmont Rosedale'
    ],
    // Renaissance Zone requires application and approval
    requiresApproval: true
  },

  // Withholding requirements
  withholding: {
    // Employers in Detroit must withhold from all employees
    employerWithholdingRequired: true,
    // Threshold for mandatory quarterly estimated payments
    estimatedPaymentThreshold: 100
  },

  // Exemptions
  exemptions: {
    // Income exempt from Detroit city tax
    militaryExempt: true,
    socialSecurityExempt: true,
    pensionExempt: false, // Pensions are taxable
    unemploymentExempt: true,
    // Minimum filing threshold
    filingThreshold: 600
  },

  // Credits
  credits: {
    // Credit for city income tax paid to other Michigan cities
    otherCityTaxCredit: {
      // Credit is limited to Detroit's rate on the income taxed by other city
      maxCreditRate: 0.024, // Cannot exceed Detroit's rate for residents
      nonResidentMaxCreditRate: 0.012, // Cannot exceed non-resident rate
      // Only Michigan cities with income tax qualify
      qualifyingStates: ['MI']
    },
    // No local EITC enhancement currently
    eitcEnhancement: {
      percentage: 0
    }
  },

  // Form information
  formInfo: {
    formNumber: 'D-1040',
    formName: 'Detroit City Individual Income Tax Return',
    filingDeadline: 'April 15',
    extensionDeadline: 'October 15'
  },

  // Michigan cities with income tax (for credit calculations)
  michiganCitiesWithIncomeTax: [
    'Detroit',
    'Grand Rapids',
    'Lansing',
    'Flint',
    'Saginaw',
    'Pontiac',
    'Port Huron',
    'Highland Park',
    'Hamtramck',
    'Battle Creek',
    'Albion',
    'Big Rapids',
    'East Lansing',
    'Grayling',
    'Hudson',
    'Ionia',
    'Jackson',
    'Lapeer',
    'Muskegon',
    'Muskegon Heights',
    'Portland',
    'Springfield',
    'Walker'
  ]
}

export default parameters
