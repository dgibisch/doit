import React from 'react';
import { useTranslation } from 'react-i18next';

interface TranslatedTextProps {
  /**
   * Der Schlüssel für die Übersetzung
   */
  id: string;
  
  /**
   * Optionale Interpolation für dynamische Werte in der Übersetzung
   */
  values?: Record<string, any>;
  
  /**
   * Optionale Angabe der Komponente, als die der übersetzte Text gerendert werden soll
   * (z.B. 'h1', 'p', 'span', etc.)
   */
  as?: React.ElementType;
  
  /**
   * Optionale CSS-Klassen
   */
  className?: string;
  
  /**
   * Fallback-Text, falls keine Übersetzung gefunden wird
   */
  fallback?: string;
  
  /**
   * Andere Props, die an die Komponente weitergegeben werden
   */
  [key: string]: any;
}

/**
 * Eine Komponente zur standardisierten Übersetzung von Texten
 * 
 * Beispiel:
 * <TranslatedText id="common.save" as="button" className="btn" onClick={handleSave} />
 */
const TranslatedText: React.FC<TranslatedTextProps> = ({
  id,
  values = {},
  as = 'span',
  className = '',
  fallback,
  ...rest
}) => {
  const { t } = useTranslation();
  
  // Wenn der Schlüssel nicht gefunden wird, verwenden wir entweder den
  // expliziten Fallback-Text oder den Schlüssel selbst
  const translated = t(id, values) || fallback || id;
  
  // Dynamisches Rendering basierend auf dem 'as'-Prop
  const Component = as;
  
  return (
    <Component className={className} {...rest}>
      {translated}
    </Component>
  );
};

export default TranslatedText;