import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { formatDistance, formatPrice, timeAgo } from '@/lib/utils';
import { getCategoryImage } from '@/lib/categoryImages';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import TaskApplicationModal from '@/components/TaskApplicationModal';
import { useToast } from '@/hooks/use-toast';

interface TaskDetailModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  createdAt: any; // Timestamp
  creatorId: string;
  creatorName: string;
  creatorPhoto?: string;
  status: 'open' | 'assigned' | 'completed';
  imageUrl?: string;
}

interface Application {
  id: string;
  applicantId: string;
  applicantName: string;
  price: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  chatId?: string;
}

function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'cleaning':
      return 'bg-blue-100 text-blue-800';
    case 'delivery':
      return 'bg-green-100 text-green-800';
    case 'handyman':
      return 'bg-yellow-100 text-yellow-800';
    case 'gardening':
      return 'bg-emerald-100 text-emerald-800';
    case 'tutoring':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ taskId, isOpen, onClose }) => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  // Fetch task data
  useEffect(() => {
    if (!taskId || !isOpen) return;

    const fetchTask = async () => {
      setLoading(true);
      try {
        const taskDoc = await getDoc(doc(db, 'tasks', taskId));
        if (taskDoc.exists()) {
          setTask({ id: taskDoc.id, ...taskDoc.data() } as Task);
        } else {
          toast({
            title: 'Task not found',
            description: 'The task you requested could not be found.',
            variant: 'destructive',
          });
          onClose();
        }
      } catch (error) {
        console.error('Error fetching task:', error);
        toast({
          title: 'Error',
          description: 'There was an error loading the task details.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId, isOpen, onClose, toast]);

  // Check if user has applied
  useEffect(() => {
    if (!taskId || !user?.id || !isOpen) return;

    const checkApplications = async () => {
      try {
        const applicationsRef = collection(db, 'applications');
        const q = query(
          applicationsRef,
          where('taskId', '==', taskId)
        );
        
        const snapshot = await getDocs(q);
        const allApplications = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as Application[];
        
        // If user is the task creator, get all applications
        if (task?.creatorId === user.id) {
          setApplications(allApplications);
        }
        
        // Check if current user has already applied
        const userApplication = allApplications.find(app => app.applicantId === user.id);
        setHasApplied(!!userApplication);
        
      } catch (error) {
        console.error('Error checking applications:', error);
      }
    };

    if (task) {
      checkApplications();
    }
  }, [taskId, user, isOpen, task]);

  const handleApplyClick = () => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'You need to be logged in to apply for tasks.',
        variant: 'destructive',
      });
      return;
    }

    if (hasApplied) {
      toast({
        title: 'Already Applied',
        description: 'You have already applied for this task.',
      });
      return;
    }

    setShowApplicationModal(true);
  };

  const handleChatClick = (chatId: string) => {
    setSelectedChat(chatId);
    setLocation(`/chat/${chatId}`);
    onClose();
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) return null;

  const isCreator = user?.id === task.creatorId;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
            <DialogDescription className="flex items-center mt-1">
              <Badge variant="outline" className={`${getCategoryColor(task.category)}`}>
                {task.category}
              </Badge>
              <span className="text-gray-500 text-sm ml-2">
                Posted {timeAgo(task.createdAt)}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Task image */}
          <div className="w-full h-48 bg-gray-100 rounded-md overflow-hidden mb-4">
            <img 
              src={task.imageUrl || getCategoryImage(task.category)} 
              alt={task.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Task details */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{task.location.address}</span>
              <span className="text-sm text-gray-500">
                ({formatDistance(1000)})
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>{new Date(task.createdAt.toDate()).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span className="font-semibold">{formatPrice(task.price)}</span>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-line">{task.description}</p>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2">Posted By</h3>
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={task.creatorPhoto} />
                  <AvatarFallback>{task.creatorName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{task.creatorName}</p>
                  <p className="text-sm text-gray-500">Task Creator</p>
                </div>
              </div>
            </div>

            {/* If user is the creator, show applications */}
            {isCreator && applications.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2">Applications ({applications.length})</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {applications.map(app => (
                      <div key={app.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between">
                          <div className="font-medium">{app.applicantName}</div>
                          <div className="font-semibold">{formatPrice(app.price)}</div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{app.message}</p>
                        <div className="flex justify-end mt-2">
                          {app.chatId ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleChatClick(app.chatId!)}
                              className="flex items-center"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Chat
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              No Chat Available
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            {!isCreator && (
              <Button 
                onClick={handleApplyClick}
                disabled={hasApplied || task.status !== 'open'}
                className="w-full"
              >
                {hasApplied ? 'Applied' : 'Apply for this Task'}
              </Button>
            )}
            {isCreator && (
              <Button 
                variant="outline"
                onClick={() => setLocation(`/chat`)}
                className="w-full"
              >
                View All Messages
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application modal */}
      {showApplicationModal && (
        <TaskApplicationModal
          isOpen={showApplicationModal}
          onClose={() => setShowApplicationModal(false)}
          taskId={task.id}
          taskTitle={task.title}
          taskCreatorId={task.creatorId}
          taskCreatorName={task.creatorName}
        />
      )}
    </>
  );
};

export default TaskDetailModal;