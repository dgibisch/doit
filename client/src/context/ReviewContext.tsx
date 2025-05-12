import React, { createContext, useContext, useState, ReactNode } from "react";

// Interface für die Bewertungsdaten
interface ReviewData {
  taskId: string;
  userId: string;  // ID des zu bewertenden Nutzers
  userName: string; // Name des zu bewertenden Nutzers
  userRole: 'creator' | 'applicant'; // Rolle des zu bewertenden Nutzers
  chatId?: string; // Optional: ID des Chats, für den die Bewertung erstellt wird
}

// Interface für den Kontext
interface ReviewContextType {
  // Daten für die Bewertung
  reviewData: ReviewData | null;
  
  // Modaler Dialog öffnen/schließen
  isReviewModalOpen: boolean;
  
  // Funktionen
  openReviewModal: (data: ReviewData) => void;
  closeReviewModal: () => void;
  notifyReviewSubmitted: (taskId: string, reviewerId: string) => void;
  
  // Event Listener
  onReviewSubmitted: (callback: (taskId: string, reviewerId: string) => void) => () => void;
}

// Erstelle den Kontext
const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

// Provider-Komponente
export function ReviewProvider({ children }: { children: ReactNode }) {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewSubmittedListeners, setReviewSubmittedListeners] = useState<
    ((taskId: string, reviewerId: string) => void)[]
  >([]);
  
  // Öffnet das Review-Modal mit den angegebenen Daten
  const openReviewModal = (data: ReviewData) => {
    setReviewData(data);
    setIsReviewModalOpen(true);
  };
  
  // Schließt das Review-Modal
  const closeReviewModal = () => {
    setIsReviewModalOpen(false);
    // Daten mit Verzögerung zurücksetzen, damit die Animation abgeschlossen werden kann
    setTimeout(() => setReviewData(null), 300);
  };
  
  // Benachrichtigt alle Listener über eine abgegebene Bewertung
  const notifyReviewSubmitted = (taskId: string, reviewerId: string) => {
    reviewSubmittedListeners.forEach(listener => {
      try {
        listener(taskId, reviewerId);
      } catch (error) {
        console.error('Error in review submitted listener:', error);
      }
    });
  };
  
  // Registriert einen Listener für abgegebene Bewertungen und gibt eine Funktion zum Entfernen zurück
  const onReviewSubmitted = (callback: (taskId: string, reviewerId: string) => void) => {
    setReviewSubmittedListeners(prev => [...prev, callback]);
    
    // Cleanup-Funktion zum Entfernen des Listeners
    return () => {
      setReviewSubmittedListeners(prev => 
        prev.filter(listener => listener !== callback)
      );
    };
  };
  
  return (
    <ReviewContext.Provider 
      value={{
        reviewData,
        isReviewModalOpen,
        openReviewModal,
        closeReviewModal,
        notifyReviewSubmitted,
        onReviewSubmitted
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

// Hook für den Zugriff auf den Kontext
export function useReview() {
  const context = useContext(ReviewContext);
  
  if (context === undefined) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  
  return context;
}