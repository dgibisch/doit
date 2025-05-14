import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { reviewService } from "@/lib/review-service";
import { auth } from "@/lib/firebase";
import { useReview } from "@/context/ReviewContext";
import { useTranslation } from "react-i18next";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  userId: string;  // ID des zu bewertenden Nutzers
  userName: string; // Name des zu bewertenden Nutzers
  userRole: 'creator' | 'applicant'; // Rolle des zu bewertenden Nutzers
}

export default function ReviewModal({ isOpen, onClose, taskId, userId, userName, userRole }: ReviewModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { toast } = useToast();
  const currentUser = auth.currentUser;
  const { notifyReviewSubmitted } = useReview();
  const { t } = useTranslation();
  
  const handleSubmit = async () => {
    if (!rating) {
      toast({
        title: t('review.ratingRequired'),
        description: t('review.pleaseRateWithStars'),
        variant: "destructive"
      });
      return;
    }
    
    // Kommentar ist optional, daher keine Validierung mehr erforderlich
    
    if (!currentUser) {
      toast({
        title: t('common.error'),
        description: t('review.loginRequired'),
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await reviewService.createReview(
        taskId,
        currentUser.uid,
        userId,
        rating,
        comment
      );
      
      toast({
        title: t('review.success'),
        description: t('review.successDescription'),
      });
      
      // Event auslösen, dass eine Bewertung abgegeben wurde
      notifyReviewSubmitted(taskId, currentUser.uid);
      
      // Zurücksetzen und Modal schließen
      setRating(0);
      setComment("");
      onClose();
    } catch (error: any) {
      console.error("Fehler beim Abgeben der Bewertung:", error);
      toast({
        title: t('review.error'),
        description: error.message || t('review.errorDescription'),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('review.rate')} {userName}</DialogTitle>
          <DialogDescription>
            {userRole === 'creator' 
              ? t('review.satisfactionWithTaskCreator')
              : t('review.satisfactionWithTaskExecution')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Sterne-Bewertung */}
          <div className="flex justify-center space-x-2 mb-6">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="focus:outline-none"
              >
                <Star 
                  size={32} 
                  className={`${
                    value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  } transition-colors`} 
                />
              </button>
            ))}
          </div>
          
          {/* Bewertungstext (optional) */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              {t('review.yourFeedback')}
            </label>
            <Textarea
              id="comment"
              placeholder={t('review.writeComment')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.sending')}
              </>
            ) : (
              t('review.submitReview')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}