import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/hooks/use-navigation';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  /**
   * Der Titel der Seite
   */
  title: string;
  
  /**
   * Ob ein Zurück-Button angezeigt werden soll
   * @default true
   */
  showBackButton?: boolean;
  
  /**
   * Zusätzliche Aktionen, die in der Kopfzeile angezeigt werden sollen
   */
  actions?: React.ReactNode;
  
  /**
   * Zusätzliche CSS-Klassen
   */
  className?: string;
  
  /**
   * Optional: Benutzerdefiniertes Zurück-Verhalten
   */
  onBack?: () => void;
}

/**
 * Einheitliche Kopfzeile für Seiten mit Titel und optionalem Zurück-Button
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBackButton = true,
  actions,
  className = '',
  onBack
}) => {
  const { goBack } = useNavigation();
  const { t } = useTranslation();
  
  // Zurück-Funktion: entweder benutzerdefiniert oder Standard
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  };
  
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center">
        {showBackButton && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mr-3 -ml-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('common.back')}
          </Button>
        )}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      
      {actions && (
        <div className="flex items-center">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;