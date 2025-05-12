import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslationContext } from '@/context/TranslationContext';

const languages = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || localStorage.getItem('i18nextLng') || 'de');
  
  // Subscribe to language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      console.log(`LanguageSwitcher detected language change to: ${lng}`);
      setCurrentLang(lng);
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);
  
  const handleLanguageChange = (languageCode: string) => {
    console.log(`Changing language to: ${languageCode}`);
    
    // Change language in i18n
    i18n.changeLanguage(languageCode);
    
    // Ensure it's saved to localStorage
    localStorage.setItem('i18nextLng', languageCode);
    
    // Update component state
    setCurrentLang(languageCode);
  };
  
  return (
    <div className="flex items-center">
      <Globe className="h-4 w-4 mr-2" />
      <Select value={currentLang} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default LanguageSwitcher;