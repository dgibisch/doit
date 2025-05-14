import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import TaskApplicationModal from '@/components/TaskApplicationModal';
import { getCategoriesWithAll } from '@/lib/categories';
import { getTasks } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { createTestTasks } from '@/utils/testData';
import { Timestamp } from 'firebase/firestore';
import TaskFilterBar, { TaskFilters } from '@/components/tasks/TaskFilterBar';
import TaskList from '@/components/tasks/TaskList';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import PullToRefresh from 'react-pull-to-refresh';

// Task data type definition
interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  creatorName: string;
  creatorId: string;
  createdAt: Timestamp;
  price: number;
  status: string;
  imageUrl?: string;
  location?: {
    coordinates: {
      lat: number;
      lng: number;
    };
    address?: string;
    city?: string;
  };
  locationCoordinates?: { 
    lat: number; 
    lng: number;
  };
  distance?: number; // Calculated based on user location compared to task location
}

// Get category color
const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    'Gardening': 'bg-green-100 text-green-800',
    'Errands': 'bg-blue-100 text-blue-800',
    'Technology': 'bg-purple-100 text-purple-800',
    'Home Repair': 'bg-yellow-100 text-yellow-800',
    'Pet Care': 'bg-pink-100 text-pink-800',
    'Delivery': 'bg-orange-100 text-orange-800',
    'Cleaning': 'bg-cyan-100 text-cyan-800',
    'Other': 'bg-gray-100 text-gray-800',
    // German categories
    'Gartenarbeit': 'bg-green-100 text-green-800',
    'Besorgungen': 'bg-blue-100 text-blue-800',
    'Technologie': 'bg-purple-100 text-purple-800',
    'Heimwerken': 'bg-yellow-100 text-yellow-800',
    'Tierpflege': 'bg-pink-100 text-pink-800',
    'Lieferung': 'bg-orange-100 text-orange-800',
    'Reinigung': 'bg-cyan-100 text-cyan-800',
    'Sonstiges': 'bg-gray-100 text-gray-800',
  };
  
  return colorMap[category] || 'bg-gray-100 text-gray-800';
};

// Format date function (simplified)
const formatDate = (date: Date | Timestamp): string => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : date.toDate();
  return d.toLocaleDateString();
};

