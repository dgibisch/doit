import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { getUserProfile, getTasks, getUserReviews, updateTask } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Star, StarHalf, MessageSquare, Briefcase, User, ArrowLeft, Edit, Check, X } from 'lucide-react';
import UserRatings from '@/components/UserRatings';
import TaskImage from '@/components/TaskImage';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import { getCategoryColor } from '@/lib/categories';
import { getUserLevel, getLevelProgress } from '@/utils/levelSystem';
import { useNavigation } from '@/hooks/use-navigation';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';

// Rating stars component
const RatingStars = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <div className="flex">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalfStar && <StarHalf className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="h-5 w-5 text-gray-300" />
      ))}
    </div>
  );
};

// Review component
const Review = ({ 
  authorName, 
  authorPhotoURL, 
  rating, 
  text, 
  date 
}: { 
  authorName: string; 
  authorPhotoURL?: string; 
  rating: number; 
  text: string; 
  date: Date;
}) => (
  <div className="border rounded-lg p-4 mb-4">
    <div className="flex items-center mb-3">
      <Avatar className="h-10 w-10 mr-3">
        <AvatarImage src={authorPhotoURL} alt={authorName} />
        <AvatarFallback>{authorName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div>
        <div className="font-semibold">{authorName}</div>
        <div className="text-sm text-gray-500">{formatDate(date)}</div>
      </div>
      <div className="ml-auto">
        <RatingStars rating={rating} />
      </div>
    </div>
    <p className="text-gray-700">{text}</p>
  </div>
);

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  level?: string;
  completedTasks: number;
  postedTasks: number;
  rating: number;
  ratingCount: number;
  skills: string[];
  bio?: string;
  location?: { lat: number; lng: number };
  joinDate?: Date;
}

interface UserReview {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  rating: number;
  text: string;
  createdAt: Date;
}

interface UserTask {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string;
  createdAt: any;
  status: string;
  requirements?: string;
}

