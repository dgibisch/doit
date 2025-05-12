import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  collection,
  query,
  where,
  getDocs, 
  orderBy
} from 'firebase/firestore';

/**
 * Prüft, ob ein Task für einen Benutzer als Favorit gespeichert ist
 */
export const isTaskBookmarked = async (userId: string, taskId: string): Promise<boolean> => {
  if (!userId || !taskId) return false;
  
  try {
    // Prüfen, ob in userProfiles
    const userProfileRef = doc(db, "userProfiles", userId);
    const userProfileSnap = await getDoc(userProfileRef);
    
    if (userProfileSnap.exists()) {
      const userProfileData = userProfileSnap.data();
      const bookmarkedTasks = userProfileData.bookmarkedTasks || [];
      return bookmarkedTasks.includes(taskId);
    }
    
    // Falls in userProfiles nicht gefunden, prüfe in users
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const bookmarkedTasks = userData.bookmarkedTasks || [];
      return bookmarkedTasks.includes(taskId);
    }
    
    return false;
  } catch (error) {
    console.error("Fehler beim Prüfen des Bookmark-Status:", error);
    return false;
  }
};

/**
 * Fügt einen Task zu den Favoriten hinzu oder entfernt ihn
 */
export const toggleTaskBookmark = async (userId: string, taskId: string): Promise<boolean> => {
  if (!userId || !taskId) return false;
  
  try {
    // Prüfen, ob der Task bereits in Favoriten ist
    const isBookmarked = await isTaskBookmarked(userId, taskId);
    console.log(`Task ${taskId} ist ${isBookmarked ? 'bereits gemerkt' : 'nicht gemerkt'}`);
    
    // Prüfen, ob Benutzer in userProfiles existiert
    const userProfileRef = doc(db, "userProfiles", userId);
    const userProfileSnap = await getDoc(userProfileRef);
    
    if (userProfileSnap.exists()) {
      // In userProfiles speichern
      await updateDoc(userProfileRef, {
        bookmarkedTasks: isBookmarked 
          ? arrayRemove(taskId) 
          : arrayUnion(taskId)
      });
      return !isBookmarked;
    }
    
    // Falls userProfiles nicht existiert, in users speichern
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        bookmarkedTasks: isBookmarked 
          ? arrayRemove(taskId) 
          : arrayUnion(taskId)
      });
      return !isBookmarked;
    }
    
    console.error("Benutzer nicht gefunden");
    return false;
  } catch (error) {
    console.error("Fehler beim Umschalten des Bookmark-Status:", error);
    return false;
  }
};

/**
 * Ruft alle gespeicherten Tasks eines Benutzers ab
 */
export const getBookmarkedTasks = async (userId: string): Promise<any[]> => {
  if (!userId) return [];
  
  try {
    console.log("Lade Lesezeichen für Benutzer:", userId);
    let bookmarkedTaskIds: string[] = [];
    
    // Prüfen, ob in userProfiles
    const userProfileRef = doc(db, "userProfiles", userId);
    const userProfileSnap = await getDoc(userProfileRef);
    
    if (userProfileSnap.exists()) {
      const userProfileData = userProfileSnap.data();
      bookmarkedTaskIds = userProfileData.bookmarkedTasks || [];
      console.log(`Gefundene Lesezeichen in userProfiles: ${bookmarkedTaskIds.length}`);
    } else {
      // Falls in userProfiles nicht gefunden, prüfe in users
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        bookmarkedTaskIds = userData.bookmarkedTasks || [];
        console.log(`Gefundene Lesezeichen in users: ${bookmarkedTaskIds.length}`);
      }
    }
    
    if (bookmarkedTaskIds.length === 0) {
      return [];
    }
    
    // Tasks mit Creator-Infos abrufen
    const tasksData = await Promise.all(
      bookmarkedTaskIds.map(async (taskId: string) => {
        try {
          const taskDoc = await getDoc(doc(db, "tasks", taskId));
          
          if (!taskDoc.exists()) {
            console.log(`Task ${taskId} existiert nicht mehr`);
            return null;
          }
          
          const taskData = taskDoc.data();
          
          // Ersteller-Profil laden
          const creatorId = taskData.creatorId;
          const creatorProfileRef = doc(db, "userProfiles", creatorId);
          const creatorProfileSnap = await getDoc(creatorProfileRef);
          
          let creatorName = taskData.creatorName || 'Unbekannt';
          let creatorPhotoURL = taskData.creatorPhotoURL || '';
          
          if (creatorProfileSnap.exists()) {
            const creatorData = creatorProfileSnap.data();
            creatorName = creatorData.displayName || creatorName;
            creatorPhotoURL = creatorData.photoURL || creatorPhotoURL;
          }
          
          return {
            id: taskId,
            ...taskData,
            creatorName,
            creatorPhotoURL,
            distance: taskData.distance || Math.round(Math.random() * 50) / 10, // Fallback für Distanz
            timeInfo: taskData.timeInfo || {
              isFlexible: true,
              displayText: 'Zeitlich flexibel'
            }
          };
        } catch (error) {
          console.error(`Fehler beim Laden der Aufgabe ${taskId}:`, error);
          return null;
        }
      })
    );
    
    // Entferne null-Einträge (nicht existierende Tasks)
    return tasksData.filter(Boolean);
  } catch (error) {
    console.error("Fehler beim Laden der gespeicherten Aufgaben:", error);
    return [];
  }
};