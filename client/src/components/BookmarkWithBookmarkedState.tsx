import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { bookmarkTask, removeBookmark, isTaskBookmarked } from '@/lib/firebase';

interface BookmarkWithBookmarkedStateProps {
  taskId: string;
  cornerButton?: boolean;
}

const BookmarkWithBookmarkedState: React.FC<BookmarkWithBookmarkedStateProps> = ({ 
  taskId, 
  cornerButton = false 
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Beim Laden der Komponente prüfen, ob der Task bereits gemerkt ist
    const checkBookmarkStatus = async () => {
      if (!user) return;
      
      try {
        const status = await isTaskBookmarked(user.id, taskId);
        setIsBookmarked(status);
      } catch (error) {
        console.error('Error checking bookmark status:', error);
      }
    };
    
    checkBookmarkStatus();
  }, [taskId, user]);

  const toggleBookmark = async () => {
    if (!user) {
      toast({
        title: 'Anmeldung erforderlich',
        description: 'Bitte melden Sie sich an, um Aufgaben zu merken.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (isBookmarked) {
        await removeBookmark(user.id, taskId);
        setIsBookmarked(false);
        toast({
          title: 'Lesezeichen entfernt',
          description: 'Die Aufgabe wurde aus Ihren gemerkten Aufgaben entfernt.'
        });
      } else {
        await bookmarkTask(user.id, taskId);
        setIsBookmarked(true);
        toast({
          title: 'Aufgabe gemerkt',
          description: 'Die Aufgabe wurde zu Ihren gemerkten Aufgaben hinzugefügt.'
        });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: 'Fehler',
        description: 'Es gab ein Problem beim Ändern des Lesezeichens.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Button mit Anpassung für die Position (Ecke oder Interaktionsleiste)
  return (
    <button
      className={`flex ${cornerButton ? '' : 'flex-col'} items-center cursor-pointer bg-transparent border-none p-0 disabled:opacity-50`}
      onClick={(e) => {
        e.stopPropagation();
        toggleBookmark();
      }}
      disabled={isLoading}
    >
      {isBookmarked ? (
        <BookmarkCheck 
          className={`${cornerButton ? 'h-5 w-5' : 'h-5 w-5 mb-1.5'} text-primary`} 
        />
      ) : (
        <Bookmark 
          className={`${cornerButton ? 'h-5 w-5' : 'h-5 w-5 mb-1.5'}`} 
        />
      )}
      {!cornerButton && (
        <span className={`text-xs font-medium ${isBookmarked ? 'text-primary' : ''}`}>
          {isBookmarked ? 'Gemerkt' : 'Merken'}
        </span>
      )}
    </button>
  );
};

export default BookmarkWithBookmarkedState;