const UserProfileScreen = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { goBack, navigateToTask } = useNavigation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Prüfen, ob es das eigene Profil ist
  const isOwnProfile = !!user && user.id === id;
  const { t } = useTranslation();
  
  // Zustand für Task-Bearbeitung
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTask, setEditedTask] = useState<any>(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Fetch user profile
        const userProfile = await getUserProfile(id);
        if (userProfile) {
          setProfile({
            id,
            displayName: userProfile.displayName || 'Unnamed User',
            email: userProfile.email || '',
            photoURL: userProfile.photoURL,
            level: userProfile.level || 'Neuling',
            completedTasks: userProfile.completedTasks || 0,
            postedTasks: userProfile.postedTasks || 0,
            rating: userProfile.rating || 0,
            ratingCount: userProfile.ratingCount || 0,
            skills: userProfile.skills || [],
            bio: userProfile.bio,
            location: userProfile.location,
            joinDate: userProfile.createdAt ? new Date(userProfile.createdAt) : undefined
          });
          
          // Fetch real user reviews from Firebase
          const userReviews = await getUserReviews(id);
          setReviews(userReviews.map(review => ({
            id: review.id,
            authorId: review.authorId,
            authorName: review.authorName,
            authorPhotoURL: review.authorPhotoURL,
            userId: id,
            taskId: review.taskId,
            taskTitle: review.taskTitle || 'Unbekannte Aufgabe',
            rating: review.rating,
            text: review.text,
            createdAt: review.createdAt instanceof Date 
              ? review.createdAt 
              : review.createdAt?.toDate?.() || new Date()
          })));
          
          // Fetch user's tasks
          const userTasks = await getTasks({ creatorId: id });
          setTasks(userTasks as UserTask[]);
        } else {
          toast({
            title: 'Fehler',
            description: 'Benutzerprofil konnte nicht gefunden werden.',
            variant: 'destructive'
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast({
          title: 'Fehler',
          description: 'Benutzerdaten konnten nicht geladen werden.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [id, toast]);
  
  // Task-Bearbeitungs-Funktionen
  const handleEditClick = (task: UserTask) => {
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
      
      // Lokalen Tasks-State aktualisieren
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, ...editedTask } 
            : task
        )
      );
      
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

  // Funktion zum Aktivieren des Card-Links direkt
  const handleCardClick = (taskId: string) => {
    console.log("Card geklickt, navigiere zu:", `/task/${taskId}`);
    navigateToTask(taskId);
  };

  // Verwenden des neuen Levelsystems für den Fortschrittsbalken
  const calculateLevelProgress = () => {
    if (!profile) return 0;
    return getLevelProgress(profile.completedTasks);
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
  
  if (!profile) {
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
          <Button className="mt-4" onClick={() => goBack('/')}>
            Zurück zur Startseite
          </Button>
        </div>
      </div>
    );
  }
  
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
      
      {/* User profile header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start">
          <Avatar className="h-24 w-24 mb-4 sm:mb-0 sm:mr-6">
            <AvatarImage src={profile.photoURL} alt={profile.displayName} />
            <AvatarFallback className="text-2xl">{profile.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center sm:text-left">
            {/* Bearbeiten-Button nur für eigenes Profil */}
            {isOwnProfile && (
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" className="flex items-center">
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Profil bearbeiten
                </Button>
              </div>
            )}
            <h2 className="text-2xl font-bold mb-1">{profile.displayName}</h2>
            <div className="flex justify-center sm:justify-start items-center mb-4">
              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                {getUserLevel(profile.completedTasks).name}
              </Badge>
              {profile.joinDate && (
                <span className="text-sm text-gray-500 ml-2">
                  Mitglied seit {formatDate(profile.joinDate)}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-primary">{profile.completedTasks}</div>
                <div className="text-sm text-gray-600">Erledigt</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-primary">{profile.postedTasks}</div>
                <div className="text-sm text-gray-600">Erstellt</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="flex justify-center">
                  <span className="text-xl font-bold text-primary mr-1">{profile.rating.toFixed(1)}</span>
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="text-sm text-gray-600">{profile.ratingCount} Bewertungen</div>
              </div>
            </div>
            
            {profile.bio && (
              <div className="mb-4">
                <h3 className="font-semibold mb-1">Über mich</h3>
                <p className="text-gray-700">{profile.bio}</p>
              </div>
            )}
            
            {profile.skills && profile.skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Fähigkeiten</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Level progress */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Level Fortschritt</span>
                <span>{Math.round(calculateLevelProgress())}%</span>
              </div>
              <Progress value={calculateLevelProgress()} className="h-2" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs for reviews and tasks */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <Tabs defaultValue="reviews">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="reviews">
              <MessageSquare className="h-4 w-4 mr-2" />
              Bewertungen
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Briefcase className="h-4 w-4 mr-2" />
              Aufgaben
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="reviews">
            {/* Neue UserRatings-Komponente, die die Bewertungen aus dem ReviewService lädt */}
            <UserRatings userId={id} />
          </TabsContent>
          
          <TabsContent value="tasks">
            {tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map(task => (
                  <Card key={task.id} className="overflow-hidden cursor-pointer" onClick={() => handleCardClick(task.id)}>
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-1/3 h-40">
                        <TaskImage 
                          imageUrl={task.imageUrl} 
                          category={task.category} 
                          title={task.title}
                          className="h-full"
                        />
                      </div>
                      <div className="p-4 flex-1">
                        <CardHeader className="p-0 pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle>{task.title}</CardTitle>
                            <Badge className={getCategoryColor(task.category)}>
                              {task.category}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 pb-2">
                          {editingTaskId === task.id ? (
                            // Bearbeitungsmodus
                            <>
                              <div className="mb-4">
                                <label className="text-sm font-medium mb-1 block">Beschreibung</label>
                                <textarea 
                                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary"
                                  value={editedTask.description}
                                  onChange={(e) => handleInputChange('description', e.target.value)}
                                  rows={3}
                                />
                              </div>
                              
                              <div className="mb-4">
                                <label className="text-sm font-medium mb-1 block">Preis (€)</label>
                                <input 
                                  type="number" 
                                  className="p-2 border rounded-md focus:ring-2 focus:ring-primary w-full"
                                  value={editedTask.price}
                                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                                  min={0}
                                  step={0.5}
                                />
                              </div>
                              
                              <div className="mb-2">
                                <label className="text-sm font-medium mb-1 block">Anforderungen <span className="text-gray-500 text-xs">(optional)</span></label>
                                <textarea 
                                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-primary"
                                  value={editedTask.requirements || ''}
                                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                                  rows={2}
                                  placeholder="Spezielle Anforderungen für diesen Task..."
                                />
                              </div>
                            </>
                          ) : (
                            // Anzeige-Modus
                            <>
                              <p className="text-gray-700 line-clamp-2">{task.description}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                  {task.createdAt ? formatDate(task.createdAt.toDate()) : ''}
                                </div>
                                <div className="text-lg font-bold text-primary">€{task.price}</div>
                              </div>
                            </>
                          )}
                        </CardContent>
                        <div className="mt-2 flex gap-2">
                          {isOwnProfile && (
                            // Nur dem Task-Ersteller die Bearbeiten-Option anzeigen
                            editingTaskId === task.id ? (
                              // Speichern- und Abbrechen-Buttons im Bearbeitungsmodus
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEdit();
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('common.cancel')}
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveChanges(task.id);
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {t('common.save')}
                                </Button>
                              </>
                            ) : (
                              // Bearbeiten-Button im Anzeigemodus
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(task);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Bearbeiten
                              </Button>
                            )
                          )}
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log("Navigiere zu:", `/task/${task.id}`);
                              navigateToTask(task.id);
                            }}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Keine Aufgaben</h3>
                <p className="mt-1 text-gray-500">
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

export default UserProfileScreen;