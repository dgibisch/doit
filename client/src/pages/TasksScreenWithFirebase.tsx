import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import TaskApplicationModal from '@/components/TaskApplicationModal';
import TaskImage from '@/components/TaskImage';
import ImageGallery from '@/components/ImageGallery';
import { getCategoriesWithAll, ALL_TASKS_LABEL, getCategoryColor } from '@/lib/categories';
import { getTasks } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { createTestTasks, createTestUsers } from '@/utils/testData';
import { deleteRecentTasks } from '@/utils/cleanupTestData';
import { Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import UserLink from '@/components/UserLink';
import BookmarkButton from '@/components/BookmarkButton';
import { calculateDistance } from '@/utils/geoUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import TaskCard from '@/components/TaskCard';
import LocationSelector from '@/components/LocationSelector';
import { useUserLocation } from '@/context/LocationContext';
import { useTranslation } from 'react-i18next';

// Task data type definition
interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  creatorName: string;
  creatorId: string;
  creatorPhotoURL?: string;
  creatorRating?: number;
  createdAt: Timestamp;
  price: number;
  status: string;
  imageUrl?: string;
  imageUrls?: string[];
  distance?: number; // This would be calculated based on user location in a real implementation
  commentCount?: number; // Number of comments on the task
  location?: {
    lat: number;
    lng: number;
  };
  locationAddress?: string;
  timeInfo?: {
    isFlexible: boolean;
    date?: Date | null;
    formattedDate?: string | null;
    timeOfDay?: string | null;
    displayText: string;
  };
}

// Format date from Firestore timestamp
const formatDate = (timestamp: Timestamp | Date): string => {
  // Convert Firestore timestamp to JavaScript Date if needed
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);
  
  if (diffDays > 0) {
    return `${diffDays} Tag${diffDays > 1 ? 'e' : ''} zuvor`;
  } else if (diffHr > 0) {
    return `${diffHr} Stunde${diffHr > 1 ? 'n' : ''} zuvor`;
  } else if (diffMin > 0) {
    return `${diffMin} Minute${diffMin > 1 ? 'n' : ''} zuvor`;
  } else {
    return 'Gerade eben';
  }
};

