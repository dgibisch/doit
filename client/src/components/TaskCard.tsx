import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { formatDate, formatDistance } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TaskImage from './TaskImage';
import { getCategoryColor } from '@/lib/categories';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UserLink from './UserLink';
import BookmarkButton from './BookmarkButton';
import { MessageSquare, Image as ImageIcon, Clock, Edit, CheckCircle, PencilLine, RefreshCw, ExternalLink, User, Share, Trash2 } from 'lucide-react';
import ImageGallery from '@/components/ImageGallery';
import BookmarkWithBookmarkedState from './BookmarkWithBookmarkedState';
import { taskApplicationService } from '@/lib/task-application-service';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useUserLocation } from '@/context/LocationContext';
import UserAvatar from '@/components/ui/user-avatar';
import { useTranslation } from 'react-i18next';
import UserRatings from '@/components/UserRatings';

/**
 * Verschiedene Anzeigemodi für die TaskCard
 * - discover: Standard-Ansicht wie in der Entdecken-Ansicht
 * - saved: Für die Ansicht gespeicherter Tasks
 * - myTasks: Für die eigenen erstellten Tasks des Nutzers
 * - applications: Für die Ansicht von Tasks, auf die man sich beworben hat
 * - compact: Kompakte Ansicht für eingeschränkten Platz
 */
export type TaskCardMode = 'discover' | 'saved' | 'myTasks' | 'applications' | 'compact' | 'dashboard';

export interface TaskCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  creatorName: string;
  creatorId: string;
  creatorPhotoURL?: string;
  creatorRating?: number;
  createdAt: any; // Firestore timestamp
  distance: number;
  imageUrl?: string;
  imageUrls?: string[]; 
  price?: number;
  commentCount?: number;
  applicantsCount?: number;
  status?: string;
  // Neue Standort-Eigenschaften
  location?: {
    lat: number;
    lng: number;
  };
  area?: string; // Stadtteil oder Gebiet
  address?: string;
  isLocationShared?: boolean;
  timeInfo?: {
    isFlexible: boolean;
    date?: Date | null;
    formattedDate?: string | null;
    timeOfDay?: string | null;
    displayText: string;
  };
  // Callback Funktionen
  onApplyClick?: (taskId: string) => void;
  onEditClick?: (taskId: string) => void;
  onDeleteClick?: (taskId: string) => void;
  // Anzeigemodus
  mode?: TaskCardMode;
  // Custom Action Button
  actionButton?: React.ReactNode;
  // Beliebige zusätzliche Daten pro Anwendungsfall
  extraData?: any;
}

/**
 * Universelle TaskCard Komponente, die in allen Ansichten verwendet werden kann
 * Der Anzeigemodus wird über die mode-Prop gesteuert
 */
