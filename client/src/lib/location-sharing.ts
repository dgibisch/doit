import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";

import { db } from '@/lib/firebase';

/**
 * Anfrage zum Freigeben des Standorts senden
 * @param chatId Die Chat-ID
 * @param userId Die Benutzer-ID des Anfragenden
 * @returns ID der erstellten Nachricht
 */
export const requestLocationSharing = async (chatId: string, userId: string): Promise<{messageId: string, isShared: boolean}> => {
  try {
    // Chat überprüfen
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      throw new Error("Chat nicht gefunden");
    }
    
    const chatData = chatSnap.data();
    
    // Prüfen, ob der Benutzer ein Teilnehmer ist
    if (!chatData.participants.includes(userId)) {
      throw new Error("Unbefugter Zugriff auf diesen Chat");
    }
    
    // Prüfen, ob dies der Task-Ersteller ist
    const taskRef = doc(db, "tasks", chatData.taskId);
    const taskSnap = await getDoc(taskRef);
    
    if (!taskSnap.exists()) {
      throw new Error("Aufgabe nicht gefunden");
    }
    
    const taskData = taskSnap.data();
    const isCreator = taskData.creatorId === userId;
    
    // Wenn es der Task-Ersteller ist, teilen wir den Standort direkt
    if (isCreator) {
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      
      // Adresse und Koordinaten vorbereiten
      const address = taskData.location?.address || 'Keine Adressangabe';
      const coords = taskData.location?.coordinates || { lat: 0, lng: 0 };
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
      
      // Nur eine Nachricht hinzufügen - als normale Text-Nachricht
      const messageDoc = await addDoc(messagesRef, {
        senderId: userId,
        content: `📍 *Standort der Aufgabe*: ${address}\n\n🔗 [Google Maps öffnen](${mapsUrl})`,
        timestamp: serverTimestamp(),
        // Hier Type explizit auf undefined lassen, damit es als normale Nachricht behandelt wird
      });
      
      // Standortfreigabe in Chat und Task aktualisieren
      await updateDoc(chatRef, {
        "locationSharingStatus": {
          creatorApproved: true,
          taskerApproved: true,
          sharedAt: serverTimestamp()
        },
        lastMessage: "📍 Standort freigegeben",
        lastMessageTimestamp: serverTimestamp()
      });
      
      // Task aktualisieren
      await updateDoc(taskRef, {
        "location.locationShared": true
      });
      
      return { messageId: messageDoc.id, isShared: true };
    } else {
      // Falls es ein normaler Teilnehmer ist, Anfrage senden wie bisher
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      const messageDoc = await addDoc(messagesRef, {
        type: "location_request",
        senderId: userId,
        timestamp: serverTimestamp(),
        content: "Hat eine Anfrage zur Standortfreigabe gesendet"
      });
      
      // Chat aktualisieren
      await updateDoc(chatRef, {
        lastMessage: "Standortfreigabe angefragt",
        lastMessageTimestamp: serverTimestamp()
      });
      
      return { messageId: messageDoc.id, isShared: false };
    }
  } catch (error) {
    console.error("Fehler beim Anfragen der Standortfreigabe:", error);
    throw error;
  }
};

/**
 * Auf Standortfreigabe-Anfrage antworten
 * @param chatId Die Chat-ID
 * @param userId Die Benutzer-ID des Antwortenden
 * @param approved Zustimmung (true) oder Ablehnung (false)
 * @param taskId Die Aufgaben-ID
 * @returns true wenn der Standort freigegeben wurde, false wenn nicht
 */
