import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { requestLocationSharing } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface LocationSharingButtonProps {
  chatId: string;
  locationShared: boolean;
}

export default function LocationSharingButton({ 
  chatId, 
  locationShared 
}: LocationSharingButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  // Falls der Standort bereits freigegeben wurde, nichts anzeigen oder Icon anzeigen
  if (locationShared) {
    return (
      <button
        className="text-green-600 rounded-full p-1.5 bg-green-50 cursor-default"
        title={t('chat.locationShared')}
        disabled
      >
        <MapPin className="h-4 w-4" />
      </button>
    );
  }
  
  const handleRequestLocation = async () => {
    if (!user || !chatId) return;
    
    try {
      setLoading(true);
      await requestLocationSharing(chatId, user.uid);
      toast({
        title: t('chat.locationShareRequest'),
        description: t('chat.waitingForTaskLocation')
      });
    } catch (error) {
      console.error("Error requesting location:", error);
      toast({
        title: t('errors.error'),
        description: t('errors.locationSharingFailed'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button
      className={`text-gray-500 rounded-full p-1.5 ${loading ? 'opacity-50' : 'hover:bg-gray-200'}`}
      onClick={handleRequestLocation}
      disabled={loading}
      title={t('chat.shareLocation')}
    >
      <MapPin className="h-4 w-4" />
    </button>
  );
}