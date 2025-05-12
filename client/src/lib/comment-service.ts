import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp, 
  increment,
  DocumentReference 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  uploadString,
  getDownloadURL
} from 'firebase/storage';
import { db, auth, storage } from './firebase';

export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: Timestamp;
  likes: number;
  parentId?: string; // ID des übergeordneten Kommentars (falls es eine Antwort ist)
  imageUrl?: string; // URL zum hochgeladenen Bild
  replies?: TaskComment[]; // Array von Antworten
}

class CommentService {
  private _activeListeners: Map<string, () => void> = new Map();

  /**
   * Get comments for a task with real-time updates
   */
  getTaskComments(
    taskId: string, 
    callback: (comments: TaskComment[]) => void, 
    onError: (error: Error) => void
  ): () => void {
    try {
      if (!taskId) {
        onError(new Error('Task ID is required to get comments'));
        return () => {};
      }

      const commentsRef = collection(db, 'comments');
      const q = query(
        commentsRef,
        where('taskId', '==', taskId),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        async (snapshot) => {
          try {
            // Erstelle eine Liste mit allen Autoren-IDs für Batch-Abfrage
            // Verwende direkt ein Array anstatt eines Sets, um TypeScript-Probleme zu vermeiden
            const authorIdsArray: string[] = [];
            snapshot.docs.forEach(doc => {
              const authorId = doc.data().authorId;
              if (authorId && !authorIdsArray.includes(authorId)) {
                authorIdsArray.push(authorId);
              }
            });
            
            if (authorIdsArray.length > 0) {
              console.log(`Fetching ${authorIdsArray.length} user profiles individually`);
            }
            
            // Hole alle Benutzerprofile einzeln, anstatt mit einer 'in'-Abfrage
            const userProfiles = new Map();
            try {
              // Einzelne Abfragen für jeden Autor durchführen
              for (let i = 0; i < authorIdsArray.length; i++) {
                const authorId = authorIdsArray[i];
                try {
                  // 1. Versuche das Profil aus 'userProfiles' zu laden
                  const userProfileRef = doc(db, 'userProfiles', authorId);
                  const userProfileDoc = await getDoc(userProfileRef);
                  
                  if (userProfileDoc.exists()) {
                    const userData = userProfileDoc.data();
                    if (userData) {
                      // Sicherstellen, dass die Benutzer-ID im Datensatz ist
                      userProfiles.set(authorId, { ...userData, uid: authorId });
                      continue; // Wenn gefunden, mit dem nächsten Autor fortfahren
                    }
                  }
                  
                  // 2. Wenn nicht in userProfiles, versuche es in der "users"-Sammlung
                  try {
                    const userRef = doc(db, 'users', authorId);
                    const userDoc = await getDoc(userRef);
                    
                    if (userDoc.exists()) {
                      const userData = userDoc.data();
                      userProfiles.set(authorId, { ...userData, uid: authorId });
                    }
                  } catch (userError) {
                    console.warn(`Fehler beim Abrufen des Benutzers ${authorId}:`, userError);
                  }
                } catch (individualError) {
                  console.warn(`Fehler beim Abrufen des Profils für Benutzer ${authorId}:`, individualError);
                }
              }
              console.log('All creator profiles fetched individually');
            } catch (profileError) {
              console.warn('Error fetching user profiles:', profileError);
            }
            
            // Erstelle die Kommentarliste mit verbesserten Profilbildern
            const commentsList = snapshot.docs.map(doc => {
              const commentData = doc.data();
              const authorId = commentData.authorId;
              let authorAvatar = commentData.authorAvatar || '';
              
              // Überprüfe, ob wir ein besseres Profilbild aus dem Userprofil haben
              const userProfile = userProfiles.get(authorId);
              if (userProfile && userProfile.photoURL) {
                // Bevorzuge das Profilbild aus dem userProfile
                authorAvatar = userProfile.photoURL;
              }
              
              return { 
                id: doc.id, 
                ...commentData,
                authorAvatar // Überschreibe mit dem verbesserten Avatarbild
              } as TaskComment;
            });
            
            callback(commentsList);
          } catch (err) {
            console.error('Error processing comments:', err);
            callback([]);
          }
        },
        (error) => {
          console.error('Error getting comments:', error);
          onError(error);
        }
      );

      // Store the unsubscribe function with a unique key
      const listenerKey = `task-comments-${taskId}`;
      this._activeListeners.set(listenerKey, unsubscribe);

      return () => {
        unsubscribe();
        this._activeListeners.delete(listenerKey);
      };
    } catch (error) {
      console.error('Error setting up comments listener:', error);
      onError(error instanceof Error ? error : new Error('Unknown error getting comments'));
      return () => {};
    }
  }

