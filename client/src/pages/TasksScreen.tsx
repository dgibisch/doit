import { useState, useEffect } from 'react';
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
  distance?: number; // This would be calculated based on user location in a real implementation
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
  };
  
  return colorMap[category] || 'bg-gray-100 text-gray-800';
};

// Format date
const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHr > 0) {
    return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  } else if (diffMin > 0) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

const TasksScreen = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('explore');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<{posted: Task[], applied: Task[], completed: Task[]}>({
    posted: [],
    applied: [],
    completed: []
  });
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
        if (selectedCategory && selectedCategory !== 'All Tasks') {
          filters.category = selectedCategory;
        }
        
        // Fetch tasks from Firebase
        const taskData = await getTasks(filters);
        
        // Add distance calculation (would be based on user location in production)
        const tasksWithDistance = taskData.map(task => ({
          ...task,
          distance: Math.round(Math.random() * 50) / 10, // Mock distance 0-5 km
          createdAt: task.createdAt // Ensure we use the Firestore timestamp
        }));
        
        setTasks(tasksWithDistance);
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
  }, [selectedCategory, toast]);
  
  // Fetch user's tasks when user is authenticated
  useEffect(() => {
    const fetchUserTasks = async () => {
      if (!user) return;
      
      try {
        // In a production app, we would have API endpoints for:
        // 1. Tasks created by the user
        // 2. Tasks the user has applied to
        // 3. Tasks the user has completed
        
        // Using mock data for now, but this would connect to Firebase in production
        const postedTasksData = await getTasks({ creatorId: user.id });
        const appliedTasksData: Task[] = []; // Would come from applications collection
        const completedTasksData: Task[] = []; // Would come from tasks with status=completed
        
        setMyTasks({
          posted: postedTasksData,
          applied: appliedTasksData,
          completed: completedTasksData
        });
      } catch (error) {
        console.error("Error fetching user tasks:", error);
      }
    };
    
    fetchUserTasks();
  }, [user]);
  
  // Filter tasks based on search query
  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    
    return task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           task.description.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  const handleCategorySelect = (category: string) => {
    if (category === 'All Tasks') {
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
      if (result.success) {
        toast({
          title: "Testdaten erstellt",
          description: `${result.count} Testaufgaben wurden erfolgreich erstellt.`
        });
        
        // Reload tasks to show the newly created ones
        const newTasks = await getTasks({});
        setTasks(newTasks.map(task => ({
          ...task,
          distance: Math.round(Math.random() * 50) / 10
        })));
      } else {
        toast({
          title: "Fehler",
          description: result.message || "Testdaten konnten nicht erstellt werden.",
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
  
  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">DoIt</h1>
        <p className="text-gray-600">Die Nachbarschafts-Aufgaben-App</p>
      </div>
      
      <div className="flex justify-end mb-4">
        <Button onClick={() => setLocation('/create-task')}>
          + Aufgabe erstellen
        </Button>
      </div>
      
      <Tabs defaultValue="explore" className="mb-6" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="explore">Entdecken</TabsTrigger>
          <TabsTrigger value="mytasks">Meine Aufgaben</TabsTrigger>
        </TabsList>
        
        <TabsContent value="explore" className="mt-4">
          {/* Wrapper div to isolate ExploreScreen errors */}
          <div>
            <h2 className="text-xl font-bold mb-4">Aufgaben in deiner Nähe</h2>
            
            {/* Search bar */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex space-x-2 mb-4">
                <div className="flex-1 relative">
                  <Input 
                    type="text"
                    placeholder="Suche nach Aufgaben..."
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
                  Suchen
                </Button>
              </div>
              
              {/* Categories */}
              <div className="flex space-x-4 overflow-x-auto pb-2">
                {getCategoriesWithAll().map(category => (
                  <div 
                    key={category} 
                    className={`flex-shrink-0 px-4 py-2 rounded-full cursor-pointer transition-colors
                              ${selectedCategory === category || (category === 'All Tasks' && !selectedCategory)
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
            
            {/* Task list */}
            <div className="space-y-4">
              {filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                  <Card key={task.id} className="overflow-hidden">
                    {task.imageUrl && (
                      <div className="h-48 overflow-hidden">
                        <img 
                          src={task.imageUrl} 
                          alt={task.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{task.title}</CardTitle>
                          <CardDescription className="mt-1">
                            Von {task.creatorName} • {formatDate(task.createdAt)}
                          </CardDescription>
                        </div>
                        <Badge className={getCategoryColor(task.category)}>
                          {task.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-gray-700">
                        {task.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-gray-600 text-sm">{task.distance} km away</span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <div className="text-2xl font-bold text-primary">€{task.price}</div>
                      <Button onClick={() => handleApply(task.id)}>Bewerben</Button>
                    </CardFooter>
                  </Card>
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
          </div>
        </TabsContent>
        
        <TabsContent value="mytasks" className="mt-4">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Meine Aufgaben</h2>
            
            <Tabs defaultValue="posted">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="posted">Erstellt</TabsTrigger>
                <TabsTrigger value="applied">Beworben</TabsTrigger>
                <TabsTrigger value="completed">Abgeschlossen</TabsTrigger>
              </TabsList>
              
              <TabsContent value="posted" className="mt-4">
                <div className="max-w-2xl mx-auto space-y-6">
                  {mockTasks.slice(0, 2).map(task => (
                    <Card key={task.id} className="overflow-hidden">
                      {task.imageUrl && (
                        <div className="h-48 overflow-hidden">
                          <img 
                            src={task.imageUrl} 
                            alt={task.title} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{task.title}</CardTitle>
                            <CardDescription className="mt-1">
                              Erstellt am {formatDate(task.createdAt)}
                            </CardDescription>
                          </div>
                          <Badge className={getCategoryColor(task.category)}>
                            {task.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-gray-700">
                          {task.description}
                        </p>
                        <div className="mt-2">
                          <Badge variant="outline" className="mr-2">3 Bewerbungen</Badge>
                          <Badge variant="outline">Aktiv</Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <div className="text-2xl font-bold text-primary">€{task.price}</div>
                        <Button variant="outline">Bearbeiten</Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                
                {mockTasks.length === 0 && (
                  <div className="text-center py-10">
                    <h3 className="text-lg font-medium text-gray-900">Keine Aufgaben erstellt</h3>
                    <p className="mt-1 text-gray-500">Erstellen Sie Ihre erste Aufgabe</p>
                    <Button onClick={() => setLocation('/create-task')} className="mt-4">
                      + Aufgabe erstellen
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="applied" className="mt-4">
                <div className="max-w-2xl mx-auto space-y-6">
                  {mockTasks.slice(2, 3).map(task => (
                    <Card key={task.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{task.title}</CardTitle>
                            <CardDescription className="mt-1">
                              Von {task.creatorName} • {formatDate(task.createdAt)}
                            </CardDescription>
                          </div>
                          <Badge className={getCategoryColor(task.category)}>
                            {task.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-gray-700">
                          {task.description}
                        </p>
                        <div className="mt-2">
                          <Badge variant="secondary">Bewerbung gesendet</Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <div className="text-2xl font-bold text-primary">€{task.price}</div>
                        <Button variant="outline" onClick={() => setLocation('/chat')}>Nachricht</Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                
                {mockTasks.length === 0 && (
                  <div className="text-center py-10">
                    <h3 className="text-lg font-medium text-gray-900">Keine Bewerbungen</h3>
                    <p className="mt-1 text-gray-500">Bewerben Sie sich auf Aufgaben im Entdecken-Tab</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="mt-4">
                <div className="max-w-2xl mx-auto space-y-6">
                  {mockTasks.slice(3, 4).map(task => (
                    <Card key={task.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{task.title}</CardTitle>
                            <CardDescription className="mt-1">
                              Von {task.creatorName} • Abgeschlossen am {formatDate(new Date(Date.now() - 3600000))}
                            </CardDescription>
                          </div>
                          <Badge className={getCategoryColor(task.category)}>
                            {task.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-gray-700">
                          {task.description}
                        </p>
                        <div className="mt-2">
                          <Badge variant="outline" className="bg-green-100 text-green-800">Abgeschlossen</Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <div className="text-2xl font-bold text-primary">€{task.price}</div>
                        <div className="flex items-center">
                          <span className="mr-2">Bewertung:</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className="h-5 w-5 text-yellow-400 fill-current"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                
                {mockTasks.length === 0 && (
                  <div className="text-center py-10">
                    <h3 className="text-lg font-medium text-gray-900">Keine abgeschlossenen Aufgaben</h3>
                    <p className="mt-1 text-gray-500">Ihre abgeschlossenen Aufgaben werden hier angezeigt</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Application Modal */}
      {selectedTask && (
        <TaskApplicationModal
          isOpen={isApplicationModalOpen}
          onClose={handleCloseModal}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          taskCreatorId={`creator-${selectedTask.id}`} // Mock creator ID
          taskCreatorName={selectedTask.creatorName}
        />
      )}
    </div>
  );
};

export default TasksScreen;