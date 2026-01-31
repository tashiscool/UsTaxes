/**
 * Ohio Municipal Tax Parameters for 2025
 *
 * Ohio has a unique municipal income tax system where cities and villages
 * can levy their own income tax. The Regional Income Tax Agency (RITA)
 * administers taxes for many Ohio municipalities.
 *
 * Key features:
 * - Most municipalities tax at 1-2.5%
 * - Credit available for taxes paid to work city
 * - Some municipalities have different rates for residents vs workers
 */
const parameters = {
  // Common Ohio city tax rates for 2025
  // These are the major cities - actual implementation would need a full database
  cityRates: {
    // Major cities
    Columbus: { rate: 0.025, creditRate: 1.0 }, // 2.5%, full credit
    Cleveland: { rate: 0.025, creditRate: 1.0 }, // 2.5%, full credit
    Cincinnati: { rate: 0.018, creditRate: 0.5 }, // 1.8%, 50% credit
    Toledo: { rate: 0.0225, creditRate: 1.0 }, // 2.25%, full credit
    Akron: { rate: 0.025, creditRate: 1.0 }, // 2.5%, full credit
    Dayton: { rate: 0.025, creditRate: 1.0 }, // 2.5%, full credit
    Youngstown: { rate: 0.027, creditRate: 1.0 }, // 2.7%, full credit
    Canton: { rate: 0.02, creditRate: 1.0 }, // 2.0%, full credit
    Parma: { rate: 0.03, creditRate: 1.0 }, // 3.0%, full credit
    Lorain: { rate: 0.025, creditRate: 1.0 }, // 2.5%, full credit

    // Additional common RITA municipalities
    Dublin: { rate: 0.02, creditRate: 1.0 },
    Westerville: { rate: 0.02, creditRate: 1.0 },
    Grove_City: { rate: 0.02, creditRate: 1.0 },
    Upper_Arlington: { rate: 0.025, creditRate: 1.0 },
    Hilliard: { rate: 0.02, creditRate: 1.0 },
    Reynoldsburg: { rate: 0.025, creditRate: 1.0 },
    Gahanna: { rate: 0.025, creditRate: 1.0 },
    Worthington: { rate: 0.025, creditRate: 1.0 },
    Bexley: { rate: 0.025, creditRate: 1.0 },
    Whitehall: { rate: 0.025, creditRate: 1.0 },

    // Cleveland suburbs
    Lakewood: { rate: 0.015, creditRate: 1.0 },
    Euclid: { rate: 0.029, creditRate: 1.0 },
    Shaker_Heights: { rate: 0.0225, creditRate: 1.0 },
    Cleveland_Heights: { rate: 0.02, creditRate: 1.0 },
    Strongsville: { rate: 0.02, creditRate: 1.0 },

    // Default for unknown cities
    default: { rate: 0.02, creditRate: 1.0 }
  },

  // RITA (Regional Income Tax Agency) information
  rita: {
    filingFee: 0, // No fee for individual filers
    minimumTax: 0, // Most cities have no minimum
    // RITA handles collection for 300+ Ohio municipalities
    memberCities: true
  },

  // Central Collection Agency (CCA) - Cleveland area
  cca: {
    memberCities: [
      'Cleveland',
      'Parma',
      'Lakewood',
      'Euclid',
      'Cleveland_Heights'
    ]
  },

  // Exemptions
  exemptions: {
    // Standard exemption (varies by city, using common amount)
    standardExemption: 0,
    // Military active duty is generally exempt
    militaryExempt: true,
    // Under 18 may be exempt in some jurisdictions
    under18Exempt: true,
    // Minimum filing threshold (some cities don't require filing below this)
    minimumFilingThreshold: 0
  },

  // Work location credit rules
  // Ohio law allows credit for taxes paid to work city, limited to residence city rate
  creditRules: {
    // Maximum credit is the lesser of:
    // 1. Actual tax paid to work city
    // 2. Residence city's credit limit (% of residence rate)
    // 3. Residence city's rate applied to wages earned in work city
    creditLimit: 'residence_rate',
    // Some cities limit credit to less than 100%
    // Cincinnati only allows 50% credit
    minCreditPercent: 0.5,
    maxCreditPercent: 1.0
  },

  // Types of income subject to municipal tax
  taxableIncome: {
    wages: true,
    salaries: true,
    commissions: true,
    bonuses: true,
    selfEmployment: true,
    partnership: true,
    sCorp: true,
    // These are generally NOT taxable at municipal level
    interest: false,
    dividends: false,
    capitalGains: false,
    socialSecurity: false,
    pension: false, // Exception: some cities tax pension
    unemployment: false
  },

  // Special provisions
  specialProvisions: {
    // Work from home provisions (post-COVID)
    // If work city differs from where work is performed
    workFromHomeCredit: true,
    // Joint Economic Development Districts (JEDDs)
    jeddTaxApplies: true,
    // Net operating loss carryforward (varies by city)
    nolCarryforwardYears: 5
  }
}

export default parameters