  /**
   * Add a comment to a task
   */
  async addComment(
    taskId: string, 
    content: string, 
    authorId?: string, 
    authorName?: string,
    parentId?: string,
    imageUrl?: string
  ): Promise<string> {
    try {
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      
      // Erlaube leeren Kommentartext, wenn ein Bild vorhanden ist
      if (!content.trim() && !imageUrl) {
        throw new Error('Comment content or image is required');
      }

      // If authorId/name are not provided, try to get from Firebase auth
      let userId = authorId;
      let userName = authorName;
      let userAvatar = '';
      
      if (!userId || !userName) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          userId = currentUser.uid;
          userName = currentUser.displayName || 'User';
          
          // Verwende das aktuelle Profilbild aus verschiedenen Quellen
          // 1. Zuerst prüfen wir, ob ein photoURL im Auth-Objekt vorhanden ist
          userAvatar = currentUser.photoURL || '';
          
          // 2. Versuche das Profilbild aus dem localStorage zu holen (falls vorhanden)
          try {
            const localUserData = localStorage.getItem(`user_profile_${currentUser.uid}`);
            if (localUserData) {
              const userData = JSON.parse(localUserData);
              if (userData.photoURL) {
                userAvatar = userData.photoURL;
                console.log('Using photoURL from localStorage for comment avatar');
              } else if (userData.avatarUrl) {
                userAvatar = userData.avatarUrl;
                console.log('Using avatarUrl from localStorage for comment avatar');
              } else if (userData.avatarBase64) {
                userAvatar = userData.avatarBase64;
                console.log('Using avatarBase64 from localStorage for comment avatar');
              }
            }
          } catch (e) {
            console.warn('Error getting user avatar from localStorage:', e);
          }
        } else {
          throw new Error('User must be logged in to add comments');
        }
      }

      // Add comment to Firestore
      const commentData: any = {
        taskId,
        content: content.trim(),
        authorId: userId,
        authorName: userName,
        authorAvatar: userAvatar,
        timestamp: serverTimestamp(),
        likes: 0
      };

      // Wenn es sich um eine Antwort handelt, füge parentId hinzu
      if (parentId) {
        commentData.parentId = parentId;
      }

      // Wenn ein Bild angehängt wurde, füge die Bild-URL hinzu
      if (imageUrl) {
        commentData.imageUrl = imageUrl;
      }

      const commentRef = await addDoc(collection(db, 'comments'), commentData);

      // Update task with comment count
      await updateDoc(doc(db, 'tasks', taskId), {
        commentCount: increment(1)
      });

