import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import deTranslations from '../locales/de.json';
import enTranslations from '../locales/en.json';

// Get stored language preference or default to browser language
const storedLanguage = localStorage.getItem('i18nextLng');
const initialLanguage = storedLanguage && ['de', 'en'].includes(storedLanguage) 
  ? storedLanguage 
  : 'de';

console.log(`Initial language from storage: ${initialLanguage}`);

i18n
  // Auto detect language
  .use(LanguageDetector)
  // React integration
  .use(initReactI18next)
  // Initialization
  .init({
    resources: {
      de: { translation: deTranslations },
      en: { translation: enTranslations }
    },
    fallbackLng: 'en', // Fallback language
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false // React already escapes XSS
    },
    
    // Detection settings
    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'querystring', 'cookie', 'htmlTag'],
      
      // Caching
      caches: ['localStorage'],
      
      // LocalStorage key
      lookupLocalStorage: 'i18nextLng',
    },
    
    supportedLngs: ['de', 'en'],
    
    // Default language (can be overridden by detection)
    lng: initialLanguage,
  });

// Log when language changes
i18n.on('languageChanged', (lng) => {
  console.log(`Language changed to: ${lng}`);
  
  // Update localStorage to ensure persistence
  localStorage.setItem('i18nextLng', lng);
  
  // Optional: Set html lang attribute
  document.documentElement.setAttribute('lang', lng);
});

export default i18n;