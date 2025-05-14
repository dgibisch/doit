import { useEffect, useState, Suspense, lazy } from 'react';
import { Route, Switch, Link, useLocation } from 'wouter';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Eager-loaded components
import AuthScreen from '@/components/AuthScreen';

// Lazy-loaded components
const AnalyticsDashboard = lazy(() => import('@/pages/AnalyticsDashboard'));
const TasksScreen = lazy(() => import('@/pages/TasksScreen'));
const CreateTaskScreen = lazy(() => import('@/pages/CreateTaskScreen'));
const ProfileScreen = lazy(() => import('@/pages/ProfileScreen'));
const UserProfileScreen = lazy(() => import('@/pages/UserProfileScreen'));
const ModernUserProfileScreen = lazy(() => import('@/pages/ModernUserProfileScreen'));
const ChatScreen = lazy(() => import('@/pages/ChatScreen'));
const NewChatScreen = lazy(() => import('@/pages/NewChatScreen'));
const TaskDetailScreen = lazy(() => import('@/pages/TaskDetailScreen'));
const BookmarkedTasksScreen = lazy(() => import('@/pages/BookmarkedTasksScreen'));
const StorageDebugScreen = lazy(() => import('@/pages/StorageDebugScreen'));
const NotificationsScreen = lazy(() => import('@/pages/NotificationsPage'));
const SearchScreen = lazy(() => import('@/pages/SearchScreen'));
const MyTasksScreen = lazy(() => import('@/pages/MyTasksScreen'));
const SettingsScreen = lazy(() => import('@/pages/SettingsScreen'));
import { Bookmark, Settings, MessageSquare, Bell, User } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { BottomNavProvider } from '@/context/BottomNavContext';
import { LocationProvider } from '@/context/LocationContext';
import { ReviewProvider, useReview } from '@/context/ReviewContext';
import { TranslationProvider } from '@/context/TranslationContext';
import ReviewModal from '@/components/ReviewModal';
import InitialSetupModal from '@/components/InitialSetupModal';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/toaster';
import DirectBottomNav from '@/components/DirectBottomNav';
import MessageBadge from '@/components/MessageBadge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import routes from '@/routes';
import ReviewManager from '@/components/ReviewManager';

/**
 * Komponente, die das ReviewModal mit dem ReviewContext verbindet
 */
function ReviewModalConnector() {
  const { reviewData, isReviewModalOpen, closeReviewModal } = useReview();
  
  if (!reviewData) return null;
  
  return (
    <ReviewModal
      isOpen={isReviewModalOpen}
      onClose={closeReviewModal}
      taskId={reviewData.taskId}
      userId={reviewData.userId}
      userName={reviewData.userName}
      userRole={reviewData.userRole}
    />
  );
}

// Navigation component has been removed

// Home page component
const HomePage = () => {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <h1 className="text-4xl font-bold text-white font-poppins">DoIt</h1>
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to DoIt!</h2>
          <p className="text-gray-600">
            The neighborhood task sharing app
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            className="w-full py-6 rounded-full bg-primary text-white font-bold hover:bg-opacity-90 transform transition hover:scale-105"
            onClick={() => setLocation('/login')}
          >
            Login
          </Button>
          <Button
            variant="outline"
            className="w-full py-6 rounded-full border-secondary text-secondary font-bold hover:bg-secondary hover:text-white transform transition hover:scale-105"
            onClick={() => setLocation('/login')}
          >
            Register
          </Button>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Join our community today and start helping your neighbors!</p>
        </div>
      </div>
    </div>
  )
};

// Route guard for authenticated routes
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [user, loading, setLocation]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : null;
};

// Weiterleitung von Login-Seite zu Tasks, wenn Benutzer bereits angemeldet ist
const LoginRedirect = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Wenn Benutzer bereits eingeloggt ist, zur Tasks-Seite weiterleiten
    if (!loading && user) {
      setLocation('/tasks');
    }
  }, [user, loading, setLocation]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return !user ? <>{children}</> : null;
};

function AppContent() {
  const { user } = useAuth();
  
  // Loading fallback component used for all Suspense boundaries
  const SuspenseFallback = () => <LoadingScreen label="Lade Seite..." />;
  
  return (
    <div className="min-h-screen flex flex-col relative">
      <main className="flex-1 pb-20 md:pb-0">
        <Suspense fallback={<SuspenseFallback />}>
          <Switch>
            <Route path={routes.login}>
              <LoginRedirect>
                <AuthScreen />
              </LoginRedirect>
            </Route>
            
            <Route path={routes.tasks}>
              <PrivateRoute>
                <TasksScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.createTask}>
              <PrivateRoute>
                <CreateTaskScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.profile}>
              <PrivateRoute>
                <ProfileScreen />
              </PrivateRoute>
            </Route>
            
            <Route path="/chat">
              <PrivateRoute>
                <NewChatScreen />
              </PrivateRoute>
            </Route>
            
            <Route path="/chat/:chatId">
              <PrivateRoute>
                <NewChatScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.messages}>
              <PrivateRoute>
                <NewChatScreen />
              </PrivateRoute>
            </Route>

            <Route path={routes.analytics}>
              <AnalyticsDashboard />
            </Route>
            
            <Route path={routes.notifications}>
              <PrivateRoute>
                <NotificationsScreen />
              </PrivateRoute>
            </Route>
            
            <Route path="/task/:id">
              <PrivateRoute>
                <TaskDetailScreen />
              </PrivateRoute>
            </Route>
            
            <Route path="/edit-task/:id">
              <PrivateRoute>
                <TaskDetailScreen editMode={true} />
              </PrivateRoute>
            </Route>

            <Route path={routes.bookmarkedTasks}>
              <PrivateRoute>
                <BookmarkedTasksScreen />
              </PrivateRoute>
            </Route>

            <Route path="/user/:id">
              <PrivateRoute>
                <ModernUserProfileScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.storageConfig}>
              <PrivateRoute>
                <StorageDebugScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.notifications}>
              <PrivateRoute>
                <NotificationsScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.taskSearch}>
              <PrivateRoute>
                <SearchScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.myTasks}>
              <PrivateRoute>
                <MyTasksScreen />
              </PrivateRoute>
            </Route>
            
            <Route path={routes.settings}>
              <PrivateRoute>
                <SettingsScreen />
              </PrivateRoute>
            </Route>
            
            <Route path="/">
              <LoginRedirect>
                <HomePage />
              </LoginRedirect>
            </Route>
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <BottomNavProvider>
          <ReviewProvider>
            {/* Add TranslationProvider to ensure language persistence */}
            <TranslationProvider>
              <AppContent />
              <Toaster />
              <DirectBottomNav />
              {/* ReviewManager monitors completed tasks and displays ratings */}
              <ReviewManager />
              
              {/* Connect ReviewModal with ReviewContext */}
              <ReviewModalConnector />
              
              {/* Initial setup modal for new users */}
              <InitialSetupModal />
            </TranslationProvider>
          </ReviewProvider>
        </BottomNavProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;