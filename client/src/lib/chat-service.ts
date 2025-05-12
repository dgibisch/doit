import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  serverTimestamp, 
  Timestamp, 
  DocumentReference,
  DocumentData,
  QueryDocumentSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: Timestamp;
  status: 'sending' | 'sent' | 'error';
  errorMessage?: string;
  imageUrl?: string;
  imageBase64?: string;  // Neues Feld für Base64-kodierte Bilder
  messageType?: 'text' | 'image' | 'mixed';
  isSystemMessage?: boolean;
  visibleToUserId?: string; // Wenn gesetzt, ist die Nachricht nur für diesen Benutzer sichtbar
  isHtml?: boolean;         // Wenn gesetzt, enthält content HTML-Markup
  isLocationMessage?: boolean; // Wenn gesetzt, ist dies eine Standortnachricht
  
  // Standort-Freigabe-Nachrichtentypen
  type?: 'location_request' | 'location_response' | 'location_shared' | string;
  approved?: boolean; // Für location_response
  taskId?: string;    // Für location_shared
  location?: {        // Für location_shared
    address?: string;
    city?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    locationShared?: boolean;
  };
}

export interface Chat {
  id: string;
  taskId: string;
  taskTitle: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  participantAvatarBase64?: Record<string, string>;
  participantAvatarUrls?: Record<string, string>;
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  lastReadBy: Record<string, Timestamp>;
  applicationId?: string;
  locationSharingStatus?: {
    creatorApproved: boolean;
    taskerApproved: boolean;
    sharedAt: Timestamp | null;
  };
  
  // Neue Felder für Bewerbungsmanagement
  isTaskApplicationChat?: boolean;
  applicantId?: string;
  taskCreatorId?: string;
  applicationMessage?: string;
  isSelected?: boolean;
  isRejected?: boolean;
  isConfirmedByApplicant?: boolean;
  createdAt?: Timestamp;
  
  // Status für den Chat und den Task
  status?: 'open' | 'selected' | 'confirmed' | 'completed' | 'completed_by_applicant' | 'completed_by_creator';
  
  // Felder für Bewertungen
  isCompletedConfirmed?: boolean;
  isTaskCompleted?: boolean;
  showReviewRequest?: boolean;
}

class ChatService {
  private _activeListeners: Map<string, () => void> = new Map();

