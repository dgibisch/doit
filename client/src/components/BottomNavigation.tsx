import { Link, useLocation } from 'wouter';
import { 
  PlusCircle,
  User,
  Search,
  Bell,
  ListChecks
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';

interface BottomNavigationProps {
  onTaskClick?: (taskId: string) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = () => {
  const [location] = useLocation();
  const { profile, user } = useAuth();
  
  // Navigation-Links werden nur für eingeloggte Benutzer angezeigt oder umgeleitet
  const getHref = (path: string) => {
    return user ? path : '/login';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-2 md:hidden shadow-lg">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Tasks */}
        <Link href={getHref('/tasks')}>
          <div className={`flex flex-col items-center p-1 ${location === '/tasks' ? 'text-primary' : 'text-gray-500'}`}>
            <ListChecks className="h-6 w-6" />
            <span className="text-xs mt-1">Tasks</span>
          </div>
        </Link>
        
        {/* Search */}
        <Link href={getHref('/tasks?view=search')}>
          <div className={`flex flex-col items-center p-1 ${location.includes('search') ? 'text-primary' : 'text-gray-500'}`}>
            <Search className="h-6 w-6" />
            <span className="text-xs mt-1">Search</span>
          </div>
        </Link>
        
        {/* Create */}
        <Link href={getHref('/create-task')}>
          <div className="flex flex-col items-center relative">
            <div className={`rounded-full p-3 ${location === '/create-task' ? 'bg-primary text-white' : 'bg-primary text-white'} -mt-6 shadow-lg transition-transform hover:scale-110`}>
              <PlusCircle className="h-7 w-7" />
            </div>
            <span className="text-xs mt-1 pt-1">Create</span>
          </div>
        </Link>
        
        {/* Notifications */}
        <Link href={getHref('/notifications')}>
          <div className={`flex flex-col items-center p-1 ${location === '/notifications' ? 'text-primary' : 'text-gray-500'}`}>
            <div className="relative">
              <Bell className="h-6 w-6" />
              {user && <div className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full"></div>}
            </div>
            <span className="text-xs mt-1">Alerts</span>
          </div>
        </Link>
        
        {/* Profile */}
        <Link href={user ? '/profile' : '/login'}>
          <div className={`flex flex-col items-center p-1 ${location === '/profile' || location === '/login' ? 'text-primary' : 'text-gray-500'}`}>
            {user ? (
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile?.photoURL} alt={profile?.displayName} />
                <AvatarFallback className="text-xs bg-gray-200">
                  {profile?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-6 w-6" />
            )}
            <span className="text-xs mt-1">Profile</span>
          </div>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigation;