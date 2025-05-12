import { db } from './firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getUserLevel, getLevelProgress } from '@/utils/levelSystem';

// Task-Interfaces für TypeScript
interface TaskApplication {
  userId: string;
  status?: string;
  applicationId?: string;
  chatId?: string;
  timestamp?: any;
  message?: string;
  name?: string;
}

interface FirebaseTask {
  id: string;
  creatorId?: string;
  taskerId?: string;
  status?: string;
  applications?: Record<string, TaskApplication> | TaskApplication[];
  [key: string]: any; // Für andere Felder
}

interface FirebaseReview {
  id: string;
  rating?: number;
  content?: string;
  text?: string;
  authorId?: string;
  reviewerId?: string;
  taskId?: string;
  taskTitle?: string;
  authorName?: string;
  authorPhotoURL?: string;
  createdAt?: any;
  [key: string]: any; // Für andere Felder
}

interface FirebaseUser {
  displayName?: string;
  photoURL?: string;
  avatarUrl?: string;
  avatarBase64?: string;
  createdAt?: any;
  [key: string]: any; // Für andere Felder
}

/**
 * Holt vollständige Profilstatistiken für einen Benutzer
 */
export const getUserProfileStats = async (userId: string) => {
  try {
    console.log("ProfileService: Starte Abfrage für User-ID:", userId);
    
    // Benutzergrundprofil abrufen
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error("Benutzerprofil nicht gefunden");
    }
    
    const userData = userSnap.data();
    
    // Überprüfe, ob auch ein userProfile-Datensatz existiert
    // Dies ist ein Legacy-Check, da die App Daten in zwei Sammlungen speichert
    let userProfileData: FirebaseUser = {};
    try {
      const userProfileRef = doc(db, "userProfiles", userId);
      const userProfileSnap = await getDoc(userProfileRef);
      if (userProfileSnap.exists()) {
        userProfileData = userProfileSnap.data() as FirebaseUser;
      }
    } catch (error) {
      console.warn("Kein userProfile-Dokument gefunden:", error);
    }
    
    // Daten aus beiden Quellen zusammenführen
    const mergedUserData: FirebaseUser = {
      ...userData as FirebaseUser,
      ...userProfileData
    };
    
    // Tasks des Benutzers abrufen (sowohl erstellte als auch erledigte)
    const tasksRef = collection(db, "tasks");
    
    // Erstellte Tasks
    const createdTasksQuery = query(
      tasksRef, 
      where("creatorId", "==", userId)
    );
    const createdTasksSnap = await getDocs(createdTasksQuery);
    const createdTasks: FirebaseTask[] = createdTasksSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Erledigte Tasks (wo der Benutzer der ausgewählte Tasker war)
    const completedTasksQuery = query(
      tasksRef,
      where("taskerId", "==", userId),
      where("status", "==", "completed")
    );
    const completedTasksSnap = await getDocs(completedTasksQuery);
    const completedAsTaskerTasks: FirebaseTask[] = completedTasksSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Alternative Abfrage nach abgeschlossenen Tasks, wo der Benutzer beteiligt war
    // Dies ist ein Fallback für ältere Datensätze, die möglicherweise anders strukturiert sind
    const completedTasksAltQuery = query(
      tasksRef,
      where("status", "==", "completed")
    );
    const completedTasksAltSnap = await getDocs(completedTasksAltQuery);
    const allCompletedTasks: FirebaseTask[] = completedTasksAltSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Erweiterte Abfrage für alle Tasks mit Status "done" (alternative Bezeichnung für "completed")
    try {
      const doneTasksQuery = query(
        tasksRef,
        where("status", "==", "done")
      );
      const doneTasksSnap = await getDocs(doneTasksQuery);
      const doneTasks: FirebaseTask[] = doneTasksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Zu den abgeschlossenen Tasks hinzufügen
      allCompletedTasks.push(...doneTasks);
      
      if (userId === 'VfRP6kACcOX0q4sSL4Yzyy4V3Tc2') {
        console.log("Gefundene Tasks mit status=done:", doneTasks.length);
      }
    } catch (error) {
      console.warn("Fehler beim Abrufen von Tasks mit status=done:", error);
    }
    
    // Filtere Tasks, an denen der Benutzer als Helfer beteiligt war (durch applications)
    const completedAsParticipantTasks = allCompletedTasks.filter(task => {
      // Fall 1: Benutzer ist in applications als 'accepted' markiert
      if (task.applications) {
        const applications = Array.isArray(task.applications) ? task.applications : Object.values(task.applications);
        if (applications.some((app: any) => 
          app.userId === userId && (app.status === 'accepted' || app.status === 'completed')
        )) {
          return true;
        }
      }
      
      // Fall 2: Benutzer ist in applicants Array (älteres Datenmodell)
      if (task.applicants) {
        const applicants = Array.isArray(task.applicants) ? task.applicants : Object.values(task.applicants);
        if (applicants.some((app: any) => 
          app.userId === userId && (app.status === 'accepted' || app.status === 'completed')
        )) {
          return true;
        }
      }
      
      // Fall 3: Benutzer ist direkt als selectedApplicant oder assignedUserId gespeichert
      if (task.selectedApplicant === userId || task.assignedUserId === userId) {
        return true;
      }
      
      return false;
    });
    
    // Erledigte Tasks, die der Benutzer erstellt hat
    const createdCompletedTasks = createdTasks.filter(task => task.status === "completed");
    
    // Bewertungen abrufen
    const reviewsRef = collection(db, "reviews");
    const reviewsQuery = query(
      reviewsRef,
      where("userId", "==", userId)
    );
    const reviewsSnap = await getDocs(reviewsQuery);
    const reviews: FirebaseReview[] = reviewsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Durchschnittsbewertung berechnen
    let avgRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      avgRating = totalRating / reviews.length;
    }
    
    // Log all task info for debugging
    console.log("Tasks für Profil von User", userId, {
      createdTasks: createdTasks.length,
      completedAsTasker: completedAsTaskerTasks.length,
      completedAsParticipant: completedAsParticipantTasks.length,
      createdAndCompleted: createdCompletedTasks.length,
      createdAndCompletedByOthers: createdCompletedTasks.filter((task: any) => task.taskerId !== userId).length
    });
    
    // Detaillierte Debugging-Informationen für den spezifischen Nutzer
    if (userId === 'VfRP6kACcOX0q4sSL4Yzyy4V3Tc2') {
      console.log("DETAILLIERTE AUFGABENÜBERSICHT FÜR NUTZER:", userId);
      
      // Alle abgeschlossenen Aufgaben ausgeben
      console.log("Alle abgeschlossenen Aufgaben:", allCompletedTasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        creatorId: task.creatorId,
        taskerId: task.taskerId,
        applicants: task.applicants,
        applications: task.applications,
        selectedApplicant: task.selectedApplicant,
        assignedUserId: task.assignedUserId
      })));
      
      // Als Helfer erledigte Aufgaben
      console.log("Als Helfer erledigte Aufgaben:", completedAsParticipantTasks.map(task => ({
        id: task.id,
        title: task.title,
        reason: task.applications ? "applications" : 
                task.applicants ? "applicants" : 
                task.selectedApplicant === userId ? "selectedApplicant" : 
                task.assignedUserId === userId ? "assignedUserId" : "unknown"
      })));
    }
    
    // Anzahl der erledigten Aufgaben (alle Varianten berücksichtigen)
    const totalCompletedTasks = 
      // Als offizieller Tasker zugewiesen
      completedAsTaskerTasks.length + 
      // Als Teilnehmer über Applications
      completedAsParticipantTasks.length +
      // Als Ersteller, wo jemand anderes Tasker war
      createdCompletedTasks.filter((task: any) => task.taskerId !== userId).length;
    
    // Aktuelles Level und Fortschritt bestimmen
    const userLevel = getUserLevel(totalCompletedTasks);
    const levelProgress = getLevelProgress(totalCompletedTasks);
    
    // Ermittle das nächste Level
    const levels = [
      { level: 1, name: "🐣 Anfänger", minTasks: 0 },
      { level: 2, name: "🛠️ Helfer", minTasks: 5 },
      { level: 3, name: "🚀 Macher", minTasks: 10 },
      { level: 4, name: "🌟 Profi", minTasks: 20 },
      { level: 5, name: "🧙 Experte", minTasks: 50 },
      { level: 6, name: "🦄 Local Hero", minTasks: 100 }
    ];
    
    const currentLevelIndex = levels.findIndex(level => level.level === userLevel.level);
    const nextLevel = currentLevelIndex < levels.length - 1 ? levels[currentLevelIndex + 1] : null;
    
    return {
      userData: {
        ...mergedUserData,
        displayName: mergedUserData.displayName || 'Unbekannter Benutzer',
        photoURL: mergedUserData.photoURL || mergedUserData.avatarUrl || mergedUserData.avatarBase64 || '',
        createdAt: mergedUserData.createdAt ? 
          (typeof mergedUserData.createdAt === 'object' && 'toDate' in mergedUserData.createdAt) ? 
            (mergedUserData.createdAt as any).toDate() : new Date(mergedUserData.createdAt as any) 
          : new Date()
      },
      stats: {
        completedTasks: totalCompletedTasks,
        createdTasks: createdTasks.length,
        totalReviews: reviews.length,
        avgRating: parseFloat(avgRating.toFixed(1)),
        currentLevel: userLevel.name,
        nextLevel: nextLevel ? nextLevel.name : null,
        levelProgress: Math.round(levelProgress)
      },
      reviews: reviews.map(review => ({
        id: review.id,
        rating: review.rating || 0,
        content: (review.content || review.text || '') as string,
        authorId: (review.authorId || review.reviewerId || '') as string,
        taskId: review.taskId || '',
        taskTitle: review.taskTitle || '',
        authorName: review.authorName || '',
        authorPhotoURL: review.authorPhotoURL || '',
        createdAt: review.createdAt ? 
          (typeof review.createdAt === 'object' && 'toDate' in review.createdAt) ? 
            (review.createdAt as any).toDate() : new Date(review.createdAt as any) 
          : new Date()
      })),
      tasks: createdTasks
    };
  } catch (error) {
    console.error("Fehler beim Abrufen der Profilstatistiken:", error);
    throw error;
  }
};