import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { completeTask } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useReview } from '@/context/ReviewContext';

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  userId: string;
  taskTitle: string;
}

export default function ReviewDialog({
  isOpen,
  onClose,
  taskId,
  userId,
  taskTitle
}: ReviewDialogProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const reviewContext = useReview();
  
  const handleStarClick = (value: number) => {
    setRating(value);
  };
  
  const handleSubmit = async () => {
    if (!user) return;
    
    try {
      setSubmitting(true);
      
      // Aufgabe abschließen und Bewertung speichern
      await completeTask(taskId, rating, review);
      
      // Event über den ReviewContext senden
      if (user.id) {
        reviewContext.notifyReviewSubmitted(taskId, user.id);
      }
      
      toast({
        title: t('review.success'),
        description: t('review.successDescription'),
      });
      
      onClose();
    } catch (error) {
      console.error('Fehler beim Senden der Bewertung:', error);
      toast({
        title: t('review.error'),
        description: t('review.errorDescription'),
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('review.leaveReview')}</DialogTitle>
          <DialogDescription>
            {t('review.rateExperience')}: {taskTitle}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center justify-center space-x-1 mb-4">
            {[1, 2, 3, 4, 5].map((value) => (
              <button 
                key={value}
                type="button"
                onClick={() => handleStarClick(value)}
                className="focus:outline-none"
              >
                <Star 
                  className={`w-8 h-8 ${
                    value <= rating 
                      ? 'text-yellow-400 fill-yellow-400' 
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          
          <Textarea
            placeholder={t('review.shareFeedback')}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            className="w-full h-32 resize-none"
          />
        </div>
        
        <DialogFooter className="flex space-x-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('general.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('general.submitting') : t('review.submitReview')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}