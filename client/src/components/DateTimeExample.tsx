import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, formatDistance, formatRelative } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

/**
 * Komponente zur Demonstration der Lokalisierung von Datumsformaten
 */
const DateTimeExample: React.FC = () => {
  const { t, i18n } = useTranslation();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  // Sprach-Locale für date-fns basierend auf der i18n-Sprache auswählen
  const locale = i18n.language === 'de' ? de : enUS;
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('settings.dateTimeFormatting')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-1">{t('settings.standardFormat')}</h3>
          <p className="text-slate-700">
            {format(today, 'PPP', { locale })}
          </p>
        </div>
        
        <div>
          <h3 className="text-sm font-medium mb-1">{t('settings.relativeFormat')}</h3>
          <ul className="space-y-1 text-slate-700">
            <li>
              {t('settings.today')}: {formatRelative(today, today, { locale })}
            </li>
            <li>
              {t('settings.yesterday')}: {formatRelative(yesterday, today, { locale })}
            </li>
            <li>
              {t('settings.lastWeek')}: {formatRelative(lastWeek, today, { locale })}
            </li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-sm font-medium mb-1">{t('settings.distanceFormat')}</h3>
          <ul className="space-y-1 text-slate-700">
            <li>
              {t('settings.yesterday')}: {formatDistance(yesterday, today, { addSuffix: true, locale })}
            </li>
            <li>
              {t('settings.lastWeek')}: {formatDistance(lastWeek, today, { addSuffix: true, locale })}
            </li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-sm font-medium mb-1">{t('settings.customFormat')}</h3>
          <ul className="space-y-1 text-slate-700">
            <li>
              {t('settings.short')}: {format(today, 'P', { locale })}
            </li>
            <li>
              {t('settings.medium')}: {format(today, 'PPP', { locale })}
            </li>
            <li>
              {t('settings.full')}: {format(today, 'PPPP', { locale })}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default DateTimeExample;