import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  PlusCircle,
  User,
  Search,
  MessageSquare,
  ListChecks,
  Bell
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useBottomNavContext } from '@/context/BottomNavContext';
import DoItLogo from '@/components/ui/DoItLogo';
import routes, { isPathInSection } from '@/routes';
import { useTranslation } from 'react-i18next';

export interface BottomNavigationProps {
  /**
   * Variante der Navigation
   * - 'default': Standard-Navigation wie bisher
   * - 'fixed': Fest ans untere Bildende angeheftet
   * - 'portal': Wird via Portal direkt im body Element gerendert (für schwierige Layout-Fälle)
   */
  variant?: 'default' | 'fixed' | 'portal';
  
  /**
   * Callback für Task-Klicks
   */
  onTaskClick?: (taskId: string) => void;
  
  /**
   * Definiert die CSS-Klasse für das Wurzelelement
   */
  className?: string;
  
  /**
   * Zeigt/verbirgt das Erstellen-Icon
   */
  showCreateButton?: boolean;
  
  /**
   * Zeigt/verbirgt Benachrichtigungsindikatoren
   */
  showNotifications?: boolean;
}

/**
 * Einheitliche BottomNavigation-Komponente für DoIt
 * 
 * Ersetzt die vorherigen Komponenten BottomNavBar und BottomNavigation
 * Unterstützt verschiedene Darstellungsvarianten und Funktionalitäten.
 */
const BottomNavigation: React.FC<BottomNavigationProps> = ({
  variant = 'default',
  onTaskClick,
  className = '',
  showCreateButton = true,
  showNotifications = true
}) => {
  const [location] = useLocation();
  const { userProfile, user } = useAuth();
  const { isVisible } = useBottomNavContext();
  const { t } = useTranslation();
  
  // Debug-Log für Benachrichtigungen
  useEffect(() => {
    if (userProfile) {
      console.log('BottomNavigation - UserProfile:', {
        unreadNotifications: userProfile.unreadNotifications,
        uid: userProfile.uid
      });
    }
  }, [userProfile?.unreadNotifications]);
  
  // Navigationshöhe für Position und Abstand
  const NAV_HEIGHT = 65; // in Pixeln, inklusive Padding
  
  // Füge Abstand zum Inhalt hinzu, wenn die Navigation angezeigt wird
  useEffect(() => {
    if (variant === 'fixed' || variant === 'portal') {
      const style = document.createElement('style');
      style.id = 'bottom-nav-spacing';
      style.innerHTML = `
        body {
          padding-bottom: ${NAV_HEIGHT}px !important;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        const styleElement = document.getElementById('bottom-nav-spacing');
        if (styleElement) {
          document.head.removeChild(styleElement);
        }
      };
    }
  }, [variant]);
  
  // Navigation-Links werden nur für eingeloggte Benutzer angezeigt oder umgeleitet
  const getHref = (path: string) => {
    return user ? path : '/login';
  };
  
  // Prüft, ob der angegebene Pfad aktiv ist
  const isActive = (path: string | string[]) => {
    if (Array.isArray(path)) {
      return path.some(p => location === p || location.startsWith(p));
    }
    return location === path || location.startsWith(path);
  };
  
  // Falls kein Benutzer eingeloggt ist oder Navigation ausgeblendet werden soll
  if (!user || !isVisible) return null;
  
  // Create-Button (mittig, hervorgehoben)
  const CreateButton = () => (
    <Link href={getHref(routes.createTask)}>
      <div className="flex flex-col items-center cursor-pointer relative">
        <div className="rounded-full p-3 bg-primary text-white -mt-6 shadow-lg transition-transform hover:scale-110">
          {variant === 'default' ? (
            <PlusCircle className="h-6 w-6" />
          ) : (
            <DoItLogo size={28} gradient={true} />
          )}
        </div>
        <span className="text-xs mt-1 pt-1">{t('common.create')}</span>
      </div>
    </Link>
  );
  
  // Navbar Inhalt als gemeinsame Komponente
  const NavContent = () => (
    <>
      {/* Tasks (Browse) */}
      <Link href={getHref(routes.tasks)}>
        <div className={`flex flex-col items-center cursor-pointer ${isPathInSection(location, 'discover') ? 'text-primary' : 'text-gray-500'}`}>
          <ListChecks className="h-6 w-6" />
          <span className="text-xs mt-1">{t('common.discover')}</span>
        </div>
      </Link>
      
      {/* Meine Aufgaben */}
      <Link href={getHref(routes.myTasks)}>
        <div className={`flex flex-col items-center cursor-pointer ${isPathInSection(location, 'myTasks') ? 'text-primary' : 'text-gray-500'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span className="text-xs mt-1">{t('common.myTasks')}</span>
        </div>
      </Link>
      
      {/* Create Button (mittig) */}
      {showCreateButton && <CreateButton />}
      
      {/* Nachrichten / Chat */}
      <Link href={getHref(routes.messages)}>
        <div className={`flex flex-col items-center cursor-pointer ${isPathInSection(location, 'messages') ? 'text-primary' : 'text-gray-500'}`}>
          <MessageSquare className="h-6 w-6" />
          <span className="text-xs mt-1">{t('common.messages')}</span>
        </div>
      </Link>
      
      {/* Benachrichtigungen */}
      <Link href={getHref(routes.notifications)}>
        <div className={`flex flex-col items-center cursor-pointer ${isPathInSection(location, 'notifications') ? 'text-primary' : 'text-gray-500'}`}>
          <div className="relative">
            <Bell className="h-6 w-6" />
            {showNotifications && userProfile && userProfile.unreadNotifications && userProfile.unreadNotifications > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {userProfile.unreadNotifications > 9 ? '9+' : userProfile.unreadNotifications}
              </div>
            )}
          </div>
          <span className="text-xs mt-1">{t('notifications.title')}</span>
        </div>
      </Link>
      
      {/* Profil */}
      <Link href={user ? routes.profile : routes.login}>
        <div className={`flex flex-col items-center cursor-pointer ${isPathInSection(location, 'profile') ? 'text-primary' : 'text-gray-500'}`}>
          {user && userProfile?.photoURL ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
              <AvatarFallback className="text-xs bg-gray-200">
                {userProfile.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-6 w-6" />
          )}
          <span className="text-xs mt-1">{t('common.profile')}</span>
        </div>
      </Link>
    </>
  );
  
  // Navigationsleiste basierend auf der gewählten Variante rendern
  switch (variant) {
    case 'fixed':
      return (
        <nav className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-2 shadow-lg ${className}`}
             style={{ height: `${NAV_HEIGHT}px` }}>
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <NavContent />
          </div>
        </nav>
      );
    
    case 'portal':
      return (
        <div className={`fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-200 flex justify-evenly items-center shadow-lg ${className}`}
             style={{ 
               height: `${NAV_HEIGHT}px`,
               paddingBottom: 'env(safe-area-inset-bottom, 0)'
             }}>
          <NavContent />
        </div>
      );
    
    default:
      return (
        <nav className={`relative bg-white border-t border-gray-200 p-2 ${className}`}>
          <div className="flex items-center justify-between">
            <NavContent />
          </div>
        </nav>
      );
  }
};

export default BottomNavigation;