  /**
   * Get user chats with real-time updates
   */
  getUserChats(
    userId: string, 
    callback: (chats: Chat[]) => void, 
    onError: (error: Error) => void
  ): () => void {
    try {
      if (!userId) {
        onError(new Error('User ID is required to get chats'));
        return () => {};
      }

      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTimestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const chatsList = snapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() } as Chat;
          });
          
          // Versuche, alle Chats zu migrieren, die die neuen Avatar-Felder nicht haben
          chatsList.forEach(chat => {
            if (!chat.participantAvatarBase64 || !chat.participantAvatarUrls) {
              this.tryMigrateChat(chat.id);
            }
          });
          
          callback(chatsList);
        },
        (error) => {
          console.error('Error getting chats:', error);
          onError(error);
        }
      );

      // Store the unsubscribe function with a unique key
      const listenerKey = `user-chats-${userId}`;
      this._activeListeners.set(listenerKey, unsubscribe);

      return () => {
        unsubscribe();
        this._activeListeners.delete(listenerKey);
      };
    } catch (error) {
      console.error('Error setting up chats listener:', error);
      onError(error instanceof Error ? error : new Error('Unknown error getting chats'));
      return () => {};
    }
  }

  /**
   * Get single chat by ID with real-time updates
   */
  getChat(
    chatId: string, 
    callback: (chat: Chat | null) => void, 
    onError: (error: Error) => void
  ): () => void {
    try {
      if (!chatId) {
        onError(new Error('Chat ID is required'));
        return () => {};
      }

      const chatDocRef = doc(db, 'chats', chatId);
      
      // Versuche einmalig, den Chat zu migrieren (falls erforderlich)
      this.tryMigrateChat(chatId);
      
      const unsubscribe = onSnapshot(chatDocRef, 
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const chatData = { id: docSnapshot.id, ...docSnapshot.data() } as Chat;
            
            // Überprüfen, ob der Chat die neuen Avatar-Felder hat
            if (!chatData.participantAvatarBase64 || !chatData.participantAvatarUrls) {
              // Wir versuchen, die Migration durchzuführen, aber warten nicht auf sie
              this.tryMigrateChat(chatId);
            }
            
            callback(chatData);
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error('Error getting chat:', error);
          onError(error);
        }
      );

      // Store the unsubscribe function with a unique key
      const listenerKey = `chat-${chatId}`;
      this._activeListeners.set(listenerKey, unsubscribe);

      return () => {
        unsubscribe();
        this._activeListeners.delete(listenerKey);
      };
    } catch (error) {
      console.error('Error setting up chat listener:', error);
      onError(error instanceof Error ? error : new Error('Unknown error getting chat'));
      return () => {};
    }
  }
  
  /**
   * Versucht einen Chat zu migrieren, fängt alle Fehler ab
   * Diese Funktion gibt kein Promise zurück und wartet nicht auf den Abschluss
   */
  private tryMigrateChat(chatId: string): void {
    // Non-blocking migration attempt
    this.migrateChat(chatId).catch(error => {
      console.warn(`Nicht-blockierender Migrationsfehler für Chat ${chatId}:`, error);
    });
  }

  /**
   * Get chat messages with real-time updates
   */
  getChatMessages(
    chatId: string, 
    callback: (messages: ChatMessage[]) => void, 
    onError: (error: Error) => void
  ): () => void {
    try {
      if (!chatId) {
        onError(new Error('Chat ID is required to get messages'));
        return () => {};
      }

      // Aktuellen Benutzer abrufen für Nachrichtenfilterung
      const currentUser = auth.currentUser;
      const currentUserId = currentUser?.uid;

      const messagesRef = collection(db, 'messages');
      // Index is now created, so we can use orderBy directly
      const q = query(
        messagesRef,
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          try {
            const messageList = snapshot.docs
              .map(doc => {
                return { 
                  id: doc.id, 
                  ...doc.data(),
                  status: 'sent' // Messages from Firestore are always "sent"
                } as ChatMessage;
              })
              // Filtere Nachrichten, die nur für bestimmte Benutzer sichtbar sein sollen
              .filter(message => {
                // Wenn die Nachricht eine visibleToUserId hat, prüfe, ob sie für den aktuellen Benutzer ist
                if (message.visibleToUserId) {
                  return message.visibleToUserId === currentUserId;
                }
                // Ansonsten zeige die Nachricht allen Benutzern
                return true;
              });
            
            callback(messageList);
          } catch (err) {
            console.error('Error processing messages:', err);
            callback([]);
          }
        },
        (error) => {
          console.error('Error getting messages:', error);
          onError(error);
        }
      );

      // Store the unsubscribe function with a unique key
      const listenerKey = `chat-messages-${chatId}`;
      this._activeListeners.set(listenerKey, unsubscribe);

      return () => {
        unsubscribe();
        this._activeListeners.delete(listenerKey);
      };
    } catch (error) {
      console.error('Error setting up messages listener:', error);
      onError(error instanceof Error ? error : new Error('Unknown error getting messages'));
      return () => {};
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      if (!chatId || !userId) {
        throw new Error('Chat ID and User ID are required to mark messages as read');
      }

      await updateDoc(doc(db, 'chats', chatId), {
        [`lastReadBy.${userId}`]: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(
    chatId: string, 
    content: string, 
    senderId?: string, 
    senderName?: string,
    imageUrl?: string,
    imageBase64?: string
  ): Promise<string> {
    try {
      if (!chatId || (!content.trim() && !imageUrl && !imageBase64)) {
        throw new Error('Chat ID and message content or image are required');
      }

      // If userId/name are not provided, try to get from Firebase auth
      let userId = senderId;
      let userName = senderName;
      let userAvatar = '';
      
      if (!userId || !userName) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          userId = currentUser.uid;
          userName = currentUser.displayName || 'User';
          userAvatar = currentUser.photoURL || '';
        } else {
          throw new Error('User must be logged in to send messages');
        }
      }

      // Determine message type
      let messageType: 'text' | 'image' | 'mixed' = 'text';
      
      // Wenn wir ein Base64-Bild haben, hat es Priorität
      if (imageBase64) {
        if (content.trim()) {
          messageType = 'mixed';
        } else {
          messageType = 'image';
          // Bei reinen Bildnachrichten mit Base64 wird das Bild im content-Feld gespeichert
          content = imageBase64;
        }
      } else if (imageUrl && content.trim()) {
        messageType = 'mixed';
      } else if (imageUrl) {
        messageType = 'image';
      }

      // Add message to Firestore
      const messageData: Record<string, any> = {
        chatId,
        content: content.trim(),
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        timestamp: serverTimestamp(),
        messageType
      };
      
      // Wenn wir ein imageUrl-Feld haben und es keine reine Base64-Bildnachricht ist,
      // fügen wir das imageUrl-Feld hinzu
      if (imageUrl && (messageType !== 'image' || !imageBase64)) {
        messageData.imageUrl = imageUrl;
      }
      
      // Bei gemischten Nachrichten mit Base64-Bild, fügen wir ein separates imageBase64-Feld hinzu
      if (imageBase64 && messageType === 'mixed') {
        messageData.imageBase64 = imageBase64;
      }

      const messageRef = await addDoc(collection(db, 'messages'), messageData);

      // Create display message for lastMessage in chat
      let displayMessage = content.trim();
      if (messageType === 'image' || messageType === 'mixed') {
        displayMessage = messageType === 'image' ? '📷 Bild' : `📷 ${content.trim()}`;
      }

      // Update chat with last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: displayMessage,
        lastMessageTimestamp: serverTimestamp()
      });

      return messageRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
  
  /**
   * Send a system message to a chat
   * Diese Nachrichten werden anders angezeigt und haben keinen Absender
   * @param chatId Chat ID
   * @param content Nachrichteninhalt
   * @param visibleToUserId Optional: Wenn angegeben, ist die Nachricht nur für diesen Benutzer sichtbar
   */
  async sendSystemMessage(
    chatId: string, 
    content: string,
    visibleToUserId?: string
  ): Promise<string> {
    try {
      if (!chatId || !content.trim()) {
        throw new Error('Chat ID and message content are required');
      }

      // Add system message to Firestore
      const messageData: Record<string, any> = {
        chatId,
        content: content.trim(),
        senderId: 'system',
        senderName: 'System',
        timestamp: serverTimestamp(),
        messageType: 'text',
        isSystemMessage: true
      };
      
      // Wenn visibleToUserId gesetzt ist, füge es zum messageData hinzu
      if (visibleToUserId) {
        messageData.visibleToUserId = visibleToUserId;
      }

      const messageRef = await addDoc(collection(db, 'messages'), messageData);

      // Update chat with last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: `📢 ${content.trim()}`,
        lastMessageTimestamp: serverTimestamp()
      });

      return messageRef.id;
    } catch (error) {
      console.error('Error sending system message:', error);
      throw error;
    }
  }

  /**
   * Create a new chat for a task application
   */
  async createChatForApplication(
    taskId: string,
    taskTitle: string,
    taskCreatorId: string,
    taskCreatorName: string,
    applicantId: string,
    applicantName: string,
    applicationId: string,
    initialMessage: string
  ): Promise<string> {
    try {
      if (!taskId || !taskCreatorId || !applicantId) {
        throw new Error('Task ID, creator ID, and applicant ID are required');
      }

      // Profilbilder für beide Benutzer abrufen
      let taskCreatorAvatar = '';
      let applicantAvatar = '';
      let taskCreatorAvatarBase64 = null;
      let applicantAvatarBase64 = null;
      
      try {
        // Task-Ersteller Profil abrufen
        const creatorDoc = await getDoc(doc(db, 'users', taskCreatorId));
        if (creatorDoc.exists()) {
          const creatorData = creatorDoc.data();
          taskCreatorAvatar = creatorData.photoURL || creatorData.avatarUrl || '';
          taskCreatorAvatarBase64 = creatorData.avatarBase64 || null;
        }
        
        // Bewerber Profil abrufen
        const applicantDoc = await getDoc(doc(db, 'users', applicantId));
        if (applicantDoc.exists()) {
          const applicantData = applicantDoc.data();
          applicantAvatar = applicantData.photoURL || applicantData.avatarUrl || '';
          applicantAvatarBase64 = applicantData.avatarBase64 || null;
        }
      } catch (error) {
        console.error('Fehler beim Abrufen der Benutzerprofile für Chat:', error);
      }
      
      // Create chat document
      const chatData = {
        taskId,
        taskTitle,
        participants: [taskCreatorId, applicantId],
        participantNames: {
          [taskCreatorId]: taskCreatorName || 'Task Creator',
          [applicantId]: applicantName || 'Applicant'
        },
        participantAvatars: {
          [taskCreatorId]: taskCreatorAvatar,
          [applicantId]: applicantAvatar
        },
        // Neue Felder für Base64/URL Bilder
        participantAvatarUrls: {
          [taskCreatorId]: taskCreatorAvatar,
          [applicantId]: applicantAvatar
        },
        participantAvatarBase64: {
          [taskCreatorId]: taskCreatorAvatarBase64,
          [applicantId]: applicantAvatarBase64
        },
        lastMessage: initialMessage,
        lastMessageTimestamp: serverTimestamp(),
        lastReadBy: {
          [taskCreatorId]: serverTimestamp(),
          [applicantId]: serverTimestamp()
        },
        applicationId,
        createdAt: serverTimestamp(),
        
        // Neue Felder für die Bewerbungsverwaltung
        isTaskApplicationChat: true,
        applicantId: applicantId,
        taskCreatorId: taskCreatorId,
        applicationMessage: initialMessage,
        isSelected: false,
        isRejected: false,
        isConfirmedByApplicant: false
      };

      const chatRef = await addDoc(collection(db, 'chats'), chatData);

      // Personalisierte Nachrichten für Bewerber und Task-Ersteller
      // Für Bewerber
      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        content: `📩 Du hast dich auf die Aufgabe "${taskTitle}" beworben.`,
        senderId: 'system',
        senderName: 'System',
        timestamp: serverTimestamp(),
        messageType: 'text',
        isSystemMessage: true,
        visibleToUserId: applicantId // Nachricht nur für den Bewerber sichtbar
      });

      // Für Task-Ersteller
      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        content: `📩 ${applicantName} hat sich auf deine Aufgabe "${taskTitle}" beworben.`,
        senderId: 'system',
        senderName: 'System',
        timestamp: serverTimestamp(),
        messageType: 'text',
        isSystemMessage: true,
        visibleToUserId: taskCreatorId // Nachricht nur für den Task-Ersteller sichtbar
      });

      // Add initial message - mit messageType
      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        content: initialMessage,
        senderId: applicantId,
        senderName: applicantName || 'Applicant',
        timestamp: serverTimestamp(),
        messageType: 'text'
      });

      return chatRef.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  /**
   * Clean up all active listeners
   */
  cleanupListeners(): void {
    this._activeListeners.forEach(unsubscribe => {
      unsubscribe();
    });
    this._activeListeners.clear();
  }
  
  /**
   * Migriert einen Chat, um die neuen Avatar-Felder hinzuzufügen
   * Diese Funktion wird aufgerufen, wenn ein Chat geladen wird, dem die neuen Felder fehlen
   */
  async migrateChat(chatId: string): Promise<void> {
    try {
      if (!chatId) {
        throw new Error('Chat ID ist erforderlich');
      }
      
      // Chat-Daten abrufen
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat nicht gefunden');
      }
      
      const chatData = chatSnapshot.data();
      
      // Überprüfen, ob die neuen Felder bereits existieren
      if (chatData.participantAvatarBase64 && chatData.participantAvatarUrls) {
        return; // Nichts zu tun, bereits migriert
      }
      
      // Benutzerinformationen für alle Teilnehmer abrufen
      const participants = chatData.participants || [];
      const userProfiles = await Promise.all(
        participants.map(async (userId: string) => {
          try {
            const userRef = doc(db, 'users', userId);
            const userSnapshot = await getDoc(userRef);
            
            if (userSnapshot.exists()) {
              return {
                userId,
                userData: userSnapshot.data()
              };
            }
            return { userId, userData: null };
          } catch (error) {
            console.error(`Fehler beim Abrufen des Benutzerprofils für ${userId}:`, error);
            return { userId, userData: null };
          }
        })
      );
      
      // Erstellen der neuen participantAvatarBase64 und participantAvatarUrls Felder
      const participantAvatarBase64: Record<string, string | null> = {};
      const participantAvatarUrls: Record<string, string> = {};
      
      // Für jeden Teilnehmer die Daten auffüllen
      userProfiles.forEach(({ userId, userData }) => {
        if (userData) {
          // Basis-Avatar setzen (alte Daten)
          participantAvatarUrls[userId] = 
            userData.photoURL || 
            userData.avatarUrl || 
            chatData.participantAvatars?.[userId] || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(chatData.participantNames?.[userId] || 'User')}&background=6366f1&color=fff`;
          
          // Base64-Avatar wenn verfügbar
          participantAvatarBase64[userId] = userData.avatarBase64 || null;
        } else {
          // Fallback, wenn keine Benutzerdaten verfügbar sind
          participantAvatarUrls[userId] = 
            chatData.participantAvatars?.[userId] || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(chatData.participantNames?.[userId] || 'User')}&background=6366f1&color=fff`;
          participantAvatarBase64[userId] = null;
        }
      });
      
      // Chat aktualisieren
      await updateDoc(chatRef, {
        participantAvatarBase64,
        participantAvatarUrls,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Chat ${chatId} erfolgreich migriert`);
      
    } catch (error) {
      console.error('Fehler bei der Chat-Migration:', error);
      throw error;
    }
  }
  
  /**
   * Task-Ersteller wählt den Bewerber für einen Task aus
   */
  async selectApplicantForTask(chatId: string): Promise<void> {
    try {
      if (!chatId) {
        throw new Error('Chat ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Bewerber auszuwählen');
      }
      
      // Chat-Daten abrufen
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat nicht gefunden');
      }
      
      const chatData = chatSnapshot.data() as Chat;
      
      // Prüfen, ob der aktuelle Benutzer der Task-Ersteller ist
      if (chatData.taskCreatorId !== currentUser.uid) {
        throw new Error('Nur der Task-Ersteller kann einen Bewerber auswählen');
      }
      
      // Prüfen, ob es sich um einen Bewerbungs-Chat handelt
      if (!chatData.isTaskApplicationChat) {
        throw new Error('Dieser Chat ist kein Bewerbungs-Chat');
      }
      
      // Prüfen, ob bereits ein Bewerber ausgewählt wurde
      if (chatData.isSelected) {
        throw new Error('Für diesen Task wurde bereits ein Bewerber ausgewählt');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', chatData.taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Prüfen, ob der Task Bewerbungen akzeptiert
      if (taskData.status !== 'open') {
        throw new Error('Dieser Task akzeptiert keine Bewerbungen mehr');
      }
      
      // Chat als "ausgewählt" markieren
      await updateDoc(chatRef, {
        isSelected: true,
        updatedAt: serverTimestamp()
      });
      
      // Task-Status aktualisieren
      await updateDoc(taskRef, {
        status: 'assigned',
        selectedApplicant: chatData.applicantId,
        updatedAt: serverTimestamp()
      });
      
      // Benachrichtigung senden - separat für jeden Teilnehmer
      if (chatData.participantNames && chatData.applicantId) {
        // Nachricht für Task-Ersteller
        await this.sendSystemMessage(
          chatId,
          `Du hast ${chatData.participantNames[chatData.applicantId] || 'einen Bewerber'} für diese Aufgabe ausgewählt.`,
          currentUser.uid
        );
        
        // Nachricht für Bewerber
        await this.sendSystemMessage(
          chatId,
          `Du wurdest für diese Aufgabe ausgewählt! Bitte bestätige, um zu beginnen.`,
          chatData.applicantId
        );
      }
      
      // Andere Bewerbungs-Chats für diesen Task abrufen 
      try {
        const chatsRef = collection(db, 'chats');
        const q = query(
          chatsRef,
          where('taskId', '==', chatData.taskId),
          where('isTaskApplicationChat', '==', true)
        );
      
        // Logen Sie die Query-Parameter für Debugging
        console.log('Firebase-Query für Chat-Auswahl:', {
          taskId: chatData.taskId,
          isTaskApplicationChat: true
        });
        
        // Holen Sie alle Chat-Bewerbungen für diesen Task
        const otherChatsSnapshot = await getDocs(q);
        
        // Benachrichtigung an abgelehnte Bewerber senden (alle außer dem ausgewählten)
        for (const otherChatDoc of otherChatsSnapshot.docs) {
          const otherChatId = otherChatDoc.id;
          
          // Nur Benachrichtigung an andere Bewerber senden (nicht an den, der ausgewählt wurde)
          if (otherChatId !== chatId) {
            await this.sendSystemMessage(
              otherChatId,
              'Der Task-Ersteller hat einen anderen Bewerber ausgewählt. Vielen Dank für dein Interesse!'
            );
          }
        }
      } catch (error) {
        // Zeige vollständige Fehlermeldung mit Index-Hinweisen
        console.error('Vollständiger Fehler beim Auswählen des Bewerbers:', error);
        
        // Hinweis für den Benutzer zu fehlendem Index
        if (error && typeof error === 'object' && 'code' in error && error.code === 'failed-precondition') {
          console.log('HINWEIS: Es fehlt ein Firebase-Index. In der Firebase Console müssen Sie einen zusammengesetzten Index für die collection "chats" mit diesen Feldern erstellen: taskId, isTaskApplicationChat');
        }
        throw error;
      }
      
      // Die Benachrichtigungen werden bereits im try-Block gesendet
    } catch (error) {
      console.error('Error selecting applicant:', error);
      throw error;
    }
  }
  
  /**
   * Bewerber bestätigt die Auswahl für einen Task
   * @param chatId Die ID des Chat-Dokuments
   */
  async confirmTaskSelection(chatId: string): Promise<void> {
    try {
      if (!chatId) {
        throw new Error('Chat ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um die Auswahl zu bestätigen');
      }
      
      // Chat-Daten abrufen
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat nicht gefunden');
      }
      
      const chatData = chatSnapshot.data() as Chat;
      
      // Prüfen, ob der aktuelle Benutzer der Bewerber ist
      if (chatData.applicantId !== currentUser.uid) {
        throw new Error('Nur der Bewerber kann die Auswahl bestätigen');
      }
      
      // Prüfen, ob es sich um einen Bewerbungs-Chat handelt
      if (!chatData.isTaskApplicationChat) {
        throw new Error('Dieser Chat ist kein Bewerbungs-Chat');
      }
      
      // Prüfen, ob der Bewerber ausgewählt wurde
      if (!chatData.isSelected) {
        throw new Error('Sie wurden für diesen Task nicht ausgewählt');
      }
      
      // Prüfen, ob die Auswahl bereits bestätigt wurde
      if (chatData.isConfirmedByApplicant) {
        throw new Error('Sie haben die Auswahl bereits bestätigt');
      }
      
      // Chat als "bestätigt" markieren
      await updateDoc(chatRef, {
        isConfirmedByApplicant: true,
        updatedAt: serverTimestamp()
      });
      
      // Task-Status aktualisieren
      await updateDoc(doc(db, 'tasks', chatData.taskId), {
        status: 'in_progress',
        updatedAt: serverTimestamp()
      });
      
      // Personalisierte Benachrichtigungen für beide Teilnehmer senden
      if (chatData.participantNames && chatData.applicantId && chatData.taskCreatorId) {
        // Nachricht für Bewerber
        await this.sendSystemMessage(
          chatId,
          `Du hast die Aufgabe bestätigt. Du kannst jetzt mit der Arbeit beginnen.`,
          chatData.applicantId
        );
        
        // Nachricht für Task-Ersteller
        await this.sendSystemMessage(
          chatId,
          `${chatData.participantNames[chatData.applicantId] || 'Der Bewerber'} hat die Auswahl bestätigt und beginnt nun mit der Aufgabe.`,
          chatData.taskCreatorId
        );
      }
    } catch (error) {
      console.error('Error confirming task selection:', error);
      throw error;
    }
  }

  /**
   * Bewerber markiert den Task als abgeschlossen
   * @param chatId Die ID des Chat-Dokuments
   */
  async applicantMarkTaskAsCompleted(chatId: string): Promise<void> {
    try {
      if (!chatId) {
        throw new Error('Chat ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Task als abgeschlossen zu markieren');
      }
      
      // Chat-Daten abrufen
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat nicht gefunden');
      }
      
      const chatData = chatSnapshot.data() as Chat;
      
      // Prüfen, ob der aktuelle Benutzer der Bewerber ist
      if (chatData.applicantId !== currentUser.uid) {
        throw new Error('Nur der Bewerber kann den Task als abgeschlossen markieren');
      }
      
      // Prüfen, ob es sich um einen Bewerbungs-Chat handelt
      if (!chatData.isTaskApplicationChat) {
        throw new Error('Dieser Chat ist kein Bewerbungs-Chat');
      }
      
      // Prüfen, ob der Bewerber ausgewählt wurde und die Auswahl bestätigt hat
      if (!chatData.isSelected || !chatData.isConfirmedByApplicant) {
        throw new Error('Sie müssen ausgewählt sein und die Auswahl bestätigt haben');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', chatData.taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Prüfen, ob der Task sich im richtigen Status befindet
      if (taskData.status !== 'in_progress') {
        throw new Error('Dieser Task kann nicht als abgeschlossen markiert werden');
      }
      
      // Task als "vom Bewerber abgeschlossen" markieren
      await updateDoc(taskRef, {
        status: 'completed_by_applicant',
        updatedAt: serverTimestamp()
      });
      
      // Personalisierte Benachrichtigungen für beide Teilnehmer senden
      if (chatData.participantNames && currentUser && chatData.taskCreatorId) {
        // Nachricht für Bewerber
        await this.sendSystemMessage(
          chatId,
          `Du hast den Task als abgeschlossen markiert. Warte auf die Bestätigung des Auftraggebers.`,
          chatData.applicantId
        );
        
        // Nachricht für Task-Ersteller
        await this.sendSystemMessage(
          chatId,
          `${chatData.participantNames[currentUser.uid] || 'Der Bewerber'} hat den Task als abgeschlossen markiert. Bitte bestätige die Fertigstellung.`,
          chatData.taskCreatorId
        );
      }
    } catch (error) {
      console.error('Error marking task as completed by applicant:', error);
      throw error;
    }
  }
  
  /**
   * Task-Ersteller markiert den Task als abgeschlossen
   * @param chatId Die ID des Chat-Dokuments
   */
  async markTaskAsCompleted(chatId: string): Promise<void> {
    try {
      if (!chatId) {
        throw new Error('Chat ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Task als abgeschlossen zu markieren');
      }
      
      // Chat-Daten abrufen
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat nicht gefunden');
      }
      
      const chatData = chatSnapshot.data() as Chat;
      
      // Prüfen, ob der aktuelle Benutzer der Task-Ersteller ist
      if (chatData.taskCreatorId !== currentUser.uid) {
        throw new Error('Nur der Task-Ersteller kann einen Task als abgeschlossen markieren');
      }
      
      // Prüfen, ob es sich um einen Bewerbungs-Chat handelt
      if (!chatData.isTaskApplicationChat) {
        throw new Error('Dieser Chat ist kein Bewerbungs-Chat');
      }
      
      // Prüfen, ob der Bewerber ausgewählt wurde und die Auswahl bestätigt hat
      if (!chatData.isSelected || !chatData.isConfirmedByApplicant) {
        throw new Error('Der Bewerber muss ausgewählt sein und die Auswahl bestätigt haben');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', chatData.taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Prüfen, ob der Task sich im richtigen Status befindet
      if (taskData.status !== 'in_progress' && taskData.status !== 'completed_by_applicant') {
        throw new Error('Dieser Task kann nicht als abgeschlossen markiert werden');
      }
      
      // Task als "abgeschlossen" markieren
      await updateDoc(taskRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Personalisierte Benachrichtigungen für beide Teilnehmer senden
      if (chatData.applicantId && chatData.taskCreatorId) {
        // Nachricht für Bewerber
        await this.sendSystemMessage(
          chatId,
          `Der Task wurde vom Auftraggeber als abgeschlossen bestätigt. Vielen Dank für deine Arbeit! Bitte bewerte die Zusammenarbeit.`,
          chatData.applicantId
        );
        
        // Nachricht für Task-Ersteller
        await this.sendSystemMessage(
          chatId,
          `Du hast den Task als abgeschlossen markiert. Vielen Dank für die Zusammenarbeit! Bitte bewerte den Auftragnehmer.`,
          chatData.taskCreatorId
        );
      }
      
      // Speichere Task-Metadaten für das Bewertungssystem
      await updateDoc(chatRef, {
        isCompletedConfirmed: true,
        isTaskCompleted: true, // Explizites Flag für die Abgeschlossen-Markierung
        completedAt: serverTimestamp(),
        showReviewRequest: true, // Markiert, dass Bewertungen angefragt werden sollen
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking task as completed:', error);
      throw error;
    }
  }

  /**
   * Bewerber für einen Task ablehnen
   * @param chatId Die ID des Chat-Dokuments
   */
  async rejectApplicant(chatId: string): Promise<void> {
    try {
      if (!chatId) {
        throw new Error('Chat ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Bewerber abzulehnen');
      }
      
      // Chat-Daten abrufen
      const chatRef = doc(db, 'chats', chatId);
      const chatSnapshot = await getDoc(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat nicht gefunden');
      }
      
      const chatData = chatSnapshot.data() as Chat;
      
      // Prüfen, ob der aktuelle Benutzer der Task-Ersteller ist
      if (chatData.taskCreatorId !== currentUser.uid) {
        throw new Error('Nur der Task-Ersteller kann einen Bewerber ablehnen');
      }
      
      // Prüfen, ob es sich um einen Bewerbungs-Chat handelt
      if (!chatData.isTaskApplicationChat) {
        throw new Error('Dieser Chat ist kein Bewerbungs-Chat');
      }
      
      // Prüfen, ob der Bewerber bereits ausgewählt wurde
      if (chatData.isSelected) {
        throw new Error('Dieser Bewerber wurde bereits ausgewählt und kann nicht mehr abgelehnt werden');
      }
      
      // Chat als "abgelehnt" markieren
      await updateDoc(chatRef, {
        isRejected: true,
        updatedAt: serverTimestamp()
      });
      
      // Personalisierte Nachrichten senden
      if (chatData.applicantId && chatData.taskCreatorId) {
        // Nachricht für den abgelehnten Bewerber
        await this.sendSystemMessage(
          chatId,
          `Der Task-Ersteller hat deine Bewerbung abgelehnt.`,
          chatData.applicantId
        );
        
        // Nachricht für den Task-Ersteller
        await this.sendSystemMessage(
          chatId,
          `Du hast diese Bewerbung abgelehnt.`,
          chatData.taskCreatorId
        );
      }
      
    } catch (error) {
      console.error('Error rejecting applicant:', error);
      throw error;
    }
  }

  /**
   * Create a test chat between the current user and a support agent
   */
  async createTestChat(userId: string): Promise<string> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Create or get the test user
      const testUserId = 'test-user-123';
      const testUserRef = doc(db, 'users', testUserId);
      const testUserSnapshot = await getDoc(testUserRef);
      
      // Create test user if it doesn't exist
      if (!testUserSnapshot.exists()) {
        // Use setDoc instead of updateDoc for a new document
        await addDoc(collection(db, 'users'), {
          uid: testUserId,
          displayName: 'Support Team',
          email: 'support@doit-app.com',
          photoURL: 'https://ui-avatars.com/api/?name=Support+Team&background=6366f1&color=fff',
          createdAt: serverTimestamp(),
          completedTasks: 147,
          postedTasks: 23,
          rating: 4.9,
          ratingCount: 86
        });
      }
      
      // Check if a chat already exists between these users
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', userId)
      );
      
      const chatsSnapshot = await getDocs(q);
      let existingChat = null;
      
      chatsSnapshot.forEach(chatDoc => {
        const chatData = chatDoc.data();
        if (chatData.participants.includes(testUserId)) {
          existingChat = { id: chatDoc.id, ...chatData };
        }
      });
      
      if (existingChat) {
        console.log('Existing test chat found', existingChat.id);
        return existingChat.id;
      }
      
      // Get user's display name and profile data
      const userRef = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userRef);
      const userData = userSnapshot.exists() ? userSnapshot.data() : null;
      const userDisplayName = userData?.displayName || 'User';
      const userPhotoURL = userData?.photoURL || userData?.avatarUrl || '';
      const userAvatarBase64 = userData?.avatarBase64 || null;
      
      // Create a new chat
      const chatData = {
        taskId: 'welcome-task',
        taskTitle: 'Willkommen bei DoIt!',
        participants: [userId, testUserId],
        participantNames: {
          [userId]: userDisplayName,
          [testUserId]: 'Support Team'
        },
        participantAvatars: {
          [userId]: userPhotoURL,
          [testUserId]: 'https://ui-avatars.com/api/?name=Support+Team&background=6366f1&color=fff'
        },
        // Neue Felder für Base64/URL Bilder
        participantAvatarBase64: {
          [userId]: userAvatarBase64,
          [testUserId]: null
        },
        participantAvatarUrls: {
          [userId]: userPhotoURL,
          [testUserId]: 'https://ui-avatars.com/api/?name=Support+Team&background=6366f1&color=fff'
        },
        lastMessage: 'Willkommen bei DoIt! Wie kann ich Ihnen helfen?',
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: testUserId,
        lastReadBy: {},
        createdAt: serverTimestamp()
      };
      
      const chatRef = await addDoc(collection(db, 'chats'), chatData);
      
      // Add welcome messages
      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        content: 'Willkommen bei DoIt! Wie kann ich Ihnen helfen?',
        senderId: testUserId,
        senderName: 'Support Team',
        timestamp: serverTimestamp(),
        messageType: 'text',
        status: 'sent'
      });
      
      // Add a second message about the image upload feature
      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        content: 'Sie können mir jederzeit Fragen zur App stellen. Probieren Sie auch unsere neue Bildupload-Funktion im Chat aus!',
        senderId: testUserId,
        senderName: 'Support Team',
        timestamp: serverTimestamp(),
        messageType: 'text',
        status: 'sent'
      });
      
      console.log('Created test chat with ID:', chatRef.id);
      return chatRef.id;
    } catch (error) {
      console.error('Error creating test chat:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const chatService = new ChatService();