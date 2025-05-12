import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { useNavigation } from '@/hooks/use-navigation';
import { db, updateTask } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { routes } from '@/routes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, Clock, MapPin, User, MessageSquare, Image as ImageIcon, 
  Edit, Calendar, X, CheckCircle, CheckSquare, ThumbsUp, UserCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { getCategoryColor } from '@/lib/categories';
import TaskImage from '@/components/TaskImage';
import ImageGallery from '@/components/ImageGallery';
import BookmarkButton from '@/components/BookmarkButton';
import TaskApplicationModal from '@/components/TaskApplicationModal';
import TaskEditModal from '@/components/TaskEditModal';
import { useAuth } from '@/context/AuthContext';
import { useBottomNavContext } from '@/context/BottomNavContext';
import { useUserLocation } from '@/context/LocationContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { uploadChatImage } from '@/lib/firebase';
import LocationShareButton from '@/components/LocationShareButton';
import UserLink from '@/components/UserLink';
import { commentService } from '@/lib/comment-service';
import { useTaskComments } from '@/hooks/use-comments';
import UserAvatar from '@/components/ui/user-avatar';
import ZoomableImage from '@/components/ui/zoomable-image';
import { format } from 'date-fns';
import { taskApplicationService } from '@/lib/task-application-service';
import UserRatings from '@/components/UserRatings';
import type { TaskComment as CommentServiceComment } from '@/lib/comment-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
function adaptCommentFn(comment: CommentServiceComment): TaskComment {
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
    replies: comment.replies?.map(adaptCommentFn) || []
  };
}

// Export als Konstante für bessere Fast Refresh Kompatibilität
export const adaptComment = adaptCommentFn;

interface TaskDetailScreenProps {
  editMode?: boolean;
}

