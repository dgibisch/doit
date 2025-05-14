import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, StarHalf, MessageSquare, Briefcase, ArrowLeft, Edit, Calendar, MapPin, Settings } from 'lucide-react';
import routes from '@/routes';
import { getUserProfileStats } from '@/lib/profileService';
import { updateTask } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigation } from '@/hooks/use-navigation';
import { formatCurrency } from '@/lib/utils';
import { getCategoryColor } from '@/lib/categories';
import TaskImage from '@/components/TaskImage';
import ReviewsList from '@/components/reviews/ReviewsList';

// Rating stars component
const RatingStars = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <div className="flex">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalfStar && <StarHalf className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
      ))}
    </div>
  );
};

// Review component
const ReviewItem = ({ 
  review 
}: { 
  review: any 
}) => {
  const { authorName, authorPhotoURL, rating, content, createdAt, taskTitle } = review;

  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex items-start mb-3">
        <Avatar className="h-10 w-10 mr-3">
          <AvatarImage src={authorPhotoURL} alt={authorName} />
          <AvatarFallback>{authorName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{authorName || 'Anonym'}</div>
          {taskTitle && (
            <div className="text-xs text-gray-500">
              für Aufgabe: {taskTitle}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1 flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {createdAt ? format(createdAt, 'dd. MMM yyyy', { locale: de }) : 'Unbekanntes Datum'}
          </div>
        </div>
        <div className="ml-auto pl-2">
          <RatingStars rating={rating} />
        </div>
      </div>
      <p className="text-gray-700 text-sm">{content || 'Keine Bewertung hinterlassen.'}</p>
    </div>
  );
};

// TaskCard component
const TaskCard = ({ 
  task, 
  isOwner, 
  onEditClick, 
  onTaskClick 
}: { 
  task: any; 
  isOwner: boolean; 
  onEditClick: (task: any) => void; 
  onTaskClick: (taskId: string) => void;
}) => {
  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={() => onTaskClick(task.id)}
    >
      <div className="flex flex-col md:flex-row">
        <div className="md:w-1/3 h-40">
          <TaskImage 
            imageUrl={task.imageUrl} 
            category={task.category} 
            title={task.title}
            className="h-full"
          />
        </div>
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg mb-1 line-clamp-1">{task.title}</h3>
              <Badge 
                variant="outline" 
                className={`${getCategoryColor(task.category)} mb-2`}
              >
                {task.category}
              </Badge>
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {task.description}
              </p>
            </div>
            <div className="text-lg font-bold text-primary">
              {formatCurrency(task.price)}
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <Badge 
              variant="secondary"
              className={
                task.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : 
                task.status === 'matched' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                'bg-gray-100 text-gray-800 border-gray-200'
              }
            >
              {task.status === 'completed' ? 'Abgeschlossen' : 
               task.status === 'matched' ? 'Vergeben' : 'Offen'}
            </Badge>
            
            {isOwner && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick(task);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const ModernUserProfileScreen = () => {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { goBack, navigateToTask } = useNavigation();
  
  // Debug-Output für Parameter
  console.log("URL-Parameter:", params);
  
  // Bestimme die zu ladende User-ID (URL-Parameter oder current user)
  const id = params.id || (user ? user.uid : undefined);
  console.log("Verwendete User-ID für Profil:", id);
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reviews');
  
  // Zustand für Task-Bearbeitung
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTask, setEditedTask] = useState<any>(null);
  
  // Prüfen, ob es das eigene Profil ist
  const isOwnProfile = !!user && user.uid === id;

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!id) return;
      
      // Debug Output
      console.log("Lade Profil für User-ID:", id);
      console.log("Aktueller angemeldeter User:", user?.uid);
      
      try {
        setLoading(true);
        const data = await getUserProfileStats(id);
        console.log("Erhaltene Profildaten:", data);
        setProfileData(data);
      } catch (error) {
        console.error("Fehler beim Laden des Profils:", error);
        toast({
          title: "Fehler",
          description: "Das Profil konnte nicht geladen werden",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [id, toast, user?.uid]);
  
  // Task-Bearbeitungs-Funktionen
  const handleEditClick = (task: any) => {
    setEditingTaskId(task.id);
    setEditedTask({
      ...task,
      price: task.price || 0,
      description: task.description || '',
      requirements: task.requirements || ''
    });
  };
  
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditedTask(null);
  };
  
  const handleInputChange = (field: string, value: any) => {
    setEditedTask({
      ...editedTask,
      [field]: value
    });
  };
  
  const handleSaveChanges = async (taskId: string) => {
    if (!editedTask) return;
    
    try {
      // Task in Firebase aktualisieren
      await updateTask(taskId, editedTask);
      
      // Lokalen State aktualisieren
      setProfileData((prevData: any) => ({
        ...prevData,
        tasks: prevData.tasks.map((task: any) => 
          task.id === taskId ? { ...task, ...editedTask } : task
        )
      }));
      
      // Bearbeitungsmodus beenden
      setEditingTaskId(null);
      setEditedTask(null);
      
      // Erfolgsbenachrichtigung anzeigen
      toast({
        title: "Erfolgreich gespeichert",
        description: "Deine Änderungen wurden erfolgreich gespeichert."
      });
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Tasks:", error);
      toast({
        title: "Fehler",
        description: "Beim Speichern der Änderungen ist ein Fehler aufgetreten. Bitte versuche es erneut.",
        variant: "destructive"
      });
    }
  };
  
  // Funktion zum Aktivieren des Card-Links
  const handleTaskClick = (taskId: string) => {
    navigateToTask(taskId);
  };
  
  const getLevelBadgeColor = (level: string) => {
    if (level.includes('Anfänger')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (level.includes('Helfer')) return 'bg-green-50 text-green-700 border-green-200';
    if (level.includes('Macher')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (level.includes('Profi')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (level.includes('Experte')) return 'bg-red-50 text-red-700 border-red-200';
    if (level.includes('Hero')) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="mr-4"
            onClick={() => goBack()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <Skeleton className="h-8 w-1/3" />
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start">
            <Skeleton className="h-24 w-24 rounded-full mb-4 sm:mb-0 sm:mr-6" />
            <div className="flex-1 text-center sm:text-left">
              <Skeleton className="h-8 w-3/4 mx-auto sm:mx-0 mb-2" />
              <Skeleton className="h-4 w-1/2 mx-auto sm:mx-0 mb-4" />
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <Skeleton className="h-10 w-full mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  if (!profileData) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="mr-4"
            onClick={() => goBack()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-2xl font-bold">Benutzerprofil</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Benutzer nicht gefunden</h2>
          <p>Das angeforderte Benutzerprofil ist nicht verfügbar.</p>
          <Button className="mt-4" onClick={() => goBack()}>
            Zurück
          </Button>
        </div>
      </div>
    );
  }
  
  const { userData, stats, reviews, tasks } = profileData;
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          className="mr-4"
          onClick={() => goBack()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <h1 className="text-2xl font-bold">Benutzerprofil</h1>
        
        {/* Button zum Laden des eigenen Profils, wenn man ein fremdes Profil ansieht */}
        {user && user.uid !== id && (
          <Button 
            variant="outline" 
            className="ml-auto"
            onClick={() => {
              window.location.href = `/profile/${user.uid}`;
            }}
          >
            Mein Profil
          </Button>
        )}
      </div>
      
      {/* User profile header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start">
          <Avatar className="h-24 w-24 mb-4 sm:mb-0 sm:mr-6">
            <AvatarImage src={userData.photoURL} alt={userData.displayName} />
            <AvatarFallback className="text-2xl">{userData.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center sm:text-left">
            {/* Buttons nur für eigenes Profil */}
            {isOwnProfile && (
              <div className="flex justify-end gap-2 mb-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center"
                  onClick={() => window.location.href = routes.settings}
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Einstellungen
                </Button>
                <Button variant="outline" size="sm" className="flex items-center">
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Profil bearbeiten
                </Button>
              </div>
            )}
            <h2 className="text-2xl font-bold mb-1">{userData.displayName}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 mb-4">
              <Badge 
                variant="outline" 
                className={getLevelBadgeColor(stats.currentLevel)}
              >
                {stats.currentLevel}
              </Badge>
              
              {userData.createdAt && (
                <span className="text-sm text-gray-500 flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Mitglied seit {format(userData.createdAt, 'MMM yyyy', { locale: de })}
                </span>
              )}
              
              {userData.location && userData.location.city && (
                <span className="text-sm text-gray-500 flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  {userData.location.city}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-primary">{stats.completedTasks}</div>
                <div className="text-xs text-gray-600">Erledigt</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-primary">{stats.createdTasks}</div>
                <div className="text-xs text-gray-600">Erstellt</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="flex justify-center items-center mb-1">
                  <span className="text-xl font-bold text-primary mr-1">{stats.avgRating}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="text-xs text-gray-600">({stats.totalReviews})</div>
              </div>
            </div>
            
            {userData.bio && (
              <div className="mb-4">
                <h3 className="font-semibold mb-1">Über mich</h3>
                <p className="text-gray-700 text-sm">{userData.bio}</p>
              </div>
            )}
            
            {userData.skills && userData.skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Fähigkeiten</h3>
                <div className="flex flex-wrap gap-2">
                  {userData.skills.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Level progress */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">
                  Level Fortschritt
                  {stats.nextLevel && (
                    <span className="text-xs text-gray-500 font-normal ml-1">
                      (Nächstes: {stats.nextLevel})
                    </span>
                  )}
                </span>
                <span>{stats.levelProgress}%</span>
              </div>
              <Progress value={stats.levelProgress} className="h-2" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs for reviews and tasks */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="reviews" className="flex items-center justify-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Bewertungen
              {reviews.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-gray-100">
                  {reviews.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center justify-center">
              <Briefcase className="h-4 w-4 mr-2" />
              Aufgaben
              {tasks.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-gray-100">
                  {tasks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="reviews">
            {id && <ReviewsList userId={id} />}
          </TabsContent>
          
          <TabsContent value="tasks">
            {tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isOwner={isOwnProfile}
                    onEditClick={handleEditClick}
                    onTaskClick={handleTaskClick}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Keine Aufgaben</h3>
                <p className="text-gray-500 text-sm">
                  Dieser Benutzer hat noch keine Aufgaben erstellt.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ModernUserProfileScreen;