export default function TasksScreen() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // State variables
  const [selectedCategory, setSelectedCategory] = useState('All Tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories] = useState(() => getCategoriesWithAll());
  
  // Filters-related state
  const [filters, setFilters] = useState<TaskFilters>({
    query: '',
    category: '',
    maxDistance: 50,
    minPrice: 0,
    maxPrice: 1000,
    sortBy: 'newest',
  });
  
  // Selected task for application modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  
  // Benutzerstandort für Entfernungsberechnung und -filterung
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { t } = useTranslation();
  
  // Funktion zum Aktualisieren der Aufgaben beim Pull-to-Refresh
  const handleRefresh = useCallback(async (): Promise<void> => {
    toast({
      title: t('tasks.refreshing'),
      description: t('tasks.refreshingDescription') || 'Daten werden aktualisiert...',
    });
    try {
      await fetchTasks();
      toast({
        title: t('tasks.refreshed'),
        description: t('tasks.refreshedDescription') || 'Daten wurden aktualisiert',
      });
      return Promise.resolve();
    } catch (error) {
      console.error('Error refreshing tasks:', error);
      toast({
        title: t('tasks.refreshError'),
        description: t('tasks.refreshErrorDescription') || 'Fehler beim Aktualisieren',
        variant: 'destructive'
      });
      return Promise.reject(error);
    }
  }, [toast, t]);

  // Funktion zum Abrufen von Aufgaben - mit useCallback optimiert
  const fetchTasks = useCallback(async (categoryFilter?: string) => {
    setLoading(true);
    try {
      // Filter-Objekt basierend auf der ausgewählten Kategorie erstellen
      const queryFilters: Record<string, any> = {};
      if (categoryFilter && categoryFilter !== 'All Tasks') {
        queryFilters.category = categoryFilter;
      }
      
      // Aufgaben von Firebase abrufen
      const taskData = await getTasks(queryFilters);
      
      // Entfernungsberechnung hinzufügen (in Produktion basierend auf dem Benutzerstandort)
      const tasksWithDistance = taskData.map(task => {
        // Echte Entfernungsberechnung, wenn Standortdaten vorhanden sind
        let distance = 0;
        
        // Typ-Cast zu Task und prüfe auf Standortinformationen
        const taskTyped = task as Task;
        if (userLocation) {
          // Prüfe, ob es locationCoordinates gibt
          if (taskTyped.locationCoordinates) {
            distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              taskTyped.locationCoordinates.lat,
              taskTyped.locationCoordinates.lng
            );
          } 
          // Prüfe, ob es location.coordinates gibt (neue Struktur)
          else if (typeof taskTyped.location === 'object' && taskTyped.location?.coordinates) {
            distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              taskTyped.location.coordinates.lat,
              taskTyped.location.coordinates.lng
            );
          }
        } else {
          // Fallback, wenn keine Standortdaten vorhanden sind
          distance = Math.round(Math.random() * 50) / 10;
        }
        
        // Stelle sicher, dass alle Task-Felder definiert sind
        const taskWithDistance: Task = {
          ...taskTyped,
          distance,
          title: taskTyped.title || '',
          description: taskTyped.description || '',
          category: taskTyped.category || '',
          status: taskTyped.status || 'open',
          price: taskTyped.price || 0,
          creatorId: taskTyped.creatorId || '',
          createdAt: taskTyped.createdAt
        };
        
        return taskWithDistance;
      });
      
      // Cast des Arrays explizit, um TypeScript zufriedenzustellen
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
  }, [userLocation, toast]);
  
  // Aufgaben abrufen, wenn die Komponente gemountet wird oder sich die Kategorie ändert
  useEffect(() => {
    fetchTasks(selectedCategory);
  }, [selectedCategory, fetchTasks]);
  
  // Initiale Geolocation abfragen, wenn der Benutzer eingeloggt ist
  useEffect(() => {
    if (user && !userLocation && navigator.geolocation) {
      // Nutzerstandort abrufen, wenn der Nutzer eingeloggt ist und wir den Standort noch nicht haben
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          // Wenn der Nutzer einen Standort hat, füge diese Information zum Nutzerprofil hinzu
          if (user) {
            // Hier könnte ein API-Call sein, um das Benutzerprofil zu aktualisieren
            console.log("User location set:", latitude, longitude);
          }
        },
        (error) => {
          console.error("Error getting user location:", error);
          // Fallback: Wenn der Benutzer die Standortabfrage ablehnt, setzen wir einen Default-Wert
          // In einem echten Szenario würden wir den Benutzer auffordern, seinen Standort manuell einzugeben
          setUserLocation({ lat: 52.520008, lng: 13.404954 });  // Default: Berlin
        }
      );
    }
  }, [user, userLocation]);

  // Filter und sortiere Aufgaben mit useMemo für bessere Performance
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filter by search query (title or description)
      if (filters.query && !task.title?.toLowerCase().includes(filters.query.toLowerCase()) && 
          !task.description?.toLowerCase().includes(filters.query.toLowerCase())) {
        return false;
      }
      
      // Filter by category
      if (filters.category && filters.category !== 'all' && task.category !== filters.category) {
        return false;
      }
      
      // Filter by price range
      if ((filters.minPrice !== undefined && task.price < filters.minPrice) || 
          (filters.maxPrice !== undefined && task.price > filters.maxPrice)) {
        return false;
      }
      
      // Filter by distance (if both user location and task location are available)
      if (filters.maxDistance !== undefined && 
          userLocation && task.location && task.location.coordinates) {
        // Wir können die vorberechnete Distanz verwenden, falls vorhanden
        const distance = task.distance !== undefined 
          ? task.distance 
          : calculateDistance(
              userLocation.lat, 
              userLocation.lng, 
              task.location.coordinates.lat, 
              task.location.coordinates.lng
            );
        return distance <= filters.maxDistance;
      }
      
      return true;
    }).sort((a, b) => {
      // Sort tasks based on selected sort option
      const sortBy = filters.sortBy || 'date';
      const sortDirection = filters.sortDirection || 'desc';
      
      // Datumsbasierte Sortierung
      if (sortBy === 'date') {
        return sortDirection === 'desc'
          ? b.createdAt.seconds - a.createdAt.seconds // Neueste zuerst
          : a.createdAt.seconds - b.createdAt.seconds; // Älteste zuerst
      }
      
      // Preisbasierte Sortierung
      if (sortBy === 'price') {
        return sortDirection === 'asc'
          ? a.price - b.price // Günstigste zuerst
          : b.price - a.price; // Teuerste zuerst
      }
      
      // Entfernungsbasierte Sortierung (nur wenn Benutzerstandort bekannt ist)
      if (sortBy === 'distance' && userLocation) {
        // Wir können die vorberechnete Distanz verwenden, falls vorhanden
        const distA = a.distance !== undefined 
          ? a.distance 
          : (a.location?.coordinates 
              ? calculateDistance(userLocation.lat, userLocation.lng, a.location.coordinates.lat, a.location.coordinates.lng) 
              : Number.MAX_VALUE);
        
        const distB = b.distance !== undefined 
          ? b.distance 
          : (b.location?.coordinates 
              ? calculateDistance(userLocation.lat, userLocation.lng, b.location.coordinates.lat, b.location.coordinates.lng) 
              : Number.MAX_VALUE);
        
        return distA - distB; // Nächste zuerst ist derzeit die einzige Option
      }
      
      // Standardsortierung (neueste zuerst)
      return b.createdAt.seconds - a.createdAt.seconds;
    });
  }, [tasks, filters, userLocation]);
  
  // Berechnet die Entfernung zwischen zwei Punkten mit der Haversine-Formel
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Erdradius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Entfernung in km
  };
  
  // Hilfsfunktion für die Filter-Änderung
  const handleFiltersChange = useCallback((newFilters: TaskFilters) => {
    setFilters(newFilters);
    
    // Zeige Feedback bei bestimmten Änderungen an
    if (newFilters.maxDistance !== filters.maxDistance) {
      toast({
        title: `Entfernung: ${newFilters.maxDistance} km`,
        description: "Zeige nur Aufgaben in diesem Radius."
      });
    }
  }, [filters.maxDistance, toast]);
  
  // Hilfsfunktion für die Suche
  const handleSearch = useCallback(() => {
    // Aktualisiere die Filter mit der aktuellen Suchanfrage
    const newFilters = { ...filters, query: searchQuery };
    setFilters(newFilters);
    
    toast({
      title: "Suche erfolgreich",
      description: searchQuery ? `Suche nach "${searchQuery}"` : "Zeige alle Ergebnisse",
    });
  }, [filters, searchQuery, toast]);
  
  // Bewerbungsfunktion - mit useCallback optimiert
  const handleApply = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsApplicationModalOpen(true);
    }
  }, [tasks]);
  
  // Modal schließen - mit useCallback optimiert
  const handleCloseModal = useCallback(() => {
    setIsApplicationModalOpen(false);
    setSelectedTask(null);
  }, []);
  
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
      if (result.success) {
        toast({
          title: "Testdaten erstellt",
          description: `Testaufgaben wurden erfolgreich erstellt.`
        });
        
        // Reload tasks to show the newly created ones
        const newTasks = await getTasks({});
        // Typensichere Konvertierung mit Type Assertion
        setTasks(newTasks.map(task => ({
          ...task,
          distance: Math.round(Math.random() * 50) / 10
        } as Task)));
      } else {
        toast({
          title: "Fehler",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test data:", error);
      toast({
        title: "Fehler",
        description: "Testdaten konnten nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };
  

  
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Tabs defaultValue="discover" className="w-full">
        <TabsContent value="discover" className="mt-4">
          <PullToRefresh onRefresh={handleRefresh} distanceToRefresh={80} resistance={2.5}>
            <div className="space-y-4">
            {/* Entfernt die Suchleiste, da sie bereits in der TaskFilterBar vorhanden ist */}
            
            {/* Advanced filter bar */}
            <div className="mb-6">
              <TaskFilterBar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                userLocation={userLocation}
              />
            </div>
            
            {/* Virtualisierte Task-Liste mit optimierter Performance */}
            <div className="space-y-4">
              <TaskList 
                tasks={filteredTasks} 
                userLocation={userLocation}
                onTaskClick={(taskId) => handleApply(taskId)}
                isLoading={loading}
                mode="discover"
              />
            </div>
          </div>
          </PullToRefresh>
        </TabsContent>
        
        <TabsContent value="mytasks" className="mt-4">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Meine Aufgaben</h2>
            
            {/* Tab switcher for own tasks */}
            <Tabs defaultValue="created">
              <TabsList className="mb-4">
                <TabsTrigger value="created">Erstellt</TabsTrigger>
                <TabsTrigger value="applied">Beworben</TabsTrigger>
                <TabsTrigger value="completed">Abgeschlossen</TabsTrigger>
              </TabsList>
              
              <TabsContent value="created">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Meine erstellten Aufgaben</h3>
                  <Button onClick={() => setLocation('/create-task')} variant="default">
                    + Aufgabe erstellen
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {/* Task list will be here, but use mockTasks for now */}
                  {/* This will be replaced with actual user tasks */}
                  {/* We'll use TaskList component here in the future */}
                </div>
              </TabsContent>
              
              <TabsContent value="applied" className="mt-4">
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Tasks that the user has applied to */}
                  {/* Will be replaced with a TaskList component */}
                </div>
              </TabsContent>
              
              <TabsContent value="completed" className="mt-4">
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Completed tasks */}
                  {/* Will be replaced with a TaskList component */}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Test Data Generator - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 border border-gray-200 rounded-md">
          <h3 className="font-bold mb-2">Development Tools</h3>
          <Button onClick={handleCreateTestData} variant="outline">
            Generate Test Tasks
          </Button>
        </div>
      )}
      
      {/* Application Modal */}
      {selectedTask && (
        <TaskApplicationModal
          isOpen={isApplicationModalOpen}
          onClose={handleCloseModal}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          taskCreatorId={selectedTask.creatorId}
          taskCreatorName={selectedTask.creatorName || ''}
        />
      )}
    </div>
  );
}