const TaskDetailScreen = ({ editMode = false }: TaskDetailScreenProps) => {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const taskId = params?.id;
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { goBack, navigateToUserProfile, navigate } = useNavigation();
  const { toast } = useToast();
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const { user, userProfile } = useAuth();
  const { hideNav, showNav } = useBottomNavContext();
  
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
  
  // State für Bewerberfunktionalität
  const [hasApplied, setHasApplied] = useState(false);
  
  // Check if the current user is the creator of the task
  const currentUserId = user?.id || '';
  const [isSelectingApplicant, setIsSelectingApplicant] = useState(false);
  const [applicantSelectionOpen, setApplicantSelectionOpen] = useState(false);
  const [isConfirmingTask, setIsConfirmingTask] = useState(false);
  const { userLocation, calculateDistance } = useUserLocation();
  
  console.log(`TaskDetailScreen initialisiert. editMode=${editMode}, isEditing=${isEditing}`);
  
  // Prüfen, ob der eingeloggte Benutzer der Ersteller des Tasks ist
  const isTaskCreator = user && task && user.id === task.creatorId;
  
  // Berechne die Entfernung zum Task, wenn beide Standorte verfügbar sind
  const distance = task?.location && userLocation 
    ? calculateDistance(task.location)
    : (task?.distance || 0);
  
  // Prüfen, ob der aktuell angemeldete Benutzer der ausgewählte Bewerber ist
  const isSelectedApplicant = user && task?.selectedApplicant === user.id;
  
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
        setError(t('errors.taskNotFound'));
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
        setError(t('errors.taskLoadError'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchTask();
  }, [taskId, editMode, user]);

  // Bottom Navigation ausblenden, wenn die Detailansicht geöffnet ist
  useEffect(() => {
    // Navigation ausblenden, wenn die Komponente gemountet wird
    hideNav();
    
    return () => {
      // Navigation wieder anzeigen, wenn die Komponente unmounted wird
      showNav();
    };
  }, [hideNav, showNav]);
  
  // Automatisches Scrollen zum Ende der Kommentare
  useEffect(() => {
    if (task && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Überprüfung, ob der aktuelle Benutzer sich bereits auf den Task beworben hat
    if (task && user) {
      const hasUserApplied = task.applicants && 
        Array.isArray(task.applicants) && 
        task.applicants.some((app: any) => app.applicantId === user.id);
      setHasApplied(hasUserApplied || false);
    }
  }, [comments, task, user]);
  
  // Fokussiere Eingabefeld, wenn replyTo gesetzt ist
  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);
  
  // Mobile Keyboard-aware Verhalten für native-ähnliche UX
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        const formElement = document.querySelector('.comment-input-bar');
        
        // Wenn Tastatur offen ist (Höhe > 100px für die meisten mobilen Keyboards)
        if (keyboardHeight > 100) {
          if (formElement instanceof HTMLElement) {
            // Kommentarfeld über die Tastatur positionieren
            formElement.style.transform = `translateY(-${keyboardHeight}px)`;
          }
          
          // Nach unten scrollen zu den Kommentaren nach kurzer Verzögerung
          setTimeout(() => {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 150);
        } else {
          // Zurücksetzen, wenn die Tastatur geschlossen wird
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
    
    // Focus-Handler
    const handleFocus = () => {
      // Kurze Verzögerung, um sicherzustellen, dass die Tastatur vollständig geöffnet ist
      setTimeout(() => {
        handleVisualViewportResize();
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    };
    
    // Blur-Handler
    const handleBlur = () => {
      setTimeout(() => {
        handleVisualViewportResize();
      }, 100);
    };
    
    inputRef.current?.addEventListener('focus', handleFocus);
    inputRef.current?.addEventListener('blur', handleBlur);
    
    // Initial-Setup
    handleVisualViewportResize();
    
    // Cleanup
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
      
      inputRef.current?.removeEventListener('focus', handleFocus);
      inputRef.current?.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleApply = () => {
    if (!task) return;
    
    // Sicherheitsprüfung: Verhindern, dass Benutzer sich auf eigene Tasks bewerben können
    if (task.creatorId === user?.id) {
      toast({
        title: "Eigene Aufgabe",
        description: "Du kannst dich nicht auf deine eigene Aufgabe bewerben.",
        variant: "destructive"
      });
      return;
    }
    
    setIsApplicationModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsApplicationModalOpen(false);
  };
  
  // Funktion zum Öffnen der Bewerberauswahl
  const handleOpenApplicantSelection = () => {
    if (!task || !isTaskCreator) return;
    
    if (!task.applicants || task.applicants.length === 0) {
      toast({
        title: "Keine Bewerber",
        description: "Es gibt noch keine Bewerber für diese Aufgabe.",
        variant: "destructive"
      });
      return;
    }
    
    setApplicantSelectionOpen(true);
    setIsSelectingApplicant(true);
  };
  
  // Funktion zum Schließen der Bewerberauswahl
  const handleCloseApplicantSelection = () => {
    setApplicantSelectionOpen(false);
    setIsSelectingApplicant(false);
  };
  
  // Funktion zum Auswählen eines Bewerbers
  const handleSelectApplicant = async (applicantId: string) => {
    if (!task || !isTaskCreator) return;
    
    try {
      // Bewerber auswählen und Chat-ID zurückbekommen
      const chatId = await taskApplicationService.selectApplicant(task.id, applicantId);
      
      // Task aktualisieren
      const updatedTask = await getDoc(doc(db, 'tasks', task.id));
      if (updatedTask.exists()) {
        const taskData = updatedTask.data();
        setTask({
          ...task,
          ...taskData,
          id: task.id
        });
        
        toast({
          title: "Bewerber ausgewählt",
          description: "Der Bewerber wurde erfolgreich ausgewählt und benachrichtigt."
        });
      }
      
      // Dialog schließen
      handleCloseApplicantSelection();
      
      // Direkt zum Chat navigieren, wenn eine Chat-ID vorhanden ist
      if (chatId) {
        // 300ms Verzögerung, damit der Toast angezeigt werden kann, bevor wir umleiten
        setTimeout(() => {
          navigate(routes.chat(chatId));
        }, 300);
      }
    } catch (error) {
      console.error("Error selecting applicant:", error);
      toast({
        title: t('common.error'),
        description: t('errors.selectApplicantError'),
        variant: "destructive"
      });
    }
  };
  
  // Funktion zum Bestätigen des Tasks als abgeschlossen
  const handleConfirmTask = async () => {
    if (!task) return;
    
    try {
      setIsConfirmingTask(true);
      
      // Als Task-Ersteller bestätigen wir den Task als abgeschlossen
      if (isTaskCreator) {
        await taskApplicationService.confirmTask(task.id);
      }
      // Als ausgewählter Bewerber bestätigen wir den Task als abgeschlossen
      else if (isSelectedApplicant) {
        await taskApplicationService.confirmTaskCompletion(task.id);
      }
      else {
        throw new Error("Keine Berechtigung zum Bestätigen des Tasks");
      }
      
      // Task aktualisieren
      const updatedTask = await getDoc(doc(db, 'tasks', task.id));
      if (updatedTask.exists()) {
        const taskData = updatedTask.data();
        setTask({
          ...task,
          ...taskData,
          id: task.id
        });
        
        toast({
          title: "Task bestätigt",
          description: "Der Task wurde erfolgreich als abgeschlossen bestätigt."
        });
      }
    } catch (error) {
      console.error("Error confirming task:", error);
      toast({
        title: t('common.error'),
        description: t('errors.confirmTaskError'),
        variant: "destructive"
      });
    } finally {
      setIsConfirmingTask(false);
    }
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
        title: t('errors.invalidFileType'),
        description: t('errors.pleaseSelectImageFile'),
        variant: 'destructive',
      });
      return;
    }
    
    // Prüfe die Dateigröße (max 5MB)
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
          console.error('Error uploading image:', error);
          toast({
            title: t('errors.imageUploadError'),
            description: t('errors.tryAgainLaterOrContact'),
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
        if (!taskId) {
          throw new Error("Task ID ist nicht definiert");
        }
        
        console.log(`Sende Kommentar für Task ${taskId}, Inhalt: ${newComment.trim() ? 'Text vorhanden' : 'Kein Text'}, Bild: ${imageUrl ? 'Ja' : 'Nein'}`);
        await commentService.addComment(taskId, newComment.trim() || "Bild-Kommentar", undefined, undefined, undefined, imageUrl);
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
      console.error('Error sending comment:', err);
      toast({
        title: t('common.error'),
        description: t('errors.commentError'),
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
    // Navigation wieder anzeigen, wenn wir zurückgehen
    showNav();
    goBack('/tasks');
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
      return <span className="text-gray-600">🕒 {t('common.timeFlexible')}</span>;
    }
    
    if (timeInfo.formattedDate) {
      return (
        <span className="text-gray-600">
          🕒 {timeInfo.formattedDate}
          {timeInfo.timeOfDay && ` – ${t('tasks.preferredTimePrefix')} ${timeInfo.timeOfDay}`}
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
  const adaptedComments: TaskComment[] = comments.map(comment => {
    // Basiskommentar mit Hauptdaten
    const adaptedComment: TaskComment = {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.authorId,
      userName: comment.authorName,
      userPhotoURL: comment.authorAvatar,
      content: comment.content,
      createdAt: comment.timestamp,
      parentId: comment.parentId,
      imageUrl: comment.imageUrl,
      replies: []
    };
    
    // Füge auch die Antworten hinzu, falls vorhanden
    if (comment.replies && comment.replies.length > 0) {
      adaptedComment.replies = comment.replies.map(reply => ({
        id: reply.id,
        taskId: reply.taskId,
        userId: reply.authorId,
        userName: reply.authorName,
        userPhotoURL: reply.authorAvatar,
        content: reply.content,
        createdAt: reply.timestamp,
        parentId: reply.parentId,
        imageUrl: reply.imageUrl
      }));
    }
    
    return adaptedComment;
  });
  
  // Kommentare sind bereits vom Hook organisiert, wir brauchen nur die Root-Kommentare
  const rootComments = adaptedComments;

  // Rendern eines einzelnen Kommentars
  const renderComment = (comment: TaskComment) => {
    const formattedDate = getFormattedDate(comment.createdAt);
    const isOwnComment = comment.userId === user?.id;
    
    return (
      <div key={comment.id} className="mb-6 border-b border-gray-100 pb-4 last:border-0">
        <div className="flex items-start">
          {/* Avatar mit der UserAvatar-Komponente für bessere Kompatibilität */}
          <UserAvatar 
            user={{
              uid: comment.userId,
              photoURL: comment.userPhotoURL,
              displayName: comment.userName
            }}
            size={40}
            className="mr-3 mt-0.5"
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
                  <div className="mt-2 mb-3">
                    <ZoomableImage 
                      src={comment.imageUrl} 
                      alt="Kommentar-Bild" 
                      maxHeight={240}
                      objectFit="contain"
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
                  {comment.replies && comment.replies.length > 0 && (
                    <span className="text-gray-500">
                      {comment.replies.length} {comment.replies.length === 1 ? 'Antwort' : 'Antworten'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Antworten rendernd - eingerückt (mit deutlicher visueller Kennzeichnung) */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 pl-5 border-l-2 border-indigo-100 ml-5">
            {comment.replies.map(reply => {
              const replyFormattedDate = getFormattedDate(reply.createdAt);
              const isOwnReply = reply.userId === user?.id;
              
              return (
                <div key={reply.id} className="mb-5">
                  <div className="flex items-start">
                    {/* Avatar mit der UserAvatar-Komponente für bessere Kompatibilität */}
                    <UserAvatar 
                      user={{
                        uid: reply.userId,
                        photoURL: reply.userPhotoURL,
                        displayName: reply.userName
                      }}
                      size={32}
                      className="mr-2.5"
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
                          <div className="mt-1.5 mb-2">
                            <ZoomableImage 
                              src={reply.imageUrl} 
                              alt="Antwort-Bild" 
                              maxHeight={160}
                              objectFit="contain"
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
        
        {/* Scrollbarer Inhaltsbereich */}
        <div className="flex-1 overflow-y-auto pb-[65px] task-detail-content">
          {loading ? (
            <div className="p-4">
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6">
                <p className="text-red-600 font-medium mb-4">
                  {error || t('errors.taskLoadError')}
                </p>
                <Button 
                  onClick={handleClose}
                  className="mt-2"
                >
                  {t('common.back')}
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                  
                  {/* Standort mit Datenschutzkontrolle */}
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600 flex-1">
                      {/* Wenn Standort geteilt wird oder Nutzer ist Ersteller, dann volle Adresse anzeigen */}
                      {(task.isLocationShared || isTaskCreator) && task.address ? (
                        task.address
                      ) : task.area ? (
                        // Wenn ein Gebiet/Stadtteil verfügbar ist, diesen anzeigen
                        distance > 0 ? t('tasks.area', {area: task.area, distance: distance.toFixed(1)}) : task.area
                      ) : (
                        // Ansonsten nur die Entfernung anzeigen
                        distance > 0 ? t('tasks.kmAway', {distance: distance.toFixed(1)}) : t('tasks.noLocation')
                      )}
                    </span>
                    
                    {/* LocationShareButton - nur anzeigen für Auftragsersteller oder wenn Task zugewiesen wurde */}
                    {(isTaskCreator || isSelectedApplicant || (task?.status === 'assigned' && hasApplied)) && task?.location && (
                      <LocationShareButton
                        taskId={task.id}
                        location={task.location}
                        address={task.address}
                        isLocationShared={task.isLocationShared || false}
                        isCreator={isTaskCreator}
                      />
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">{t('common.createdBy')} </span>
                    <span
                      className="ml-1 text-gray-600 hover:text-primary cursor-pointer"
                      onClick={() => task.creatorId && navigateToUserProfile(task.creatorId)}
                    >
                      {task.creatorName}
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">
                      {t('tasks.createdAt')} {formatDate(task.createdAt?.toDate?.() || task.createdAt)}
                    </span>
                  </div>
                </div>
                
                {/* Beschreibung */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-2">{t('tasks.description')}</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
                </div>
                
                {/* Anforderungen, falls vorhanden */}
                {task.requirements && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-2">{t('tasks.requirements')}</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{task.requirements}</p>
                  </div>
                )}
                
                {/* Aktionen */}
                <div className="flex flex-wrap gap-3 mb-8">
                  {/* Aktionen für Nicht-Ersteller */}
                  {/* "Bewerben" nur anzeigen, wenn Nutzer nicht Ersteller ist und Task offen ist */}
                  {!isTaskCreator && task?.status === 'open' && (
                    <>
                      {/* Wenn bereits beworben, dann "Beworben" anzeigen */}
                      {hasApplied ? (
                        <Button disabled variant="outline">
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {t('tasks.applied')}
                        </Button>
                      ) : (
                        <Button onClick={handleApply}>
                          {t('tasks.applyForTask')}
                        </Button>
                      )}
                    </>
                  )}
                      
                  {/* Bestätigen-Button für ausgewählten Bewerber */}
                  {isSelectedApplicant && task?.status === 'assigned' && (
                        <Button 
                          onClick={handleConfirmTask}
                          disabled={isConfirmingTask}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckSquare className="mr-2 h-4 w-4" />
                          {isConfirmingTask ? t('tasks.confirming') : t('tasks.confirmTask')}
                        </Button>
                  )}

                  {/* Aktionen für Task-Ersteller */}
                  {isTaskCreator && (
                    <>
                      <Button onClick={handleEditClick}>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('common.edit')}
                      </Button>
                      
                      {/* Button zur Bewerberauswahl */}
                      {task?.status === 'open' && (
                        <Button
                          onClick={handleOpenApplicantSelection}
                          variant="outline"
                          className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          {t('tasks.selectApplicants')}
                          {task?.applicants && Array.isArray(task.applicants) && task.applicants.length > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-indigo-200 text-indigo-800">
                              {task.applicants.length}
                            </Badge>
                          )}
                        </Button>
                      )}
                      
                      {/* Button zur Auftragsbestätigung */}
                      {task?.status === 'assigned' && task?.selectedApplicant && (
                        <Button
                          onClick={handleConfirmTask}
                          disabled={isConfirmingTask}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <ThumbsUp className="mr-2 h-4 w-4" />
                          {isConfirmingTask ? t('tasks.confirming') : t('tasks.confirmTask')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {/* Kommentare Sektion */}
                <div className="mt-6 pb-20">
                  <h3 className="text-lg font-semibold mb-4">
                    <div className="flex items-center">
                      <MessageSquare className="h-5 w-5 text-gray-500 mr-2" />
                      <span>{t('tasks.comments')}</span>
                    </div>
                  </h3>
                  
                  {/* Kommentarliste */}
                  <div className="space-y-4">
                    {commentsLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-gray-500">{t('tasks.loadingComments')}</p>
                      </div>
                    ) : commentsError ? (
                      <div className="text-center py-8 text-red-500">
                        <p>{t('errors.loadingCommentError')}</p>
                      </div>
                    ) : rootComments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="mb-1">{t('tasks.noComments')}</p>
                        <p className="text-sm">{t('tasks.beFirstToComment')}</p>
                      </div>
                    ) : (
                      rootComments.map(comment => renderComment(comment))
                    )}
                    
                    {/* Unsichtbares Element für automatisches Scrollen */}
                    <div ref={commentsEndRef} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Eingabefeld - separat an Bildschirmrand fixiert, außerhalb des Scrollbereiches */}
      {task && !loading && !error && (
        <div 
          className="fixed right-0 bg-white border-t border-gray-100 z-[999] shadow-sm comment-input-bar"
          style={{ 
            boxShadow: '0 -1px 2px rgba(0,0,0,0.05)',
            width: window.innerWidth > 768 ? '500px' : '100%',
            maxWidth: '100%',
            left: window.innerWidth > 768 ? 'auto' : '0',
            bottom: 0,
            margin: 0,
            padding: 0,
            position: 'fixed'
          }}
        >
          {/* Antwort-Indikator */}
          {replyTo && (
            <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between border-t border-indigo-100">
              <div className="flex items-center text-sm">
                <ArrowLeft className="h-4 w-4 text-indigo-500 mr-2" />
                <span className="text-indigo-700">
                  Antwort an <UserLink 
                    userId={replyTo.userId} 
                    name={replyTo.userName}
                    className="font-medium"
                    size="sm"
                  />
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
          <form onSubmit={handleSubmitComment} className="p-2 pb-3 m-0">
            <div className="flex items-center gap-3">
              {/* Avatar mit UserAvatar-Komponente */}
              <div className="h-8 w-8 flex-shrink-0 ring-2 ring-gray-100 rounded-full overflow-hidden bg-indigo-100">
                <img 
                  src={userProfile?.avatarUrl || userProfile?.avatarBase64 || user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff`}
                  alt={user?.name || 'Benutzer'}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    console.log('Avatar konnte nicht geladen werden, verwende Fallback');
                    (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff`;
                  }}
                />
              </div>
              
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
      )}
      
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
      
      {/* Bewerber-Auswahl Modal */}
      {task && applicantSelectionOpen && (
        <Dialog open={applicantSelectionOpen} onOpenChange={handleCloseApplicantSelection}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bewerber auswählen</DialogTitle>
              <DialogDescription>
                Wähle einen Bewerber für die Aufgabe "{task.title}" aus.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {task.applicants && task.applicants.length > 0 ? (
                <div className="space-y-4">
                  {task.applicants.map((applicant: any) => (
                    <div 
                      key={applicant.applicantId || applicant.userId} 
                      className="flex items-start p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {/* Moderne Avatar-Darstellung mit UserAvatar-Komponente */}
                      <div className="flex-shrink-0 mr-3">
                        <UserAvatar 
                          user={{
                            uid: applicant.applicantId || applicant.userId,
                            displayName: applicant.applicantName || applicant.name,
                            photoURL: applicant.applicantPhotoURL,
                            avatarUrl: applicant.applicantAvatarUrl,
                            avatarBase64: applicant.applicantAvatarBase64
                          }}
                          size={48}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Verbesserte Darstellung des Bewerbernamens mit UserLink */}
                        <h4 className="font-medium text-gray-900 text-base">
                          <UserLink 
                            userId={applicant.applicantId || applicant.userId}
                            name={applicant.applicantName || applicant.name}
                            size="lg"
                          />
                        </h4>
                        
                        {/* Bewertungen und Bewertungssterne anzeigen (kompakte Version) */}
                        <div className="mt-1 mb-2">
                          <UserRatings userId={applicant.applicantId || applicant.userId} compact={true} />
                        </div>
                        
                        {/* Nachricht vom Bewerber */}
                        <div className="bg-gray-50 p-3 mt-2 rounded-md text-sm text-gray-700 break-words">
                          {applicant.message}
                        </div>
                        
                        {/* Zusätzliche Bewerber-Infos, falls vorhanden */}
                        {applicant.timestamp && (
                          <p className="text-xs text-gray-500 mt-2">
                            {t('tasks.appliedOn')} {format(new Date(applicant.timestamp.seconds * 1000), 'dd.MM.yyyy HH:mm')}
                          </p>
                        )}
                        
                        {/* Aktionsbuttons: Chat und Profil anzeigen */}
                        <div className="mt-3 flex gap-2">
                          <Button
                            onClick={async () => {
                              // Find or create chat for this applicant
                              try {
                                const chatId = await taskApplicationService.getChatIdForApplication(task.id, applicant.applicantId || applicant.userId);
                                if (chatId) {
                                  // Close dialog and navigate to chat
                                  handleCloseApplicantSelection();
                                  navigate(routes.chat(chatId));
                                }
                              } catch (error) {
                                console.error("Error connecting to chat:", error);
                                toast({
                                  title: t('common.error'),
                                  description: t('errors.chatConnectionError'),
                                  variant: "destructive"
                                });
                              }
                            }}
                            className="w-auto"
                            size="sm"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {t('chat.goToChat')}
                          </Button>
                          
                          {/* View profile button */}
                          <Button
                            onClick={() => {
                              handleCloseApplicantSelection();
                              // Navigate to user profile
                              const userId = applicant.applicantId || applicant.userId;
                              if (userId) {
                                navigate(routes.user(userId));
                              }
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <User className="h-4 w-4 mr-2" />
                            {t('profile.viewProfile')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>Keine Bewerber für diese Aufgabe verfügbar.</p>
                </div>
              )}
            </div>
            
            <DialogFooter className="sm:justify-start">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseApplicantSelection}
              >
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default TaskDetailScreen;