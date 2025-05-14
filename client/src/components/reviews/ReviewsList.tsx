import React, { useEffect, useState } from 'react';
import { getUserReviews } from '@/lib/firebase';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Star, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

// Review Interface für bessere Typsicherheit
interface FirebaseReview {
  id: string;
  rating: number;
  content?: string;
  text?: string;
  authorId?: string;
  reviewerId?: string;
  taskId?: string;
  taskTitle?: string;
  taskName?: string;
  authorName?: string;
  reviewerName?: string;
  authorPhotoURL?: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

interface ReviewsListProps {
  userId: string;
}

export default function ReviewsList({ userId }: ReviewsListProps) {
  const [reviews, setReviews] = useState<FirebaseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const fetchedReviews = await getUserReviews(userId);
        console.log("Erhaltene Reviews:", fetchedReviews);
        
        // Verarbeite die Bewertungen, um fehlende Eigenschaften zu ergänzen
        const processedReviews = fetchedReviews.map((review: any) => {
          // Debug-Ausgabe für jede Bewertung
          console.log("Review Eigenschaften:", Object.keys(review));
          
          const processedReview: FirebaseReview = {
            ...review,
            id: review.id,
            rating: review.rating || 0,
            // Nutze vorhandenen taskTitle oder den aufgabenbezogenen Text
            taskTitle: review.taskTitle || review.taskName || '',
            // Standardwerte für fehlende Eigenschaften setzen
            authorName: review.authorName || review.reviewerName || 'Unbekannter Benutzer',
            content: review.content || review.text || ''
          };
          
          return processedReview;
        });
        
        setReviews(processedReviews);
      } catch (error) {
        console.error("Fehler beim Laden der Bewertungen:", error);
        // Bei einem Fehler setzen wir die Reviews auf ein leeres Array
        // damit die UI einen leeren Zustand anzeigen kann
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      fetchReviews();
    }
  }, [userId]);
  
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((index) => (
          <div key={index} className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  
  if (reviews.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-gray-400 mb-2">
          <MessageSquare className="h-12 w-12 mx-auto mb-2" />
        </div>
        <div className="text-gray-500">
          {t('profile.noReviewsYet')}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              {review.authorPhotoURL && (
                <img 
                  src={review.authorPhotoURL} 
                  alt={review.authorName || "Reviewer"}
                  className="w-8 h-8 rounded-full mr-2 object-cover"
                />
              )}
              <div>
                <div className="flex items-center mb-1">
                  <div className="flex mr-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star}
                        className={`w-4 h-4 ${
                          star <= review.rating 
                            ? 'text-yellow-400 fill-yellow-400' 
                            : 'text-gray-300'
                        }`} 
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600 ml-1">
                    ({review.rating})
                  </span>
                </div>
                {review.authorName && review.reviewerId && (
                  <a 
                    href={`/user/${review.reviewerId}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {review.authorName}
                  </a>
                )}
                {review.authorName && !review.reviewerId && (
                  <span className="text-sm font-medium">{review.authorName}</span>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-500">
              {review.createdAt ? 
                format(
                  new Date(review.createdAt.seconds * 1000), 
                  'dd. MMMM yyyy', 
                  { locale: i18n.language === 'de' ? de : undefined }
                ) : ''}
            </span>
          </div>
          
          {review.content && (
            <p className="text-gray-700">{review.content}</p>
          )}
          
          {review.taskId && review.taskTitle && (
            <div className="mt-2 text-sm text-gray-500 py-1 px-2 rounded bg-gray-100 inline-block">
              <a 
                href={`/task/${review.taskId}`}
                className="hover:underline text-gray-600"
              >
                {t('review.for')}: {review.taskTitle}
              </a>
            </div>
          )}
          {!(review.taskId && review.taskTitle) && (
            <div className="mt-2 text-sm text-gray-500 py-1 px-2 rounded bg-gray-100 inline-block">
              {review.taskName || ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}