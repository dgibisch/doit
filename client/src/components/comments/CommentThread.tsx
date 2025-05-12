import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Send, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserAvatar from '@/components/ui/user-avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import UserLink from '@/components/UserLink';
import { useTaskComments } from '@/hooks/use-comments';
import { uploadChatImage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { commentService, TaskComment as CommentServiceComment } from '@/lib/comment-service';
import CommentRepliesView from './CommentRepliesView';

// TaskComment Typ mit Interface, kompatibel mit comment-service
export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  content: string;
  createdAt: any;
  parentId?: string;
  imageUrl?: string;
  replies?: TaskComment[];
}

// Hilfsfunktion zur Konvertierung zwischen den TaskComment-Typen
export function adaptComment(comment: CommentServiceComment): TaskComment {
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

interface CommentThreadProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CommentThread - Eine moderne Kommentarbereich-Komponente im Facebook/Instagram-Stil
 * - Hauptansicht aller Kommentare
 * - Zeigt nur Root-Kommentare mit Antwort-Zählern
 * - Separate Ansicht für Antworten durch Klick auf "Antworten"
 * - Fixiertes Eingabefeld am unteren Bildschirmrand
 */
export const CommentThread: React.FC<CommentThreadProps> = ({ 
  taskId, 
  isOpen, 
  onClose 
}) => {
  const { user } = useAuth();
  const { comments, loading, error, addComment } = useTaskComments(isOpen ? taskId : null);
  const [newComment, setNewComment] = useState('');
  const [selectedComment, setSelectedComment] = useState<TaskComment | null>(null);
  const [showReplies, setShowReplies] = useState(false);
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
      
      // Verwende den Comment-Service für einen neuen Root-Kommentar
      await commentService.addComment(taskId, newComment.trim(), undefined, undefined, undefined, imageUrl);
      
      // Zurücksetzen der Eingabe
      setNewComment('');
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
  
  // Öffne die Antworten-Ansicht für einen Kommentar
  const handleViewReplies = (comment: TaskComment) => {
    setSelectedComment(comment);
    setShowReplies(true);
  };
  
  // Schließe die Antworten-Ansicht
  const handleCloseReplies = () => {
    setShowReplies(false);
    setSelectedComment(null);
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
            <button 
              className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
              onClick={onClose}
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
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
  
  // Nur Root-Kommentare anzeigen
  const rootComments = adaptedComments.filter(comment => !comment.parentId) || [];
  
  // Antworten auf einen Kommentar finden
  const getCommentReplies = (parentId: string) => 
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
  
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-20 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Slide-in Kommentarbereich - Facebook/Instagram-Style */}
      <div 
        ref={containerRef}
        className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-xl z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
          <div className="px-4 py-3 flex justify-between items-center">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Kommentare
              </h2>
              {rootComments.length > 0 && (
                <span className="ml-2 bg-indigo-100 text-indigo-800 font-medium text-xs rounded-full px-2 py-0.5">
                  {adaptedComments.length}
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
            rootComments.map(comment => {
              const replies = getCommentReplies(comment.id);
              const formattedDate = getFormattedDate(comment.createdAt);
              const isOwnComment = comment.userId === user?.id;
              
              return (
                <div key={comment.id} className="mb-6 border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-start">
                    {/* Avatar */}
                    <UserAvatar
                      user={{
                        uid: comment.userId,
                        photoURL: comment.userPhotoURL || '',
                        displayName: comment.userName
                      }}
                      size={40}
                      className="flex-shrink-0 mr-3 mt-0.5"
                    />
                    
                    {/* Kommentarinhalt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <UserLink 
                            userId={comment.userId} 
                            name={comment.userName}
                            className="font-semibold text-gray-900"
                          />
                          {isOwnComment && (
                            <Badge variant="outline" className="ml-2 text-[10px] h-5 border-indigo-200 text-indigo-700 bg-indigo-50">
                              Du
                            </Badge>
                          )}
                        </div>
                        
                        {/* Kommentartext */}
                        <div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words my-1.5">
                            {comment.content}
                          </p>
                          
                          {/* Bild anzeigen, falls vorhanden */}
                          {comment.imageUrl && (
                            <div className="mt-2 mb-3 rounded-lg overflow-hidden border border-gray-200">
                              <img 
                                src={comment.imageUrl} 
                                alt="Kommentar-Bild" 
                                className="max-w-full max-h-60 object-contain bg-gray-50"
                                loading="lazy"
                              />
                            </div>
                          )}
                          
                          {/* Meta-Informationen und Aktionen */}
                          <div className="flex items-center mt-1.5 space-x-4 text-xs">
                            <span className="text-gray-500">{formattedDate}</span>
                            
                            {/* Antworten-Button nach Facebook-Style */}
                            {user && (
                              <button
                                className="font-medium text-gray-500 hover:text-indigo-700"
                                onClick={() => handleViewReplies(comment)}
                              >
                                Antworten
                              </button>
                            )}
                            
                            {/* Antworten-Zähler und View-Button */}
                            {replies.length > 0 && (
                              <button
                                className="text-gray-500 hover:text-indigo-700 font-medium flex items-center space-x-1"
                                onClick={() => handleViewReplies(comment)}
                              >
                                <span>{replies.length} {replies.length === 1 ? 'Antwort' : 'Antworten'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {/* Unsichtbares Element für automatisches Scrollen */}
          <div ref={commentsEndRef} />
        </div>
        
        {/* Eingabebereich - Instagram-Stil, fixiert am Boden */}
        <div 
          className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100 z-10 comment-input-container"
          style={{ 
            boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
          }}
        >
          <form onSubmit={handleSubmitComment} className="p-3">
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
              
              {/* Eingabefeld */}
              <div className="relative flex-1 bg-gray-50 rounded-full overflow-hidden flex items-center border border-gray-200">
                <Input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Schreibe einen Kommentar..."
                  ref={inputRef}
                  className="flex-1 h-10 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 pl-4 pr-24 placeholder:text-gray-400"
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
      
      {/* Separate Ansicht für Antworten, die von rechts eingeschoben wird */}
      {selectedComment && (
        <CommentRepliesView
          comment={selectedComment}
          isOpen={showReplies}
          onClose={handleCloseReplies}
          taskId={taskId}
          allComments={adaptedComments}
        />
      )}
    </>
  );
};

export default CommentThread;