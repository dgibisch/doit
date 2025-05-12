import React, { useState, lazy, Suspense, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useBottomNavContext } from '@/context/BottomNavContext';
import { useUserChats } from '@/hooks/use-chat';
import { useFullscreenMode } from '@/hooks/useFullscreenMode';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from '@/components/ui/alert';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

// Lazy load the ModernChatView component
const ModernChatView = lazy(() => import('@/components/chat/ModernChatView'));

/**
 * ChatList component displays a list of the user's chats
 */
const ChatList = ({ onChatSelect }: { onChatSelect: (chatId: string) => void }) => {
  const { user } = useAuth();
  const { chats, loading, error } = useUserChats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    // Spezielle Behandlung für Firestore-Index-Fehler
    const isIndexError = error.message && (
      error.message.includes('index') || 
      error.message.includes('requires an index') || 
      error.message.includes('failed-precondition')
    );
    
    return (
      <Alert variant="destructive" className={`my-4 ${isIndexError ? 'bg-amber-50 border-amber-300' : ''}`}>
        <AlertCircle className={`h-4 w-4 ${isIndexError ? 'text-amber-600' : ''}`} />
        <AlertTitle className={isIndexError ? 'text-amber-800' : ''}>
          {isIndexError ? 'Hinweis: Firebase-Index erforderlich' : 'Fehler beim Laden der Chats'}
        </AlertTitle>
        <AlertDescription className="space-y-2">
          {isIndexError ? (
            <>
              <p className="text-amber-700">Firebase benötigt einen Index für diese Abfrage. Als Administrator müssen Sie:</p>
              <ol className="list-decimal ml-5 text-amber-700">
                <li>Zum Firebase Console gehen</li>
                <li>Den angegebenen Link aus der Fehlermeldung öffnen</li>
                <li>Den benötigten Index erstellen</li>
              </ol>
              <p className="text-xs mt-2 text-amber-600">Fehlermeldung: {error.message}</p>
            </>
          ) : (
            <p>{error.message}. Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 flex flex-col items-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <p className="font-medium">Keine Gespräche vorhanden</p>
        <p className="mt-1 text-sm max-w-xs">Bewerben Sie sich auf Aufgaben oder erstellen Sie eigene, um zu chatten.</p>
        <p className="mt-3 text-sm">Oder erstellen Sie einen Testchat mit dem Support-Team über den Button oben rechts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-3xl mx-auto">
      {chats.map(chat => {
        // Find the other participant's ID
        const otherParticipantId = chat.participants.find(id => id !== user?.id) || '';
        
        // Format last message timestamp
        let lastMessageTime = '';
        if (chat.lastMessageTimestamp) {
          try {
            const date = typeof chat.lastMessageTimestamp.toDate === 'function'
              ? chat.lastMessageTimestamp.toDate()
              : new Date();
            lastMessageTime = format(date, 'dd.MM., HH:mm');
          } catch (err) {
            console.error('Error formatting timestamp:', err);
            lastMessageTime = '';
          }
        }
        
        // Check if there are unread messages
        const hasUnread = user?.id && chat.lastReadBy && chat.lastMessageTimestamp
          ? ((chat.lastReadBy[user.id] || new Timestamp(0, 0)).seconds < chat.lastMessageTimestamp.seconds)
          : false;
        
        return (
          <div 
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className="p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-indigo-100 flex-shrink-0">
                <Avatar className="h-full w-full">
                  <AvatarImage 
                    src={
                      // Versuche zuerst Base64-kodierte Bilder, dann URLs, dann generiere Avatar
                      chat.participantAvatarBase64?.[otherParticipantId] || 
                      chat.participantAvatarUrls?.[otherParticipantId] || 
                      chat.participantAvatars?.[otherParticipantId] || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.participantNames?.[otherParticipantId] || 'User')}&background=6366f1&color=fff`
                    }
                    alt={chat.participantNames?.[otherParticipantId] || 'Benutzer'}
                    className="h-full w-full object-cover"
                  />
                  <AvatarFallback>
                    {(chat.participantNames?.[otherParticipantId] || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="font-medium truncate text-gray-900">
                    {chat.participantNames?.[otherParticipantId] || 'Benutzer'}
                  </p>
                  <span className="text-xs text-gray-500 whitespace-nowrap pl-2">
                    {lastMessageTime}
                  </span>
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <p className={`text-sm truncate ${hasUnread ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                    {chat.lastMessage || 'Neue Konversation'}
                  </p>
                  {hasUnread && (
                    <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-indigo-500">
                      •
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-1">
                  Aufgabe: {chat.taskTitle}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * ChatMessages component displays the messages in a chat using the new ModernChatView
 */
const ChatMessages = ({ chatId, onBack }: { chatId: string, onBack: () => void }) => {
  const { isFullscreen, enableFullscreen, disableFullscreen } = useFullscreenMode();
  const { hideNav, showNav } = useBottomNavContext();
  
  // Aktiviere Vollbildmodus und verstecke Navigation beim Laden
  useEffect(() => {
    enableFullscreen();
    hideNav(); // Navigation ausblenden
    
    // Deaktiviere Vollbildmodus und zeige Navigation wieder an beim Verlassen
    return () => {
      disableFullscreen();
      showNav();
    };
  }, [enableFullscreen, disableFullscreen, hideNav, showNav]);

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ModernChatView chatId={chatId} onBack={onBack} />
    </Suspense>
  );
};

/**
 * Main ChatScreen component
 */
const NewChatScreen = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const params = useParams<{ chatId: string }>();
  const { hideNav, showNav } = useBottomNavContext();
  
  // Extrahiere die Chat-ID aus dem URL-Parameter, falls vorhanden
  useEffect(() => {
    if (params && params.chatId) {
      console.log("Chat-ID aus URL-Parameter gefunden:", params.chatId);
      setSelectedChatId(params.chatId);
    }
  }, [params]);
  
  // Navigation ausblenden, wenn ein Chat ausgewählt ist
  useEffect(() => {
    if (selectedChatId) {
      hideNav();
    } else {
      showNav();
    }
    
    // Beim Unmounten die Navigation wieder anzeigen
    return () => {
      showNav();
    };
  }, [selectedChatId, hideNav, showNav]);
  
  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    // URL aktualisieren, damit die Browserhistorie korrekt funktioniert
    setLocation(`/chat/${chatId}`);
  };
  
  const handleBackToList = () => {
    setSelectedChatId(null);
    showNav(); // Navigation wieder anzeigen
    // Zurück zur Nachrichten-Übersicht navigieren
    setLocation('/messages');
  };
  
  return (
    <main className="container py-4 max-w-5xl mx-auto h-screen">
      {!selectedChatId ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Nachrichten</h1>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="all">Alle Gespräche</TabsTrigger>
              <TabsTrigger value="unread">Ungelesen</TabsTrigger>
            </TabsList>
            
            <Separator className="my-2" />
            
            <TabsContent value="all" className="mt-4">
              <ChatList onChatSelect={handleChatSelect} />
            </TabsContent>
            
            <TabsContent value="unread" className="mt-4">
              <div className="text-center py-6 text-gray-500">
                <p>Ungelesene Nachrichten werden hier angezeigt.</p>
                <p className="text-sm mt-1">Aktuell keine ungelesenen Nachrichten.</p>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <ChatMessages chatId={selectedChatId} onBack={handleBackToList} />
      )}
    </main>
  );
};

export default NewChatScreen;