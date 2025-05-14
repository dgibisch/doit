import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/hooks/use-chat';
import { uploadChatImage, requestLocationSharing, respondToLocationRequest, isLocationSharedInChat } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useReview } from '@/context/ReviewContext';
import { type ChatMessage, type Chat } from '@/lib/chat-service';
import { reviewService } from '@/lib/review-service';
import ZoomableImage from '@/components/ui/zoomable-image';
import { useLocation } from 'wouter';
import { routes } from '@/routes';
import { useNavigation } from '@/hooks/use-navigation';
import { useTranslation } from 'react-i18next';
import LocationSharingButton from '@/components/chat/LocationSharingButton';
import LocationDisplay from '@/components/chat/LocationDisplay';
import { sendLocationMessage } from '@/lib/location-helper';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserAvatar from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertCircle, 
  ArrowLeft, 
  ImageIcon, 
  Send, 
  X,
  MapPin,
  MapPinned,
  CheckCheck, 
  Check, 
  UserCheck, 
  CheckCircle2, 
  CircleCheck, 
  Star, 
  User
} from 'lucide-react';
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Message status component showing sending, sent, delivered or read status
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
        <AlertCircle className="h-3 w-3 inline mr-1" />
        {t('errors.genericError')}
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="text-gray-400">
        <Check className="h-3 w-3 inline" />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="text-gray-400">
        <CheckCheck className="h-3 w-3 inline" />
      </span>
    );
  }
  if (status === 'read') {
    return (
      <span className="text-blue-500">
        <CheckCheck className="h-3 w-3 inline" />
      </span>
    );
  }
  return null;
};

/**
 * Einzelne Nachrichtenkomponente
 */
