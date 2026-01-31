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
 */

// NYC Forms
export { NYCResidentTax, default as makeNYCResidentTax } from './NYC/NYCResidentTax'
export { default as nycParameters } from './NYC/Parameters'

// Philadelphia Forms
export { PhiladelphiaWageTax, default as makePhiladelphiaWageTax } from './Philadelphia/PhiladelphiaWageTax'
export { default as philadelphiaParameters } from './Philadelphia/Parameters'

// Ohio Municipal Forms
export { OhioMunicipalTax, default as makeOhioMunicipalTax } from './Ohio/OhioMunicipalTax'
export { default as ohioMunicipalParameters } from './Ohio/Parameters'

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
    return localTaxFormsRegistry[jurisdiction as keyof typeof localTaxFormsRegistry]
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
 * Determine which local tax forms are needed based on residency and work location
 */
export const determineRequiredLocalForms = (
  residenceCity: string | undefined,
  residenceState: string | undefined,
  workCity: string | undefined,
  workState: string | undefined
): string[] => {
  const requiredForms: string[] = []

  // NYC resident tax
  if (
    residenceCity?.toLowerCase() === 'new york city' ||
    residenceCity?.toLowerCase() === 'nyc' ||
    (residenceState === 'NY' && ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten island'].includes(residenceCity?.toLowerCase() ?? ''))
  ) {
    requiredForms.push('NYC-201')
  }

  // Philadelphia wage tax
  if (
    residenceCity?.toLowerCase() === 'philadelphia' ||
    workCity?.toLowerCase() === 'philadelphia' ||
    residenceState === 'PA' && workState === 'PA'
  ) {
    if (residenceCity?.toLowerCase() === 'philadelphia' || workCity?.toLowerCase() === 'philadelphia') {
      requiredForms.push('PHL-WAGE-TAX')
    }
  }

  // Ohio municipal tax
  if (residenceState === 'OH' || workState === 'OH') {
    if (residenceCity || workCity) {
      requiredForms.push('OHIO-MUNI-TAX')
    }
  }

  return requiredForms
}
