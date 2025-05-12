import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { reviewService } from "@/lib/review-service";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface UserRatingsProps {
  userId: string;
  compact?: boolean;
}

export default function UserRatings({ userId, compact = false }: UserRatingsProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        if (!userId) return;
        
        setLoading(true);
        const reviewsData = await reviewService.getUserReviews(userId);
        setReviews(reviewsData);
      } catch (err) {
        console.error("Fehler beim Laden der Bewertungen:", err);
        setError("Die Bewertungen konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchReviews();
  }, [userId]);
  
  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Bewertungen</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Fehler</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (reviews.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">Keine Bewertungen</h3>
        <p className="text-gray-500">Dieser Nutzer hat noch keine Bewertungen erhalten.</p>
      </div>
    );
  }
  
  // Kompakte Version für Bewerberauswahl zeigen
  if (compact && reviews.length > 0) {
    const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
    return (
      <div className="flex items-center text-sm">
        <span className="font-medium mr-1">{averageRating.toFixed(1)}</span>
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="text-gray-500 ml-1">({reviews.length})</span>
      </div>
    );
  }
  
  // Vollständige Version
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bewertungen</h3>
        <div className="flex items-center">
          <span className="text-xl font-bold mr-1">
            {reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length}
          </span>
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          <span className="text-sm text-gray-500 ml-1">
            ({reviews.length})
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <div className="flex space-x-1 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star}
                      size={16} 
                      className={`${
                        star <= review.rating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300'
                      }`} 
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600">{review.content}</p>
              </div>
              
              <div className="text-xs text-gray-400">
                {review.createdAt && typeof review.createdAt.toDate === 'function' && (
                  formatDistanceToNow(review.createdAt.toDate(), { 
                    addSuffix: true,
                    locale: de
                  })
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}