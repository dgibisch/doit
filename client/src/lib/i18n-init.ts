import i18n from './i18n';

/**
 * This function initializes and synchronizes the i18n instance.
 * It's important to call this once at application startup to
 * ensure that translations are loaded correctly.
 * 
 * @returns The i18n instance
 */
export function initializeI18n() {
  // Ensure i18n is properly initialized
  if (!i18n.isInitialized) {
    console.warn('i18n is not fully initialized');
  }
  
  // Get language from localStorage or use default
  const storedLanguage = localStorage.getItem('i18nextLng');
  const defaultLanguage = 'de';
  const currentLanguage = storedLanguage && ['de', 'en'].includes(storedLanguage) 
    ? storedLanguage 
    : defaultLanguage;
  
  // Ensure the current language is set
  if (i18n.language !== currentLanguage) {
    i18n.changeLanguage(currentLanguage);
  }
  
  console.log(`i18n initialized with language '${currentLanguage}'`);
  
  return i18n;
}

/**
 * This function updates the application language
 * and triggers a reload of all translated components.
 * 
 * @param language The new language ('de' or 'en')
 */
export function changeLanguage(language: string) {
  console.log(`Changing language to ${language}`);
  
  // Change language in i18n
  i18n.changeLanguage(language);
  
  // Ensure language is saved to localStorage
  localStorage.setItem('i18nextLng', language);
  
  // Set html lang attribute
  document.documentElement.setAttribute('lang', language);
  
  // Optional event dispatcher for global language changes
  const event = new CustomEvent('languageChanged', { detail: { language } });
  window.dispatchEvent(event);
}

// Export the i18n instance for use across the application
export default i18n;