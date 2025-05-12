import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@/hooks/use-navigation';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { useChat, useUserChats } from '@/hooks/use-chat';
import { type Chat, type ChatMessage, chatService } from '@/lib/chat-service';
import { uploadChatImage } from '@/lib/firebase';
import { useFullscreenMode } from '@/hooks/useFullscreenMode';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowLeft, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

/**
 * Message status badge component
 */
const MessageStatus = ({ status }: { status: ChatMessage['status'] }) => {
  const { t } = useTranslation();
  
  if (status === 'sending') {
    return (
      <span className="text-gray-400 text-xs ml-1 inline-flex items-center">
        <svg className="animate-spin -ml-1 mr-1 h-2 w-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {t('chat.sending')}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="text-red-500 text-xs ml-1">
        {t('errors.messageSendFailed')}
      </span>
    );
  }
  return null;
};

/**
 * ChatList component displays a list of the user's chats
 */
const ChatList = ({ onChatSelect }: { onChatSelect: (chatId: string) => void }) => {
  const { t } = useTranslation();
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
          {isIndexError 
            ? t('errors.firebaseIndexRequired') 
            : t('errors.chatLoadError')}
        </AlertTitle>
        <AlertDescription className="space-y-2">
          {isIndexError ? (
            <>
              <p className="text-amber-700">{t('errors.firebaseIndexRequiredDesc')}</p>
              <ol className="list-decimal ml-5 text-amber-700">
                <li>{t('errors.goToFirebaseConsole')}</li>
                <li>{t('errors.openLinkFromError')}</li>
                <li>{t('errors.createRequiredIndex')}</li>
              </ol>
              <p className="text-xs mt-2 text-amber-600">{t('errors.errorMessage')}: {error.message}</p>
            </>
          ) : (
            <p>{error.message}. {t('errors.tryAgainLaterOrContact')}</p>
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
        <p className="font-medium">{t('chat.noChatsYet')}</p>
        <p className="mt-1 text-sm max-w-xs">{t('chat.applyOrCreateToChat')}</p>
        <p className="mt-3 text-sm">{t('chat.createTestChat')}</p>
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
              <Avatar className="h-12 w-12">
                <AvatarImage src={chat.participantAvatars?.[otherParticipantId]} />
                <AvatarFallback className="bg-indigo-100 text-indigo-800 font-medium">
                  {chat.participantNames?.[otherParticipantId]?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
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
 * ChatMessages component displays the messages in a chat
 */
const ChatMessages = ({ chatId, onBack }: { chatId: string, onBack: () => void }) => {
  const { user } = useAuth();
  const { chat, messages, loading, error, sending, sendMessage } = useChat(chatId);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { goBack, navigateToProfile, navigateToTask } = useNavigation();
  const { isFullscreen, enableFullscreen, disableFullscreen } = useFullscreenMode();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Aktiviere Vollbildmodus beim Laden
  useEffect(() => {
    enableFullscreen();
    
    // Deaktiviere Vollbildmodus beim Verlassen
    return () => {
      disableFullscreen();
    };
  }, [enableFullscreen, disableFullscreen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Keyboard-aware behavior: Reagiert auf Tastatureingaben (ähnlich wie bei CommentList)
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (inputRef.current) {
        // Berechne die Differenz zwischen sichtbarer Viewport-Höhe und Fenster-Höhe
        // Dies gibt die Höhe der virtuellen Tastatur
        if (window.visualViewport) {
          const keyboardHeight = window.innerHeight - window.visualViewport.height;
          
          // Passe die Position des Eingabefelds an, wenn die Tastatur sichtbar ist
          if (keyboardHeight > 100) { // Schwellenwert, um zu erkennen, dass die Tastatur offen ist
            const formElement = document.querySelector('.chat-input-container');
            if (formElement) {
              // Transformiere das Element statt bottom zu verändern (stabiler)
              (formElement as HTMLElement).style.transform = `translateY(-${keyboardHeight}px)`;
            }
            
            // Scrolle zum Ende der Nachrichten, wenn Tastatur geöffnet wird
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } else {
            // Zurück zur normalen Position
            const formElement = document.querySelector('.chat-input-container');
            if (formElement) {
              (formElement as HTMLElement).style.transform = 'translateY(0)';
            }
          }
        }
      }
    };

    // Füge CSS für verbesserte Anpassung hinzu
    const style = document.createElement('style');
    style.id = 'chat-keyboard-aware-styles';
    style.innerHTML = `
      /* Eingabefeld-Stil und Verhalten */
      .chat-input-container {
        transition: transform 0.15s ease-out;
        will-change: transform;
        position: fixed !important; 
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        background-color: white !important;
        z-index: 9999 !important;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.05) !important;
      }
      
      /* Stelle sicher, dass alle Eingabeelemente im Chatbereich stabil sind */
      .chat-input-container * {
        transform: none;
      }
      
      /* Stelle sicher, dass das Scroll-Padding korrekt ist */
      .fullscreen-chat .overflow-y-auto {
        scroll-padding-bottom: 80px;
        padding-bottom: 80px !important;
      }
      
      /* Extra Anpassungen für iOS und mobile */
      @media (max-width: 768px) {
        .chat-input-container {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          box-shadow: 0 -1px 3px rgba(0,0,0,0.1) !important;
        }
      }
      
      /* Spezifische iOS-Anpassungen */
      @supports (-webkit-touch-callout: none) {
        /* Erlaubt Scrollen innerhalb des Chatbereichs */
        .fullscreen-chat .overflow-y-auto {
          -webkit-overflow-scrolling: touch;
        }
        
        /* Weitere iOS-spezifische Fixes */
        .chat-input-container {
          /* Verbessert die Positionierung in iOS */
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
      }
    `;
    document.head.appendChild(style);
    
    // Event-Listener für Bildschirmgrößenänderungen (Tastatur öffnen/schließen)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      // Bei iOS auch die Scroll-Events berücksichtigen
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }
    
    // Zusätzlicher Event-Listener für Fokus auf das Eingabefeld
    const handleFocus = () => {
      // Kurze Verzögerung, damit die Tastatur Zeit hat sich zu öffnen
      setTimeout(() => {
        handleVisualViewportResize();
        // Zusätzlich scrolle zum Ende
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };
    
    if (inputRef.current) {
      inputRef.current.addEventListener('focus', handleFocus);
    }
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
      
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', handleFocus);
      }
      
      const styleElement = document.getElementById('chat-keyboard-aware-styles');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // Füge State für die ausgewählte Bilddatei hinzu
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Bild auswählen
  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  // Wenn eine Datei ausgewählt wird
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Prüfen, ob die Datei ein Bild ist
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Fehlerhafter Dateityp',
        description: 'Bitte wählen Sie eine Bilddatei aus.',
        variant: 'destructive',
      });
      return;
    }

    // Prüfen, ob die Datei zu groß ist (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Datei zu groß',
        description: 'Die maximale Dateigröße beträgt 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImage(file);
  };

  // Bild entfernen
  const handleRemoveImage = () => {
    setSelectedImage(null);
    // Input-Feld zurücksetzen
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Nachricht senden
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || sending || uploadingImage) return;

    try {
      // Wenn es ein Bild gibt, lade es zuerst hoch
      let imageUrl: string | undefined;
      
      if (selectedImage) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadChatImage(selectedImage, chatId);
          console.log('Image uploaded:', imageUrl);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast({
            title: 'Fehler beim Hochladen des Bildes',
            description: 'Das Bild konnte nicht hochgeladen werden. Bitte versuchen Sie es später erneut.',
            variant: 'destructive',
          });
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }
      
      // Sende die Nachricht mit oder ohne Bild
      await sendMessage(newMessage.trim(), imageUrl);
      
      // Zurücksetzen der Eingabe
      setNewMessage('');
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
      // Error is handled by the hook
    }
  };

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
    
    // Spezielle Behandlung für "not-found" Fehler (wenn der Chat nicht gefunden wurde)
    const isNotFoundError = error.message && error.message.includes('not-found');
    
    if (isNotFoundError) {
      // Statt Fehlermeldung trotzdem den UI darstellen
      // Der Code fällt durch zum nächsten Block, wo ein leeres Chat-Objekt erstellt wird
    } else {
      return (
        <Alert variant="destructive" className={`my-4 ${isIndexError ? 'bg-amber-50 border-amber-300' : ''}`}>
          <AlertCircle className={`h-4 w-4 ${isIndexError ? 'text-amber-600' : ''}`} />
          <AlertTitle className={isIndexError ? 'text-amber-800' : ''}>
            {isIndexError ? 'Hinweis: Firebase-Index erforderlich' : 'Fehler beim Laden des Chats'}
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
  }
  
  // Statt Fehlermeldung ein leeres Chat-Objekt anzeigen
  const chatData = chat || {
    id: chatId,
    taskId: '',
    taskTitle: 'Keine Aufgabe ausgewählt',
    participants: [],
    participantNames: {},
    participantAvatars: {},
    lastReadBy: {}
  };
  
  const otherUserId = chatData.participants.find(id => id !== user?.id) || '';
  const otherUserName = chatData.participantNames?.[otherUserId] || 'Neuer Chat';

  return (
    <div className="flex flex-col h-screen w-full mx-auto bg-gray-50 overflow-hidden fullscreen-chat">
      {/* Chat header with modern style - Fixed at top */}
      <div className="flex items-center p-3 border-b bg-white sticky top-0 z-40 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 rounded-full hover:bg-gray-100"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9 mr-3">
          <AvatarImage src={chatData.participantAvatars?.[otherUserId]} />
          <AvatarFallback className="bg-indigo-100 text-indigo-800 font-medium">
            {otherUserName.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{otherUserName}</p>
          <p className="text-xs text-gray-500 truncate">
            Aufgabe: {chatData.taskTitle}
          </p>
        </div>
        {chatData.taskId && chatData.taskId !== 'welcome-task' && (
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-full text-xs px-3 py-1 h-8 bg-white hover:bg-gray-50"
            onClick={() => navigateToTask(chatData.taskId)}
          >
            Aufgabe ansehen
          </Button>
        )}
      </div>

      {/* Messages container - Scrollable area that fills available space */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Keine Nachrichten vorhanden.</p>
            <p className="mt-2 text-sm">Senden Sie eine Nachricht, um das Gespräch zu beginnen.</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.senderId === user?.id;
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
            
            // Gruppierte Nachrichten für besseren visuellen Fluss
            const isFirstInGroup = !previousMessage || previousMessage.senderId !== message.senderId;
            const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId;

            // Format timestamp
            let messageTime = '';
            if (message.timestamp) {
              try {
                const date = typeof message.timestamp.toDate === 'function'
                  ? message.timestamp.toDate()
                  : new Date();
                messageTime = format(date, 'HH:mm');
              } catch (err) {
                console.error('Error formatting message timestamp:', err);
                messageTime = '';
              }
            }

            // Message bubble with padding at bottom for timestamp
            return (
              <div 
                key={message.id} 
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} 
                  ${!isLastInGroup ? 'mb-1' : 'mb-3'}`}
              >
                <div className={`max-w-[75%] ${
                    isOwnMessage 
                      ? 'bg-indigo-100 text-gray-800 rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl' 
                      : 'bg-gray-100 text-gray-800 rounded-tr-2xl rounded-br-2xl rounded-tl-2xl'
                  } ${isLastInGroup ? 'rounded-br-2xl' : 'rounded-br-md'} 
                  ${isFirstInGroup ? 'rounded-tr-2xl mt-1' : 'rounded-tr-md'}
                  ${isOwnMessage && isFirstInGroup ? 'rounded-tr-2xl' : ''}
                  ${!isOwnMessage && isFirstInGroup ? 'rounded-tl-2xl' : ''}
                  py-2 px-3 pb-4 shadow-sm`} // Added padding-bottom for timestamp
                >
                  {/* Bild anzeigen, wenn vorhanden - mit verbesserten Styles */}
                  {message.imageUrl && (
                    <div className="mb-2">
                      <img 
                        src={message.imageUrl} 
                        alt="Nachrichtenbild" 
                        className="rounded-2xl w-full max-h-[250px] object-contain bg-white"
                        onClick={() => window.open(message.imageUrl, '_blank')}
                        style={{ cursor: 'zoom-in' }}
                      />
                    </div>
                  )}
                  
                  {/* Nachrichtentext anzeigen, wenn vorhanden */}
                  {message.content && (
                    <p className="text-[15px] leading-[20px] whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  
                  {/* Timestamp unten rechts in der Bubble - besser positioniert */}
                  <div className="text-[10px] font-light text-gray-500 absolute bottom-1 right-2.5 flex items-center space-x-1">
                    <span>{messageTime}</span>
                    {isOwnMessage && <MessageStatus status={message.status} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {/* Invisible element for auto-scrolling */}
        <div ref={messagesEndRef} className="h-3" />
      </div>

      {/* Wir brauchen diesen separaten Bildvorschaucontainer nicht mehr, 
          da wir jetzt eine einheitliche Vorschau im Input-Container haben */}
      
      {/* Message input - Fixed at bottom with consistent design like comments */}
      <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 shadow-md z-50 chat-input-container"
           style={{ 
             boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
             width: '100%'
           }}>
        <form onSubmit={handleSendMessage} className="p-3">
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback className="bg-indigo-100 text-indigo-800 font-medium">
                {user?.name?.charAt(0) || user?.displayName?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            
            {/* Input wrapper mit Kamera und Senden-Button */}
            <div className="flex-1 flex items-center bg-gray-100 rounded-full pl-4 pr-2 border border-gray-200 focus-within:border-indigo-200 focus-within:ring-1 focus-within:ring-indigo-200">
              {/* Texteingabefeld ohne Border */}
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={selectedImage ? "Optionaler Bildtext..." : "Nachricht schreiben..."}
                className="flex-1 bg-transparent border-none py-2 text-[15px] focus:outline-none focus:ring-0"
                disabled={sending || uploadingImage}
              />
              
              {/* Kamera-Button */}
              <button
                type="button"
                onClick={handleImageSelect}
                className="text-gray-500 hover:text-indigo-500 mx-1 h-8 w-8 flex items-center justify-center"
                disabled={sending || uploadingImage}
              >
                <ImageIcon className="h-5 w-5" />
              </button>
                
              {/* Senden-Button */}
              <Button 
                type="submit" 
                size="icon" 
                disabled={(sending || uploadingImage) || (!newMessage.trim() && !selectedImage)} 
                className="rounded-full h-8 w-8 ml-1"
              >
                {(sending || uploadingImage) ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={sending || uploadingImage}
            />
          </div>
          
          {/* Image preview */}
          {selectedImage && (
            <div className="flex items-center mt-2 ml-10 mr-3 p-1.5 bg-gray-50 rounded-lg">
              <div className="flex-1 flex items-center">
                <span className="text-xs text-gray-600 truncate max-w-[250px] ml-1">{selectedImage.name}</span>
              </div>
              <Button 
                type="button" 
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                className="ml-2 text-gray-500 hover:text-red-500 h-6 w-6 p-0 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

/**
 * Main ChatScreen component
 */
const ChatScreen = () => {
  const { goBack, navigateToProfile, navigateToTask } = useNavigation();
  // Holen wir uns den chatId aus der URL
  const pathname = window.location.pathname;
  const pathSegments = pathname.split('/');
  const lastSegment = pathSegments.pop();
  // Wenn der letzte Teil der URL "messages" oder "chat" ist, zeigen wir die Übersicht
  const chatIdFromUrl = (lastSegment === 'messages' || lastSegment === 'chat') ? null : lastSegment;
  const [activeChat, setActiveChat] = useState<string | null>(chatIdFromUrl || null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreatingTestChat, setIsCreatingTestChat] = useState(false);

  const handleBack = () => {
    setActiveChat(null);
  };

  // Funktion zum Erstellen eines Testchats
  const handleCreateTestChat = async () => {
    if (!user?.id || isCreatingTestChat) return;
    
    setIsCreatingTestChat(true);
    try {
      const chatId = await chatService.createTestChat(user.id);
      setActiveChat(chatId);
      toast({
        title: 'Testchat erstellt',
        description: 'Ein neuer Chat mit unserem Support-Team wurde erstellt',
      });
    } catch (error) {
      console.error('Fehler beim Erstellen des Testchats:', error);
      toast({
        title: 'Fehler',
        description: 'Der Testchat konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTestChat(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 pb-20 h-full bg-gray-50 min-h-[calc(100vh-80px)]">
      {activeChat ? (
        <ChatMessages chatId={activeChat} onBack={handleBack} />
      ) : (
        <div className="flex flex-col h-full max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-gray-50 pt-2 pb-3">
            <h1 className="text-2xl font-bold">Nachrichten</h1>
            <Button 
              variant="outline" 
              size="sm"
              className="rounded-full text-sm px-4 bg-white hover:bg-gray-50 border-gray-200"
              onClick={handleCreateTestChat}
              disabled={isCreatingTestChat}
            >
              {isCreatingTestChat ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Erstelle Chat...
                </>
              ) : (
                <>Testchat erstellen</>
              )}
            </Button>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-1">
            <ChatList onChatSelect={setActiveChat} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatScreen;