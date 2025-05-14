import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSharedTaskLocation } from '@/lib/location-sharing';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';

interface LocationDisplayProps {
  chatId: string;
  taskId: string;
  isShared: boolean;
}

export default function LocationDisplay({ 
  chatId, 
  taskId,
  isShared 
}: LocationDisplayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [locationData, setLocationData] = useState<any>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchLocationData = async () => {
      if (!isShared || !chatId || !taskId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await getSharedTaskLocation(chatId, taskId);
        
        if (isMounted) {
          setLocationData(data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching shared location:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchLocationData();
    
    return () => {
      isMounted = false;
    };
  }, [chatId, taskId, isShared]);
  
  // Wenn noch nicht freigegeben, zeigen wir gar nichts an
  if (!isShared) {
    return null;
  }
  
  // Ladezustand
  if (loading) {
    return (
      <div className="p-3 rounded-lg bg-gray-50 border mt-2 mb-4">
        <div className="flex items-center mb-2">
          <MapPin className="text-indigo-500 mr-2 h-5 w-5" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }
  
  // Wenn keine Daten gefunden wurden
  if (!locationData || !locationData.coordinates) {
    return (
      <div className="p-3 rounded-lg bg-gray-50 border mt-2 mb-4">
        <div className="flex items-center">
          <MapPin className="text-gray-400 mr-2 h-5 w-5" />
          <p className="text-sm font-medium text-gray-700">
            {t('chat.exactTaskLocation')}
          </p>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {t('chat.locationAddress')}
        </p>
      </div>
    );
  }
  
  // Wenn Daten vorhanden sind, zeigen wir sie an
  const { coordinates, address } = locationData;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`;
  
  return (
    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 mt-2 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <MapPin className="text-indigo-500 mr-2 h-5 w-5" />
          <p className="text-sm font-medium text-indigo-700">
            {t('chat.exactTaskLocation')}
          </p>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-8 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 p-0 px-2"
          onClick={() => window.open(googleMapsUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          {t('chat.openInMaps')}
        </Button>
      </div>
      <p className="text-sm text-indigo-600 mt-1">
        {address || t('chat.locationAddress')}
      </p>
      <p className="text-xs text-indigo-500 mt-0.5">
        {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
      </p>
    </div>
  );
}