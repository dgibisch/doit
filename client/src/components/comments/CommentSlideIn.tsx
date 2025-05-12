import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { X, Send, CornerDownLeft, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext'; // Für den aktuellen Benutzer
import { useTaskComments } from '@/hooks/use-comments';
import { uploadChatImage } from '@/lib/firebase'; // Wir verwenden die gleiche Upload-Funktion wie für Chat-Bilder
import { useToast } from '@/hooks/use-toast';
import { commentService, TaskComment as CommentServiceComment } from '@/lib/comment-service';
import UserAvatar from '@/components/ui/user-avatar';

// Angepasster TaskComment-Typ, der mit dem aus comment-service kompatibel ist
interface TaskComment {
  id: string;
  taskId: string;
  userId: string;      // entspricht authorId in CommentServiceComment
  userName: string;    // entspricht authorName in CommentServiceComment
  userPhotoURL?: string; // entspricht authorAvatar in CommentServiceComment
  content: string;
  createdAt: any;      // entspricht timestamp in CommentServiceComment
  parentId?: string;
  imageUrl?: string;
  replies?: TaskComment[];
}

// Hilfsfunktion zur Konvertierung zwischen den TaskComment-Typen
function adaptComment(comment: CommentServiceComment): TaskComment {
  return {
    id: comment.id,
    taskId: comment.taskId,
    userId: comment.authorId,
    userName: comment.authorName,
    userPhotoURL: comment.authorAvatar,
    content: comment.content,
    createdAt: comment.timestamp,
    parentId: comment.parentId,
    imageUrl: comment.imageUrl,
    replies: comment.replies?.map(adaptComment) || []
  };
}

interface CommentSlideInProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CommentSlideIn - Eine moderne Kommentarbereich-Komponente 
 * - Gleitet von rechts herein
 * - Fixiertes Eingabefeld unten
 * - Unterstützung für Bildanhänge
 * - Vollständige Antwortfunktionalität
 * - Tastatur-optimiert für mobile Nutzer
 */
export const CommentSlideIn: React.FC<CommentSlideInProps> = ({ 
  taskId, 
  isOpen, 
  onClose 
}) => {
  const { user, userProfile } = useAuth(); // Beide Daten abrufen
  
  // Debug-Ausgabe, um die verfügbaren Profilbild-Quellen zu sehen
  React.useEffect(() => {
    if (user) {
      // Vollständige Debug-Infos loggen
      console.log('User in CommentSlideIn - User:', user);
      console.log('User in CommentSlideIn - UserProfile:', userProfile);
      
      // In der Konsole genau sehen welche Bildquelle tatsächlich verwendet wird
      const avatarSrc = user.avatarBase64 || user.avatarUrl || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`;
      console.log('Verwendete Avatar-Quelle:', {
        quelle: avatarSrc.substring(0, 30) + '...',
        avatarBase64Vorhanden: !!user.avatarBase64,
        avatarUrlVorhanden: !!user.avatarUrl,
        photoURLVorhanden: !!user.photoURL
      });
      
      // Debug-Ausgabe direkt in die UI einfügen
      const debugElement = document.createElement('div');
      debugElement.style.position = 'fixed';
      debugElement.style.bottom = '10px';
      debugElement.style.left = '10px';
      debugElement.style.backgroundColor = 'rgba(0,0,0,0.8)';
      debugElement.style.color = 'white';
      debugElement.style.padding = '10px';
      debugElement.style.borderRadius = '5px';
      debugElement.style.zIndex = '9999';
      debugElement.style.fontSize = '10px';
      debugElement.style.maxWidth = '80%';
      debugElement.innerHTML = `
        <strong>Avatar Debug:</strong><br>
        Avatar-Quelle: ${avatarSrc.substring(0, 30)}...<br>
        avatarBase64: ${!!user.avatarBase64 ? 'JA' : 'NEIN'}<br>
        avatarUrl: ${!!user.avatarUrl ? 'JA' : 'NEIN'}<br>
        photoURL: ${!!user.photoURL ? 'JA' : 'NEIN'}
      `;
      document.body.appendChild(debugElement);
      
      // Nach 10 Sekunden wieder entfernen
      setTimeout(() => {
        if (document.body.contains(debugElement)) {
          document.body.removeChild(debugElement);
        }
      }, 20000);
    }
  }, [user, userProfile]);
  const { comments, loading, error, addComment } = useTaskComments(isOpen ? taskId : null);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Zustand für Bildauswahl und -upload
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Automatisches Scrollen zum Ende der Kommentare
  useEffect(() => {
    if (isOpen && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, isOpen]);
  
  // Fokussiere Eingabefeld, wenn replyTo gesetzt ist
  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);
  
  // Keyboard-aware Verhalten
  useEffect(() => {
    if (!isOpen) return;
    
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        
        // Wenn Tastatur offen ist (Höhe > 100px), passe Position an
        if (keyboardHeight > 100) {
          const formElement = document.querySelector('.comment-input-container');
          if (formElement instanceof HTMLElement) {
            formElement.style.transform = `translateY(-${keyboardHeight}px)`;
          }
          
          // Nach unten scrollen
          setTimeout(() => {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        } else {
          const formElement = document.querySelector('.comment-input-container');
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
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  
  // Click-Outside-Handler zum Schließen
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) && 
        !(event.target as HTMLElement).closest('.comment-input-container')
      ) {
        onClose();
      }
    };
    
    // Event hinzufügen mit Verzögerung, damit das Öffnen nicht direkt zum Schließen führt
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 300);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
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
  
  // Kommentar senden
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !selectedImage) || !user) return;
    
    try {
      let imageUrl: string | undefined;
      
      // Falls ein Bild ausgewählt wurde, lade es hoch
      if (selectedImage) {
        setUploadingImage(true);
        try {
          // Verwende die uploadChatImage-Funktion für Kommentarbilder
          // Wir speichern in einem separaten Pfad für Kommentare
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
      
      // Wenn es eine Antwort auf einen Kommentar ist
      if (replyTo) {
        // Verwende direkt den Comment-Service für Antworten
        await commentService.replyToComment(replyTo.id, newComment.trim(), imageUrl);
      } else {
        // Verwende den Comment-Service für einen neuen Kommentar
        await commentService.addComment(taskId, newComment.trim(), undefined, undefined, undefined, imageUrl);
      }
      
      // Zurücksetzen der Eingabe
      setNewComment('');
      setReplyTo(null);
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Scrolle zum neuen Kommentar
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Fehler beim Senden des Kommentars:', err);
      toast({
        title: 'Fehler',
        description: 'Der Kommentar konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
        variant: 'destructive',
      });
    }
  };
  
  // Antworte auf einen Kommentar
  const handleReplyClick = (comment: TaskComment) => {
    setReplyTo(comment);
    // Fokussiere das Eingabefeld
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };
  
  // Abbrechen der Antwort
  const handleCancelReply = () => {
    setReplyTo(null);
  };
  
  // Lade-Indikator
  if (isOpen && loading) {
    return (
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-lg z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-center items-center h-full">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  // Fehlerbehandlung
  if (isOpen && error) {
    return (
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-lg z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Kommentare</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-4">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="font-medium">Fehler beim Laden der Kommentare</p>
              <p className="text-sm text-gray-500 mt-1">
                {error.message || 'Bitte versuchen Sie es später erneut.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Konvertiere die Kommentare vom Service-Format in unser lokales Format
  const adaptedComments: TaskComment[] = comments.map(comment => ({
    id: comment.id,
    taskId: comment.taskId,
    userId: comment.authorId,
    userName: comment.authorName,
    userPhotoURL: comment.authorAvatar,
    content: comment.content,
    createdAt: comment.timestamp,
    parentId: comment.parentId,
    imageUrl: comment.imageUrl
  }));
  
  // Berechnung der verschachtelten Kommentarstruktur mit den adaptierten Kommentaren
  const rootComments = adaptedComments.filter(comment => !comment.parentId) || [];
  const commentReplies = (parentId: string) => 
    adaptedComments.filter(comment => comment.parentId === parentId) || [];
  
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
  
  // Rendern eines einzelnen Kommentars
  const renderComment = (comment: TaskComment, isReply = false, depth = 0) => {
    const replies = commentReplies(comment.id);
    const formattedDate = getFormattedDate(comment.createdAt);
    const isOwnComment = comment.userId === user?.id;
    
    // Instagram-ähnlicher Stil für Kommentare
    return (
      <div key={comment.id} className={`mb-5 ${isReply ? '' : ''}`}>
        <div className={`flex items-start`}>
          {/* Avatar */}
          <Avatar className={`flex-shrink-0 ${isReply ? 'h-7 w-7' : 'h-8 w-8'} mr-3`}>
            <AvatarImage src={comment.userPhotoURL} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-medium">
              {comment.userName?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          
          {/* Kommentarinhalt - Modern Style */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className={`font-semibold ${isReply ? 'text-sm' : 'text-sm'} text-gray-900`}>
                  {comment.userName}
                </span>
                {isOwnComment && (
                  <Badge variant="outline" className="ml-2 text-[10px] h-5 border-indigo-200 text-indigo-700 bg-indigo-50">
                    Du
                  </Badge>
                )}
              </div>
              
              {/* Kommentartext - Direkt unter Benutzernamen wie bei Instagram */}
              <div className="">
                <p className={`${isReply ? 'text-sm' : 'text-sm'} text-gray-800 whitespace-pre-wrap break-words`}>
                  {comment.content}
                </p>
                
                {/* Bild anzeigen, falls vorhanden */}
                {comment.imageUrl && (
                  <div className="mt-2 max-w-xs">
                    <img 
                      src={comment.imageUrl} 
                      alt="Kommentar-Bild" 
                      className="rounded-lg max-w-full h-auto border border-gray-200"
                      loading="lazy"
                    />
                  </div>
                )}
                
                {/* Meta-Informationen */}
                <div className="flex items-center mt-1.5 space-x-3">
                  <p className="text-xs text-gray-500">{formattedDate}</p>
                  
                  {/* Antworten-Link (wie bei Instagram) */}
                  {user && (
                    <button
                      className="text-xs font-medium text-gray-500 hover:text-indigo-700"
                      onClick={() => handleReplyClick(comment)}
                    >
                      Antworten
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Antworten rendernd - verbesserte Thread-Struktur */}
        {replies.length > 0 && (
          <div className="mt-3 pl-5 border-l-2 border-indigo-100 ml-4">
            {replies.map(reply => renderComment(reply, true, depth + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-20 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Slide-in Kommentarbereich */}
      <div 
        ref={containerRef}
        className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-xl z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}
      >
        {/* Header - Instagram-Style */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
          <div className="px-4 py-3 flex justify-between items-center">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Kommentare
              </h2>
              {rootComments.length > 0 && (
                <span className="ml-2 bg-indigo-100 text-indigo-800 font-medium text-xs rounded-full px-2 py-0.5">
                  {rootComments.length + rootComments.reduce((acc, comment) => acc + (commentReplies(comment.id).length || 0), 0)}
                </span>
              )}
            </div>
            
            <button
              className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
              onClick={onClose}
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Kommentarliste - scrollbar */}
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-28">
          {rootComments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-1">Keine Kommentare vorhanden</p>
              <p className="text-sm">Sei der Erste, der einen Kommentar hinterlässt!</p>
            </div>
          ) : (
            rootComments.map(comment => renderComment(comment))
          )}
          {/* Unsichtbares Element für automatisches Scrollen */}
          <div ref={commentsEndRef} />
        </div>
        
        {/* Eingabebereich - fixiert am unteren Bildschirmrand - Instagram-Stil */}
        <div 
          className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-100 z-50 comment-input-container"
          style={{ 
            boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
            width: isOpen ? (window.innerWidth > 768 ? '24rem' : '100%') : '0',
            transition: 'transform 0.15s ease-out'
          }}
        >
          {/* Antwort-Indikator - Instagram-Style */}
          {replyTo && (
            <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between border-t border-indigo-100">
              <div className="flex items-center text-sm">
                <CornerDownLeft className="h-4 w-4 text-indigo-500 mr-2" />
                <span className="text-indigo-700">
                  Antwort an <span className="font-medium">{replyTo.userName}</span>
                </span>
              </div>
              <button 
                type="button"
                className="text-gray-400 hover:text-gray-600 h-6 w-6 flex items-center justify-center" 
                onClick={handleCancelReply}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {/* Kommentarformular - Instagram-Style */}
          <form onSubmit={handleSubmitComment} className="p-3">
            <div className="flex items-center gap-3">
              {/* Avatar mit moderner Darstellung */}
              <div className="h-8 w-8 flex-shrink-0 ring-2 ring-gray-100 rounded-full overflow-hidden bg-indigo-100">
                {/* HARDCODED DUMMY-AVATAR FÜR SCHNELLEN FIX */}
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=6366f1&color=fff`}
                  alt={user?.displayName || 'Benutzer'}
                  className="h-full w-full object-cover"
                />
              </div>
              
              {/* Modernes Eingabefeld im Instagram-Stil */}
              <div className="relative flex-1 bg-gray-50 rounded-full overflow-hidden flex items-center border border-gray-200">
                <Input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? `@${replyTo.userName} ${newComment ? '' : '...'}` : "Schreibe einen Kommentar..."}
                  ref={inputRef}
                  className="flex-1 h-10 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 pl-4 pr-24 placeholder:text-gray-400"
                  disabled={!user}
                  autoComplete="off"
                />
                
                <div className="absolute right-2 flex items-center space-x-2">
                  {/* Bild-Upload-Button - Instagram-Style */}
                  <button
                    type="button"
                    onClick={handleImageSelect}
                    className={`text-gray-500 rounded-full p-1.5 transition-colors ${selectedImage ? 'text-indigo-600' : 'hover:text-indigo-500'}`}
                    disabled={!user}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  
                  {/* Senden-Button - Instagram-Style */}
                  {(newComment.trim() || selectedImage) ? (
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
            
            {/* Bildvorschau im Instagram-Stil */}
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
                      
                      {/* Entfernen-Button im modernen Stil */}
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
    </>
  );
};

export default CommentSlideIn;