const TasksScreen = () => {
  const { user, profile } = useAuth();
  const { userLocation, searchRadius, setSearchRadius } = useUserLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredByDistanceTasks, setFilteredByDistanceTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch tasks from Firebase when component mounts or category changes
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        // Build filter object based on selected category
        const filters: Record<string, any> = {};
        if (selectedCategory && selectedCategory !== ALL_TASKS_LABEL) {
          filters.category = selectedCategory;
        }
        
        // Fetch tasks from Firebase
        const taskData = await getTasks(filters);
        
        // Add distance calculation (would be based on user location in production)
        // und stellen sicher, dass imageUrls ein Array ist
        // Benutzerstandort aus dem Profil holen
        const userLocation = profile?.location || { lat: 0, lng: 0 };
        
        const tasksWithDistance = taskData.map(task => {
          // Debug-Ausgabe für die Tasks in der Liste
          console.debug(`TasksList ${task.id}: ${task.imageUrls?.length || 0} Bilder, Format:`, 
                    task.imageUrls?.length > 0 ? task.imageUrls[0].substring(0, 50) + '...' : 'keine Bilder');
          
          // Tatsächliche Distanzberechnung mittels Haversine-Formel
          let calculatedDistance = 0;
          if (userLocation.lat !== 0 && userLocation.lng !== 0 && task.location) {
            // Stelle sicher, dass Standortdaten vorhanden sind
            calculatedDistance = calculateDistance(userLocation, task.location);
          }
          
          return {
            ...task,
            // Sicherstellen, dass imageUrls immer ein Array ist
            imageUrls: Array.isArray(task.imageUrls) ? task.imageUrls : [],
            // Stellt sicher, dass die Abwärtskompatibilität gewährleistet ist
            imageUrl: task.imageUrl || (Array.isArray(task.imageUrls) && task.imageUrls.length > 0 ? task.imageUrls[0] : null),
            distance: calculatedDistance,
            createdAt: task.createdAt // Ensure we use the Firestore timestamp
          };
        });
        
        setTasks(tasksWithDistance as Task[]);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        toast({
          title: "Fehler",
          description: "Aufgaben konnten nicht geladen werden. Bitte versuchen Sie es später erneut.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, [selectedCategory, toast, profile]);
  
  // Filtern von Aufgaben basierend auf dem Standort und Radius
  useEffect(() => {
    if (userLocation && tasks.length > 0) {
      // Entfernungsfilterung basierend auf dem aktuellen Standort
      const filtered = tasks.filter(task => {
        if (!task.location) return false;
        
        // Berechne die tatsächliche Entfernung mit dem aktuellen userLocation
        const distance = calculateDistance(userLocation, task.location);
        // Aktualisiere die Distanzinformation im Task
        task.distance = distance;
        
        // Gib nur Aufgaben zurück, die innerhalb des eingestellten Radius sind
        return distance <= searchRadius;
      });
      
      setFilteredByDistanceTasks(filtered);
    } else {
      // Wenn kein Standort gesetzt ist, zeige alle Aufgaben
      setFilteredByDistanceTasks(tasks);
    }
  }, [tasks, userLocation, searchRadius]);
  
  // Filter tasks based on search query
  const filteredTasks = filteredByDistanceTasks.filter(task => {
    if (!searchQuery) return true;
    
    return task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           task.description.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  // Handler für Änderungen am Suchradius
  const handleRadiusChange = (radius: number) => {
    setSearchRadius(radius);
  };
  
  const handleCategorySelect = (category: string) => {
    if (category === ALL_TASKS_LABEL) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
    }
  };
  
  const handleSearch = () => {
    // Search is client-side filtering via the filteredTasks computed property
    toast({
      title: "Suche erfolgreich",
      description: searchQuery ? `Suche nach "${searchQuery}"` : "Zeige alle Ergebnisse",
    });
  };
  
  const handleApply = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsApplicationModalOpen(true);
    }
  };
  
  const handleCloseModal = () => {
    setIsApplicationModalOpen(false);
    setSelectedTask(null);
  };
  
  // Function to create test data
  const handleCreateTestData = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Testdaten zu erstellen.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await createTestTasks();
      if (result && result.success) {
        toast({
          title: "Testdaten erstellt",
          description: `${result.count || 0} Testaufgaben wurden erfolgreich erstellt.`
        });
        
        // Reload tasks to show the newly created ones
        const newTasks = await getTasks({});
        setTasks(newTasks.map(task => {
          // Sicherstellen, dass imageUrls immer ein Array ist
          const imageUrls = Array.isArray(task.imageUrls) ? task.imageUrls : [];
          
          // Tatsächliche Distanzberechnung mittels Haversine-Formel
          let calculatedDistance = 0;
          const userLocation = profile?.location || { lat: 0, lng: 0 };
          
          if (userLocation.lat !== 0 && userLocation.lng !== 0 && task.location) {
            // Stelle sicher, dass Standortdaten vorhanden sind
            calculatedDistance = calculateDistance(userLocation, task.location);
          }
          
          return {
            ...task,
            // Sicherstellen, dass imageUrls immer ein Array ist
            imageUrls: imageUrls,
            // Stellt sicher, dass die Abwärtskompatibilität gewährleistet ist
            imageUrl: task.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null),
            distance: calculatedDistance
          };
        }) as Task[]);
      } else {
        toast({
          title: "Fehler",
          description: result && result.message ? result.message : "Testdaten konnten nicht erstellt werden.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test data:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };
  
  // Function to delete recent test tasks
  const handleDeleteRecentTasks = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Testdaten zu löschen.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await deleteRecentTasks(7); // Die letzten 7 Testeinträge löschen
      if (result && result.success) {
        toast({
          title: "Testdaten gelöscht",
          description: result.message || "Testdaten wurden gelöscht."
        });
        
        // Tasks neu laden, um die Änderungen anzuzeigen
        const updatedTasks = await getTasks({});
        setTasks(updatedTasks.map(task => {
          const imageUrls = Array.isArray(task.imageUrls) ? task.imageUrls : [];
          
          // Tatsächliche Distanzberechnung mittels Haversine-Formel
          let calculatedDistance = 0;
          const userLocation = profile?.location || { lat: 0, lng: 0 };
          
          if (userLocation.lat !== 0 && userLocation.lng !== 0 && task.location) {
            // Stelle sicher, dass Standortdaten vorhanden sind
            calculatedDistance = calculateDistance(userLocation, task.location);
          }
          
          return {
            ...task,
            imageUrls: imageUrls,
            imageUrl: task.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null),
            distance: calculatedDistance
          };
        }) as Task[]);
      } else {
        toast({
          title: "Fehler",
          description: result && result.message ? result.message : "Testdaten konnten nicht gelöscht werden."
        });
      }
    } catch (error) {
      console.error("Error deleting test tasks:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten."
      });
    }
  };
  
  // Function to create test users with reviews
  const handleCreateTestUsers = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Testnutzer zu erstellen.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await createTestUsers();
      if (result && result.success) {
        toast({
          title: "Testnutzer erstellt",
          description: result.message || "Testnutzer wurden erfolgreich erstellt."
        });
      } else {
        toast({
          title: "Fehler",
          description: result && result.message ? result.message : "Testnutzer konnten nicht erstellt werden.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test users:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };
  
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto p-4 max-w-5xl">
      {/* Only show "Discover", "My Tasks" is now accessible through the menu */}
      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 className="text-xl font-bold">{t('common.discover')}</h1>
      </div>
      
      <div>
        <h2 className="text-xl font-bold mb-4">{t('tasks.nearbyTasks')}</h2>
        
        {/* Location Selector */}
        <LocationSelector onRadiusChange={handleRadiusChange} />
        
        {/* Search bar and filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex space-x-2 mb-4">
            <div className="flex-1 relative">
              <Input 
                type="text"
                placeholder={t('tasks.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <Button onClick={handleSearch}>
              {t('common.search')}
            </Button>
          </div>
          
          {/* Categories */}
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {getCategoriesWithAll().map(category => (
              <div 
                key={category} 
                className={`flex-shrink-0 px-4 py-2 rounded-full cursor-pointer transition-colors
                          ${selectedCategory === category || (category === ALL_TASKS_LABEL && !selectedCategory)
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                onClick={() => handleCategorySelect(category)}
              >
                {category}
              </div>
            ))}
          </div>
        </div>
        
        {/* Task list with loading state */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden p-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-6 w-1/6 rounded-full" />
                </div>
                <Skeleton className="h-4 w-1/3 mb-4" />
                <Skeleton className="h-16 w-full mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-8 w-1/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.length > 0 ? (
              filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description}
                  category={task.category}
                  creatorName={task.creatorName}
                  creatorId={task.creatorId}
                  creatorPhotoURL={task.creatorPhotoURL}
                  creatorRating={task.creatorRating}
                  createdAt={task.createdAt}
                  distance={task.distance || 0}
                  imageUrl={task.imageUrl}
                  imageUrls={task.imageUrls}
                  price={task.price}
                  commentCount={task.commentCount || 0}
                  onApplyClick={handleApply}
                  timeInfo={task.timeInfo || {
                    isFlexible: true,
                    displayText: "Zeitlich flexibel"
                  }}
                />
              ))
            ) : (
              <div className="text-center py-10">
                <h3 className="text-lg font-medium text-gray-900">Keine passenden Aufgaben gefunden</h3>
                <p className="mt-1 text-gray-500">
                  {searchQuery 
                    ? "Versuchen Sie es mit einem anderen Suchbegriff oder wählen Sie eine andere Kategorie."
                    : "Es gibt derzeit keine Aufgaben in dieser Kategorie."
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Admin tools for testing */}
      {user && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-bold mb-4">Admin-Werkzeuge</h3>
          <div className="flex space-x-4">
            <Button variant="outline" onClick={handleCreateTestData}>
              Testdaten erstellen
            </Button>
            <Button variant="outline" onClick={handleDeleteRecentTasks}>
              Letzte Testaufgaben löschen
            </Button>
            <Button variant="outline" onClick={handleCreateTestUsers}>
              Testnutzer erstellen
            </Button>
          </div>
        </div>
      )}
      
      {/* Application modal */}
      {selectedTask && (
        <TaskApplicationModal
          isOpen={isApplicationModalOpen}
          onClose={handleCloseModal}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          taskCreatorId={selectedTask.creatorId}
          taskCreatorName={selectedTask.creatorName}
        />
      )}
    </div>
  );
};

export default TasksScreen;