import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTaskComments } from '@/hooks/use-comments';
import { useFullscreenMode } from '@/hooks/useFullscreenMode';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ThumbsUp, Send, MessageSquare, Camera, X, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import UserLink from './UserLink';
import { TaskComment } from '@/lib/comment-service';
import { cn } from '@/lib/utils';

interface CommentListProps {
  taskId: string;
  showSeparator?: boolean;
}

// Einzelne Kommentarkomponente
const CommentItem: React.FC<{ 
  comment: TaskComment; 
  onLike: (id: string) => void;
  onReply: (id: string) => void;
  replyingTo: string | null;
  onCancelReply: () => void;
  onSubmitReply: (commentId: string, content: string) => void;
  submitting: boolean;
  handleImageSelect: (file: File | null) => void;
  uploadingImage: boolean;
  level?: number;
}> = ({ 
  comment, 
  onLike, 
  onReply, 
  replyingTo,
  onCancelReply,
  onSubmitReply,
  submitting,
  handleImageSelect,
  uploadingImage,
  level = 0 
}) => {
  const { user } = useAuth();
  const [replyContent, setReplyContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Format timestamp
  let commentTime = '';
  try {
    if (comment.timestamp) {
      const date = typeof comment.timestamp.toDate === 'function'
        ? comment.timestamp.toDate()
        : new Date();
      commentTime = format(date, 'dd.MM.yyyy • HH:mm');
    }
  } catch (err) {
    console.error('Error formatting timestamp:', err);
  }

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || submitting) return;
    
    onSubmitReply(comment.id, replyContent);
    setReplyContent('');
    setSelectedFileName(null);
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleImageSelect(file);
      setSelectedFileName(file.name);
    } else {
      handleImageSelect(null);
      setSelectedFileName(null);
    }
  };

  const handleClearImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    handleImageSelect(null);
    setSelectedFileName(null);
  };

  // Check if comment is from the current user
  const isOwnComment = user?.id === comment.authorId;
  
  return (
    <div className={`flex space-x-3 mb-4 ${level > 0 ? 'ml-5 sm:ml-8' : ''}`}>
      {!isOwnComment && (
        <UserLink userId={comment.authorId} type="avatar">
          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
            <AvatarImage src={comment.authorAvatar} />
            <AvatarFallback className="bg-indigo-100 text-indigo-800 font-medium">
              {comment.authorName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </UserLink>
      )}
      
      <div className={`flex-1 ${isOwnComment ? 'flex justify-end' : ''}`}>
        <div className={`relative max-w-[80%] ${isOwnComment ? 'ml-auto' : ''}`}>
          {/* Chat-bubble styling based on sender */}
          <div className={`
            py-2 px-3 pb-5 shadow-sm
            ${isOwnComment 
              ? 'bg-indigo-100 text-gray-800 rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl' 
              : 'bg-gray-100 text-gray-800 rounded-tr-2xl rounded-br-2xl rounded-tl-2xl'
            }
          `}>
            <div className="flex justify-between items-start mb-1">
              <UserLink userId={comment.authorId} type="name">
                <p className={`text-sm font-medium ${isOwnComment ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {comment.authorName}
                </p>
              </UserLink>
            </div>
            
            {/* Inhalt des Kommentars */}
            <p className="text-[15px] leading-[20px] whitespace-pre-wrap break-words">{comment.content}</p>
            
            {/* Bild anzeigen, falls vorhanden */}
            {comment.imageUrl && (
              <div className="mt-2 overflow-hidden">
                {comment.imageUrl.startsWith('data:') ? (
                  /* Für Base64/DataURL Bilder */
                  <img 
                    src={comment.imageUrl} 
                    alt="Angehängtes Bild" 
                    className="max-w-full max-h-[200px] object-contain rounded-lg"
                  />
                ) : (
                  /* Für normale URLs (Firebase Storage) mit Fallback */
                  <img 
                    src={comment.imageUrl} 
                    alt="Angehängtes Bild" 
                    className="max-w-full max-h-[200px] object-contain rounded-lg"
                    onError={(e) => {
                      console.log('Bildfehler bei URL, fallback auf Platzhalter:', e);
                      e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Bild+nicht+verfügbar';
                      e.currentTarget.classList.add('opacity-70'); // Visuell zeigen, dass es ein Fallback ist
                    }}
                  />
                )}
              </div>
            )}
            
          </div>
          
          {/* Interaktionen und Zeitstempel in einer Zeile */}
          <div className={`flex items-center justify-between mt-2 text-[11px] text-gray-500 ${isOwnComment ? 'pr-1' : 'pl-1'}`}>
            {/* Action Buttons links */}
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => onLike(comment.id)}
                className="flex items-center hover:text-primary transition-colors"
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                <span className="font-normal">Danke{comment.likes > 0 ? ` (${comment.likes})` : ''}</span>
              </button>
              
              <button 
                onClick={() => onReply(comment.id)}
                className="flex items-center hover:text-primary transition-colors"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                <span className="font-normal">Antworten</span>
              </button>
            </div>
            
            {/* Zeitstempel rechts */}
            <div className="text-[10px] font-light text-gray-400 ml-4">
              {commentTime}
            </div>
          </div>
        </div>
        
        {/* Antwortformular, wenn auf diesen Kommentar geantwortet wird */}
        {replyingTo === comment.id && user && (
          <div className="bg-white rounded-lg shadow-sm p-3 mt-2 border border-gray-100">
            <div className="flex items-center mb-2">
              <Avatar className="h-6 w-6 flex-shrink-0 mr-2">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="bg-indigo-100 text-indigo-800 font-medium">
                  {user.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium">Antwort an <span className="text-indigo-600">{comment.authorName}</span></p>
              <Button 
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelReply}
                disabled={submitting}
                className="ml-auto text-xs rounded-full h-7 px-3"
              >
                Abbrechen
              </Button>
            </div>
            
            <form onSubmit={handleSubmitReply} className="flex flex-col">
              <div className="relative">
                <Input
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`${comment.authorName} antworten...`}
                  className="flex-1 rounded-full py-2 px-4 pr-12 bg-gray-100 border-gray-200 focus-visible:ring-1 focus-visible:ring-indigo-200 focus-visible:ring-offset-1"
                  disabled={submitting}
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
                  {/* Bildupload-Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-500 hover:text-primary h-8 w-8 flex items-center justify-center"
                    disabled={submitting || !!selectedFileName}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  
                  {/* Senden-Button */}
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!replyContent.trim() || submitting} 
                    className="rounded-full h-7 w-7"
                  >
                    {submitting || uploadingImage ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleSelectImage}
                disabled={submitting}
              />
              
              {/* Bildvorschau anzeigen, wenn ausgewählt */}
              {selectedFileName && (
                <div className="flex items-center mt-2 p-1.5 bg-gray-50 rounded-lg">
                  <div className="flex-1 flex items-center">
                    <span className="text-xs text-gray-600 truncate max-w-[250px] ml-1">{selectedFileName}</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost"
                    size="sm"
                    onClick={handleClearImage}
                    className="ml-2 text-gray-500 hover:text-red-500 h-6 w-6 p-0 rounded-full"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </form>
          </div>
        )}
        
        {/* Antworten zu diesem Kommentar anzeigen */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onLike={onLike}
                onReply={onReply}
                replyingTo={replyingTo}
                onCancelReply={onCancelReply}
                onSubmitReply={onSubmitReply}
                submitting={submitting}
                handleImageSelect={handleImageSelect}
                uploadingImage={uploadingImage}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Haupt-Komponente für die Kommentarliste
const CommentList: React.FC<CommentListProps> = ({ taskId, showSeparator = true }) => {
  const { user } = useAuth();
  const { 
    comments, 
    loading, 
    error, 
    submitting, 
    addComment, 
    likeComment,
    replyToComment,
    replyingTo,
    startReply,
    cancelReply,
    handleImageSelect,
    selectedImage,
    uploadingImage,
    getAllComments
  } = useTaskComments(taskId);
  
  // Aktiviere den Vollbildmodus für Kommentare
  const { isFullscreen, enableFullscreen, disableFullscreen } = useFullscreenMode();
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const [newComment, setNewComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const bottomFormRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Aktiviere Vollbildmodus beim Laden
  useEffect(() => {
    enableFullscreen();
    
    // Deaktiviere Vollbildmodus beim Verlassen
    return () => {
      disableFullscreen();
    };
  }, [enableFullscreen, disableFullscreen]);

  // Header-Verhalten: Ausblenden beim Scrollen nach unten, Einblenden beim Scrollen nach oben
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollingDown = scrollY > lastScrollY;
      
      // Mindestens 50px scrollen, bevor Header ausgeblendet wird
      if (scrollingDown && scrollY > 50) {
        setShowHeader(false);
      } else if (!scrollingDown) {
        setShowHeader(true);
      }
      
      setLastScrollY(scrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Keyboard-aware behavior: Reagiert auf Tastatureingaben
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (bottomFormRef.current) {
        // Berechne die Differenz zwischen sichtbarer Viewport-Höhe und Fenster-Höhe
        // Dies gibt die Höhe der virtuellen Tastatur
        if (window.visualViewport) {
          const keyboardHeight = window.innerHeight - window.visualViewport.height;
          
          // Passe die Position des Eingabefelds an, wenn die Tastatur sichtbar ist
          if (keyboardHeight > 100) { // Schwellenwert, um zu erkennen, dass die Tastatur offen ist
            // Hebe das Eingabefeld über die Tastatur (wichtig: transform statt bottom)
            bottomFormRef.current.style.transform = `translateY(-${keyboardHeight}px)`;
            
            // Scrolle zum Ende der Kommentare, wenn Tastatur geöffnet wird
            setTimeout(() => {
              if (commentsContainerRef.current) {
                const lastComment = commentsContainerRef.current.lastElementChild;
                if (lastComment) {
                  lastComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }, 100);
          } else {
            // Zurück zur normalen Position (kein Bottom, nur Transform)
            bottomFormRef.current.style.transform = 'translateY(0)';
          }
        }
      }
    };

    // Füge CSS für verbesserte Anpassung hinzu
    const style = document.createElement('style');
    style.id = 'comment-keyboard-aware-styles';
    style.innerHTML = `
      .comments-container {
        /* Stelle sicher, dass der Container die volle Höhe des Bildschirms einnimmt */
        height: 100dvh; /* dynamische Viewport-Höhe für mobile Browser */
        max-height: 100dvh;
        overflow: hidden;
        position: relative;
      }
      
      /* Eingabefeld-Stil */
      .comment-input-container {
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
      
      /* Stelle sicher, dass alle Eingabeelemente im Kommentarbereich stabil sind */
      .comment-input-container * {
        transform: none;
      }
      
      /* Stelle sicher, dass das Scroll-Padding korrekt ist */
      .comments-container .overflow-y-auto {
        scroll-padding-bottom: 80px;
        padding-bottom: 80px !important;
      }
      
      /* Extra Anpassungen für iOS und mobile */
      @media (max-width: 768px) {
        .comment-input-container {
          /* Zusätzliche Sicherheit für gute mobile Positionierung */
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
        /* Erlaubt Scrollen innerhalb des Kommentarbereichs */
        .comments-container .overflow-y-auto {
          -webkit-overflow-scrolling: touch;
        }
        
        /* Weitere iOS-spezifische Fixes */
        .comment-input-container {
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
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
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
      
      const styleElement = document.getElementById('comment-keyboard-aware-styles');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, [selectedFileName]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      await addComment(newComment.trim());
      setNewComment('');
      setSelectedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Scrolle zum Ende nach dem Senden
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Error in handleAddComment:', err);
    }
  };

  const handleReplySubmit = async (commentId: string, content: string) => {
    try {
      await replyToComment(commentId, content);
    } catch (err) {
      console.error('Error submitting reply:', err);
    }
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleImageSelect(file);
      setSelectedFileName(file.name);
    } else {
      handleImageSelect(null);
      setSelectedFileName(null);
    }
  };

  const handleClearImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    handleImageSelect(null);
    setSelectedFileName(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-4">
        Es ist ein Fehler aufgetreten: {error.message}
      </div>
    );
  }

  // Gesamtzahl der Kommentare (inkl. Antworten) berechnen
  const totalCommentCount = getAllComments().length;

  return (
    <div className="h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      {/* Sticky header - similar to Chat header */}
      <div 
        className={`flex items-center p-3 border-b bg-white sticky top-0 z-50 shadow-sm transition-transform duration-300 ${
          showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 rounded-full hover:bg-gray-100"
          onClick={() => {
            disableFullscreen();
            // Handle back navigation if needed
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h3 className="font-medium">{totalCommentCount} Antworten</h3>
        </div>
      </div>
      
      {/* Comments List - Scrollable area */}
      <div 
        ref={commentsContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
        style={{ 
          paddingBottom: '80px'  // Festes Padding für den Bereich unter den Kommentaren
        }}
      >
        {comments.length === 0 ? (
          <div className="text-center text-gray-500 py-12 mt-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-medium">Noch keine Kommentare.</p>
            <p className="mt-1 text-sm max-w-xs mx-auto">Sei der Erste, der auf diese Aufgabe antwortet!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onLike={likeComment}
              onReply={startReply}
              replyingTo={replyingTo}
              onCancelReply={cancelReply}
              onSubmitReply={handleReplySubmit}
              submitting={submitting}
              handleImageSelect={handleImageSelect}
              uploadingImage={uploadingImage}
            />
          ))
        )}
      </div>
      
      {/* Fixed Bottom Comment Form - Modern chat-like design */}
      {user && (
        <div 
          ref={bottomFormRef}
          className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 shadow-md z-50 comment-input-container"
          style={{ 
            boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
            width: '100%'
          }}
        >
          <form onSubmit={handleAddComment} className="p-3">
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="bg-indigo-100 text-indigo-800 font-medium">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              {/* Input wrapper mit Kamera und Senden-Button */}
              <div className="flex-1 flex items-center bg-gray-100 rounded-full pl-4 pr-2 border border-gray-200 focus-within:border-indigo-200 focus-within:ring-1 focus-within:ring-indigo-200">
                {/* Texteingabefeld ohne Border */}
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Schreib eine Antwort..."
                  className="flex-1 bg-transparent border-none py-2 text-[15px] focus:outline-none focus:ring-0"
                  disabled={submitting}
                />
                
                {/* Kamera-Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-500 hover:text-indigo-500 mx-1 h-8 w-8 flex items-center justify-center"
                  disabled={submitting || !!selectedFileName}
                >
                  <Camera className="h-5 w-5" />
                </button>
                  
                {/* Senden-Button */}
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!newComment.trim() || submitting} 
                  className="rounded-full h-8 w-8 ml-1"
                >
                  {submitting || uploadingImage ? (
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
                onChange={handleSelectImage}
                disabled={submitting}
              />
            </div>
            
            {/* Image preview */}
            {selectedFileName && (
              <div className="flex items-center mt-2 ml-10 mr-3 p-1.5 bg-gray-50 rounded-lg">
                <div className="flex-1 flex items-center">
                  <span className="text-xs text-gray-600 truncate max-w-[250px] ml-1">{selectedFileName}</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost"
                  size="sm"
                  onClick={handleClearImage}
                  className="ml-2 text-gray-500 hover:text-red-500 h-6 w-6 p-0 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default CommentList;