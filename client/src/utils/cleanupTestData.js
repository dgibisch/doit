// cleanupTestData.js
import { db, auth, storage } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  deleteDoc, 
  doc, 
  getDoc,
  writeBatch
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

/**
 * Löscht die letzten X Testaufgaben des aktuellen Benutzers
 * 
 * @param {number} count Anzahl der zu löschenden Einträge
 * @returns {Promise<{success: boolean, message: string, deletedCount: number}>}
 */
export const deleteRecentTasks = async (count = 7) => {
  try {
    if (!auth.currentUser) {
      return { success: false, message: "Sie müssen angemeldet sein, um Testdaten zu löschen." };
    }

    // Da auch mit aktiviertem Index noch Probleme bestehen, 
    // verwenden wir die einfachere Abfrage ohne Sortierung und machen die Sortierung clientseitig
    const tasksRef = collection(db, "tasks");
    const q = query(
      tasksRef,
      where("creatorId", "==", auth.currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    let deletedCount = 0;
    
    // Firestore Batch für Transaktionssicherheit verwenden
    const batch = writeBatch(db);

    // Hier prüfen wir auch, ob mit den Tasks noch andere Dokumente verknüpft sind
    // Diese müssten zuerst gelöscht werden (z.B. Kommentare, Bewerbungen)
    const idsToDelete = [];
    
    // Nur die letzten 'count' Einträge verarbeiten
    // Da wir keinen Index für createdAt haben, sortieren wir clientseitig
    const tasks = [];
    querySnapshot.forEach((document) => {
      tasks.push({
        id: document.id,
        ...document.data()
      });
    });
    
    // Nach createdAt-Timestamp sortieren und nur die neuesten 'count' Einträge auswählen
    tasks.sort((a, b) => {
      const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
      return dateB - dateA; // absteigend (neueste zuerst)
    });
    
    // Nur die ersten 'count' Einträge nehmen oder alle, wenn weniger vorhanden
    const tasksToDelete = tasks.slice(0, count);
    
    // Diese zum Batch hinzufügen
    tasksToDelete.forEach((task) => {
      idsToDelete.push(task.id);
      batch.delete(doc(db, "tasks", task.id));
      deletedCount++;
    });
    
    // Zusätzlich alle Kommentare zu diesen Aufgaben löschen
    // und eventuell vorhandene Bilder in Firebase Storage
    if (idsToDelete.length > 0) {
      for (const taskId of idsToDelete) {
        try {
          // Kommentare für diese Aufgabe abrufen und löschen
          const commentsRef = collection(db, "comments");
          const commentsQuery = query(commentsRef, where("taskId", "==", taskId));
          const commentsSnapshot = await getDocs(commentsQuery);
          
          commentsSnapshot.forEach((commentDoc) => {
            batch.delete(doc(db, "comments", commentDoc.id));
          });
          
          // Bilder im Storage löschen, falls vorhanden
          // Task-Daten abrufen, um an die Bild-URLs zu kommen
          const taskData = tasksToDelete.find(task => task.id === taskId);
          
          if (taskData && taskData.imageUrls && taskData.imageUrls.length > 0) {
            console.log(`Task ${taskId} hat ${taskData.imageUrls.length} Bilder, versuche zu löschen...`);
            
            // Bei Firebase Storage (nicht Data-URL)
            taskData.imageUrls.forEach(async (imageUrl) => {
              if (!imageUrl.startsWith('data:')) {
                try {
                  // Bei Firebase Storage URLs der Form "https://firebasestorage.googleapis.com/..."
                  const imageRef = ref(storage, imageUrl);
                  await deleteObject(imageRef);
                  console.log(`Bild aus Storage gelöscht: ${imageUrl}`);
                } catch (storageError) {
                  console.log(`Konnte Bild nicht aus Storage löschen: ${storageError.message}`);
                  // Wir ignorieren Fehler beim Löschen der Bilder, da es sich nur um Aufräumarbeiten handelt
                }
              }
            });
          }
        } catch (relatedError) {
          console.error(`Fehler beim Löschen der Verlinkungen für Task ${taskId}:`, relatedError);
          // Fahre trotz Fehler fort, um möglichst viele Daten zu löschen
        }
      }
    }
    
    // Bei leeren Batches wäre commit() ein Fehler
    if (deletedCount > 0) {
      try {
        // Batch ausführen
        await batch.commit();
        console.log(`Löschvorgang abgeschlossen für ${deletedCount} Einträge`);
      } catch (commitError) {
        console.error("Fehler beim Commit:", commitError);
        
        // Als Fallback: Einzeln löschen, wenn Batch fehlschlägt
        console.log("Versuche Fallback: Einzelnes Löschen...");
        let successCount = 0;
        
        for (const taskId of idsToDelete) {
          try {
            await deleteDoc(doc(db, "tasks", taskId));
            successCount++;
          } catch (individualError) {
            console.error(`Konnte Task ${taskId} nicht löschen:`, individualError);
          }
        }
        
        if (successCount > 0) {
          return { 
            success: true, 
            message: `${successCount} Testaufgaben wurden im Fallback-Modus gelöscht.`,
            deletedCount: successCount 
          };
        } else {
          throw new Error("Auch der Fallback-Mechanismus konnte keine Aufgaben löschen");
        }
      }
    } else {
      return { 
        success: true, 
        message: "Keine Aufgaben zum Löschen gefunden.",
        deletedCount: 0 
      };
    }

    return { 
      success: true, 
      message: `${deletedCount} Testaufgaben wurden erfolgreich gelöscht.`,
      deletedCount 
    };
  } catch (error) {
    console.error("Fehler beim Löschen der Testdaten:", error);
    return { 
      success: false, 
      message: `Fehler: ${error.message || 'Unbekannter Fehler'}` 
    };
  }
};