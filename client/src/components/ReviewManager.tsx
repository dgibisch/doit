import { useState, useEffect, useCallback } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc,
  getDoc, 
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import ReviewModal from "./ReviewModal";
import { useToast } from "@/hooks/use-toast";

/**
 * Komponente, die Bewertungen nach Aufgabenabschluss verwaltet
 * 
 * Diese Komponente überwacht abgeschlossene Aufgaben und zeigt
 * automatisch ein Bewertungsmodal an, wenn eine Aufgabe abgeschlossen wurde.
 * 
 * Es unterstützt auch einen manuellen Auslösemechanismus, der über das DOM
 * implementiert ist (review-manager-trigger Element).
 */
export default function ReviewManager() {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const { toast } = useToast();
  
  // Prüft, ob für einen Chat eine Bewertung angezeigt werden soll
  const checkForPendingReviews = useCallback(async (chatId?: string | null) => {
    // Sicherstellen, dass chatId nicht null ist, falls es verwendet wird
    const safeId = chatId || undefined;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      // Suche nach Chats mit showReviewRequest=true
      const chatsRef = collection(db, "chats");
      const q = query(
        chatsRef,
        where("participants", "array-contains", currentUser.uid),
        where("showReviewRequest", "==", true),
        where("isCompletedConfirmed", "==", true)
      );
      
      const chatsSnapshot = await getDocs(q);
      
      if (chatsSnapshot.empty) return;
      
      // Erster Chat mit ausstehender Bewertung
      const chatDoc = chatsSnapshot.docs[0];
      const chatData = chatDoc.data();
      
      // Prüfen, ob der aktuelle Nutzer bereits eine Bewertung für diesen Task abgegeben hat
      const reviewsRef = collection(db, "reviews");
      const reviewQuery = query(
        reviewsRef,
        where("taskId", "==", chatData.taskId),
        where("reviewerId", "==", currentUser.uid)
      );
      
      const reviewsSnapshot = await getDocs(reviewQuery);
      
      // Wenn bereits eine Bewertung abgegeben wurde, entferne die Anfrage
      if (!reviewsSnapshot.empty) {
        await updateDoc(doc(db, "chats", chatDoc.id), {
          showReviewRequest: false,
          updatedAt: serverTimestamp()
        });
        return;
      }
      
      // Task-Details abrufen
      const taskDoc = await getDoc(doc(db, "tasks", chatData.taskId));
      
      if (!taskDoc.exists()) return;
      
      const taskData = taskDoc.data();
      
      // Bestimme, wer bewertet werden soll (der andere Teilnehmer im Chat)
      const otherUserId = chatData.participants.find((id: string) => id !== currentUser.uid);
      
      if (!otherUserId) return;
      
      // Nutzerprofil des zu Bewertenden abrufen
      const userProfileDoc = await getDoc(doc(db, "userProfiles", otherUserId));
      
      if (!userProfileDoc.exists()) return;
      
      const userProfile = userProfileDoc.data();
      
      // Rolle bestimmen (Ersteller oder Bewerber)
      const userRole = otherUserId === chatData.taskCreatorId ? 'creator' : 'applicant';
      
      // Reviewdaten setzen und Modal öffnen
      setReviewData({
        taskId: chatData.taskId,
        taskTitle: taskData.title || chatData.taskTitle,
        userId: otherUserId,
        userName: userProfile.displayName || chatData.participantNames?.[otherUserId] || "Unbekannter Nutzer",
        userRole,
        chatId: chatDoc.id
      });
      
      setReviewModalOpen(true);
    } catch (error) {
      console.error("Fehler beim Prüfen auf ausstehende Bewertungen:", error);
    }
  }, []);
  
  // Bewertungsmodal schließen
  const handleCloseReviewModal = async () => {
    if (reviewData?.chatId) {
      try {
        // Bewertungsanfrage entfernen
        await updateDoc(doc(db, "chats", reviewData.chatId), {
          showReviewRequest: false,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Fehler beim Aktualisieren des Chat-Dokuments:", error);
      }
    }
    
    setReviewModalOpen(false);
    setReviewData(null);
  };
  
  // Manuellen Trigger über DOM-Element überwachen
  useEffect(() => {
    // Funktion zum Überprüfen, ob ein Trigger-Element existiert
    const checkForTriggerElement = () => {
      const triggerElement = document.getElementById('review-manager-trigger');
      if (triggerElement && triggerElement.getAttribute('data-trigger') === 'true') {
        const chatId = triggerElement.getAttribute('data-chat-id');
        console.log('Review manager triggered manually for chat:', chatId);
        checkForPendingReviews(chatId);
      }
    };

    // Mutation Observer für das Überwachen von DOM-Änderungen
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Sicheres Iterieren durch NodeList
          [...mutation.addedNodes].forEach(node => {
            if (node instanceof HTMLElement && node.id === 'review-manager-trigger') {
              checkForTriggerElement();
            }
          });
        }
      }
    });

    // Beobachter starten
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial prüfen
    checkForPendingReviews();
    checkForTriggerElement();
    
    // Echtzeit-Listener für Chatänderungen
    const setupChatListener = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      const chatsRef = collection(db, "chats");
      const q = query(
        chatsRef,
        where("participants", "array-contains", currentUser.uid)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          // Wenn ein Chat aktualisiert wurde und eine Bewertung angezeigt werden soll
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            if (data.showReviewRequest === true && data.isCompletedConfirmed === true) {
              checkForPendingReviews();
            }
          }
        });
      }, (error) => {
        console.error("Fehler beim Überwachen der Chats:", error);
      });
      
      return unsubscribe;
    };
    
    const unsubscribe = setupChatListener();
    
    return () => {
      // Listener entfernen
      observer.disconnect();
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [checkForPendingReviews]);
  
  // ReviewModal nur rendern, wenn Daten vorhanden sind
  return reviewData ? (
    <ReviewModal
      isOpen={reviewModalOpen}
      onClose={handleCloseReviewModal}
      taskId={reviewData.taskId}
      userId={reviewData.userId}
      userName={reviewData.userName}
      userRole={reviewData.userRole}
    />
  ) : null;
}