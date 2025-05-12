import React from 'react';
import { Link, useLocation } from 'wouter';
import { PlusCircle, User, Search, Bell, ListChecks } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const BottomNavBar = () => {
  const [location] = useLocation();
  const { user, profile } = useAuth();

  if (!user) return null; // Nur anzeigen, wenn ein Benutzer eingeloggt ist

  return (
    <div 
      id="bottom-nav-bar"
      className="fixed bottom-0 left-0 right-0 flex justify-between items-center bg-white shadow-lg border-t border-gray-200 px-3 py-2"
      style={{ 
        zIndex: 999999,
        height: '60px',
        display: 'flex' 
      }}
    >
      {/* Tasks (Browse) */}
      <Link href="/tasks">
        <div className={`flex flex-col items-center cursor-pointer ${location === '/tasks' ? 'text-primary' : 'text-gray-500'}`}>
          <ListChecks className="h-6 w-6" />
          <span className="text-xs mt-1">Tasks</span>
        </div>
      </Link>
      
      {/* Search */}
      <Link href="/tasks?view=search">
        <div className={`flex flex-col items-center cursor-pointer ${location.includes('search') ? 'text-primary' : 'text-gray-500'}`}>
          <Search className="h-6 w-6" />
          <span className="text-xs mt-1">Search</span>
        </div>
      </Link>
      
      {/* Create (Mittig mit Button-Highlight) */}
      <Link href="/create-task">
        <div className="flex flex-col items-center cursor-pointer relative">
          <div className={`rounded-full p-3 bg-primary text-white -mt-6 shadow-md`}>
            <PlusCircle className="h-6 w-6" />
          </div>
          <span className="text-xs mt-1 pt-1">Create</span>
        </div>
      </Link>
      
      {/* Notifications */}
      <Link href="/notifications">
        <div className={`flex flex-col items-center cursor-pointer ${location === '/notifications' ? 'text-primary' : 'text-gray-500'}`}>
          <div className="relative">
            <Bell className="h-6 w-6" />
            <div className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full"></div>
          </div>
          <span className="text-xs mt-1">Alerts</span>
        </div>
      </Link>
      
      {/* Profile */}
      <Link href="/profile">
        <div className={`flex flex-col items-center cursor-pointer ${location === '/profile' ? 'text-primary' : 'text-gray-500'}`}>
          {profile?.photoURL ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile.photoURL} alt={profile.displayName} />
              <AvatarFallback>{profile.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-6 w-6" />
          )}
          <span className="text-xs mt-1">Profile</span>
        </div>
      </Link>
    </div>
  );
};

export default BottomNavBar;