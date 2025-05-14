import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { markNotificationAsActed, NotificationTypes } from '@/lib/firebase';
import {
  Bell,
  MessageSquare,
  CheckCircle2,
  Star,
  AlertCircle,
  MapPin
} from 'lucide-react';

interface NotificationCardProps {
  notification: AppNotification;
  onMarkAsRead: (id: string) => void;
}

export function NotificationCard({ notification, onMarkAsRead }: NotificationCardProps) {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Benachrichtigung als gelesen markieren und zur entsprechenden Seite navigieren
  const handleClick = () => {
    console.log("Notification clicked:", notification);
    console.log("Notification type:", notification.type);
    console.log("Notification data:", notification.data);
    
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    
    // Navigiere zur entsprechenden Seite basierend auf Benachrichtigungstyp
    switch (notification.type) {
      case NotificationTypes.NEW_MESSAGE:
        if (notification.data?.chatId) {
          console.log("Navigating to chat:", notification.data.chatId);
          setLocation(`/chats/${notification.data.chatId}`);
        }
        break;
      case NotificationTypes.TASK_MATCHED:
        if (notification.data?.chatId) {
          console.log("Navigating to chat:", notification.data.chatId);
          setLocation(`/chats/${notification.data.chatId}`);
        } else if (notification.data?.taskId) {
          console.log("Navigating to task:", notification.data.taskId);
          
          // Korrekte URL-Struktur basierend auf der aktuellen App-Implementierung
          const currentPath = window.location.pathname;
          let correctPath = '';
          
          if (currentPath.includes('/tasks/')) {
            correctPath = `/tasks/${notification.data.taskId}`;
          } else {
            // Standard ist /task/ basierend auf den Logs
            correctPath = `/task/${notification.data.taskId}`;
          }
          
          console.log(`Korrigierter Navigationspfad: ${correctPath}`);
          setLocation(correctPath);
        }
        break;
      case NotificationTypes.APPLICATION_RECEIVED:
        if (notification.data?.taskId) {
          console.log("Navigating to task applications:", notification.data.taskId);
          // Für APPLICATION_RECEIVED verwenden wir eine spezielle URL mit Parameter
          const taskId = notification.data.taskId;
          
          // Debug-Ausgabe für die Navigation
          console.log(`Navigation zu: /task/${taskId}?tab=applications`);
          
          // Korrekte URL-Struktur basierend auf der aktuellen App-Implementierung
          // Prüfen, ob die URL bereits "task" oder "tasks" enthält
          const currentPath = window.location.pathname;
          let correctPath = '';
          
          if (currentPath.includes('/tasks/')) {
            correctPath = `/tasks/${taskId}?tab=applications`;
          } else {
            // Standard ist /task/ basierend auf den Logs
            correctPath = `/task/${taskId}?tab=applications`;
          }
          
          console.log(`Korrigierter Navigationspfad: ${correctPath}`);
          
          // Wir verwenden eine direkte URL-Änderung, um sicherzustellen, dass die
          // Parameter korrekt in die URL aufgenommen werden
          window.location.href = correctPath;
          
          // Wichtig: Früh zurückkehren, damit keine weitere Navigation stattfindet
          return;
        } else {
          console.warn("No taskId found in APPLICATION_RECEIVED notification");
        }
        break;
      case NotificationTypes.TASK_COMPLETED:
      case NotificationTypes.REVIEW_REQUIRED:
        if (notification.data?.taskId) {
          console.log("Navigating to task for review:", notification.data.taskId);
          // Korrekte URL-Struktur für Navigation zur Aufgabe
          const currentPath = window.location.pathname;
          const taskPath = currentPath.includes('/tasks/') 
            ? `/tasks/${notification.data.taskId}` 
            : `/task/${notification.data.taskId}`;
          setLocation(taskPath);
        }
        break;
      case NotificationTypes.NEW_TASK_NEARBY:
        if (notification.data?.taskId) {
          console.log("Navigating to nearby task:", notification.data.taskId);
          // Korrekte URL-Struktur für Navigation zur Aufgabe
          const currentPath = window.location.pathname;
          const taskPath = currentPath.includes('/tasks/') 
            ? `/tasks/${notification.data.taskId}` 
            : `/task/${notification.data.taskId}`;
          setLocation(taskPath);
        }
        break;
      case NotificationTypes.REVIEW_RECEIVED:
        if (notification.data?.taskId) {
          console.log("Navigating to task with review:", notification.data.taskId);
          // Korrekte URL-Struktur für Navigation zur Aufgabe
          const currentPath = window.location.pathname;
          const taskPath = currentPath.includes('/tasks/') 
            ? `/tasks/${notification.data.taskId}` 
            : `/task/${notification.data.taskId}`;
          setLocation(taskPath);
        }
        break;
      default:
        console.warn("Unknown notification type:", notification.type);
        // Fallback für unbekannte Typen - versuche, zur Aufgabe zu navigieren, wenn eine vorhanden ist
        if (notification.data?.taskId) {
          console.log("Fallback navigation to task:", notification.data.taskId);
          // Auch hier die korrekte URL-Struktur verwenden
          const currentPath = window.location.pathname;
          const taskPath = currentPath.includes('/tasks/') 
            ? `/tasks/${notification.data.taskId}` 
            : `/task/${notification.data.taskId}`;
          setLocation(taskPath);
        }
    }
  };

  // Icon basierend auf Benachrichtigungstyp
  const getIcon = () => {
    switch (notification.type) {
      case NotificationTypes.NEW_MESSAGE:
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case NotificationTypes.TASK_MATCHED:
      case NotificationTypes.TASK_COMPLETED:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case NotificationTypes.REVIEW_REQUIRED:
      case NotificationTypes.REVIEW_REMINDER:
        return <Star className="h-5 w-5 text-yellow-500" />;
      case NotificationTypes.NEW_TASK_NEARBY:
        return <MapPin className="h-5 w-5 text-indigo-500" />;
      case NotificationTypes.APPLICATION_RECEIVED:
        return <AlertCircle className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // Titel basierend auf Benachrichtigungstyp
  const getTitle = () => {
    switch (notification.type) {
      case NotificationTypes.NEW_MESSAGE:
        return t('notifications.newMessage');
      case NotificationTypes.TASK_MATCHED:
        return t('notifications.taskMatched');
      case NotificationTypes.TASK_COMPLETED:
        return t('notifications.taskCompleted');
      case NotificationTypes.REVIEW_REQUIRED:
        return t('notifications.reviewRequired');
      case NotificationTypes.REVIEW_REMINDER:
        return t('notifications.reviewReminder');
      case NotificationTypes.NEW_TASK_NEARBY:
        return t('notifications.newTaskNearby');
      case NotificationTypes.APPLICATION_RECEIVED:
        return t('notifications.applicationReceived');
      case NotificationTypes.REVIEW_RECEIVED:
        return t('notifications.reviewReceived');
      default:
        return t('notifications.newNotification');
    }
  };

  // Zeitpunkt formatieren
  const getTimeAgo = () => {
    if (notification.createdAt?.seconds) {
      const date = new Date(notification.createdAt.seconds * 1000);
      return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }
    return '';
  };

  // Aktion für Benachrichtigungen, die eine Aktion erfordern
  const getAction = () => {
    if ((notification.type === NotificationTypes.REVIEW_REQUIRED || 
         notification.type === NotificationTypes.REVIEW_REMINDER) && 
        !notification.acted) {
      return (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Verhindert das Auslösen des Klick-Events für die gesamte Karte

            // Navigiere zur Aufgabenseite mit geöffnetem Bewertungsdialog
            if (notification.data?.taskId) {
              // Korrekte URL-Struktur für die Navigation verwenden
              const currentPath = window.location.pathname;
              const taskPath = currentPath.includes('/tasks/') 
                ? `/tasks/${notification.data.taskId}?showReview=true` 
                : `/task/${notification.data.taskId}?showReview=true`;
              setLocation(taskPath);
            }

            // Markiere die Benachrichtigung als bearbeitet
            markNotificationAsActed(notification.id);
          }}
        >
          {t('notifications.leaveReview')}
        </Button>
      );
    }

    if (notification.type === NotificationTypes.NEW_MESSAGE) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            if (notification.data?.chatId) {
              setLocation(`/chats/${notification.data.chatId}`);
            }
          }}
        >
          {t('notifications.viewMessage')}
        </Button>
      );
    }

    return null;
  };

  const getPriorityClass = () => {
    return notification.priority === 'high' 
      ? 'border-l-4 border-yellow-500' 
      : '';
  };

  return (
    <div
      className={`p-4 rounded-lg shadow-sm cursor-pointer ${
        notification.read ? 'bg-white' : 'bg-blue-50'
      } ${getPriorityClass()}`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">{getIcon()}</div>
        <div className="flex-1">
          <h3 className="font-semibold">{getTitle()}</h3>
          {notification.data?.taskTitle && (
            <p className="text-sm text-gray-600 my-1">
              {notification.data.taskTitle}
            </p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">{getTimeAgo()}</span>
            {getAction()}
          </div>
        </div>
      </div>
    </div>
  );
}