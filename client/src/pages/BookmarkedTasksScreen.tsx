import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getBookmarkedTasks } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import ImageGallery from '@/components/ImageGallery';
import { getCategoryColor } from '@/lib/categories';
import TaskCard from '@/components/TaskCard';

// Helper to format date
const formatDate = (date: Date) => {
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

const BookmarkedTasksScreen = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    const fetchBookmarkedTasks = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const bookmarkedTasks = await getBookmarkedTasks(user.id);
        
        // Add distance calculation (in a real app, this would be based on user location)
        const tasksWithDistance = bookmarkedTasks.map(task => ({
          ...task,
          distance: Math.round(Math.random() * 50) / 10 // Mock distance 0-5 km
        }));
        
        setTasks(tasksWithDistance);
      } catch (error) {
        console.error('Error fetching bookmarked tasks:', error);
        toast({
          title: 'Fehler',
          description: 'Gemerkte Aufgaben konnten nicht geladen werden.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookmarkedTasks();
  }, [user, toast]);
  
  const handleViewTask = (taskId: string) => {
    setLocation(`/task/${taskId}`);
  };
  
  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          className="mr-4"
          onClick={() => setLocation('/')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <h1 className="text-2xl font-bold">Gemerkte Aufgaben</h1>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full" /> {/* Höhe zurückgesetzt */}
              <CardHeader>
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description}
                  category={task.category}
                  creatorName={task.creatorName}
                  creatorId={task.creatorId}
                  creatorPhotoURL={task.creatorPhotoURL}
                  createdAt={task.createdAt}
                  distance={task.distance}
                  imageUrl={task.imageUrl}
                  imageUrls={task.imageUrls}
                  price={task.price}
                  commentCount={task.commentCount || 0}
                  status={task.status || 'open'}
                  timeInfo={task.timeInfo}
                  mode="saved"
                  onApplyClick={() => handleViewTask(task.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-lg font-medium text-gray-900">Keine gemerkten Aufgaben</h3>
              <p className="mt-1 text-gray-500">
                Sie haben noch keine Aufgaben gemerkt. Sie können Aufgaben merken, indem Sie auf den "Merken"-Button bei einer Aufgabe klicken.
              </p>
              <Button onClick={() => setLocation('/')} className="mt-4">
                Aufgaben entdecken
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookmarkedTasksScreen;