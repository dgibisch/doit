import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { MapPin, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { respondToLocationRequest } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface ChatMessageProps {
  message: any;
  chatId: string;
  taskId: string;
}

export default function ChatMessage({ message, chatId, taskId }: ChatMessageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  if (!user) return null;
  
  const isOwnMessage = message.senderId === user.uid;
  const isSystemMessage = message.senderId === "system";
  
  const handleRespondToLocation = async (approved: boolean) => {
    if (!user || !chatId || !taskId) return;
    
    try {
      setLoading(true);
      const shared = await respondToLocationRequest(chatId, user.uid, approved, taskId);
      
      if (shared) {
        toast({
          title: t('location.locationShared'),
          description: t('location.exactLocationShared')
        });
      } else {
        toast({
          title: approved ? t('location.approved') : t('location.declined'),
          description: approved 
            ? t('location.youApproved') 
            : t('location.youDeclined')
        });
      }
    } catch (error) {
      console.error("Fehler bei der Standortantwort:", error);
      toast({
        title: t('errors.genericError'),
        description: t('location.requestError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'HH:mm', { locale: de });
  };
  
  // Rendere Nachrichten basierend auf ihrem Typ
  const renderMessageContent = () => {
    switch (message.type) {
      case "location_request":
        return (
          <div className="bg-yellow-50 rounded-lg p-3 my-2 mx-12 text-center">
            <p className="text-sm text-yellow-700">
              {isOwnMessage 
                ? t('location.youHave', { action: t('location.requestSent').toLowerCase() }) 
                : t('location.sharingRequest')}
            </p>
            
            {!isOwnMessage && (
              <div className="flex justify-center space-x-2 mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-green-50 hover:bg-green-100 text-green-600"
                  onClick={() => handleRespondToLocation(true)}
                  disabled={loading}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('location.approve')}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-red-50 hover:bg-red-100 text-red-600"
                  onClick={() => handleRespondToLocation(false)}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('location.decline')}
                </Button>
              </div>
            )}
          </div>
        );
        
      case "location_response":
        return (
          <div className={`bg-gray-50 rounded-lg p-3 my-2 mx-12 text-center`}>
            <p className="text-sm text-gray-700">
              {isOwnMessage 
                ? message.approved 
                    ? t('location.youApproved')
                    : t('location.youDeclined') 
                : message.approved
                    ? t('location.otherApproved')
                    : t('location.otherDeclined')}
            </p>
          </div>
        );
        
      case "location_shared":
        return (
          <div className="bg-green-50 rounded-lg p-3 my-2 text-center">
            <p className="text-sm text-green-700 font-medium mb-2">
              🎉 {t('location.exactLocationShared')}
            </p>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3 bg-white">
                <p className="font-medium text-gray-800">{message.location.address}</p>
                <div className="mt-2">
                  <a 
                    href={`https://maps.google.com/?q=${message.location.coordinates.lat},${message.location.coordinates.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    {t('location.openInMaps')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        // Normale Textnachricht
        return (
          <div className={`${
            isSystemMessage
              ? 'bg-gray-100 mx-12 text-center'
              : isOwnMessage
                ? 'bg-indigo-100 ml-12'
                : 'bg-gray-100 mr-12'
          } rounded-lg p-3 my-2`}>
            <p className="text-gray-800">{message.content}</p>
            <p className="text-xs text-gray-500 text-right mt-1">
              {formatTimestamp(message.timestamp)}
            </p>
          </div>
        );
    }
  };
  
  return renderMessageContent();
}