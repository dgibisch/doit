import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Beispielkomponente, die die Verwendung von react-i18next demonstriert
 */
const TranslationExample: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('common.appName')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">{t('auth.noAccount')}</p>
        
        <div className="flex gap-2">
          <Button variant="default">{t('auth.signIn')}</Button>
          <Button variant="outline">{t('auth.signUp')}</Button>
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>{t('auth.termsAgreement', {
            terms: t('auth.termsOfService'),
            privacy: t('auth.privacyPolicy')
          })}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TranslationExample;