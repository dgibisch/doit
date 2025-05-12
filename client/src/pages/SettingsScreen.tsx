import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useNavigation } from '@/hooks/use-navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TranslationExample from '@/components/TranslationExample';
import DateTimeExample from '@/components/DateTimeExample';

const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          className="mr-4"
          onClick={() => goBack()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
        <h1 className="text-2xl font-bold">{t('common.settings')}</h1>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {t('settings.languageDescription')}
          </p>
          <LanguageSwitcher />
          
          <Separator className="my-4" />
          
          <h3 className="font-medium mb-2">{t('settings.preview')}</h3>
          <TranslationExample />
          <DateTimeExample />
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.notifications')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {t('settings.notificationsDescription')}
          </p>
          <div className="text-center py-6">
            <p className="text-gray-500">{t('settings.comingSoon')}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.privacy')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {t('settings.privacyDescription')}
          </p>
          <div className="text-center py-6">
            <p className="text-gray-500">{t('settings.comingSoon')}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.about')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold mb-1">DoIt</h2>
            <p className="text-sm text-gray-500">Version 1.0.0</p>
          </div>
          <Separator className="my-4" />
          <div className="text-center text-sm text-gray-500">
            <p>{t('settings.copyright')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsScreen;