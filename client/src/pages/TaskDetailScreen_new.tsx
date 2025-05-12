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
import CommentThread from '@/components/comments/CommentThread';
import { useAuth } from '@/context/AuthContext';

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
  
  // Bearbeitungsstatus und bearbeitbare Felder
  const [isEditing, setIsEditing] = useState(editMode);
  const [editedTask, setEditedTask] = useState<any>({
    price: 0,
    description: '',
    requirements: '',
    imageUrls: []
  });
  
  // File-Input und Bildverwaltung
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  
  // State für das Edit-Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Kommentare direkt anzeigen
  const [commentsOpen, setCommentsOpen] = useState(true);
  
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

  return (
    <>
      {/* Overlay für den Hintergrund */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={handleClose}
      />
      
      {/* Slide-in Container im Instagram/Facebook-Stil */}
      <div 
        className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[600px] bg-white shadow-xl z-50 flex flex-col overflow-hidden transform transition-transform duration-300 ease-out"
      >
        {/* Header mit Zurück-Button und Task-Titel - fest oben */}
        <div className="bg-white sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between">
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
          <div className="flex-1 overflow-y-auto pb-20">
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
              
              {/* Kommentare - direkt anzeigen */}
              <div className="mt-4 mb-8">
                <h3 className="text-lg font-semibold mb-4">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-gray-500 mr-2" />
                    <span>Kommentare</span>
                  </div>
                </h3>
                
                {/* Kommentarthread ist direkt eingebettet und geöffnet */}
                <CommentThread
                  taskId={task.id}
                  isOpen={commentsOpen}
                  onClose={() => setCommentsOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
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