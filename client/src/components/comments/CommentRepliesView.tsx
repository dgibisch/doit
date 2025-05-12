import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { X, ArrowLeft, Send, Image as ImageIcon, CornerDownLeft } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserAvatar from '@/components/ui/user-avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { uploadChatImage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { commentService } from '@/lib/comment-service';
import UserLink from '@/components/UserLink';
import { TaskComment } from './CommentThread';

interface CommentRepliesViewProps {
  comment: TaskComment;  // Der Kommentar, für den Antworten angezeigt werden
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  allComments: TaskComment[];  // Alle Kommentare (für Filterung)
}

/**
 * CommentRepliesView - Eine separate Ansicht für Antworten auf einen Kommentar
 * - Wird angezeigt, wenn auf "Antworten" geklickt wird
 * - Gleitet von rechts herein (nach Facebook/Instagram-Stil)
 * - Zeigt den Original-Kommentar oben und alle Antworten darunter
 * - Eigenes fixiertes Eingabefeld unten mit @Username Erwähnung
 */
const CommentRepliesView: React.FC<CommentRepliesViewProps> = ({
  comment,
  isOpen,
  onClose,
  taskId,
  allComments
}) => {
  const { user } = useAuth();
  const [newReply, setNewReply] = useState('');
  const repliesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Zustand für Bildauswahl und -upload
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filtern der Antworten auf den ausgewählten Kommentar
  const replies = allComments.filter(c => c.parentId === comment.id);
  
  // Automatisches Scrollen und Fokussieren
  useEffect(() => {
    if (isOpen) {
      // Fokussiere das Eingabefeld automatisch
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500);
      
      // Scrollen zum Ende der Antworten
      if (repliesEndRef.current) {
        repliesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isOpen, replies]);
  
  // Keyboard-aware Verhalten
  useEffect(() => {
    if (!isOpen) return;
    
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        
        // Wenn Tastatur offen ist (Höhe > 100px), passe Position an
        if (keyboardHeight > 100) {
          const formElement = document.querySelector('.reply-input-container');
          if (formElement instanceof HTMLElement) {
            formElement.style.transform = `translateY(-${keyboardHeight}px)`;
          }
          
          // Nach unten scrollen
          setTimeout(() => {
            repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        } else {
          const formElement = document.querySelector('.reply-input-container');
          if (formElement instanceof HTMLElement) {
            formElement.style.transform = 'translateY(0)';
          }
        }
      }
    };
    
    // Event-Listener für Tastatur
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }
    
    // Zusätzlicher Event-Listener für Fokus
    const handleFocus = () => {
      setTimeout(() => {
        handleVisualViewportResize();
        repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    };
    
    inputRef.current?.addEventListener('focus', handleFocus);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
      
      inputRef.current?.removeEventListener('focus', handleFocus);
    };
  }, [isOpen]);
  
  // Wähle ein Bild aus
  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };
  
  // Wenn eine Datei ausgewählt wird
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validiere den Dateityp
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Fehlerhafter Dateityp',
        description: 'Bitte wählen Sie eine Bilddatei aus.',
        variant: 'destructive',
      });
      return;
    }
    
    // Prüfe die Dateigröße (max 5MB)
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Antwort senden
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newReply.trim() && !selectedImage) || !user) return;
    
    try {
      let imageUrl: string | undefined;
      
      // Falls ein Bild ausgewählt wurde, lade es hoch
      if (selectedImage) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadChatImage(selectedImage, `comments_${taskId}`);
        } catch (error) {
          console.error('Fehler beim Hochladen des Bildes:', error);
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
      
      // Verwende den Comment-Service für die Antwort
      await commentService.replyToComment(comment.id, newReply.trim(), imageUrl);
      
      // Zurücksetzen der Eingabe
      setNewReply('');
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Scrolle zum Ende der Antworten
      setTimeout(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Fehler beim Senden der Antwort:', err);
      toast({
        title: 'Fehler',
        description: 'Die Antwort konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
        variant: 'destructive',
      });
    }
  };
  
  // Berechnung des Erstellungsdatums
  const getFormattedDate = (timestamp: any) => {
    try {
      if (!timestamp) return '';
      
      const date = typeof timestamp.toDate === 'function' 
        ? timestamp.toDate() 
        : new Date(timestamp);
      
      return format(date, 'dd.MM.yyyy HH:mm');
    } catch (err) {
      console.error('Error formatting date:', err);
      return '';
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-xl z-[60] transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col overflow-hidden`}
      style={{ boxShadow: '-5px 0 20px rgba(0,0,0,0.1)' }}
    >
      {/* Header mit Zurück-Button */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
        <div className="px-3 py-3 flex items-center">
          <button
            className="mr-2 h-8 w-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Zurück"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-semibold text-base">Antworten</h2>
        </div>
      </div>
      
      {/* Original-Kommentar - Fixiert unter dem Header */}
      <div className="border-b border-gray-100 bg-gray-50/80 p-4">
        <div className="flex items-start">
          {/* Avatar */}
          <UserAvatar
            user={{
              uid: comment.userId,
              photoURL: comment.userPhotoURL || '',
              displayName: comment.userName
            }}
            size={36}
            className="flex-shrink-0 mr-3"
          />
          
          {/* Kommentarinhalt */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center">
                <UserLink 
                  userId={comment.userId} 
                  name={comment.userName}
                  className="font-semibold text-sm text-gray-900"
                  size="sm"
                />
              </div>
              
              {/* Kommentartext */}
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words my-1">
                {comment.content}
              </p>
              
              {/* Bild anzeigen, falls vorhanden */}
              {comment.imageUrl && (
                <div className="mt-1.5 rounded-lg overflow-hidden border border-gray-200">
                  <img 
                    src={comment.imageUrl} 
                    alt="Kommentar-Bild" 
                    className="max-w-full max-h-40 object-contain bg-gray-50"
                    loading="lazy"
                  />
                </div>
              )}
              
              {/* Zeitstempel */}
              <span className="text-xs text-gray-500 mt-1">
                {getFormattedDate(comment.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Antworten-Liste - scrollbar */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {replies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-1">Keine Antworten vorhanden</p>
            <p className="text-sm">Sei der Erste, der antwortet!</p>
          </div>
        ) : (
          replies.map(reply => {
            const formattedDate = getFormattedDate(reply.createdAt);
            const isOwnReply = reply.userId === user?.id;
            
            return (
              <div key={reply.id} className="mb-5">
                <div className="flex items-start">
                  {/* Avatar */}
                  <UserAvatar
                    user={{
                      uid: reply.userId,
                      photoURL: reply.userPhotoURL || '',
                      displayName: reply.userName
                    }}
                    size={32}
                    className="flex-shrink-0 mr-2.5"
                  />
                  
                  {/* Antwortinhalt */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <UserLink 
                          userId={reply.userId} 
                          name={reply.userName}
                          className="font-semibold text-sm text-gray-900"
                          size="sm"
                        />
                        {isOwnReply && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-5 border-indigo-200 text-indigo-700 bg-indigo-50">
                            Du
                          </Badge>
                        )}
                      </div>
                      
                      {/* Antworttext */}
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words my-1">
                        {reply.content}
                      </p>
                      
                      {/* Bild anzeigen, falls vorhanden */}
                      {reply.imageUrl && (
                        <div className="mt-1.5 mb-2 rounded-lg overflow-hidden border border-gray-200">
                          <img 
                            src={reply.imageUrl} 
                            alt="Antwort-Bild" 
                            className="max-w-full max-h-40 object-contain bg-gray-50"
                            loading="lazy"
                          />
                        </div>
                      )}
                      
                      {/* Zeitstempel */}
                      <span className="text-xs text-gray-500 mt-0.5">
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {/* Unsichtbares Element für automatisches Scrollen */}
        <div ref={repliesEndRef} />
      </div>
      
      {/* Eingabebereich - Facebook/Instagram-Stil, fixiert am Boden */}
      <div 
        className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100 z-10 reply-input-container"
        style={{ 
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
        }}
      >
        {/* Antwort-Indikator */}
        <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center border-t border-indigo-100">
          <div className="flex items-center text-sm">
            <CornerDownLeft className="h-4 w-4 text-indigo-500 mr-2" />
            <span className="text-indigo-700">
              Antwort an <UserLink 
                userId={comment.userId} 
                name={comment.userName} 
                className="font-medium text-indigo-700 hover:text-indigo-800" 
                showIcon={false} 
                size="sm"
              />
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmitReply} className="p-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <UserAvatar
              user={{
                uid: user?.id || '',
                photoURL: user?.photoURL || '',
                displayName: user?.name || 'Benutzer'
              }}
              size={32}
              className="flex-shrink-0 ring-2 ring-gray-100"
            />
            
            {/* Eingabefeld mit @Username Erwähnung */}
            <div className="relative flex-1 bg-gray-50 rounded-full overflow-hidden flex items-center border border-gray-200">
              <Input
                type="text"
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder={`@${comment.userName} `}
                ref={inputRef}
                className="flex-1 h-10 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 pl-4 pr-24 placeholder:text-gray-500"
                disabled={!user}
                autoComplete="off"
              />
              
              <div className="absolute right-2 flex items-center space-x-2">
                {/* Bild-Upload-Button */}
                <button
                  type="button"
                  onClick={handleImageSelect}
                  className={`text-gray-500 rounded-full p-1.5 transition-colors ${selectedImage ? 'text-indigo-600' : 'hover:text-indigo-500'}`}
                  disabled={!user}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
                
                {/* Senden-Button */}
                {(newReply.trim() || selectedImage) ? (
                  <button
                    type="submit"
                    className="font-medium text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:pointer-events-none px-2"
                    disabled={uploadingImage || !user}
                  >
                    {uploadingImage ? (
                      <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Senden"
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          
          {/* Bildvorschau */}
          {selectedImage && (
            <div className="mt-3 relative">
              <div className="w-full rounded-lg overflow-hidden bg-gray-50 border border-gray-100 p-0.5">
                <div className="relative pb-2">
                  {/* Bildanzeige */}
                  <div className="rounded-md overflow-hidden">
                    <img 
                      src={URL.createObjectURL(selectedImage)} 
                      alt="Bildvorschau" 
                      className="w-full max-h-56 object-contain"
                    />
                  </div>
                  
                  {/* Bild-Informationen */}
                  <div className="flex items-center justify-between px-2 mt-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{selectedImage.name}</p>
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const sizeMB = selectedImage.size / 1024 / 1024;
                          return sizeMB < 0.01
                            ? `${Math.round(selectedImage.size / 1024)} KB`
                            : `${sizeMB.toFixed(2)} MB`;
                        })()}
                      </p>
                    </div>
                    
                    {/* Entfernen-Button */}
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      onClick={handleRemoveImage}
                      aria-label="Bild entfernen"
                    >
                      <X className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Verstecktes Datei-Input */}
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

export default CommentRepliesView;