export const respondToLocationRequest = async (
  chatId: string, 
  userId: string, 
  approved: boolean,
  taskId: string
): Promise<boolean> => {
  try {
    // Chat und Benutzerrolle überprüfen
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      throw new Error("Chat nicht gefunden");
    }
    
    const chatData = chatSnap.data();
    
    // Prüfen, ob der Benutzer ein Teilnehmer ist
    if (!chatData.participants.includes(userId)) {
      throw new Error("Unbefugter Zugriff auf diesen Chat");
    }
    
    // Task abrufen
    const taskRef = doc(db, "tasks", taskId);
    const taskSnap = await getDoc(taskRef);
    
    if (!taskSnap.exists()) {
      throw new Error("Aufgabe nicht gefunden");
    }
    
    const taskData = taskSnap.data();
    
    // Bestimmen, ob Benutzer der Ersteller oder Tasker ist
    const isCreator = taskData.creatorId === userId;
    const isTasker = chatData.participants.find((id: string) => id !== taskData.creatorId) === userId;
    
    if (!isCreator && !isTasker) {
      throw new Error("Benutzer ist weder Ersteller noch Ausführender der Aufgabe");
    }
    
    // Antwort-Nachricht hinzufügen
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    await addDoc(messagesRef, {
      type: "location_response",
      senderId: userId,
      timestamp: serverTimestamp(),
      approved: approved,
      content: approved ? "Hat der Standortfreigabe zugestimmt" : "Hat die Standortfreigabe abgelehnt"
    });
    
    // Lokalen chat.locationSharingStatus erstellen, falls nicht vorhanden
    const locationSharingStatus = chatData.locationSharingStatus || {
      creatorApproved: false,
      taskerApproved: false,
      sharedAt: null
    };
    
    // Status aktualisieren
    if (isCreator) {
      locationSharingStatus.creatorApproved = approved;
    } else if (isTasker) {
      locationSharingStatus.taskerApproved = approved;
    }
    
    // Chat-Dokument aktualisieren
    await updateDoc(chatRef, {
      locationSharingStatus: locationSharingStatus,
      lastMessage: approved ? "Standortfreigabe zugestimmt" : "Standortfreigabe abgelehnt",
      lastMessageTimestamp: serverTimestamp()
    });
    
    // Wenn beide zugestimmt haben, standort freigeben
    const bothApproved = locationSharingStatus.creatorApproved && locationSharingStatus.taskerApproved;
    
    if (bothApproved && !chatData.locationSharingStatus?.sharedAt) {
      // Adresse und Koordinaten vorbereiten
      const address = taskData.location?.address || 'Keine Adressangabe';
      const coords = taskData.location?.coordinates || { lat: 0, lng: 0 };
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
      
      // Nur eine normale Nachricht hinzufügen vom Task-Ersteller
      await addDoc(messagesRef, {
        senderId: taskData.creatorId,
        content: `📍 Standort der Aufgabe: ${address}\n\n🔗 Google Maps: ${mapsUrl}`,
        timestamp: serverTimestamp(),
      });
      
      // Standortfreigabe in Chat und Task aktualisieren
      await updateDoc(chatRef, {
        "locationSharingStatus.sharedAt": serverTimestamp(),
        lastMessage: "📍 Standort wurde freigegeben",
        lastMessageTimestamp: serverTimestamp()
      });
      
      // Task aktualisieren
      await updateDoc(taskRef, {
        "location.locationShared": true
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Fehler beim Beantworten der Standortfreigabe:", error);
    throw error;
  }
};

/**
 * Prüft, ob der genaue Standort für einen Chat freigegeben wurde
 */
export const isLocationSharedInChat = async (chatId: string): Promise<boolean> => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      return false;
    }
    
    const chatData = chatSnap.data();
    return !!(chatData.locationSharingStatus?.sharedAt);
  } catch (error) {
    console.error("Fehler beim Prüfen des Standortfreigabestatus:", error);
    return false;
  }
};

/**
 * Holt die Standortdaten für eine Aufgabe, falls freigegeben
 * @param chatId ID des Chats
 * @param taskId ID der Aufgabe
 * @returns Standortdaten oder null, wenn nicht freigegeben
 */
export const getSharedTaskLocation = async (chatId: string, taskId: string): Promise<any | null> => {
  try {
    // Prüfen, ob der Standort freigegeben wurde
    const isShared = await isLocationSharedInChat(chatId);
    
    if (!isShared) {
      return null;
    }
    
    // Task-Daten abrufen
    const taskRef = doc(db, "tasks", taskId);
    const taskSnap = await getDoc(taskRef);
    
    if (!taskSnap.exists()) {
      return null;
    }
    
    const taskData = taskSnap.data();
    return taskData.location || null;
  } catch (error) {
    console.error("Fehler beim Abrufen der Standortdaten:", error);
    return null;
  }
};