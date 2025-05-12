import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  serverTimestamp, 
  updateDoc 
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Service-Klasse für die Bewertungsfunktionen
 */
export class ReviewService {
  /**
   * Prüft, ob ein Nutzer bereits eine Bewertung für einen Task abgegeben hat
   * 
   * @param taskId Die ID des Tasks
   * @param reviewerId Die ID des Bewertenden
   * @returns true, wenn der Nutzer bereits eine Bewertung abgegeben hat
   */
  async hasUserReviewedTask(taskId: string, reviewerId: string): Promise<boolean> {
    try {
      if (!taskId || !reviewerId) {
        throw new Error("Task-ID und Bewerter-ID sind erforderlich");
      }
      
      const reviewsRef = collection(db, "reviews");
      const q = query(
        reviewsRef, 
        where("taskId", "==", taskId),
        where("reviewerId", "==", reviewerId)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Fehler beim Prüfen auf vorhandene Bewertung:", error);
      throw error;
    }
  }

  /**
   * Erstellt eine neue Bewertung für einen Nutzer
   * 
   * @param taskId Die ID des Tasks
   * @param reviewerId Die ID des Bewertenden (der die Bewertung abgibt)
   * @param userId Die ID des Nutzers, der bewertet wird
   * @param rating Die Bewertung (1-5 Sterne)
   * @param content Der Bewertungstext
   * @returns Die ID der erstellten Bewertung
   */
  async createReview(
    taskId: string,
    reviewerId: string,
    userId: string,
    rating: number,
    content: string
  ): Promise<string> {
    try {
      // Validierung
      if (!taskId || !reviewerId || !userId) {
        throw new Error("Task-ID, Bewerter-ID und Nutzer-ID sind erforderlich");
      }
      
      if (rating < 1 || rating > 5) {
        throw new Error("Die Bewertung muss zwischen 1 und 5 Sternen liegen");
      }
      
      // Prüfen, ob der Nutzer den Task bereits bewertet hat
      const hasReviewed = await this.hasUserReviewedTask(taskId, reviewerId);
      if (hasReviewed) {
        throw new Error("Du hast diesen Task bereits bewertet");
      }
      
      // Neue Bewertung erstellen
      const reviewRef = await addDoc(collection(db, "reviews"), {
        taskId,
        reviewerId,
        userId,
        rating,
        content,
        createdAt: serverTimestamp()
      });
      
      // Nutzerbewertung aktualisieren
      await this.updateUserRating(userId);
      
      return reviewRef.id;
    } catch (error) {
      console.error("Fehler beim Erstellen der Bewertung:", error);
      throw error;
    }
  }
  
  /**
   * Aktualisiert die Bewertung eines Nutzers basierend auf allen abgegebenen Bewertungen
   * 
   * @param userId Die ID des Nutzers
   */
  async updateUserRating(userId: string): Promise<void> {
    try {
      if (!userId) {
        throw new Error("Nutzer-ID ist erforderlich");
      }
      
      // Alle Bewertungen für den Nutzer abrufen
      const reviewsRef = collection(db, "reviews");
      const q = query(reviewsRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      // Bewertungen berechnen
      let totalRating = 0;
      const reviewCount = querySnapshot.size;
      
      // Wenn keine Bewertungen vorhanden sind, beende die Funktion
      if (reviewCount === 0) {
        return;
      }
      
      // Summe der Bewertungen berechnen
      querySnapshot.forEach((reviewDoc) => {
        const reviewData = reviewDoc.data();
        totalRating += reviewData.rating || 0;
      });
      
      // Durchschnittsbewertung berechnen
      const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
      
      // Nutzerprofil abrufen und aktualisieren
      const userProfile = await this.getUserProfile(userId);
      
      if (userProfile) {
        // Nutzerprofile in userProfiles collection aktualisieren
        await updateDoc(doc(db, "userProfiles", userId), {
          rating: averageRating,
          ratingCount: reviewCount,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Nutzerbewertung:", error);
      throw error;
    }
  }
  
  /**
   * Bewertungen für einen Nutzer abrufen
   * 
   * @param userId Die ID des Nutzers
   * @returns Eine Liste aller Bewertungen für den Nutzer
   */
  async getUserReviews(userId: string): Promise<any[]> {
    try {
      if (!userId) {
        throw new Error("Nutzer-ID ist erforderlich");
      }
      
      const reviewsRef = collection(db, "reviews");
      const q = query(reviewsRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      const reviews: any[] = [];
      
      // Bewertungen sammeln
      querySnapshot.forEach((reviewDoc) => {
        reviews.push({
          id: reviewDoc.id,
          ...reviewDoc.data()
        });
      });
      
      return reviews;
    } catch (error) {
      console.error("Fehler beim Abrufen der Nutzerbewertungen:", error);
      throw error;
    }
  }
  
  /**
   * Hilfsfunktion zum Abrufen eines Nutzerprofils
   * 
   * @param userId Die ID des Nutzers
   * @returns Das Nutzerprofil oder null, wenn nicht gefunden
   */
  private async getUserProfile(userId: string): Promise<any | null> {
    try {
      const userProfileRef = doc(db, "userProfiles", userId);
      const userProfileDoc = await getDoc(userProfileRef);
      
      if (userProfileDoc.exists()) {
        return userProfileDoc.data();
      }
      
      return null;
    } catch (error) {
      console.error("Fehler beim Abrufen des Nutzerprofils:", error);
      return null;
    }
  }
}

export const reviewService = new ReviewService();