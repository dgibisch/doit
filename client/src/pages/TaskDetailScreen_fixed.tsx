import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { db, updateTask } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Clock, MapPin, User, MessageSquare, Image as ImageIcon, Edit, Calendar, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { getCategoryColor } from '@/lib/categories';
import TaskImage from '@/components/TaskImage';
import ImageGallery from '@/components/ImageGallery';
import BookmarkButton from '@/components/BookmarkButton';
import TaskApplicationModal from '@/components/TaskApplicationModal';
import TaskEditModal from '@/components/TaskEditModal';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { uploadChatImage } from '@/lib/firebase';
import { commentService, TaskComment as CommentServiceComment } from '@/lib/comment-service';
import { useTaskComments } from '@/hooks/use-comments';
import { format } from 'date-fns';

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

interface TaskDetailScreenProps {
  editMode?: boolean;
}

const TaskDetailScreen = ({ editMode = false }: TaskDetailScreenProps) => {
  const params = useParams<{ id: string }>();
  const taskId = params?.id;
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const { user } = useAuth();
  
  // Comment state
  const { comments, loading: commentsLoading, error: commentsError, addComment } = useTaskComments(taskId || null);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Image upload for comments
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bearbeitungsstatus und bearbeitbare Felder
  const [isEditing, setIsEditing] = useState(editMode);
  const [editedTask, setEditedTask] = useState<any>({
    price: 0,
    description: '',
    requirements: '',
    imageUrls: []
  });
  
  // State für das Edit-Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  console.log(`TaskDetailScreen initialisiert. editMode=${editMode}, isEditing=${isEditing}`);
  
  // Prüfen, ob der eingeloggte Benutzer der Ersteller des Tasks ist
  const isTaskCreator = user && task && user.id === task.creatorId;
  
  // Hilfsfunktion zur sicheren Anzeige von Werten
  const safeDisplay = (value: any): string => {
    if (value === null || value === undefined) {
      return 'Nicht verfügbar';
    }
    if (typeof value === 'object') {
      return 'Objekt';
    }
    return String(value);
  };
  
  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId) {
        setError('Keine Aufgaben-ID gefunden');
        setLoading(false);
        return;
      }
      
      try {
        const taskDoc = await getDoc(doc(db, 'tasks', taskId));
        if (taskDoc.exists()) {
          const taskData = taskDoc.data();
          
          // Sicherstellen, dass imageUrls ein Array ist
          const imageUrls = Array.isArray(taskData.imageUrls) ? taskData.imageUrls : [];
          
          // Debug Ausgabe für die gefundenen Bilder
          console.debug(`TaskDetail ${taskId}: ${imageUrls.length} Bilder aus Firestore`);
          
          const loadedTask = {
            id: taskDoc.id,
            ...taskData,
            // Garantiere, dass imageUrls immer ein Array ist
            imageUrls: imageUrls,
            // Stelle sicher, dass die Abwärtskompatibilität gewährleistet ist
            imageUrl: taskData.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null)
          };
          
          setTask(loadedTask);
          
          // Wenn wir im Bearbeitungsmodus starten und der aktuelle User der Ersteller ist,
          // sollten wir auch die editedTask Daten initialisieren
          const isCreator = user && user.id === loadedTask.creatorId;
          if (editMode && isCreator) {
            console.log('Edit Mode aktiviert. Lade Daten in Bearbeitungsfelder...');
            setEditedTask({
              ...loadedTask,
              price: loadedTask.price || 0,
              description: loadedTask.description || '',
              requirements: loadedTask.requirements || ''
            });
            // Bearbeitungsmodus aktivieren
            setIsEditing(true);
          } else if (editMode && !isCreator) {
            // Wenn der User nicht der Ersteller ist, aber versucht zu bearbeiten
            console.log('Bearbeitung nicht erlaubt - User ist nicht der Ersteller');
            toast({
              title: "Zugriff verweigert",
              description: "Du hast keine Berechtigung, diese Aufgabe zu bearbeiten.",
              variant: "destructive"
            });
            // Zurück zur normalen Ansicht und nicht in den Bearbeitungsmodus wechseln
            setIsEditing(false);
          }
        } else {
          // Besondere Fehlerbehandlung für den Fall, dass die Task-ID "welcome-task" ist
          if (taskId === 'welcome-task') {
            setError('Willkommen bei DoIt! Dies ist ein Supportchat und keine echte Aufgabe.');
          } else {
            setError('Aufgabe nicht gefunden');
          }
        }
      } catch (err) {
        console.error('Error fetching task:', err);
        setError('Fehler beim Laden der Aufgabe');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTask();
  }, [taskId, editMode, user]);

  // Automatisches Scrollen zum Ende der Kommentare
  useEffect(() => {
    if (task && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, task]);
  
  // Fokussiere Eingabefeld, wenn replyTo gesetzt ist
  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);
  
  // Keyboard-aware Verhalten
  useEffect(() => {
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
  }, []);

  const handleApply = () => {
    if (!task) return;
    setIsApplicationModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsApplicationModalOpen(false);
  };
  
  // Konvertiert ein Bild in eine Data-URL
  const convertToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Fehler beim Lesen der Datei'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  // Öffnet das Edit-Modal für die Task-Bearbeitung
  const handleEditClick = () => {
    setIsEditModalOpen(true);
  };

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
      
      // Wenn es eine Antwort auf einen Kommentar ist
      if (replyTo) {
        // Verwende direkt den Comment-Service für Antworten
        await commentService.replyToComment(replyTo.id, newComment.trim(), imageUrl);
        setReplyTo(null);
      } else {
        // Verwende den Comment-Service für einen neuen Kommentar
        await commentService.addComment(taskId || "", newComment.trim(), undefined, undefined, undefined, imageUrl);
      }
      
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
  
  // Task-Aktualisierung nach Speichern im Modal
  const handleTaskUpdated = () => {
    if (taskId) {
      getDoc(doc(db, 'tasks', taskId))
        .then((taskDoc) => {
          if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            const imageUrls = Array.isArray(taskData.imageUrls) ? taskData.imageUrls : [];
            
            const updatedTask = {
              id: taskDoc.id,
              ...taskData,
              imageUrls: imageUrls,
              imageUrl: taskData.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null)
            };
            
            setTask(updatedTask);
            
            toast({
              title: "Aufgabe aktualisiert",
              description: "Deine Aufgabe wurde erfolgreich aktualisiert."
            });
          }
        })
        .catch((error) => {
          console.error("Fehler beim Neuladen der Aufgabe:", error);
        });
    }
  };
  
  // Zurück-Navigation
  const handleClose = () => {
    setLocation('/');
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

  // Zeit-Information formatieren
  const formatTimeInfo = (timeInfo: any) => {
    if (!timeInfo) return null;
    
    if (timeInfo.isFlexible) {
      return <span className="text-gray-600">🕒 Zeitlich flexibel</span>;
    }
    
    if (timeInfo.formattedDate) {
      return (
        <span className="text-gray-600">
          🕒 {timeInfo.formattedDate}
          {timeInfo.timeOfDay && ` – Am besten ${timeInfo.timeOfDay}`}
        </span>
      );
    }
    
    return null;
  };

  // Berechnung des Erstellungsdatums für Kommentare
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

  // Rendern eines einzelnen Kommentars
  const renderComment = (comment: TaskComment) => {
    const replies = getCommentReplies(comment.id);
    const formattedDate = getFormattedDate(comment.createdAt);
    const isOwnComment = comment.userId === user?.id;
    
    return (
      <div key={comment.id} className="mb-6 border-b border-gray-100 pb-4 last:border-0">
        <div className="flex items-start">
          {/* Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0 mr-3 mt-0.5">
            <AvatarImage src={comment.userPhotoURL} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-medium">
              {comment.userName?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          
          {/* Kommentarinhalt */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="font-semibold text-gray-900">
                  {comment.userName}
                </span>
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
                  
                  {/* Antworten-Button */}
                  {user && (
                    <button
                      className="font-medium text-gray-500 hover:text-indigo-700"
                      onClick={() => handleReplyClick(comment)}
                    >
                      Antworten
                    </button>
                  )}
                  
                  {/* Antworten-Zähler */}
                  {replies.length > 0 && (
                    <span className="text-gray-500">
                      {replies.length} {replies.length === 1 ? 'Antwort' : 'Antworten'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Antworten rendernd - eingerückt */}
        {replies.length > 0 && (
          <div className="mt-3 pl-5 border-l-2 border-indigo-100 ml-4">
            {replies.map(reply => {
              const replyFormattedDate = getFormattedDate(reply.createdAt);
              const isOwnReply = reply.userId === user?.id;
              
              return (
                <div key={reply.id} className="mb-5">
                  <div className="flex items-start">
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 flex-shrink-0 mr-2.5">
                      <AvatarImage src={reply.userPhotoURL} />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-medium">
                        {reply.userName?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Antwortinhalt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span className="font-semibold text-sm text-gray-900">
                            {reply.userName}
                          </span>
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
                        <div className="flex items-center mt-1.5 space-x-3 text-xs">
                          <span className="text-gray-500">{replyFormattedDate}</span>
                          
                          {/* Antworten-Button */}
                          {user && (
                            <button
                              className="font-medium text-gray-500 hover:text-indigo-700"
                              onClick={() => handleReplyClick(comment)} // Antwort auf den Hauptkommentar
                            >
                              Antworten
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay für den Hintergrund */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={handleClose}
      />
      
      {/* Slide-in Container im Instagram/Facebook-Stil */}
      <div 
        className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[600px] bg-white shadow-xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header mit Zurück-Button und Task-Titel - fest oben */}
        <div className="bg-white sticky top-0 z-20 px-4 py-3 border-b flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClose}
            className="rounded-full"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold truncate max-w-[250px]">
            {loading ? 'Wird geladen...' : (task ? task.title : 'Fehler')}
          </h2>
          <div className="w-9"></div>
        </div>
        
        {loading ? (
          <div className="flex-1 p-4">
            <Skeleton className="h-64 w-full" />
            <div className="p-4">
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-6" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ) : error || !task ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              <p className="text-red-600 font-medium mb-4">
                {error || 'Aufgabe konnte nicht geladen werden.'}
              </p>
              <Button 
                onClick={handleClose}
                className="mt-2"
              >
                Zur Hauptseite
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-28">
            {/* Bilder-Galerie */}
            <div className="overflow-hidden border-b">
              {(() => {
                // Sicherstellen, dass imageUrls ein Array ist
                const validImageUrls = Array.isArray(task.imageUrls) ? task.imageUrls : [];
                const images = validImageUrls.length > 0 
                  ? validImageUrls 
                  : (task.imageUrl ? [task.imageUrl] : []);
                  
                return (
                  <ImageGallery 
                    images={images}
                    category={task.category}
                    showNavigation={true}
                    aspectRatio="video"
                    height="medium"
                  />
                );
              })()}
            </div>
            
            {/* Task-Details */}
            <div className="p-4">
              {/* Titel und Lesezeichen */}
              <div className="flex justify-between items-start mb-2">
                <h1 className="text-xl font-bold">{task.title}</h1>
                <BookmarkButton 
                  taskId={task.id} 
                  variant="ghost" 
                  size="sm" 
                  showText={false}
                />
              </div>
              
              {/* Kategorie-Badge */}
              <div className="mb-3">
                <Badge
                  style={{
                    backgroundColor: getCategoryColor(task.category),
                    color: 'white'
                  }}
                >
                  {task.category}
                </Badge>
              </div>
              
              {/* Preis */}
              {task.price > 0 && (
                <p className="text-xl font-semibold text-green-600 mb-3">
                  {task.price.toFixed(2)} €
                </p>
              )}
              
              {/* Meta-Informationen */}
              <div className="flex flex-col space-y-2 mb-6 text-sm">
                {task.timeInfo && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    {formatTimeInfo(task.timeInfo)}
                  </div>
                )}
                
                {task.locationAddress && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">{task.locationAddress}</span>
                  </div>
                )}
                
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">Erstellt von {task.creatorName}</span>
                </div>
                
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">
                    Erstellt am {formatDate(task.createdAt?.toDate?.() || task.createdAt)}
                  </span>
                </div>
              </div>
              
              {/* Beschreibung */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">Beschreibung</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>
              
              {/* Anforderungen, falls vorhanden */}
              {task.requirements && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-2">Anforderungen</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{task.requirements}</p>
                </div>
              )}
              
              {/* Aktionen */}
              <div className="flex flex-wrap gap-3 mb-8">
                {isTaskCreator ? (
                  <Button onClick={handleEditClick}>
                    <Edit className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </Button>
                ) : (
                  <Button onClick={handleApply}>
                    Auf Aufgabe bewerben
                  </Button>
                )}
              </div>
              
              {/* Kommentare Sektion */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-gray-500 mr-2" />
                    <span>Kommentare</span>
                  </div>
                </h3>
                
                {/* Kommentarliste */}
                <div className="space-y-4">
                  {commentsLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-500">Kommentare werden geladen...</p>
                    </div>
                  ) : commentsError ? (
                    <div className="text-center py-8 text-red-500">
                      <p>Fehler beim Laden der Kommentare</p>
                    </div>
                  ) : rootComments.length === 0 ? (
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
              </div>
            </div>
          </div>
        )}
        
        {/* Eingabebereich - fixiert am unteren Bildschirmrand */}
        <div 
          className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-100 z-10 comment-input-container"
          style={{ 
            boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
            width: window.innerWidth > 768 ? '500px' : '100%',
            maxWidth: '100%',
            transform: 'translateY(0)',
            right: '0',
            left: window.innerWidth > 768 ? 'auto' : '0',
          }}
        >
          {/* Antwort-Indikator */}
          {replyTo && (
            <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between border-t border-indigo-100">
              <div className="flex items-center text-sm">
                <ArrowLeft className="h-4 w-4 text-indigo-500 mr-2" />
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
          
          {/* Kommentarformular */}
          <form onSubmit={handleSubmitComment} className="p-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-gray-100">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-medium">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              
              {/* Eingabefeld */}
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
      
      {/* Modals */}
      {isApplicationModalOpen && task && (
        <TaskApplicationModal
          isOpen={isApplicationModalOpen}
          onClose={handleCloseModal}
          taskId={task.id}
          taskTitle={task.title}
          taskCreatorId={task.creatorId}
          taskCreatorName={task.creatorName}
        />
      )}
      
      {/* Task Bearbeiten Modal */}
      {task && (
        <TaskEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          task={task}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </>
  );
};

export default TaskDetailScreen;