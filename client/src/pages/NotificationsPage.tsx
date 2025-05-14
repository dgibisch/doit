import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserNotifications, markNotificationAsRead, createNotification, NotificationTypes } from '@/lib/firebase';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  // Typedefinition zur Vermeidung von Namenskonflikten
  type DoItNotification = AppNotification;
  
  // Stelle sicher, dass die Benachrichtigungen typensicher sind
  const transformNotification = (notification: any): DoItNotification => {
    return {
      id: notification.id || '',
      type: notification.type || '',
      data: notification.data || {},
      read: notification.read === true,
      acted: notification.acted === true,
      createdAt: notification.createdAt || null,
      priority: notification.priority || 'normal',
      userId: notification.userId || ''
    };
  };
  
  const [notifications, setNotifications] = useState<DoItNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Benachrichtigungen laden
  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      if (!user) return;

      try {
        setLoading(true);
        console.log(`🔍 Lade Benachrichtigungen für Benutzer ${user.uid}...`);
        
        const fetchedNotifications = await getUserNotifications(user.uid);
        
        if (isMounted) {
          console.log(`✅ ${fetchedNotifications.length} Benachrichtigungen geladen`);
          // Konvertiere alle Benachrichtigungen in das korrekte Format
          setNotifications(fetchedNotifications.map(transformNotification));
          
          // Als Nebeneffekt: Prüfe, ob der Zähler für ungelesene Benachrichtigungen aktuell ist
          const typedNotifications = fetchedNotifications.map(transformNotification);
          const unreadCount = typedNotifications.filter(n => !n.read).length;
          console.log(`ℹ️ Gefundene ungelesene Benachrichtigungen: ${unreadCount}`);
          
          // Markiere alle als gelesen, wenn die unread-Tab nicht aktiv ist
          if (activeTab !== "unread" && unreadCount > 0) {
            console.log("Markiere alle Benachrichtigungen automatisch als gelesen...");
            
            // Verarbeite jede ungelesene Benachrichtigung sequentiell
            for (const notif of typedNotifications.filter(n => !n.read)) {
              try {
                await markNotificationAsRead(notif.id, user.uid);
                console.log(`✅ Benachrichtigung ${notif.id} automatisch als gelesen markiert`);
              } catch (error) {
                console.error(`❌ Fehler beim automatischen Markieren von ${notif.id}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ Fehler beim Laden der Benachrichtigungen:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNotifications();
    
    // Regelmäßige Aktualisierung alle 30 Sekunden
    const refreshInterval = setInterval(fetchNotifications, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [user]);

  // Filterung nach Typ
  const filteredNotifications = activeTab === "all"
    ? notifications
    : notifications.filter(notif => {
        if (activeTab === "action_required") {
          return notif.data?.requiresAction && !notif.acted;
        }
        if (activeTab === "unread") {
          return !notif.read;
        }
        return true;
      });

  // Benachrichtigung als gelesen markieren
  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      console.log(`Markiere Benachrichtigung ${notificationId} als gelesen`);
      const updated = await markNotificationAsRead(notificationId, user.uid);
      
      if (updated) {
        console.log(`✅ Benachrichtigung ${notificationId} erfolgreich als gelesen markiert`);
        // Lokales State-Update, um UI sofort zu aktualisieren
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId
              ? { ...notif, read: true }
              : notif
          )
        );
        
        // Zusätzliche Verzögerung, um sicherzustellen, dass Firestore-Änderungen wirksam werden
        setTimeout(async () => {
          try {
            const refreshedNotifications = await getUserNotifications(user.uid);
            setNotifications(refreshedNotifications.map(transformNotification));
            console.log(`🔄 Benachrichtigungen nach Markierung aktualisiert`);
          } catch (refreshError) {
            console.error("Fehler beim Aktualisieren der Benachrichtigungen:", refreshError);
          }
        }, 1000);
      }
    } catch (error) {
      console.error(`❌ Fehler beim Markieren der Benachrichtigung ${notificationId}:`, error);
    }
  };

  // Funktion zum Erstellen einer Test-Benachrichtigung
  const createTestNotification = async () => {
    if (!user) return;
    
    try {
      // Erstelle eine Test-Benachrichtigung vom Typ NEW_MESSAGE (funktioniert ohne komplexe Daten)
      const notificationData: Record<string, any> = {
        senderId: user.uid,
        senderName: user.displayName || 'TestUser',
        taskId: 'test-task-id',
        taskTitle: 'Test-Aufgabe',
        message: 'Dies ist eine Test-Benachrichtigung',
        chatId: 'test-chat-id',
        requiresAction: false
      };
      
      // Erstelle eine feste Test-Benachrichtigung (garantiert funktionierend)
      await createNotification(user.uid, NotificationTypes.NEW_MESSAGE, notificationData);
      
      // Bestätigungsmeldung im Console-Log
      console.log("✅ Test-Benachrichtigung wurde erstellt!");
      
      // Aktualisiere die Liste nach dem Erstellen (mit kurzer Verzögerung für Firestore)
      setTimeout(async () => {
        const fetchedNotifications = await getUserNotifications(user.uid);
        setNotifications(fetchedNotifications.map(transformNotification));
        console.log(`✅ ${fetchedNotifications.length} Benachrichtigungen geladen`);
      }, 500);
    } catch (error) {
      console.error("❌ Fehler beim Erstellen der Test-Benachrichtigung:", error);
      alert("Es gab ein Problem beim Erstellen der Test-Benachrichtigung. Bitte prüfen Sie die Konsole für Details.");
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
        
        {/* Nur im Entwicklungsmodus anzeigen */}
        {import.meta.env.DEV && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={createTestNotification}
            className="ml-auto"
          >
            Test-Benachrichtigung
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="all">
            {t('notifications.all')}
          </TabsTrigger>
          <TabsTrigger value="action_required">
            {t('notifications.actionRequired')}
          </TabsTrigger>
          <TabsTrigger value="unread">
            {t('notifications.unread')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 text-center shadow-sm">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('notifications.empty')}</p>
        </div>
      )}
    </div>
  );
}