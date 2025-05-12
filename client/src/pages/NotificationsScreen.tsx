import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bell, CheckCircle2, AlertCircle, Clock, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

// Typen für Benachrichtigungen
type NotificationType = 'application' | 'accepted' | 'message' | 'reminder';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  relatedUserId?: string;
  relatedUserName?: string;
  relatedUserPhoto?: string;
  relatedItemId?: string;
}

const NotificationsScreen = () => {
  // Beispiel-Daten für Benachrichtigungen
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'application',
      title: 'Neue Bewerbung',
      description: 'Maria hat sich auf deine Aufgabe "Babysitter für Samstag Abend" beworben',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 Minuten vorher
      read: false,
      relatedUserId: 'user123',
      relatedUserName: 'Maria Schmidt',
      relatedUserPhoto: 'https://ui-avatars.com/api/?name=Maria+Schmidt',
      relatedItemId: 'task123'
    },
    {
      id: '2',
      type: 'accepted',
      title: 'Bewerbung angenommen',
      description: 'Thomas hat deine Bewerbung für "Umzugshilfe am Wochenende" angenommen',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 Stunden vorher
      read: true,
      relatedUserId: 'user456',
      relatedUserName: 'Thomas Müller',
      relatedUserPhoto: 'https://ui-avatars.com/api/?name=Thomas+Müller',
      relatedItemId: 'task456'
    },
    {
      id: '3',
      type: 'message',
      title: 'Neue Nachricht',
      description: 'Du hast eine neue Nachricht von Anna zu "Gartenarbeit"',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 Stunden vorher
      read: false,
      relatedUserId: 'user789',
      relatedUserName: 'Anna Weber',
      relatedUserPhoto: 'https://ui-avatars.com/api/?name=Anna+Weber',
      relatedItemId: 'chat123'
    },
    {
      id: '4',
      type: 'reminder',
      title: 'Aufgabe morgen fällig',
      description: 'Deine Aufgabe "Einkaufen für Nachbarn" ist morgen fällig',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 Stunden vorher
      read: false,
      relatedItemId: 'task789'
    }
  ]);

  // Anzahl der ungelesenen Nachrichten
  const unreadCount = notifications.filter(n => !n.read).length;

  // Funktion, um eine Benachrichtigung als gelesen zu markieren
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  };

  // Icon für Benachrichtigungstyp
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'application':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'accepted':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'reminder':
        return <Clock className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // Formatierte Zeit
  const getFormattedTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: de });
  };

  return (
    <div className="container max-w-md mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
        <Badge variant="outline" className="ml-2">
          {unreadCount} ungelesen
        </Badge>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Keine Benachrichtigungen vorhanden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`p-4 rounded-lg border ${notification.read ? 'bg-white' : 'bg-blue-50'} transition-colors duration-200`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{notification.title}</h3>
                    <span className="text-xs text-gray-500">{getFormattedTime(notification.timestamp)}</span>
                  </div>
                  
                  <p className="text-sm text-gray-700 mt-1">{notification.description}</p>
                  
                  {notification.relatedUserId && (
                    <div className="flex items-center mt-2">
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={notification.relatedUserPhoto} alt={notification.relatedUserName} />
                        <AvatarFallback>{notification.relatedUserName?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-600">{notification.relatedUserName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen;