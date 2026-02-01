import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enTranslation from './locales/en.json'
import esTranslation from './locales/es.json'

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

// Language preference storage key
const LANGUAGE_STORAGE_KEY = 'ustaxes_language'

// Available languages
export const languages = {
  en: { name: 'English', nativeName: 'English', flag: 'US' },
  es: { name: 'Spanish', nativeName: 'Espanol', flag: 'ES' }
} as const

export type LanguageCode = keyof typeof languages

// Namespace definitions
export const namespaces = {
  common: 'common',
  nav: 'nav',
  forms: 'forms',
  income: 'income',
  deductions: 'deductions',
  credits: 'credits',
  results: 'results',
  errors: 'errors',
  validation: 'validation'
} as const

// Resources configuration
const resources = {
  en: {
    translation: enTranslation
  },
  es: {
    translation: esTranslation
  }
}

// Initialize i18next
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false, // React already handles escaping
      formatSeparator: ','
    },

    // React specific options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: ''
    },

    // Debug mode (disable in production)
    debug: process.env.NODE_ENV === 'development'
  })

// Helper function to get current language
export const getCurrentLanguage = (): LanguageCode => {
  return (i18n.language.split('-')[0] as LanguageCode) || 'en'
}

// Helper function to change language
export const changeLanguage = async (lng: LanguageCode): Promise<void> => {
  await i18n.changeLanguage(lng)
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
}

// Helper function to get language from storage
export const getStoredLanguage = (): LanguageCode | null => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored && stored in languages ? (stored as LanguageCode) : null
}

// Format currency based on locale
export const formatCurrency = (amount: number, lng?: LanguageCode): string => {
  const language = lng || getCurrentLanguage()
  const locale = language === 'es' ? 'es-US' : 'en-US'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Format date based on locale
export const formatDate = (date: Date, lng?: LanguageCode): string => {
  const language = lng || getCurrentLanguage()
  const locale = language === 'es' ? 'es-US' : 'en-US'

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

// Format number based on locale
export const formatNumber = (num: number, lng?: LanguageCode): string => {
  const language = lng || getCurrentLanguage()
  const locale = language === 'es' ? 'es-US' : 'en-US'

  return new Intl.NumberFormat(locale).format(num)
}

export default i18n