const TaskCard: React.FC<TaskCardProps> = ({
  id,
  title,
  description,
  category,
  creatorName,
  creatorId,
  creatorPhotoURL,
  creatorRating = 0,
  createdAt,
  distance,
  imageUrl,
  imageUrls = [],
  price = 0,
  commentCount = 0,
  applicantsCount = 0,
  status = 'open',
  // Standort-Properties mit Standardwerten
  location,
  area,
  address,
  isLocationShared = false,
  timeInfo,
  onApplyClick,
  onEditClick,
  onDeleteClick,
  mode = 'discover',
  actionButton,
  extraData
}) => {
  // Zustand für die Anzeige des vollständigen Textes
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const { userLocation, calculateDistance } = useUserLocation();
  const { t } = useTranslation();
  
  // Bestimme, ob die kompakte oder vollständige Version angezeigt werden soll
  const isCompact = mode === 'compact';
  const isMyTask = mode === 'myTasks';
  const isApplicationMode = mode === 'applications';
  
  // Berechne die tatsächliche Entfernung, wenn Standortdaten vorhanden sind
  const calculatedDistance = location && userLocation ? calculateDistance(location) : distance;
  
  // Prüfen ob der aktuelle Nutzer der Ersteller des Tasks ist
  const currentUserId = auth.currentUser?.uid || '';
  const isCreator = currentUserId === creatorId;
  
  // Zustand für Bewerbungsstatus
  const [hasApplied, setHasApplied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Firestore-Zeitstempel in lesbares Datum umwandeln
  const formattedDate = formatDate(createdAt?.toDate?.() || createdAt);
  const [, setLocation] = useLocation();
  
  // Prüfen, ob sich der Benutzer bereits beworben hat
  useEffect(() => {
    const checkApplicationStatus = async () => {
      try {
        setIsLoading(true);
        const applied = await taskApplicationService.hasUserAppliedForTask(id);
        setHasApplied(applied);
      } catch (error) {
        console.error(t('errors.applicationError'), error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (!isMyTask && id) {
      checkApplicationStatus();
    }
  }, [id, isMyTask, t]);
  
  // Bilder-Array zusammenstellen (Kompatibilität mit älteren Tasks)
  const validImageUrls = Array.isArray(imageUrls) ? imageUrls : [];
  const images = validImageUrls.length > 0 ? validImageUrls : (imageUrl ? [imageUrl] : []);
  const hasMultipleImages = images.length > 1;
  
  // Beschreibungstext kürzen
  const MAX_WORDS = mode === 'compact' ? 10 : 20;
  const words = description.split(/\s+/);
  const isTooLong = words.length > MAX_WORDS;
  const shortDescription = isTooLong ? words.slice(0, MAX_WORDS).join(' ') + '...' : description;
  
  // Event Handler
  const toggleDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  const navigateToDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/task/${id}`);
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditClick) {
      onEditClick(id);
    } else {
      setLocation(`/edit-task/${id}`);
    }
  };
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteClick) {
      onDeleteClick(id);
    }
  };
  
  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Sicherheitsprüfung: Verhindern, dass Benutzer sich auf eigene Tasks bewerben
    if (isCreator) {
      toast({
        title: t('tasks.ownTask'),
        description: t('tasks.cannotApplyToOwnTask'),
        variant: "destructive"
      });
      return;
    }
    
    if (onApplyClick) {
      onApplyClick(id);
    } else {
      setLocation(`/task/${id}`);
    }
  };
  
  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.share?.({
      title: title,
      text: description.substring(0, 100) + '...',
      url: window.location.origin + `/task/${id}`
    }).catch(err => console.error(t('errors.shareError'), err));
  };
  
  // Statusfarbe basierend auf Status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'in progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Wenn der kompakte Modus aktiv ist, zeige eine stark reduzierte Version an
  if (isCompact) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden" onClick={navigateToDetail}>
        <div className="flex">
          {/* Bild (kleinere Version) */}
          <div className="w-1/4 relative">
            <TaskImage 
              imageUrl={images[0]} 
              category={category} 
              title={title} 
              className="h-full object-cover"
            />
          </div>
          
          {/* Inhalt (komprimiert) */}
          <div className="w-3/4 p-3">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-base">{title}</h3>
              <Badge className={getCategoryColor(category) + " text-xs"}>
                {category}
              </Badge>
            </div>
            
            <p className="mt-1 text-sm text-gray-600 line-clamp-1">{shortDescription}</p>
            
            <div className="flex items-center justify-between mt-2">
              <div className="text-primary font-bold">€{price}</div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500">{formattedDate}</div>
                {isMyTask ? (
                  <Button size="sm" variant="ghost" onClick={handleEditClick} className="h-8 px-2">
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                ) : actionButton || (
                  <Button size="sm" onClick={handleApplyClick} className="h-8 px-2">
                    Details
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Standard-Ansicht (voll)
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col" onClick={navigateToDetail}>
      {/* 1. BILD-BEREICH (überspringen, wenn im Applications-Modus) */}
      {!isApplicationMode && (
        <div className="w-full">
          <div className="w-full relative">
            <ImageGallery
              images={images}
              category={category}
              height="small"
              showNavigation={images.length > 1}
            />
            
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center">
                <ImageIcon className="w-3 h-3 mr-1" />
                <span>{t('tasks.imagesCount', { count: images.length })}</span>
              </div>
            )}
            
            {/* Bookmark-Button (außer bei eigenen Tasks) */}
            {mode !== 'myTasks' && (
              <div className="absolute top-2 right-2">
                <BookmarkWithBookmarkedState taskId={id} cornerButton={true} />
              </div>
            )}
            
            {/* Status-Badge für eigene Tasks */}
            {isMyTask && status && (
              <div className="absolute top-2 right-2">
                <Badge className={getStatusColor(status)}>
                  {status}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 2. CONTENT-BEREICH */}
      <div className="w-full p-4">
        {/* Header mit Titel und Kategorie */}
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg">{title}</h3>
          <Badge className={getCategoryColor(category)}>
            {category}
          </Badge>
        </div>
        
        {/* Benutzerinfo mit Avatar, Name und Bewertung */}
        <div className="flex items-center mt-2">
          <UserLink userId={creatorId} type="avatar">
            <UserAvatar 
              user={{
                uid: creatorId,
                photoURL: creatorPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorName)}`,
                displayName: creatorName,
                username: creatorName
              }}
              size={24}
              className="mr-2"
            />
          </UserLink>
          <UserLink userId={creatorId} type="name">
            <span className="text-primary text-sm font-medium">{creatorName}</span>
          </UserLink>
          <div className="ml-2 flex items-center">
            {/* Verwende die UserRatings-Komponente im kompakten Modus */}
            <UserRatings userId={creatorId} compact={true} />
          </div>
          <p className="text-xs text-gray-500 ml-auto">
            {formattedDate}
          </p>
        </div>
        
        {/* Beschreibung */}
        <div className="mt-3 text-gray-700">
          {isExpanded ? (
            <div className="cursor-pointer">
              <p className="whitespace-pre-line">{description}</p>
              <span className="text-primary text-sm font-medium mt-1 inline-block">
                {t('tasks.viewDetails')}
              </span>
            </div>
          ) : (
            <p 
              className="cursor-pointer" 
              onClick={toggleDescription}
            >
              {shortDescription}
              {isTooLong && (
                <span className="text-primary text-sm font-medium ml-1">
                  {t('tasks.readMore')}
                </span>
              )}
            </p>
          )}
        </div>
        
        {/* Meta-Infos (Zeitangabe, Entfernung und Kommentare) */}
        <div className="mt-4 space-y-2">
          {/* Zeitangabe */}
          {timeInfo && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-5 w-5 text-gray-400" />
              <span className="text-sm">{timeInfo.displayText}</span>
            </div>
          )}
          
          {/* Entfernung und Kommentare/Bewerbungen */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-gray-600 text-sm">
                {/* Genaue Adresse nur anzeigen, wenn der Standort freigegeben wurde */}
                {isLocationShared && address ? (
                  address
                ) : (
                  area ? (
                    // Wenn ein Gebiet/Stadtteil verfügbar ist, diesen anzeigen
                    calculatedDistance > 0 ? t('tasks.area', { area, distance: calculatedDistance.toFixed(1) }) : area
                  ) : (
                    // Ansonsten nur die Entfernung anzeigen
                    calculatedDistance > 0 ? t('tasks.kmAway', { distance: calculatedDistance.toFixed(1) }) : t('tasks.noLocation')
                  )
                )}
              </span>
            </div>
            
            {/* Bei eigenen Tasks: Anzahl der Bewerbungen, sonst Kommentare */}
            <div 
              className="flex items-center gap-1 text-gray-600 hover:text-primary cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/task/${id}${isMyTask ? '' : '#comments'}`);
              }}
            >
              {isMyTask ? (
                <>
                  <User className="h-4 w-4" />
                  <span className="text-sm">{t('tasks.applications', { count: applicantsCount })}</span>
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm">{t('tasks.replies', { count: commentCount })}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Interaktionsleiste mit Trennlinie */}
        <div className="pt-4 mt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            {/* Preis links */}
            <div className="text-2xl font-bold text-primary">€{price}</div>
            
            {/* Mittlere Action-Buttons abhängig vom Modus */}
            <div className="flex items-center justify-center gap-6 sm:gap-12">
              {/* Eigene Tasks: Edit, View, Delete */}
              {isMyTask ? (
                <>
                  <button 
                    className="flex flex-col items-center justify-center h-14 text-gray-600 hover:text-primary"
                    onClick={handleEditClick}
                  >
                    <Edit className="h-5 w-5 mb-1.5" />
                    <span className="text-xs font-medium">{t('tasks.edit')}</span>
                  </button>
                  
                  <button 
                    className="flex flex-col items-center justify-center h-14 text-gray-600 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/task/${id}`);
                    }}
                  >
                    <ExternalLink className="h-5 w-5 mb-1.5" />
                    <span className="text-xs font-medium">{t('tasks.view')}</span>
                  </button>
                  
                  <button 
                    className="flex flex-col items-center justify-center h-14 text-red-500 hover:text-red-600"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-5 w-5 mb-1.5" />
                    <span className="text-xs font-medium">{t('tasks.delete')}</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Standard Interaktions-Buttons für Nicht-Eigentümer */}
                  <button 
                    className="flex flex-col items-center justify-center h-14 text-gray-600 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/task/${id}#comments`);
                    }}
                  >
                    <MessageSquare className="h-5 w-5 mb-1.5" />
                    <span className="text-xs font-medium">{t('common.reply')}</span>
                  </button>

                  <div className="flex flex-col items-center justify-center h-14 text-gray-600 hover:text-primary">
                    <BookmarkWithBookmarkedState taskId={id} />
                  </div>

                  <button 
                    className="flex flex-col items-center justify-center h-14 text-gray-600 hover:text-primary"
                    onClick={handleShareClick}
                  >
                    <Share className="h-5 w-5 mb-1.5" />
                    <span className="text-xs font-medium">{t('tasks.share')}</span>
                  </button>
                </>
              )}
            </div>
            
            {/* Rechts: primärer Action-Button */}
            {actionButton || (
              isMyTask || isCreator ? (
                <Button variant="outline" onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/task/${id}`);
                }}>
                  {t('tasks.details')}
                </Button>
              ) : hasApplied ? (
                <Button 
                  variant="outline" 
                  className="flex items-center gap-1" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/task/${id}`);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t('tasks.applied')}
                </Button>
              ) : (
                <Button 
                  onClick={handleApplyClick}
                  disabled={isLoading}
                >
                  {isLoading ? t('common.loading') : t('tasks.apply')}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;