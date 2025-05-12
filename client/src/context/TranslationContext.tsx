import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

interface TranslationContextType {
  /**
   * The currently active language ('de' or 'en')
   */
  currentLanguage: string;
  
  /**
   * Function to change the language
   */
  setLanguage: (language: string) => void;
  
  /**
   * Translation function
   */
  translate: (key: string, options?: any) => string | object;
  
  /**
   * Determines if the language has been changed from the default
   */
  isCustomLanguage: boolean;
}

// Create the context
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

/**
 * Provider component for the TranslationContext
 */
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation();
  
  // Get the stored language from localStorage or default to 'de'
  const storedLanguage = localStorage.getItem('i18nextLng');
  const defaultLanguage = 'de';
  const initialLanguage = storedLanguage && ['de', 'en'].includes(storedLanguage) 
    ? storedLanguage 
    : defaultLanguage;
  
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [isCustomLanguage, setIsCustomLanguage] = useState(initialLanguage !== defaultLanguage);
  
  // Synchronize state with the i18n instance
  useEffect(() => {
    // Ensure i18n is using the correct language on mount
    if (i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
    
    const handleLanguageChanged = (lng: string) => {
      console.log(`TranslationContext detected language change to: ${lng}`);
      setCurrentLanguage(lng);
      setIsCustomLanguage(lng !== defaultLanguage);
    };
    
    // Add event listener for language changes
    i18n.on('languageChanged', handleLanguageChanged);
    
    // Cleanup on unmount
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n, currentLanguage, defaultLanguage]);
  
  // Function to change the language
  const setLanguage = (language: string) => {
    console.log(`TranslationContext setting language to: ${language}`);
    
    // Change language in i18n
    i18n.changeLanguage(language);
    
    // Ensure it's saved to localStorage for persistence
    localStorage.setItem('i18nextLng', language);
  };
  
  // Function to translate
  const translate = (key: string, options?: any) => {
    return t(key, options);
  };
  
  // Context value
  const contextValue: TranslationContextType = {
    currentLanguage,
    setLanguage,
    translate,
    isCustomLanguage
  };
  
  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

/**
 * Hook to access the TranslationContext
 */
export const useTranslationContext = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  
  if (!context) {
    throw new Error('useTranslationContext must be used within a TranslationProvider');
  }
  
  return context;
};

export default TranslationContext;