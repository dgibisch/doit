// Dieses Skript kann in der Browserkonsole ausgeführt werden, um alle Tasks zu löschen
// ACHTUNG: Dies löscht ALLE Tasks in der Datenbank!

async function cleanupAllTasks() {
  try {
    console.log("Starte Löschvorgang für alle Tasks...");
    
    // Hole eine Referenz zur tasks-Collection
    const tasksRef = firebase.firestore().collection('tasks');
    
    // Hole alle Task-Dokumente
    const tasksSnapshot = await tasksRef.get();
    
    if (tasksSnapshot.empty) {
      console.log("Keine Tasks zum Löschen gefunden.");
      return;
    }
    
    // Zeige die Anzahl der zu löschenden Tasks
    console.log(`${tasksSnapshot.docs.length} Tasks gefunden. Beginne mit dem Löschen...`);
    
    // Erstelle ein Batch für die Löschoperationen
    let batch = firebase.firestore().batch();
    let count = 0;
    const BATCH_SIZE = 500; // Firestore hat ein Limit von 500 Operationen pro Batch
    
    // Füge jedes Dokument zum Batch hinzu
    for (const doc of tasksSnapshot.docs) {
      batch.delete(doc.ref);
      count++;
      
      // Wenn das Batch-Limit erreicht ist, committe den Batch und starte einen neuen
      if (count >= BATCH_SIZE) {
        console.log(`Löschen von ${count} Tasks...`);
        await batch.commit();
        batch = firebase.firestore().batch();
        count = 0;
      }
    }
    
    // Committe den letzten Batch, falls noch Dokumente übrig sind
    if (count > 0) {
      console.log(`Löschen der letzten ${count} Tasks...`);
      await batch.commit();
    }
    
    console.log("Alle Tasks wurden erfolgreich gelöscht!");
    
    // Optional: Lösche auch die zugehörigen Anwendungen und Chats
    await cleanupRelatedDocuments();
    
  } catch (error) {
    console.error("Fehler beim Löschen der Tasks:", error);
  }
}

async function cleanupRelatedDocuments() {
  try {
    console.log("Lösche zugehörige Anwendungen und Chats...");
    
    // Lösche Anwendungen
    const applicationsRef = firebase.firestore().collection('applications');
    const applicationsSnapshot = await applicationsRef.get();
    
    if (!applicationsSnapshot.empty) {
      console.log(`${applicationsSnapshot.docs.length} Anwendungen gefunden. Beginne mit dem Löschen...`);
      
      let batch = firebase.firestore().batch();
      let count = 0;
      const BATCH_SIZE = 500;
      
      for (const doc of applicationsSnapshot.docs) {
        batch.delete(doc.ref);
        count++;
        
        if (count >= BATCH_SIZE) {
          console.log(`Löschen von ${count} Anwendungen...`);
          await batch.commit();
          batch = firebase.firestore().batch();
          count = 0;
        }
      }
      
      if (count > 0) {
        console.log(`Löschen der letzten ${count} Anwendungen...`);
        await batch.commit();
      }
      
      console.log("Alle Anwendungen wurden erfolgreich gelöscht!");
    } else {
      console.log("Keine Anwendungen zum Löschen gefunden.");
    }
    
    // Lösche Chats, die mit Aufgaben zusammenhängen
    const chatsRef = firebase.firestore().collection('chats');
    const taskChatsSnapshot = await chatsRef.where('taskId', '!=', 'welcome-task').get();
    
    if (!taskChatsSnapshot.empty) {
      console.log(`${taskChatsSnapshot.docs.length} Task-bezogene Chats gefunden. Beginne mit dem Löschen...`);
      
      let batch = firebase.firestore().batch();
      let count = 0;
      const BATCH_SIZE = 500;
      
      for (const doc of taskChatsSnapshot.docs) {
        // Lösche den Chat
        batch.delete(doc.ref);
        count++;
        
        if (count >= BATCH_SIZE) {
          console.log(`Löschen von ${count} Chats...`);
          await batch.commit();
          batch = firebase.firestore().batch();
          count = 0;
        }
      }
      
      if (count > 0) {
        console.log(`Löschen der letzten ${count} Chats...`);
        await batch.commit();
      }
      
      console.log("Alle Task-bezogenen Chats wurden erfolgreich gelöscht!");
    } else {
      console.log("Keine Task-bezogenen Chats zum Löschen gefunden.");
    }
    
    // Lösche alle Nachrichten außer die aus Willkommenscchats
    await deleteMessagesForChats();
    
  } catch (error) {
    console.error("Fehler beim Löschen der zugehörigen Dokumente:", error);
  }
}

async function deleteMessagesForChats() {
  try {
    console.log("Lösche zugehörige Nachrichten...");
    
    // Lösche alle Nachrichten außer die aus Willkommenscchats
    const messagesRef = firebase.firestore().collection('messages');
    const welcomeChatIds = [];
    
    // Hole zuerst alle Willkommenschat-IDs
    const welcomeChatsSnapshot = await firebase.firestore().collection('chats')
      .where('taskId', '==', 'welcome-task')
      .get();
    
    welcomeChatsSnapshot.forEach(doc => {
      welcomeChatIds.push(doc.id);
    });
    
    // Hole alle Nachrichten
    const messagesSnapshot = await messagesRef.get();
    
    if (!messagesSnapshot.empty) {
      console.log(`${messagesSnapshot.docs.length} Nachrichten gefunden. Prüfe, welche gelöscht werden sollen...`);
      
      let batch = firebase.firestore().batch();
      let count = 0;
      let deletedCount = 0;
      const BATCH_SIZE = 500;
      
      for (const doc of messagesSnapshot.docs) {
        const messageData = doc.data();
        // Nur Nachrichten löschen, die nicht zu Willkommenschats gehören
        if (!welcomeChatIds.includes(messageData.chatId)) {
          batch.delete(doc.ref);
          count++;
          deletedCount++;
          
          if (count >= BATCH_SIZE) {
            console.log(`Löschen von ${count} Nachrichten...`);
            await batch.commit();
            batch = firebase.firestore().batch();
            count = 0;
          }
        }
      }
      
      if (count > 0) {
        console.log(`Löschen der letzten ${count} Nachrichten...`);
        await batch.commit();
      }
      
      console.log(`${deletedCount} zugehörige Nachrichten wurden erfolgreich gelöscht!`);
    } else {
      console.log("Keine Nachrichten zum Löschen gefunden.");
    }
    
  } catch (error) {
    console.error("Fehler beim Löschen der Nachrichten:", error);
  }
}

// Anleitung zur Verwendung:
// 1. Öffnen Sie die Browser-Konsole (F12 oder Rechtsklick -> Untersuchen -> Konsole)
// 2. Kopieren Sie dieses Skript und fügen Sie es in die Konsole ein
// 3. Führen Sie die Funktion aus: cleanupAllTasks()
// 4. Warten Sie, bis der Löschvorgang abgeschlossen ist

// cleanupAllTasks();