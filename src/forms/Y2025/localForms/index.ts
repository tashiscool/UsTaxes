/**
 * Local Tax Forms Registry for Y2025
 *
 * This module exports all local (municipal/city) tax forms
 * that are supported by UsTaxes.
 *
 * Currently supported jurisdictions:
 * - NYC (New York City) - Resident income tax
 * - Philadelphia, PA - Wage tax and net profits tax
 * - Ohio municipalities - RITA/CCA municipal income tax
 * - Detroit, MI - City income tax
 * - St. Louis, MO - Earnings tax
 * - Kansas City, MO - Earnings tax
 * - Baltimore, MD - City income tax
 * - Pittsburgh, PA - Earned income tax
 * - Indianapolis/Marion County, IN - County income tax
 */

// NYC Forms
export {
  NYCResidentTax,
  default as makeNYCResidentTax
} from './NYC/NYCResidentTax'
export { default as nycParameters } from './NYC/Parameters'

// Philadelphia Forms
export {
  PhiladelphiaWageTax,
  default as makePhiladelphiaWageTax
} from './Philadelphia/PhiladelphiaWageTax'
export { default as philadelphiaParameters } from './Philadelphia/Parameters'

// Ohio Municipal Forms
export {
  OhioMunicipalTax,
  default as makeOhioMunicipalTax
} from './Ohio/OhioMunicipalTax'
export { default as ohioMunicipalParameters } from './Ohio/Parameters'

// Detroit Forms
export {
  DetroitCityTax,
  default as makeDetroitCityTax
} from './Detroit/DetroitCityTax'
export { default as detroitParameters } from './Detroit/Parameters'

// St. Louis Forms
export {
  StLouisEarningsTax,
  default as makeStLouisEarningsTax
} from './StLouis/StLouisEarningsTax'
export { default as stLouisParameters } from './StLouis/Parameters'

// Kansas City Forms
export {
  KansasCityEarningsTax,
  default as makeKansasCityEarningsTax
} from './KansasCity/KansasCityEarningsTax'
export { default as kansasCityParameters } from './KansasCity/Parameters'

// Baltimore Forms
export {
  BaltimoreCityTax,
  default as makeBaltimoreCityTax
} from './Baltimore/BaltimoreCityTax'
export { default as baltimoreParameters } from './Baltimore/Parameters'

// Pittsburgh Forms
export {
  PittsburghEIT,
  default as makePittsburghEIT
} from './Pittsburgh/PittsburghEIT'
export { default as pittsburghParameters } from './Pittsburgh/Parameters'

// Indianapolis/Marion County Forms
export {
  MarionCountyTax,
  default as makeMarionCountyTax
} from './Indianapolis/MarionCountyTax'
export { default as indianapolisParameters } from './Indianapolis/Parameters'

/**
 * Supported local tax jurisdictions
 */
export type LocalTaxJurisdictionType =
  | 'NYC'
  | 'Philadelphia'
  | 'Columbus'
  | 'Cleveland'
  | 'Cincinnati'
  | 'Toledo'
  | 'Akron'
  | 'Dayton'
  | 'Youngstown'
  | 'Canton'
  | 'Parma'
  | 'Lorain'
  | 'Dublin'
  | 'Westerville'
  | 'Grove City'
  | 'Upper Arlington'
  | 'Detroit'
  | 'St. Louis'
  | 'Kansas City'
  | 'Baltimore'
  | 'Pittsburgh'
  | 'Indianapolis'
  | 'Other'

/**
 * Registry of all local tax forms
 */
export const localTaxFormsRegistry = {
  NYC: {
    name: 'New York City',
    state: 'NY',
    description: 'NYC resident income tax (3.078% - 3.876%)',
    formName: 'NYC-201',
    hasResidentTax: true,
    hasNonResidentTax: false,
    hasSelfEmploymentTax: true // UBT
  },
  Philadelphia: {
    name: 'Philadelphia',
    state: 'PA',
    description: 'Philadelphia wage tax (3.75% resident, 3.44% non-resident)',
    formName: 'PHL-WAGE-TAX',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true // NPT
  },
  Columbus: {
    name: 'Columbus',
    state: 'OH',
    description: 'Columbus municipal income tax (2.5%)',
    formName: 'OHIO-MUNI-TAX',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    collectionAgency: 'RITA'
  },
  Cleveland: {
    name: 'Cleveland',
    state: 'OH',
    description: 'Cleveland municipal income tax (2.5%)',
    formName: 'OHIO-MUNI-TAX',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    collectionAgency: 'CCA'
  },
  Cincinnati: {
    name: 'Cincinnati',
    state: 'OH',
    description: 'Cincinnati municipal income tax (1.8%, 50% credit limit)',
    formName: 'OHIO-MUNI-TAX',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    collectionAgency: 'RITA'
  },
  Detroit: {
    name: 'Detroit',
    state: 'MI',
    description: 'Detroit city income tax (2.4% resident, 1.2% non-resident)',
    formName: 'D-1040',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    hasRenaissanceZoneExemption: true
  },
  'St. Louis': {
    name: 'St. Louis',
    state: 'MO',
    description: 'St. Louis earnings tax (1.0%)',
    formName: 'STL-E5',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true
  },
  'Kansas City': {
    name: 'Kansas City',
    state: 'MO',
    description: 'Kansas City earnings tax (1.0%)',
    formName: 'KC-RD109',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true
  },
  Baltimore: {
    name: 'Baltimore',
    state: 'MD',
    description: 'Baltimore city tax (3.2% resident, 1.75% non-resident)',
    formName: 'BALT-LOCAL',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    collectedWith: 'MD-502'
  },
  Pittsburgh: {
    name: 'Pittsburgh',
    state: 'PA',
    description: 'Pittsburgh EIT (3.0% resident, 1.0% non-resident)',
    formName: 'PITTS-EIT',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    taxCollector: 'Jordan Tax Service'
  },
  Indianapolis: {
    name: 'Indianapolis/Marion County',
    state: 'IN',
    description: 'Marion County income tax (2.02%)',
    formName: 'MARION-CTY',
    hasResidentTax: true,
    hasNonResidentTax: false, // Based on residence, not work location
    hasSelfEmploymentTax: true,
    collectedWith: 'IT-40'
  }
} as const

/**
 * Get form information for a jurisdiction
 */
export const getLocalTaxFormInfo = (jurisdiction: LocalTaxJurisdictionType) => {
  if (jurisdiction === 'Other') {
    return null
  }

  // Check if it's a direct registry entry
  if (jurisdiction in localTaxFormsRegistry) {
    return localTaxFormsRegistry[
      jurisdiction as keyof typeof localTaxFormsRegistry
    ]
  }

  // For other Ohio cities, return generic Ohio info
  return {
    name: jurisdiction,
    state: 'OH',
    description: `${jurisdiction} municipal income tax`,
    formName: 'OHIO-MUNI-TAX',
    hasResidentTax: true,
    hasNonResidentTax: true,
    hasSelfEmploymentTax: true,
    collectionAgency: 'RITA' as const
  }
}

/**
 * List of all Ohio cities with municipal tax
 */
export const ohioCities = [
  'Columbus',
  'Cleveland',
  'Cincinnati',
  'Toledo',
  'Akron',
  'Dayton',
  'Youngstown',
  'Canton',
  'Parma',
  'Lorain',
  'Dublin',
  'Westerville',
  'Grove City',
  'Upper Arlington',
  'Hilliard',
  'Reynoldsburg',
  'Gahanna',
  'Worthington',
  'Bexley',
  'Whitehall',
  'Lakewood',
  'Euclid',
  'Shaker Heights',
  'Cleveland Heights',
  'Strongsville'
] as const

/**
 * List of Michigan cities with income tax
 */
export const michiganCities = [
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
] as const

/**
 * List of Missouri cities with earnings tax
 */
export const missouriCities = ['St. Louis', 'Kansas City'] as const

/**
 * Determine which local tax forms are needed based on residency and work location
 */
export const determineRequiredLocalForms = (
  residenceCity: string | undefined,
  residenceState: string | undefined,
  workCity: string | undefined,
  workState: string | undefined
): string[] => {
  const requiredForms: string[] = []
  const resCityLower = residenceCity?.toLowerCase()
  const workCityLower = workCity?.toLowerCase()

  // NYC resident tax
  if (
    resCityLower === 'new york city' ||
    resCityLower === 'nyc' ||
    (residenceState === 'NY' &&
      ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten island'].includes(
        resCityLower ?? ''
      ))
  ) {
    requiredForms.push('NYC-201')
  }

  // Philadelphia wage tax
  if (resCityLower === 'philadelphia' || workCityLower === 'philadelphia') {
    requiredForms.push('PHL-WAGE-TAX')
  }

  // Ohio municipal tax
  if (residenceState === 'OH' || workState === 'OH') {
    if (residenceCity || workCity) {
      requiredForms.push('OHIO-MUNI-TAX')
    }
  }

  // Detroit city tax
  if (resCityLower === 'detroit' || workCityLower === 'detroit') {
    requiredForms.push('D-1040')
  }

  // St. Louis earnings tax
  if (
    resCityLower === 'st. louis' ||
    resCityLower === 'st louis' ||
    resCityLower === 'saint louis' ||
    workCityLower === 'st. louis' ||
    workCityLower === 'st louis' ||
    workCityLower === 'saint louis'
  ) {
    requiredForms.push('STL-E5')
  }

  // Kansas City earnings tax
  if (resCityLower === 'kansas city' || workCityLower === 'kansas city') {
    // Only MO Kansas City, not KS
    if (residenceState === 'MO' || workState === 'MO') {
      requiredForms.push('KC-RD109')
    }
  }

  // Baltimore city tax
  if (
    resCityLower === 'baltimore' ||
    resCityLower === 'baltimore city' ||
    workCityLower === 'baltimore' ||
    workCityLower === 'baltimore city'
  ) {
    requiredForms.push('BALT-LOCAL')
  }

  // Pittsburgh EIT
  if (resCityLower === 'pittsburgh' || workCityLower === 'pittsburgh') {
    requiredForms.push('PITTS-EIT')
  }

  // Indianapolis/Marion County tax
  if (
    resCityLower === 'indianapolis' ||
    resCityLower === 'indy' ||
    resCityLower === 'marion county'
  ) {
    requiredForms.push('MARION-CTY')
  }

  return requiredForms
}
