import React, { useEffect, useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getUserProfile } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Briefcase, Award, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Hilfsfunktion zum Ermitteln des Benutzerlevels basierend auf abgeschlossenen Aufgaben
const getUserLevel = (completedTasks: number) => {
  if (completedTasks >= 100) return { level: "Local Hero", icon: "🦄", color: "bg-purple-500" };
  if (completedTasks >= 50) return { level: "Task Pro", icon: "🚀", color: "bg-blue-500" };
  if (completedTasks >= 25) return { level: "Task Star", icon: "⭐", color: "bg-yellow-500" };
  if (completedTasks >= 10) return { level: "Reliable Helper", icon: "👍", color: "bg-green-500" };
  if (completedTasks >= 5) return { level: "Helper", icon: "🤝", color: "bg-teal-500" };
  return { level: "Anfänger", icon: "🐣", color: "bg-gray-500" };
};

// Hilfsfunktion zum Berechnen des Fortschritts zum nächsten Level
const getProgressToNextLevel = (completedTasks: number) => {
  if (completedTasks >= 100) return 100; // Maximales Level erreicht
  if (completedTasks >= 50) return ((completedTasks - 50) / 50) * 100;
  if (completedTasks >= 25) return ((completedTasks - 25) / 25) * 100;
  if (completedTasks >= 10) return ((completedTasks - 10) / 15) * 100;
  if (completedTasks >= 5) return ((completedTasks - 5) / 5) * 100;
  return (completedTasks / 5) * 100;
};

const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, isOpen, onClose }) => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      setError(null);
      
      getUserProfile(userId)
        .then(profile => {
          setUserProfile(profile);
          setLoading(false);
        })
        .catch(err => {
          console.error('Fehler beim Laden des Benutzerprofils:', err);
          setError('Profilinformationen konnten nicht geladen werden.');
          setLoading(false);
        });
    }
  }, [userId, isOpen]);

  // Bestimme das Benutzerlevel
  const userLevel = userProfile ? getUserLevel(userProfile.completedTasks || 0) : { level: "", icon: "", color: "" };
  const progressToNextLevel = userProfile ? getProgressToNextLevel(userProfile.completedTasks || 0) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Benutzerprofil</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex flex-col space-y-4 p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center p-4 text-red-500">
            <p>{error}</p>
            <Button 
              variant="outline" 
              onClick={onClose}
              className="mt-4"
            >
              Schließen
            </Button>
          </div>
        ) : userProfile ? (
          <div className="flex flex-col">
            {/* Kopfbereich mit Avatar und Basisdaten */}
            <div className="flex items-start space-x-4 mb-4">
              <Avatar className="h-16 w-16 border-2 border-indigo-100">
                <AvatarImage 
                  src={
                    userProfile.avatarBase64 || 
                    userProfile.avatarUrl || 
                    userProfile.photoURL || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.displayName || 'User')}&background=6366f1&color=fff`
                  }
                  alt={userProfile.displayName || 'Benutzerprofil'} 
                />
                <AvatarFallback>{(userProfile.displayName || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold">{userProfile.displayName}</h3>
                  <Badge 
                    className={`ml-2 ${userLevel.color} text-white`}
                    variant="outline"
                  >
                    {userLevel.icon} {userLevel.level}
                  </Badge>
                </div>
                
                {userProfile.location && (
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <MapPin className="h-3.5 w-3.5 mr-1 text-gray-400" />
                    <span>{userProfile.location}</span>
                  </div>
                )}
                
                {/* Level-Fortschritt */}
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Level-Fortschritt</span>
                    <span>{userProfile.completedTasks || 0} Tasks</span>
                  </div>
                  <Progress value={progressToNextLevel} className="h-2" />
                </div>
              </div>
            </div>
            
            {/* Statistiken */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Bewertung</div>
                <div className="flex items-center justify-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="font-medium">{userProfile.rating?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Erstellt</div>
                <div className="flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-indigo-500 mr-1" />
                  <span className="font-medium">{userProfile.postedTasks || 0}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-md p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Abgeschlossen</div>
                <div className="flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-500 mr-1" />
                  <span className="font-medium">{userProfile.completedTasks || 0}</span>
                </div>
              </div>
            </div>
            
            {/* Bio */}
            {userProfile.bio && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Über mich</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-md p-3">
                  {userProfile.bio}
                </p>
              </div>
            )}
            
            {/* Stärken/Skills (wenn vorhanden) */}
            {userProfile.skills && userProfile.skills.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Fähigkeiten</h4>
                <div className="flex flex-wrap gap-1">
                  {userProfile.skills.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary" className="bg-gray-100">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-4 text-gray-500">
            <p>Keine Daten gefunden.</p>
          </div>
        )}
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;