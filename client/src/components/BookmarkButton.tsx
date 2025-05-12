import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { bookmarkTask, removeBookmark, isTaskBookmarked } from '@/lib/firebase';
import { useTranslation } from 'react-i18next';

interface BookmarkButtonProps {
  taskId: string;
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  'data-task-id'?: string;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  taskId,
  variant = 'outline',
  showText = true,
  size = 'default',
  className = '',
  'data-task-id': dataTaskId
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    // Check if task is already bookmarked when component mounts
    const checkBookmarkStatus = async () => {
      if (!user || !user.id) return;
      
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
    if (!user || !user.id) {
      toast({
        title: t('loginRequired'),
        description: t('common.loginRequiredToBookmark'),
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
          title: t('taskRemovedFromBookmarks'),
          description: t('taskRemovedFromBookmarks')
        });
      } else {
        await bookmarkTask(user.id, taskId);
        setIsBookmarked(true);
        toast({
          title: t('taskBookmarked'),
          description: t('taskBookmarked')
        });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: t('error'),
        description: t('bookmarkToggleError'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-xs',
    default: 'h-10 text-sm',
    lg: 'h-11 text-base'
  };

  // We can create an icon-only version to place in a card corner
  if (!showText) {
    return (
      <Button
        variant={variant}
        size="icon"
        className={`${className} p-2 h-8 w-8 rounded-full hover:bg-white/90`}
        onClick={toggleBookmark}
        disabled={isLoading}
        data-task-id={dataTaskId || taskId}
      >
        {isBookmarked ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </Button>
    );
  }

  // Prüfen, ob wir die vertikale Version verwenden (wie im TaskCard angefordert)
  if (className?.includes('flex-col')) {
    return (
      <div 
        className="flex flex-col items-center h-14 justify-center text-gray-600 hover:text-primary cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          toggleBookmark();
        }}
      >
        {isBookmarked ? (
          <BookmarkCheck className="h-5 w-5 mb-1.5" />
        ) : (
          <Bookmark className="h-5 w-5 mb-1.5" />
        )}
        <span className="text-xs font-medium">{isBookmarked ? t('common.bookmarked') : t('common.bookmark')}</span>
      </div>
    );
  }

  // Standard horizontale Version
  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} ${sizeClasses[size]} flex items-center justify-center`}
      onClick={toggleBookmark}
      disabled={isLoading}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-4 w-4 mr-1" />
      ) : (
        <Bookmark className="h-4 w-4 mr-1" />
      )}
      {isBookmarked ? t('common.bookmarked') : t('common.bookmark')}
    </Button>
  );
};

export default BookmarkButton;