const ChatMessageItem = ({ 
  message, 
  isOwnMessage,
  chat,
  currentUserProfile,
  onProfileClick,
  onLocationResponse
}: { 
  message: ChatMessage; 
  isOwnMessage: boolean;
  chat?: Chat;
  currentUserProfile?: any;
  onProfileClick: (userId: string, event: React.MouseEvent) => void;
  onLocationResponse?: (approved: boolean) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { t } = useTranslation();
  
  // Format timestamp
  let messageTime = '';
  try {
    if (message.timestamp) {
      const date = typeof message.timestamp.toDate === 'function'
        ? message.timestamp.toDate()
        : new Date(message.timestamp as any);
      messageTime = format(date, 'HH:mm');
    }
  } catch (err) {
    console.error('Error formatting timestamp:', err);
  }
  
  // Zum Benutzerprofil navigieren über die übergebene Callback-Funktion
  const handleProfileClick = (userId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (userId) {
      onProfileClick(userId, event);
    }
  };

  // Standort-Freigabe-Nachricht
  if (message.type === 'location_request') {
    // Anfrage zur Standortfreigabe
    return (
      <div className="mb-4 flex justify-center">
        <div className="bg-yellow-50 rounded-lg p-3 my-2 mx-1 text-center shadow-sm border border-yellow-200 w-full max-w-[90%]">
          <div className="flex items-center justify-center mb-2 text-yellow-600">
            <MapPin className="h-5 w-5 mr-2" />
            <p className="text-sm font-medium">
              {message.senderId === user?.id 
                ? "Du hast eine Standortfreigabe angefragt" 
                : "Anfrage zur Standortfreigabe"}
            </p>
          </div>
          <p className="text-xs text-yellow-700 mb-3">
            {message.senderId === user?.id 
              ? "Warte auf die Bestätigung des anderen Nutzers" 
              : "Der andere Nutzer möchte den genauen Standort dieser Aufgabe sehen"}
          </p>
          
          {message.senderId !== user?.id && onLocationResponse && (
            <div className="flex justify-center space-x-2 mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                onClick={() => onLocationResponse(true)}
              >
                <Check className="h-4 w-4 mr-1" />
                Zustimmen
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                onClick={() => onLocationResponse(false)}
              >
                <X className="h-4 w-4 mr-1" />
                Ablehnen
              </Button>
            </div>
          )}
          <div className="text-[10px] mt-2 text-gray-500">
            {messageTime}
          </div>
        </div>
      </div>
    );
  }
  
  if (message.type === 'location_response') {
    // Antwort auf eine Standortfreigabe-Anfrage
    return (
      <div className="mb-4 flex justify-center">
        <div className={`
          rounded-lg p-3 my-2 mx-1 text-center shadow-sm border w-full max-w-[90%]
          ${message.approved 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
          }
        `}>
          <div className="flex items-center justify-center mb-1">
            {message.approved ? (
              <Check className="h-5 w-5 mr-2 text-green-600" />
            ) : (
              <X className="h-5 w-5 mr-2 text-red-600" />
            )}
            <p className={`text-sm font-medium ${message.approved ? 'text-green-700' : 'text-red-700'}`}>
              {message.senderId === user?.id 
                ? t('chat.youHave', {action: message.approved ? t('chat.accepted') : t('chat.declined')}) 
                : t('chat.otherUserHas', {
                    name: message.senderName || t('chat.otherUser'),
                    action: message.approved ? t('chat.accepted') : t('chat.declined')
                  })}
            </p>
          </div>
          <p className={`text-xs ${message.approved ? 'text-green-600' : 'text-red-600'}`}>
            {message.approved 
              ? t('location.locationSharedBoth') 
              : t('location.locationPrivacyNote')}
          </p>
          <div className="text-[10px] mt-2 text-gray-500">
            {messageTime}
          </div>
        </div>
      </div>
    );
  }
  
  if (message.type === 'location_shared') {
    // Standort wurde freigegeben - diese Nachricht erscheint für beide Parteien im Chat
    return (
      <div className="mb-4 flex justify-center">
        <div className="bg-blue-50 rounded-lg p-3 my-2 mx-1 text-center shadow-sm border border-blue-200 w-full max-w-[90%]">
          <div className="flex items-center justify-center mb-2 text-blue-600">
            <MapPinned className="h-5 w-5 mr-2" />
            <p className="text-sm font-medium">{t('chat.exactTaskLocation')}</p>
          </div>
          
          {message.location && (
            <div className="bg-white rounded-md p-2 mb-2 text-left border border-blue-100">
              <p className="text-sm font-medium text-gray-800">
                {message.location.address || t('chat.locationAddress')}
              </p>
              {message.location.coordinates && (
                <div className="text-xs text-gray-500 mt-1">
                  {message.location.coordinates.lat.toFixed(6)}, {message.location.coordinates.lng.toFixed(6)}
                </div>
              )}
            </div>
          )}
          
          <Button 
            size="sm" 
            variant="default" 
            className="bg-blue-600 hover:bg-blue-700 text-white w-full mt-1"
            onClick={() => {
              // Google Maps öffnen mit den Koordinaten
              if (message.location?.coordinates) {
                const coords = `${message.location.coordinates.lat},${message.location.coordinates.lng}`;
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords}`;
                
                // Neues Fenster/Tab öffnen
                window.open(mapsUrl, '_blank');
                
                // Als Backup auch in die Zwischenablage kopieren
                navigator.clipboard.writeText(coords)
                  .then(() => {
                    toast({
                      title: "Maps geöffnet",
                      description: "Koordinaten wurden auch in die Zwischenablage kopiert",
                    });
                  })
                  .catch(err => {
                    console.error("Fehler beim Kopieren:", err);
                  });
              }
            }}
          >
            <MapPin className="h-4 w-4 mr-1" />
            In Google Maps öffnen
          </Button>
          
          <div className="text-[10px] mt-2 text-gray-500">
            {messageTime}
          </div>
        </div>
      </div>
    );
  }
  
  // System message
  if (message.isSystemMessage) {
    return (
      <div className="mb-4 flex justify-center">
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-medium max-w-[90%] text-center">
          {message.content}
          <div className="text-[10px] mt-1 text-gray-500">
            {messageTime}
          </div>
        </div>
      </div>
    );
  }
  
  // Normal message
  return (
    <div 
      className={`mb-3 flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-start`}
    >
      {/* Avatar on the left side for incoming messages */}
      {!isOwnMessage ? (
        <div 
          onClick={(e) => handleProfileClick(message.senderId || '', e)}
          className="mr-2 mt-1 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          title={t('profile.showProfileOf', {name: message.senderName || t('common.user')})}
        >
          <UserAvatar 
            user={{
              uid: message.senderId || '',
              photoURL: message.senderAvatar || (chat?.participantAvatarUrls && message.senderId ? chat.participantAvatarUrls[message.senderId] : ''),
              avatarBase64: chat?.participantAvatarBase64 && message.senderId ? chat.participantAvatarBase64[message.senderId] : undefined,
              displayName: message.senderName || ''
            }}
            size={32}
            className="flex-shrink-0"
          />
        </div>
      ) : null}
      
      <div 
        className={`
          relative max-w-[75%] px-3 py-2 shadow-sm
          ${isOwnMessage 
            ? 'bg-indigo-500 text-white rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl' 
            : 'bg-white text-gray-800 rounded-tr-2xl rounded-br-2xl rounded-tl-2xl'
          }
        `}
      >
        {/* Display message content based on type */}
        {message.messageType === 'image' ? (
          // Bildnachricht (Base64 oder URL im content-Feld)
          <div className="mt-1 mb-4">
            <ZoomableImage 
              src={message.content} 
              alt="Bild zur Nachricht" 
              maxHeight={240}
              objectFit="contain"
              containerClassName="bg-transparent"
            />
          </div>
        ) : message.messageType === 'mixed' ? (
          // Gemischte Nachricht (Text + Bild)
          <>
            <p className="text-[15px] leading-[20px] whitespace-pre-wrap break-words mb-2">
              {message.content}
            </p>
            {/* Zeige entweder imageBase64 oder imageUrl für gemischte Nachrichten */}
            {message.imageBase64 ? (
              <div className="mt-1 mb-4">
                <ZoomableImage 
                  src={message.imageBase64} 
                  alt="Bild zur Nachricht" 
                  maxHeight={240}
                  objectFit="contain"
                  containerClassName="bg-transparent"
                />
              </div>
            ) : message.imageUrl && (
              <div className="mt-1 mb-4">
                <ZoomableImage 
                  src={message.imageUrl} 
                  alt="Bild zur Nachricht" 
                  maxHeight={240}
                  objectFit="contain"
                  containerClassName="bg-transparent"
                />
              </div>
            )}
          </>
        ) : (
          // Standard-Textnachricht oder Legacy-Nachricht ohne Typ
          <>
            {message.content && message.isHtml ? (
              <p 
                className="text-[15px] leading-[20px] whitespace-pre-wrap break-words mb-4"
                dangerouslySetInnerHTML={{ __html: message.content }}
              />
            ) : message.content && (
              <p className="text-[15px] leading-[20px] whitespace-pre-wrap break-words mb-4">
                {message.content}
              </p>
            )}
            
            {/* Legacy: Display message image if available and type is undefined */}
            {!message.messageType && message.imageUrl && (
              <div className="mt-1 mb-4">
                <ZoomableImage 
                  src={message.imageUrl} 
                  alt="Bild zur Nachricht" 
                  maxHeight={240}
                  objectFit="contain"
                  containerClassName="bg-transparent"
                />
              </div>
            )}
          </>
        )}
        
        {/* Timestamp unten rechts in der Bubble - besser positioniert */}
        <div className={`
          text-[10px] font-light absolute bottom-1 right-2.5 flex items-center space-x-1
          ${isOwnMessage ? 'text-white text-opacity-70' : 'text-gray-500'}
        `}>
          <span>{messageTime}</span>
          {isOwnMessage && <MessageStatus status={message.status} />}
        </div>
      </div>
      
      {/* Avatar on the right side for own messages */}
      {isOwnMessage && (
        <div 
          onClick={(e) => handleProfileClick(message.senderId || user?.id || '', e)}
          className="h-8 w-8 ml-2 mt-1 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          title={t('profile.viewProfile')}
        >
          <Avatar className="h-full w-full">
            <AvatarImage 
              src={
                // Try base64-encoded images first, then URLs, then generate avatar
                currentUserProfile?.avatarBase64 || 
                currentUserProfile?.avatarUrl || 
                currentUserProfile?.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile?.displayName || message.senderName || t('common.user'))}&background=6366f1&color=fff`
              }
              alt={(currentUserProfile?.displayName || message.senderName || t('common.user'))}
              className="h-full w-full object-cover"
            />
            <AvatarFallback>
              {(currentUserProfile?.displayName || message.senderName || t('common.user').charAt(0)).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};

/**
 * Moderner Chat-View mit fixiertem Eingabefeld und Keyboard-Unterstützung
 */
interface ModernChatViewProps {
  chatId: string;
  onBack: () => void;
}

const ModernChatView: React.FC<ModernChatViewProps> = ({ chatId, onBack }) => {
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();
  const { navigateToUserProfile } = useNavigation();
  const { 
    chat, 
    messages, 
    loading, 
    error, 
    sending, 
    sendMessage,
    selectApplicant,
    rejectApplicant,
    confirmSelection,
    markTaskCompleted
  } = useChat(chatId);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { openReviewModal } = useReview();
  
  // State for selected image
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for review status
  const [hasReviewed, setHasReviewed] = useState<boolean>(false);
  const [checkingReviewStatus, setCheckingReviewStatus] = useState<boolean>(false);
  
  // State for location sharing
  const [isLocationShared, setIsLocationShared] = useState<boolean>(false);
  const [checkingLocationStatus, setCheckingLocationStatus] = useState<boolean>(false);
  const [requestingLocation, setRequestingLocation] = useState<boolean>(false);
  const [respondingToLocation, setRespondingToLocation] = useState<boolean>(false);
  
  // Chat-Container Ref für Scroll-Position
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Automatisches Scrollen zu neuesten Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Check if location has already been shared
  useEffect(() => {
    let isMounted = true;
    
    const checkLocationSharedStatus = async () => {
      if (!chatId) return;
      
      try {
        setCheckingLocationStatus(true);
        const shared = await isLocationSharedInChat(chatId);
        if (isMounted) {
          setIsLocationShared(shared);
        }
      } catch (error) {
        console.error("Error checking location sharing status:", error);
      } finally {
        if (isMounted) {
          setCheckingLocationStatus(false);
        }
      }
    };
    
    // Nur beim ersten Rendern oder wenn sich chatId ändert ausführen
    if (!isLocationShared) {
      checkLocationSharedStatus();
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [chatId, isLocationShared]);
  
  // Check if the current user has already submitted a review
  useEffect(() => {
    const checkReviewStatus = async () => {
      if (!user?.id || !chat?.taskId) return;
      
      try {
        setCheckingReviewStatus(true);
        const hasUserReviewed = await reviewService.hasUserReviewedTask(chat.taskId, user.id);
        setHasReviewed(hasUserReviewed);
        
        // If the task is completed and no review has been submitted yet,
        // we add a manual trigger for the ReviewManager module
        if ((chat.isTaskCompleted || chat.isCompletedConfirmed) && !hasUserReviewed) {
          // Create or reference DOM element for the ReviewManager trigger
          const triggerElement = document.getElementById('review-manager-trigger') || document.createElement('div');
          triggerElement.id = 'review-manager-trigger';
          triggerElement.setAttribute('data-trigger', 'true');
          triggerElement.setAttribute('data-chat-id', chatId);
          
          // Only append if it's not already in the document
          if (!triggerElement.parentNode) {
            document.body.appendChild(triggerElement);
          }
        }
      } catch (error) {
        console.error("Error checking review status:", error);
      } finally {
        setCheckingReviewStatus(false);
      }
    };
    
    if (chat?.isCompletedConfirmed || chat?.isTaskCompleted) {
      checkReviewStatus();
    }
  }, [user?.id, chat?.taskId, chat?.isCompletedConfirmed, chat?.isTaskCompleted, chatId]);
  
  // Get review context for event listener
  const reviewContext = useReview();
  
  // Memoize callback with useCallback
  const handleReviewSubmitted = useCallback((taskId: string, reviewerId: string) => {
    // Check if current chat and user are affected
    if (taskId === chat?.taskId && reviewerId === user?.id) {
      setHasReviewed(true);
    }
  }, [chat?.taskId, user?.id]);
  
  // Listen for ReviewSubmitted events
  useEffect(() => {
    // Register event listener
    const unsubscribe = reviewContext.onReviewSubmitted(handleReviewSubmitted);
    
    // Cleanup on unmount
    return unsubscribe;
  }, [reviewContext, handleReviewSubmitted]);
  
  // Keyboard handling
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        
        // Anpassen der Eingabeposition wenn Tastatur offen ist
        if (keyboardHeight > 100) {
          const formElement = document.querySelector('.modern-chat-input');
          if (formElement && formElement instanceof HTMLElement) {
            formElement.style.transform = `translateY(-${keyboardHeight}px)`;
          }
          
          // Scroll to bottom
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        } else {
          const formElement = document.querySelector('.modern-chat-input');
          if (formElement && formElement instanceof HTMLElement) {
            formElement.style.transform = 'translateY(0)';
          }
        }
      }
    };
    
    // Event listener for keyboard
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }
    
    // Event listener for input field focus
    const handleFocus = () => {
      setTimeout(() => {
        handleVisualViewportResize();
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    };
    
    inputRef.current?.addEventListener('focus', handleFocus);
    
    // Cleanup
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
      
      inputRef.current?.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  // Select image
  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };
  
  // File change handler
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('errors.invalidFileType'),
        description: t('errors.pleaseSelectImageFile'),
        variant: 'destructive',
      });
      return;
    }
    
    // Check maximum file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('errors.fileTooLarge'),
        description: t('errors.maxFileSizeLimit'),
        variant: 'destructive',
      });
      return;
    }
    
    setSelectedImage(file);
  };
  
  // Remove image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    // Reset input field
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Request or directly share location (for task owner)
  const handleRequestLocation = useCallback(async () => {
    if (!user?.id || !chatId || !chat?.taskId) return;
    
    try {
      setRequestingLocation(true);
      
      // Use imported sendLocationMessage function
      const success = await sendLocationMessage(chatId, user.id, chat.taskId);
      
      if (success) {
        // Update state and show toast
        setIsLocationShared(true);
        toast({
          title: t('chat.locationShared'),
          description: t('chat.locationSharedNotice')
        });
      } else {
        throw new Error("Location could not be sent");
      }
    } catch (error) {
      console.error("Error with location request:", error);
      toast({
        title: t('common.error'),
        description: t('errors.locationSharingFailed'),
        variant: "destructive"
      });
    } finally {
      setRequestingLocation(false);
    }
  }, [chatId, user?.id, chat?.taskId, toast, t]);
  
  // Respond to location request
  const handleLocationResponse = useCallback(async (approved: boolean) => {
    if (!user?.id || !chatId || !chat?.taskId) return;
    
    try {
      setRespondingToLocation(true);
      const shared = await respondToLocationRequest(chatId, user.id, approved, chat.taskId);
      
      if (shared) {
        setIsLocationShared(true);
        toast({
          title: t('chat.locationShared'),
          description: t('chat.locationSharedForBoth')
        });
      } else {
        toast({
          title: approved ? t('chat.accepted') : t('chat.declined'),
          description: approved 
            ? t('chat.locationShareAccepted')
            : t('chat.locationShareDeclined')
        });
      }
    } catch (error) {
      console.error("Error with location response:", error);
      toast({
        title: t('common.error'),
        description: t('errors.responseNotSent'),
        variant: "destructive"
      });
    } finally {
      setRespondingToLocation(false);
    }
  }, [chatId, user?.id, chat?.taskId, toast, t]);
  
  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || sending || uploadingImage) return;
    
    try {
      // If an image is selected, upload it first
      let imageUrl: string | undefined;
      
      if (selectedImage) {
        setUploadingImage(true);
        try {
          // If it's just an image (no text), save it directly as an image message
          if (!newMessage.trim()) {
            // Use the new uploadChatImageBase64 function for pure image messages
            const { uploadChatImageBase64 } = await import('@/lib/firebase');
            if (!user?.id) throw new Error("User ID not found");
            
            await uploadChatImageBase64(selectedImage, chatId, user.id);
          } else {
            // For text + image, first convert the image to Base64 for mixed message
            const { compressAndConvertToBase64 } = await import('@/utils/imageUtils');
            imageUrl = await compressAndConvertToBase64(selectedImage, 0.3);
          }
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast({
            title: t('errors.imageUploadError'),
            description: t('chat.imageUploadFailed'),
            variant: 'destructive',
          });
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }
      
      // Send text if present - alone or with image
      if (newMessage.trim()) {
        // Use the sendMessage function from the useChat hook
        await sendMessage(newMessage.trim(), imageUrl);
      }
      
      // Reset input
      setNewMessage('');
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errors.chatLoadError')}</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
        
        <Button 
          onClick={onBack}
          className="mt-4"
          variant="outline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('chat.backToOverview')}
        </Button>
      </div>
    );
  }
  
  // Get data for other participants
  const otherParticipantId = chat?.participants.find(id => id !== user?.id) || '';
  
  // Helper function for application chat
  const isApplicationChat = chat?.isTaskApplicationChat || false;
  const isTaskCreator = chat?.taskCreatorId === user?.id;
  const isApplicant = chat?.applicantId === user?.id;
  const isSelected = chat?.isSelected || false;
  const isRejected = chat?.isRejected || false;
  const isConfirmedByApplicant = chat?.isConfirmedByApplicant || false;
  
  return (
    <div className="h-full flex flex-col bg-gray-50 modern-chat">
      {/* Chat-Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-4 py-2">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mr-2 -ml-2" 
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center">
            <div 
              className="mr-3 h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                if (otherParticipantId) navigateToUserProfile(otherParticipantId);
              }}
              title={t('profile.showProfileOf', {name: chat?.participantNames?.[otherParticipantId] || t('common.user')})}
            >
              <Avatar className="h-full w-full">
                <AvatarImage 
                  src={
                    // Try base64-encoded images first, then URLs, then generate avatar
                    chat?.participantAvatarBase64?.[otherParticipantId] || 
                    chat?.participantAvatarUrls?.[otherParticipantId] || 
                    chat?.participantAvatars?.[otherParticipantId] || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(chat?.participantNames?.[otherParticipantId] || t('common.user'))}&background=6366f1&color=fff`
                  }
                  alt={chat?.participantNames?.[otherParticipantId] || t('common.user')}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback>
                  {(chat?.participantNames?.[otherParticipantId] || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div>
              <h2 
                className="text-sm font-medium cursor-pointer hover:text-indigo-600 hover:underline transition-colors flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  if (otherParticipantId) navigateToUserProfile(otherParticipantId);
                }}
                title={t('profile.viewProfile')}
              >
                {chat?.participantNames?.[otherParticipantId] || t('common.user')}
                <User className="ml-1 h-3 w-3" />
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {chat?.taskTitle || t('common.chat')}
              </p>
            </div>
            {/* Location display/sharing - different presentation depending on role (for confirmed task or manual check) */}
            {chat?.taskId && ((isSelected && isConfirmedByApplicant) || false) && (
              <div className="absolute right-2 flex items-center">
                {/* For task creator: Button to share location */}
                {isTaskCreator && (
                  <Button
                    size="sm"
                    variant={isLocationShared ? "default" : "outline"}
                    className={`${
                      isLocationShared ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-600 border-dashed border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={handleRequestLocation}
                    disabled={requestingLocation || isLocationShared}
                    title={
                      isLocationShared 
                        ? t('chat.locationSharedAccepted')
                        : t('chat.locationShareRequest')
                    }
                  >
                    {isLocationShared ? (
                      <>
                        <MapPinned className="h-4 w-4 mr-1" />
                        <span className="text-xs">{t('chat.locationSharedNotice')}</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="text-xs">{t('chat.shareLocationShort')}</span>
                      </>
                    )}
                    {requestingLocation && (
                      <div className="w-3 h-3 ml-1 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </Button>
                )}
                
                {/* For contractor: Only show notice when no location is shared */}
                {isApplicant && !isLocationShared && (
                  <div className="text-xs text-gray-500 flex items-center">
                    <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                    <span>{t('chat.exactLocationPrivate')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons for application chats */}
      {isApplicationChat && (
        <div className="bg-gray-50 border-b p-3">
          <div className="flex flex-wrap gap-2">
            {/* For task creator: Select/reject applicant */}
            {isTaskCreator && !isSelected && !isRejected && (
              <>
                <Button 
                  onClick={selectApplicant}
                  variant="default"
                  size="sm"
                  className="flex-1"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Bewerber annehmen
                </Button>
                <Button 
                  onClick={rejectApplicant}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.reject')}
                </Button>
              </>
            )}
            
            {/* For applicants: Confirm */}
            {isApplicant && isSelected && !isConfirmedByApplicant && (
              <Button 
                onClick={confirmSelection}
                variant="default"
                size="sm"
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('task.confirmSelectionAndStart')}
              </Button>
            )}
            
            {/* Task completion section with different views based on role */}
            {(isSelected && isConfirmedByApplicant) && (
              <>
                {/* Only for task creator: Mark task as completed */}
                {isTaskCreator && !chat?.isTaskCompleted && !chat?.isCompletedConfirmed && (
                  <Button 
                    onClick={markTaskCompleted}
                    variant="default"
                    size="sm"
                    className="w-full"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    {t('task.markAsCompleted')}
                  </Button>
                )}
                
                {/* Information for task executor */}
                {isApplicant && !chat?.isTaskCompleted && !chat?.isCompletedConfirmed && (
                  <div className="bg-gray-100 rounded-md p-3 text-sm text-gray-600 w-full">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                      {t('task.waitingForTaskCompletion')}
                    </div>
                  </div>
                )}
                
                {/* For both: Submit review when task is completed */}
                {(chat?.isTaskCompleted || chat?.isCompletedConfirmed) && !hasReviewed && !checkingReviewStatus && (
                  <Button 
                    onClick={() => openReviewModal({
                      taskId: chat.taskId,
                      userId: otherParticipantId,
                      userName: chat.participantNames?.[otherParticipantId] || t('common.user'),
                      userRole: isTaskCreator ? 'applicant' : 'creator',
                      chatId: chat.id
                    })}
                    variant="default"
                    size="sm"
                    className="w-full"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    {t('review.submitReview')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Chat-Nachrichten-Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 pb-16"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-2">{t('chat.noMessages')}</p>
            <p className="text-sm">{t('chat.startConversation')}</p>
          </div>
        ) : (
          messages.map(message => {
            const isOwnMessage = message.senderId === user?.id;
            return (
              <ChatMessageItem 
                key={message.id} 
                message={message} 
                isOwnMessage={isOwnMessage}
                chat={chat || undefined}
                currentUserProfile={userProfile}
                onProfileClick={(userId, event) => {
                  event.stopPropagation();
                  if (userId) navigateToUserProfile(userId);
                }}
                onLocationResponse={handleLocationResponse}
              />
            );
          })
        )}
        {/* Unsichtbares Element für automatisches Scrollen */}
        <div ref={messagesEndRef} className="h-3" />
        
        {/* Standortanzeige, wenn der Standort freigegeben wurde */}
        {isLocationShared && chat?.taskId && (
          <LocationDisplay 
            chatId={chatId}
            taskId={chat.taskId}
            isShared={isLocationShared}
          />
        )}
      </div>
      
      {/* Eingabebereich - fixiert am unteren Bildschirmrand */}
      <div 
        className="fixed right-0 bg-white border-t border-gray-100 z-[999] shadow-sm modern-chat-input"
        style={{ 
          boxShadow: '0 -1px 2px rgba(0,0,0,0.05)',
          width: '100%',
          maxWidth: '100%',
          left: 0,
          bottom: 0,
          margin: 0,
          padding: 0,
          position: 'fixed',
          transition: 'transform 0.15s ease-out'
        }}
      >
        <form onSubmit={handleSendMessage} className="p-2 pb-3 m-0">
          <div className="flex items-center gap-2">
            {/* Avatar des aktuellen Benutzers */}
            <div className="flex-shrink-0 h-8 w-8">
              <Avatar className="h-full w-full">
                <AvatarImage 
                  src={
                    // Try base64-encoded images first, then URLs, then generate avatar
                    userProfile?.avatarBase64 || 
                    userProfile?.avatarUrl || 
                    user?.photoURL || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff`
                  }
                  alt={(user?.name || 'Benutzer')}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback>
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* Eingabefeld */}
            <div className="relative flex-1 bg-gray-100 rounded-full overflow-hidden flex items-center">
              <Input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('chat.typeMessage')}
                ref={inputRef}
                className="flex-1 h-10 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 pl-4 pr-24"
                disabled={sending || uploadingImage}
              />
              
              <div className="absolute right-2 flex items-center space-x-1">
                {/* Location-Sharing-Button (Nur für Aufgabenchats anzeigen) */}
                {isApplicationChat && chat?.taskId && (
                  <LocationSharingButton 
                    chatId={chatId} 
                    locationShared={isLocationShared}
                  />
                )}
                
                {/* Bild-Upload-Button */}
                <button
                  type="button"
                  onClick={handleImageSelect}
                  className={`text-gray-500 rounded-full p-1.5 ${selectedImage ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-200'}`}
                  title={t('chat.uploadImage')}
                  disabled={sending || uploadingImage}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
                
                {/* Senden-Button */}
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-indigo-500 hover:bg-indigo-600"
                  disabled={(!newMessage.trim() && !selectedImage) || sending || uploadingImage}
                >
                  {sending || uploadingImage ? (
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Vorschau des ausgewählten Bildes */}
          {selectedImage && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg flex items-center">
              <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 mr-2">
                <img 
                  src={URL.createObjectURL(selectedImage)} 
                  alt="Vorschau" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{selectedImage.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedImage.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-gray-500 h-6 w-6 p-0 ml-1"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Hidden input element for file selection */}
          <input 
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </form>
      </div>
    </div>
  );
};

export default ModernChatView;