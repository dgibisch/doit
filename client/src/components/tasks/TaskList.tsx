import React, { useCallback, useMemo } from 'react';
import TaskCard from '@/components/TaskCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

interface TaskListProps {
  tasks: Task[];
  userLocation?: { lat: number; lng: number } | null;
  onTaskClick?: (taskId: string) => void;
  isLoading?: boolean;
  mode?: 'discover' | 'myTasks' | 'applications' | 'saved';
}

export default function TaskList({ 
  tasks, 
  userLocation, 
  onTaskClick,
  isLoading = false,
  mode = 'discover'
}: TaskListProps) {
  const { t } = useTranslation();
  
  // Task-Klick-Handler mit useCallback für verbesserte Performance
  const handleTaskClick = useCallback((taskId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId);
    }
  }, [onTaskClick]);
  
  // Keine Tasks vorhanden -> Leere Ansicht anzeigen
  if (tasks.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-gray-500 mb-2">{t('tasks.noTasksFound')}</p>
        <p className="text-sm text-gray-400">{t('tasks.tryDifferentFilters')}</p>
      </div>
    );
  }
  
  // Render-Content
  const renderContent = () => {
    if (isLoading) {
      // Lade-Skeletons anzeigen
      return Array(3).fill(0).map((_, index) => (
        <div key={`skeleton-${index}`} className="mb-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex gap-4">
              <Skeleton className="h-24 w-24 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          </div>
        </div>
      ));
    }
    
    return tasks.map(task => (
      <div key={task.id} className="mb-4">
        <TaskCard
          id={task.id}
          title={task.title || ""}
          description={task.description || ""}
          category={task.category || ""}
          creatorName={task.creatorName || ""}
          creatorId={task.creatorId || ""}
          creatorPhotoURL={task.creatorPhotoURL}
          creatorRating={task.creatorRating || 0}
          createdAt={task.createdAt}
          distance={task.distance || 0}
          imageUrl={task.imageUrl}
          imageUrls={task.imageUrls}
          price={task.price || 0}
          commentCount={task.commentCount || 0}
          applicantsCount={(task.applicants || []).length}
          status={task.status || "open"}
          location={task.locationCoordinates || 
            (typeof task.location === 'object' && 'coordinates' in task.location ? 
              task.location.coordinates : undefined)}
          area={task.area}
          address={task.address}
          isLocationShared={task.isLocationShared === true}
          timeInfo={typeof task.timeInfo === 'object' ? task.timeInfo : undefined}
          mode={mode}
        />
      </div>
    ));
  };

  return (
    <div className="w-full overflow-auto p-4 pb-24">
      {renderContent()}
    </div>
  );
}