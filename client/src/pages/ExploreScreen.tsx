import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit, startAfter, doc, getDoc } from 'firebase/firestore';
import TaskCard from '@/components/TaskCard';
import CategoryIcon from '@/components/CategoryIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getCategoriesWithAll, ALL_TASKS_LABEL } from '@/lib/categories';
// Import the test data creator function (for development only)
import { createTestTasks } from '@/utils/testData';

const ExploreScreen = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();

  // Get categories list from centralized categories module
  const categories = getCategoriesWithAll();

  useEffect(() => {
    fetchTasks();
  }, [selectedCategory]);

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);
    setLastVisible(null);
    setHasMore(true);
    
    try {
      // Build the base query
      let tasksQuery;
      
      if (selectedCategory && selectedCategory !== ALL_TASKS_LABEL) {
        console.log(`Filtering by category: ${selectedCategory}`);
        // Create a query with category filter
        // Note: When using multiple inequality filters (like where + orderBy),
        // we need a composite index which should be created in Firebase Console
        tasksQuery = query(
          collection(db, "tasks"),
          where("status", "==", "open"),
          where("category", "==", selectedCategory),
          orderBy("createdAt", "desc"),
          limit(10)
        );
      } else {
        // Query without category filter
        tasksQuery = query(
          collection(db, "tasks"),
          where("status", "==", "open"),
          orderBy("createdAt", "desc"),
          limit(10)
        );
      }

      const snapshot = await getDocs(tasksQuery);
      
      // Get the last document for pagination
      if (!snapshot.empty) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }

      const tasksList = await Promise.all(snapshot.docs.map(async doc => {
        const taskData = doc.data();
        
        // Default values
        let creatorName = taskData.creatorName || 'Unknown User';
        let creatorPhoto = '';
        
        // Try to fetch creator info if available
        try {
          if (taskData.creatorRef) {
            const creatorDoc = await getDoc(taskData.creatorRef);
            if (creatorDoc.exists()) {
              const creatorData = creatorDoc.data();
              // Type assertions to help TypeScript
              const displayName = creatorData?.displayName as string | undefined;
              const photoURL = creatorData?.photoURL as string | undefined;
              
              if (displayName) {
                creatorName = displayName;
              }
              
              if (photoURL) {
                creatorPhoto = photoURL;
              }
            }
          }
        } catch (error) {
          console.error("Error fetching creator info:", error);
        }
        
        // Calculate distance (this would use the user's location in a real app)
        const distance = Math.floor(Math.random() * 5000); // Mock distance in meters
        
        return {
          id: doc.id,
          ...taskData,
          creatorName,
          creatorPhoto,
          distance
        };
      }));

      setTasks(tasksList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Could not load tasks. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreTasks = async () => {
    if (!lastVisible || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      let tasksQuery;
      
      if (selectedCategory && selectedCategory !== ALL_TASKS_LABEL) {
        tasksQuery = query(
          collection(db, "tasks"),
          where("status", "==", "open"),
          where("category", "==", selectedCategory),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(10)
        );
      } else {
        tasksQuery = query(
          collection(db, "tasks"),
          where("status", "==", "open"),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(10)
        );
      }

      const snapshot = await getDocs(tasksQuery);
      
      // Get the last document for pagination
      if (!snapshot.empty) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }

      const tasksList = await Promise.all(snapshot.docs.map(async doc => {
        const taskData = doc.data();
        
        // Default values
        let creatorName = taskData.creatorName || 'Unknown User';
        let creatorPhoto = '';
        
        // Try to fetch creator info if available
        try {
          if (taskData.creatorRef) {
            const creatorDoc = await getDoc(taskData.creatorRef);
            if (creatorDoc.exists()) {
              const creatorData = creatorDoc.data();
              // Type assertions to help TypeScript
              const displayName = creatorData?.displayName as string | undefined;
              const photoURL = creatorData?.photoURL as string | undefined;
              
              if (displayName) {
                creatorName = displayName;
              }
              
              if (photoURL) {
                creatorPhoto = photoURL;
              }
            }
          }
        } catch (error) {
          console.error("Error fetching creator info:", error);
        }
        
        // Calculate distance (this would use the user's location in a real app)
        const distance = Math.floor(Math.random() * 5000); // Mock distance in meters
        
        return {
          id: doc.id,
          ...taskData,
          creatorName,
          creatorPhoto,
          distance
        };
      }));

      setTasks([...tasks, ...tasksList]);
    } catch (error) {
      console.error("Error fetching more tasks:", error);
      toast({
        title: "Error",
        description: "Could not load more tasks. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = () => {
    // This would be implemented with a proper text search solution like Algolia
    // For now, just filter the existing tasks client-side
    if (!searchQuery.trim()) {
      fetchTasks();
      return;
    }

    const filtered = tasks.filter(task => 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setTasks(filtered);
  };

  const handleApplyClick = (taskId: string) => {
    // Open task detail modal through parent component
    // This is handled in App.tsx with the TaskDetailModal component
  };

  // Function to create test data (only for development purposes)
  const handleCreateTestData = async () => {
    try {
      const result = await createTestTasks();
      if (result.success) {
        toast({
          title: "Test Data Created",
          description: `${result.count} test tasks have been created successfully.`,
        });
        // Refresh the tasks list
        fetchTasks();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create test data.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test data:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating test data.",
        variant: "destructive"
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">DoIt</h1>
            <p className="text-xs text-gray-500">Find neighborhood tasks</p>
          </div>
          <div className="flex items-center space-x-2">
            <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <i className="fas fa-bell text-gray-500"></i>
            </button>
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
              <img 
                src={user?.photoURL || "https://via.placeholder.com/100"} 
                alt="Profile" 
                className="w-full h-full object-cover" 
              />
            </div>
          </div>
        </div>
        
        {/* Search & Filter */}
        <div className="mt-3 flex space-x-2">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <i className="fas fa-search absolute left-4 top-3 text-gray-400"></i>
          </div>
          <Button 
            onClick={handleSearch} 
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <i className="fas fa-sliders-h text-gray-600"></i>
          </Button>
        </div>
        
        {/* Categories Tabs */}
        <div className="mt-4 bg-gray-100 rounded-lg p-1 flex overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                if (category === ALL_TASKS_LABEL) {
                  setSelectedCategory(null);
                } else {
                  setSelectedCategory(category);
                }
              }}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                (category === ALL_TASKS_LABEL && !selectedCategory) || 
                selectedCategory === category
                  ? 'bg-white shadow-sm font-medium'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      
      {/* Task List */}
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">Tasks Near You</h2>
        
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
        ) : tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                description={task.description}
                category={task.category}
                creatorName={task.creatorName}
                createdAt={task.createdAt}
                distance={task.distance}
                imageUrl={task.imageUrl}
                onApplyClick={handleApplyClick}
              />
            ))}
            
            {hasMore && (
              <div className="flex justify-center py-4">
                <Button 
                  onClick={fetchMoreTasks} 
                  disabled={loadingMore}
                  variant="outline"
                  className="rounded-full"
                >
                  {loadingMore ? (
                    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin mr-2"></div>
                  ) : (
                    <i className="fas fa-chevron-down mr-2"></i>
                  )}
                  Load More
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">No tasks found</h3>
            <p className="text-gray-500">
              {selectedCategory 
                ? `No ${selectedCategory} tasks available in your area.` 
                : 'No tasks available in your area.'}
            </p>
            
            {/* Show different actions based on if filter is applied */}
            {selectedCategory ? (
              <div className="space-y-2">
                <Button 
                  onClick={() => setSelectedCategory(null)} 
                  className="mt-4 rounded-full"
                  variant="outline"
                >
                  Clear Filter
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Development mode only: Button to create test data */}
                {import.meta.env.DEV && (
                  <Button 
                    onClick={handleCreateTestData} 
                    className="mt-4 rounded-full"
                    variant="secondary"
                  >
                    Create Test Data
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreScreen;