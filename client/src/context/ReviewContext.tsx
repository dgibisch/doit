import React, { createContext, useContext, useState, useCallback } from 'react';

// Define the context type
export interface ReviewContextType {
  // Review modal state
  isReviewModalOpen: boolean;
  reviewData: any | null;
  
  // Methods for review modal
  openReviewModal: (data: any) => void;
  closeReviewModal: () => void;
  
  // Event notification system for reviews
  notifyReviewSubmitted: (taskId: string, reviewerId: string) => void;
  onReviewSubmitted: (callback: (taskId: string, reviewerId: string) => void) => () => void;
}

// Create the context with a default value
const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

// Custom hook for using the review context
export const useReview = (): ReviewContextType => {
  const context = useContext(ReviewContext);
  if (context === undefined) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
};

// Props type for the provider component
interface ReviewProviderProps {
  children: React.ReactNode;
}

// Provider component
export const ReviewProvider: React.FC<ReviewProviderProps> = ({ children }) => {
  // State for review modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState<any | null>(null);
  
  // Event listeners for review submission
  const [reviewListeners, setReviewListeners] = useState<((taskId: string, reviewerId: string) => void)[]>([]);
  
  // Open the review modal
  const openReviewModal = useCallback((data: any) => {
    setReviewData(data);
    setIsReviewModalOpen(true);
  }, []);
  
  // Close the review modal
  const closeReviewModal = useCallback(() => {
    setIsReviewModalOpen(false);
    setReviewData(null);
  }, []);
  
  // Register a callback for review submission events
  const onReviewSubmitted = useCallback((callback: (taskId: string, reviewerId: string) => void) => {
    setReviewListeners(prev => [...prev, callback]);
    
    // Return unsubscribe function
    return () => {
      setReviewListeners(prev => prev.filter(listener => listener !== callback));
    };
  }, []);
  
  // Trigger review submitted event
  const notifyReviewSubmitted = useCallback((taskId: string, reviewerId: string) => {
    // Notify all listeners
    reviewListeners.forEach(listener => listener(taskId, reviewerId));
  }, [reviewListeners]);
  
  // Create the context value
  const value: ReviewContextType = {
    isReviewModalOpen,
    reviewData,
    openReviewModal,
    closeReviewModal,
    onReviewSubmitted,
    notifyReviewSubmitted
  };
  
  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
};