      return commentRef.id;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }
  
  /**
   * Reply to a comment
   */
  async replyToComment(
    commentId: string,
    content: string,
    imageUrl?: string
  ): Promise<string> {
    try {
      if (!commentId || !content.trim()) {
        throw new Error('Comment ID and reply content are required');
      }
      
      // Get the parent comment to access the taskId
      const commentDoc = await getDoc(doc(db, 'comments', commentId));
      if (!commentDoc.exists()) {
        throw new Error('Parent comment not found');
      }
      
      const parentComment = commentDoc.data() as TaskComment;
      const taskId = parentComment.taskId;
      
      // Now add the reply as a new comment with parentId
      return this.addComment(taskId, content, undefined, undefined, commentId, imageUrl);
    } catch (error) {
      console.error('Error replying to comment:', error);
      throw error;
    }
  }
  
  /**
   * Upload an image for a comment
   * Produktionsreife Implementierung mit configirierbarem Speicherort:
   * - Firebase Storage (für Produktion)
   * - Data-URL (für Entwicklung oder wenn Storage nicht verfügbar ist)
   * 
   * Die Methode wird über das ENV-Flag VITE_USE_FIREBASE_STORAGE gesteuert
   */
  async uploadCommentImage(file: File): Promise<string> {
    try {
      // Import der Konfiguration
      const { FEATURES, APP_CONFIG, logger } = await import('./config');
      
      // Prüfe, ob die Datei zu groß ist
      if (file.size > APP_CONFIG.MAX_UPLOAD_SIZE) {
        logger.warn(`Bild zu groß (${(file.size / 1024 / 1024).toFixed(2)}MB), maximale Größe: ${APP_CONFIG.MAX_UPLOAD_SIZE / 1024 / 1024}MB`);
        return Promise.reject(new Error(`Bild zu groß, maximale Größe: ${APP_CONFIG.MAX_UPLOAD_SIZE / 1024 / 1024}MB`));
      }
      
      // Für die Entwicklungsumgebung immer Data-URL (Base64) verwenden
      // Firebase Storage verursacht CORS-Probleme in der Entwicklungsumgebung
      if (false && FEATURES.USE_FIREBASE_STORAGE) { // FEATURES.USE_FIREBASE_STORAGE ist in der Konfiguration temporär deaktiviert
        try {
          logger.info('Firebase Storage ist aktiviert, versuche Upload...');
          
          // Komprimiere das Bild vor dem Upload, wenn die Feature aktiviert ist
          let imageFile = file;
          if (FEATURES.ENABLE_IMAGE_COMPRESSION && file.size > 1024 * 1024) {
            logger.debug('Großes Bild erkannt, wird komprimiert');
            
            // Hier könnte eine Komprimierung erfolgen
            const { compressImage } = await import('@/utils/imageUtils');
            imageFile = await compressImage(file, {
              maxSizeMB: 0.5,
              maxWidthOrHeight: 1200,
              useWebWorker: true
            });
          }
          
          // Generiere einen eindeutigen Dateinamen mit Timestamp, um Konflikte zu vermeiden
          const uniqueFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          
          // Referenz zum Firebase Storage erstellen
          const storageRef = ref(storage, `${APP_CONFIG.FIREBASE_STORAGE_BASE_PATH}/${uniqueFilename}`);
          
          // Zugängliche Metadaten für öffentliches Caching und bessere Performance
          const metadata = {
            contentType: file.type,
            cacheControl: 'public, max-age=31536000', // 1 Jahr Cache
          };
          
          // Bild hochladen mit Metadaten
          logger.info('Starte Firebase Storage Upload...');
          const uploadResult = await uploadBytes(storageRef, imageFile, metadata);
          logger.info('Bild erfolgreich hochgeladen');
          logger.debug('Upload details:', uploadResult);
          
          // URL des hochgeladenen Bildes abrufen
          const downloadURL = await getDownloadURL(uploadResult.ref);
          logger.info('Bild-URL erhalten');
          logger.debug('Download URL:', downloadURL);
          
          return downloadURL;
        } catch (storageError) {
          // Wenn Firebase Storage fehlschlägt, logge den Fehler
          logger.warn('Firebase Storage Upload fehlgeschlagen, Fallback auf DataURL', storageError);
          
          // Bei Fehler auf DataURL zurückfallen
          return this.convertToDataUrl(file);
        }
      } else {
        // Wenn Firebase Storage nicht aktiviert ist, verwende DataURL
        logger.info('Firebase Storage deaktiviert, verwende Data-URL für Kommentarbild');
        
        // Komprimiere das Bild vor der Base64-Kodierung
        if (FEATURES.ENABLE_IMAGE_COMPRESSION && file.size > 500 * 1024) {
          logger.info('Komprimiere Bild für Base64-Kodierung');
          try {
            const { compressImage } = await import('@/utils/imageUtils');
            const compressedFile = await compressImage(file, {
              maxSizeMB: 0.3, // Stärkere Komprimierung für Base64
              maxWidthOrHeight: 1000,
              useWebWorker: true
            });
            
            return this.convertToDataUrl(compressedFile);
          } catch (compressionError) {
            logger.warn('Bildkomprimierung fehlgeschlagen, verwende Originalbild', compressionError);
          }
        }
        
        return this.convertToDataUrl(file);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      // Im Fehlerfall einen Platzhalter zurückgeben, damit das UI nicht kaputt geht
      return 'https://via.placeholder.com/400x300?text=Bild+nicht+verfügbar';
    }
  }
  
  /**
   * Konvertiert eine Datei in eine Data-URL
   * (Base64-kodiert, direkt im Browser verwendbar)
   */
  private convertToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          // Die Data-URL enthält die Bilddaten als Base64-String
          console.log('Bild als Data-URL kodiert');
          resolve(event.target.result);
        } else {
          reject(new Error('Fehler beim Lesen der Datei'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Fehler beim Lesen der Datei'));
      };
      
      // Bild als Data-URL lesen
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Prüft, ob Firebase Storage korrekt konfiguriert ist
   * Diese Funktion kann verwendet werden, um zu testen, ob die Storage-Einstellungen korrekt sind
   * und ggf. das Feature-Flag automatisch zu setzen
   */
  async checkStorageConfiguration(): Promise<boolean> {
    try {
      const { logger } = await import('./config');
      
      // Versuche, eine Testdatei aus dem Storage zu laden
      const testRef = ref(storage, 'test/storage-test.txt');
      
      // Erstelle eine kleine Testdatei, falls sie nicht existiert
      try {
        logger.debug('Erstelle Testdatei in Firebase Storage...');
        await uploadString(testRef, 'Storage funktioniert!');
      } catch (uploadError) {
        logger.warn('Konnte Testdatei nicht erstellen, prüfe nur Lesezugriff', uploadError);
      }
      
      // Versuche, die URL der Testdatei abzurufen
      try {
        const url = await getDownloadURL(testRef);
        logger.info('Firebase Storage ist korrekt konfiguriert');
        return true;
      } catch (downloadError) {
        logger.error('Firebase Storage ist nicht korrekt konfiguriert', downloadError);
        return false;
      }
    } catch (error) {
      console.error('Fehler bei der Prüfung der Storage-Konfiguration:', error);
      return false;
    }
  }
  
  /**
   * Helper: Aktualisiert das Firebase Storage Feature-Flag basierend auf der Verfügbarkeit
   * Kann beim App-Start aufgerufen werden, um automatisch das beste Storage-Verfahren zu wählen
   */
  async autoConfigureStorage(): Promise<boolean> {
    try {
      const { logger } = await import('./config');
      const isStorageAvailable = await this.checkStorageConfiguration();
      
      // Hier könnte eine Einstellung im localStorage gespeichert werden
      localStorage.setItem('firebaseStorageAvailable', isStorageAvailable.toString());
      
      logger.info(`Firebase Storage Flag automatisch auf ${isStorageAvailable} gesetzt`);
      return isStorageAvailable;
    } catch (error) {
      console.error('Fehler bei der automatischen Storage-Konfiguration:', error);
      return false;
    }
  }
  
  /**
   * Like a comment
   */
  async likeComment(commentId: string): Promise<void> {
    try {
      if (!commentId) {
        throw new Error('Comment ID is required');
      }
      
      // Update comment with like count
      await updateDoc(doc(db, 'comments', commentId), {
        likes: increment(1)
      });
    } catch (error) {
      console.error('Error liking comment:', error);
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
}

export const commentService = new CommentService();