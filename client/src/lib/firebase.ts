import { initializeApp, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithRedirect, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut, 
  onAuthStateChanged,
  type User,
  type Auth
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  updateDoc,
  serverTimestamp,
  GeoPoint,
  increment,
  onSnapshot,
  setDoc,
  arrayUnion,
  arrayRemove,
  limit,
  type Firestore
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, type FirebaseStorage } from "firebase/storage";

// Die globalen Typendefinitionen für Window wurden nach client/src/types.d.ts verschoben

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: "123456789012", // Dummy-Wert, wird für Auth nicht benötigt
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase-Konfiguration ist eingerichtet - keine Debug-Logs im Produktionscode

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore; 
let storage: FirebaseStorage;

try {
  // Firebase App initialisieren
  app = initializeApp(firebaseConfig);
  
  // Firebase Auth initialisieren
  auth = getAuth(app);
  
  // Firestore initialisieren
  db = getFirestore(app);
  
  // Storage initialisieren
  try {
    const bucketName = `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`;
    storage = getStorage(app);
    
    // Storage-Dienst testen
    const testRef = ref(storage, 'test/connection_test.txt');
  } catch (storageError) {
    console.error("Firebase Storage Initialisierungsfehler:", storageError);
    console.error("Firebase Storage konnte nicht initialisiert werden. Bitte überprüfen Sie die Firebase Console und aktivieren Sie den Storage-Dienst.");
    
    // Fallback-Storage-Instanz erstellen, um TypeScript-Fehler zu vermeiden
    storage = null as unknown as FirebaseStorage;
  }
  
  console.log("Firebase vollständig initialisiert und einsatzbereit");
  
  // Für Debugging-Zwecke
  if (typeof window !== 'undefined') {
    window.firebaseApp = app;
  }
} catch (error) {
  console.error("Firebase Initialisierungsfehler:", error);
  
  // Fallback-Instanzen erstellen, um TypeScript-Fehler zu vermeiden
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

// Authentication providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// User levels definition
export const userLevels = [
  { name: "Task-Küken", minTasks: 0, minRating: 0 },
  { name: "DoIt-Anfänger", minTasks: 3, minRating: 3 },
  { name: "DoIt-Profi", minTasks: 8, minRating: 3.5 },
  { name: "DoIt-Ninja", minTasks: 15, minRating: 4 },
  { name: "Superheld:in", minTasks: 25, minRating: 4.5 },
];

// Auth functions
export const signInWithGoogle = () => signInWithRedirect(auth, googleProvider);
export const signInWithFacebook = () => signInWithRedirect(auth, facebookProvider);
export const loginWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const registerWithEmail = (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);

// Helper for file uploads
export const uploadTaskImage = async (file: File, taskId: string) => {
  const storageRef = ref(storage, `tasks/${taskId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Lädt ein Chat-Bild für einen Chat hoch und gibt die URL zurück
 * Hybride Implementierung mit Base64 für Entwicklung und Firebase Storage für Produktion
 * 
 * @param file Die hochzuladende Bild-Datei
 * @param chatId Die ID des Chats
 * @returns URL des hochgeladenen Bildes oder Base64-String
 */
export const uploadChatImage = async (file: File, chatId: string): Promise<string> => {
  try {
    console.log("Starte Upload von Chat-Bild:", file.name);
    
    if (!file) throw new Error("Keine Datei zum Hochladen angegeben");
    if (!chatId) throw new Error("Keine Chat-ID angegeben");
    
    // Konfiguration importieren
    const { FEATURES, logger } = await import('./config');
    
    // Komprimiere das Bild mit browser-image-compression
    const { compressImage } = await import('@/utils/imageUtils');
    
    // Stärkere Komprimierung für Base64-Kodierung (wg. Firestore Dokumentlimit)
    // und normale Komprimierung für Firebase Storage
    const compressionOptions = {
      maxSizeMB: 0.3,           // 300KB für Base64, sehr starke Komprimierung
      maxWidthOrHeight: 800,    // Maximal 800px für Chat-Bilder
      useWebWorker: true        // Für bessere Performance
    };
    
    const compressedFile = await compressImage(file, compressionOptions);
    
    console.log("Bild komprimiert:", {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      compressedSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      reduction: `${Math.round((1 - compressedFile.size / file.size) * 100)}%`
    });
    
    // Für die Entwicklung verwenden wir immer Base64-kodierte Bilder, 
    // um CORS-Probleme mit Firebase Storage zu vermeiden
    // Durch das "false &&" wird der Storage-Code nie ausgeführt,
    // aber bleibt im Code für einfache Reaktivierung
    if (false && FEATURES.USE_FIREBASE_STORAGE) {
      logger.info("Versuche Firebase Storage für Chat-Bild zu verwenden");
      
      try {
        // Eindeutiger Dateiname erstellen
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `chat_${chatId}_${timestamp}.${fileExtension}`;
        
        // Referenz zum Firebase Storage erstellen
        const storageRef = ref(storage, `chat-images/${fileName}`);
        
        // Bild hochladen
        const snapshot = await uploadBytes(storageRef, compressedFile);
        
        // Download-URL abrufen
        const downloadUrl = await getDownloadURL(snapshot.ref);
        logger.info("Chat-Bild erfolgreich hochgeladen:", downloadUrl);
        
        return downloadUrl;
      } catch (storageError) {
        logger.warn("Firebase Storage fehlgeschlagen, fallback auf Base64:", storageError);
        // Fallback auf Base64, wenn Firebase Storage fehlschlägt
      }
    }
    
    // Base64-Kodierung (für Entwicklung oder als Fallback)
    logger.info("Verwende Base64-Kodierung für Chat-Bild");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (reader.result && typeof reader.result === 'string') {
          logger.info("Chat-Bild erfolgreich als Base64 kodiert");
          resolve(reader.result);
        } else {
          reject(new Error("Fehler beim Lesen der Bilddatei"));
        }
      };
      
      reader.onerror = () => {
        reject(new Error("Fehler beim Lesen der Bilddatei"));
      };
      
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    console.error("Fehler beim Hochladen des Chat-Bildes:", error);
    throw error; // Fehler weiterleiten zur Behandlung
  }
};

// Upload a profile image for a user and update their profile
export const uploadProfileImage = async (file: File, userId: string) => {
  try {
    console.log("uploadProfileImage (legacy) called, redirecting to uploadUserAvatar");
    return await uploadUserAvatar(file, userId);
  } catch (error) {
    console.error("Error in uploadProfileImage:", error);
    throw error;
  }
};

/**
 * Upload für Profilbilder als Base64
 * 
 * @param imageData Bilddatei oder Base64-String
 * @param userId User-ID
 * @returns Base64-String des gespeicherten Bildes
 */
export const uploadUserAvatarBase64 = async (imageData: string | File, userId: string): Promise<string> => {
  try {
    // Falls ein File-Objekt übergeben wurde, erst zu Base64 konvertieren
    const { compressAndConvertToBase64, ensureSmallerThan } = await import('@/utils/imageUtils');
    let base64Data = typeof imageData === 'string'
      ? imageData
      : await compressAndConvertToBase64(imageData, 0.5); // Max 0.5 MB
    
    // Optional: Prüfen, ob die Datei zu groß ist und ggf. weiter komprimieren
    const estimatedSize = base64Data.length;
    if (estimatedSize > 700000) { // ca. 700 KB Schwellenwert (Firestore-Limit: 1 MB)
      console.warn("Bild zu groß für Firestore, versuche erneute Komprimierung");
      base64Data = await ensureSmallerThan(base64Data, 700); // Auf 700 KB begrenzen
    }
    
    // In Firestore speichern
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      avatarBase64: base64Data,
      avatarUrl: base64Data, // Für Abwärtskompatibilität
      photoURL: base64Data, // Für Kompatibilität mit Auth-Benutzer
      photoUpdatedAt: new Date().toISOString()
    });
    
    return base64Data;
  } catch (error) {
    console.error("Fehler beim Speichern des Base64-Bildes:", error);
    throw error;
  }
};

/**
 * Verbesserte Funktion zum Hochladen von Benutzeravataren mit robuster Fehlerbehandlung
 *
 * @param file Das hochzuladende Bild als File-Objekt
 * @param userId Die ID des Benutzers
 * @returns URL des hochgeladenen Bildes
 * @throws Error wenn der Upload fehlschlägt
 */
export const uploadUserAvatar = async (file: File, userId: string): Promise<string> => {
  // Input-Validierung
  if (!file) throw new Error("Keine Datei zum Hochladen angegeben");
  if (!userId) throw new Error("Keine Benutzer-ID angegeben");
  if (!(file instanceof File)) throw new Error("Ungültiges Dateiobjekt");
  
  // Bildtyp validieren
  const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validImageTypes.includes(file.type)) {
    throw new Error(`Nicht unterstützter Dateityp: ${file.type}. Bitte verwende JPG, PNG, WebP oder GIF.`);
  }
  
  // Dateigröße validieren
  const maxSizeMB = 5;
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Datei zu groß: ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum: ${maxSizeMB} MB.`);
  }
  
  try {
    // Config-Werte importieren
    const { FEATURES, IS_DEVELOPMENT } = await import('@/lib/config');
    
    // Versuche zunächst, das Bild zu komprimieren - bei Base64 ist das besonders wichtig
    let fileToUpload = file;
    if (file.type !== 'image/gif') {
      try {
        const { compressImage } = await import('@/utils/imageUtils');
        
        // Für Base64-Speicherung SEHR stark komprimieren, um Firestore-Dokumentlimit (1MB) einzuhalten
        // Für Firebase Storage können wir größere Dateien erlauben
        const compressionOptions = !FEATURES.USE_FIREBASE_STORAGE 
          ? { maxSizeMB: 0.3, maxWidthOrHeight: 500 }  // Sehr starke Kompression für Base64 (Firestore hat 1MB Limit)
          : { maxSizeMB: 1, maxWidthOrHeight: 1200 };  // Normale Kompression für Storage
        
        fileToUpload = await compressImage(file, {
          ...compressionOptions,
          useWebWorker: true
        });
        
        console.log(`Bild komprimiert: ${(file.size / 1024 / 1024).toFixed(2)} MB → ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (compressionError) {
        console.warn("Bildkomprimierung fehlgeschlagen, verwende Original:", compressionError);
        // Verwende das Original, wenn die Komprimierung fehlschlägt
        fileToUpload = file;
      }
    }
    
    // Hybride Upload-Strategie: Base64 in Entwicklung, Firebase Storage in Produktion
    if (FEATURES.USE_FIREBASE_STORAGE) {
      console.log("🌩️ Verwende Firebase Storage für Bild-Upload (Produktionsmodus)");
      
      // Eindeutiger Dateiname mit Benutzer-ID, Timestamp und sanitiertem Originalnamen
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').substring(0, 50);
      const uniqueFileName = `avatar_${userId}_${timestamp}_${safeFileName}`;
      
      // Storage-Referenz mit korrektem Pfad erstellen
      const storageRef = ref(storage, `avatars/${userId}/${uniqueFileName}`);
      
      // Metadaten für optimierten Cache und Content-Type
      const metadata = {
        contentType: file.type,
        cacheControl: 'public, max-age=86400' // 24h Cache
      };
      
      // Fortschrittsverfolgung vorbereiten
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload, metadata);
      
      // Upload durchführen und auf Abschluss warten
      const snapshot = await uploadTask;
      console.log(`Upload abgeschlossen: ${snapshot.bytesTransferred} Bytes`);
      
      // Download-URL abrufen
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      // Profil mit neuer Bild-URL aktualisieren
      await updateUserProfile(userId, {
        photoURL: downloadUrl,
        avatarUrl: downloadUrl, // Für Abwärtskompatibilität
        photoUpdatedAt: new Date().toISOString(),
        // Wenn vorher Base64 verwendet wurde, dieses Feld löschen (null setzen)
        avatarBase64: null 
      });
      
      return downloadUrl;
    } else {
      console.log("💾 Verwende Base64 für Bild-Upload (Entwicklungsmodus)");
      
      // Base64-Encoding über FileReader
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async () => {
          try {
            if (!reader.result) {
              throw new Error("Fehler beim Lesen der Datei");
            }
            
            // Base64-String extrahieren
            let imageDataUrl = reader.result.toString();
            
            // Überprüfen, ob Base64-String zu groß ist (Firestore-Limit: 1MB pro Dokument)
            const sizeInMB = imageDataUrl.length / 1024 / 1024;
            
            if (sizeInMB > 0.9) { // 900KB als Sicherheitspuffer
              console.warn("⚠️ Base64-String ist zu groß:", sizeInMB.toFixed(2), "MB");
              console.warn("⚠️ Firestore hat ein Limit von 1MB pro Dokument");
              
              // NOTFALL-MAXI-KOMPRESSION: Nochmals mit extremen Einstellungen komprimieren
              try {
                console.warn("🔄 Notfall-Kompression wird durchgeführt...");
                
                // Konvertiere Base64 zurück zu Blob für zweite Komprimierung
                const byteString = atob(imageDataUrl.split(',')[1]);
                const mimeType = imageDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const arrayBuffer = new ArrayBuffer(byteString.length);
                const uint8Array = new Uint8Array(arrayBuffer);
                
                for (let i = 0; i < byteString.length; i++) {
                  uint8Array[i] = byteString.charCodeAt(i);
                }
                
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const notfallFile = new File([blob], "emergency-compressed.jpg", { type: mimeType });
                
                // Extreme Komprimierung durchführen
                const { compressImage } = await import('@/utils/imageUtils');
                const extremeCompressedFile = await compressImage(notfallFile, {
                  maxSizeMB: 0.15,  // Ultra-niedrige Größe (max 150KB)
                  maxWidthOrHeight: 300,  // Sehr kleine Auflösung
                  useWebWorker: true
                });
                
                // Zum Base64 konvertieren
                const tempReader = new FileReader();
                tempReader.readAsDataURL(extremeCompressedFile);
                
                const emergencyBase64 = await new Promise<string>((resolve, reject) => {
                  tempReader.onload = () => resolve(tempReader.result as string);
                  tempReader.onerror = () => reject(new Error("Notfall-Komprimierung fehlgeschlagen"));
                });
                
                if ((emergencyBase64.length / 1024 / 1024) > 0.95) {
                  throw new Error("Auch Notfallkomprimierung erzeugt zu große Datei");
                }
                
                console.warn(`✅ Notfall-Kompression erfolgreich: ${sizeInMB.toFixed(2)}MB → ${(emergencyBase64.length / 1024 / 1024).toFixed(2)}MB`);
                
                // Ersetze die große Version durch die Notfallversion
                imageDataUrl = emergencyBase64;
              } catch (emergencyError) {
                console.error("⛔ Notfall-Kompression fehlgeschlagen:", emergencyError);
                throw new Error(`Das Bild ist zu groß für Firestore (${sizeInMB.toFixed(2)}MB). Bitte verwende ein kleineres Bild oder aktiviere Firebase Storage.`);
              }
            }
            
            // Firestore-Dokument mit Base64-String aktualisieren
            const userRef = doc(db, "users", userId);
            
            // Aktualisieren mit Base64-Daten
            await updateDoc(userRef, {
              avatarBase64: imageDataUrl,
              photoURL: imageDataUrl, // Für Kompatibilität mit beiden Ansätzen
              avatarUrl: imageDataUrl, // Für Abwärtskompatibilität
              photoUpdatedAt: new Date().toISOString()
            });
            
            console.log("✅ Base64-Bild erfolgreich in Firestore gespeichert");
            
            // Im Entwicklungsmodus Hinweis zum Umschalten anzeigen
            if (IS_DEVELOPMENT) {
              console.log("🔁 Um auf Firebase Storage umzuschalten, verwende localStorage.setItem('feature_USE_FIREBASE_STORAGE', 'true')");
            }
            
            resolve(imageDataUrl);
          } catch (error) {
            console.error("Fehler beim Speichern des Base64-Bildes:", error);
            reject(error);
          }
        };
        
        reader.onerror = () => {
          reject(new Error("Fehler beim Lesen der Datei"));
        };
        
        // Datei als Data-URL lesen
        reader.readAsDataURL(fileToUpload);
      });
    }
  } catch (error: any) {
    // Fehlerbehandlung mit nützlichen Meldungen für verschiedene Fehlertypen
    console.error("Fehler beim Hochladen des Profilbilds:", error);
    
    // Firebase Storage spezifische Fehlercodes übersetzen
    if (error.code) {
      switch (error.code) {
        case 'storage/unauthorized':
          throw new Error("Zugriff verweigert. Bitte melde dich erneut an.");
        case 'storage/canceled':
          throw new Error("Upload wurde abgebrochen.");
        case 'storage/retry-limit-exceeded':
          throw new Error("Netzwerkfehler. Bitte überprüfe deine Internetverbindung.");
        case 'storage/invalid-checksum':
          throw new Error("Datei beschädigt. Bitte versuche es mit einer anderen Datei.");
        case 'storage/server-file-wrong-size':
          throw new Error("Server-Fehler beim Upload. Bitte versuche es später erneut.");
        default:
          throw new Error(`Upload-Fehler: ${error.message || 'Unbekannter Fehler'}`);
      }
    }
    
    // Allgemeiner Fehler
    throw error;
  }
}

/**
 * Modernisierte Hilfsfunktion zum Komprimieren von Bildern
 * Diese Funktion ist veraltet und sollte nicht mehr verwendet werden.
 * Stattdessen sollte die Funktion compressImage aus @/utils/imageUtils verwendet werden.
 *
 * @deprecated Verwende stattdessen import { compressImage } from '@/utils/imageUtils'
 */
const compressAndResizeImage = async (file: File, maxSize = 800): Promise<string> => {
  try {
    console.warn('⚠️ VERALTETE FUNKTION: compressAndResizeImage() sollte nicht mehr verwendet werden!');
    console.warn('Verwende stattdessen import { compressImage } from "@/utils/imageUtils"');
    
    // Lade die komprimierungsfunktion aus dem utils-Modul
    const { compressImage } = await import('@/utils/imageUtils');
    
    // Komprimiere das Bild mit der Bibliothek
    const compressedFile = await compressImage(file, {
      maxWidthOrHeight: maxSize,
      maxSizeMB: 0.7
    });
    
    // Für Abwärtskompatibilität: Konvertiere das komprimierte File zurück in ein Blob URL
    const objectUrl = URL.createObjectURL(compressedFile);
    
    // Log für Debuggingzwecke
    console.log('Bild mit moderner Methode komprimiert:', {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      compressedSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      reduction: `${Math.round((1 - compressedFile.size / file.size) * 100)}%`
    });
    
    return objectUrl;
  } catch (error) {
    console.error('Fehler beim Komprimieren des Bildes:', error);
    throw error;
  }
};

// User profile helpers
export const createUserProfile = async (user: User, additionalData?: Record<string, any>) => {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userRef);
    
    if (!userSnapshot.exists()) {
      console.log("Creating new user profile for:", user.uid);
      const { email, displayName, photoURL } = user;
      const createdAt = serverTimestamp();
      
      try {
        // Create a new document
        await setDoc(userRef, {
          uid: user.uid,
          email: email || '',
          displayName: displayName || 'Anonymous User',
          photoURL: photoURL || '',
          createdAt,
          completedTasks: 0,
          postedTasks: 0,
          rating: 0,
          ratingCount: 0,
          skills: [],
          location: null,
          ...additionalData
        });
        console.log("User profile created successfully");
      } catch (error) {
        console.error("Error creating user profile:", error);
      }
    } else {
      console.log("User profile already exists for:", user.uid);
    }
    
    return userRef;
  } catch (error) {
    console.error("Error in createUserProfile:", error);
    // Create a dummy reference as fallback to prevent app from crashing
    return doc(db, "users", user.uid);
  }
};

export const updateUserProfile = async (userId: string, data: Record<string, any>) => {
  try {
    console.log("updateUserProfile called with userId:", userId);
    console.log("updateUserProfile data:", data);
    
    if (!userId) {
      throw new Error("userId is required for updateUserProfile");
    }
    
    const userRef = doc(db, "users", userId);
    console.log("User document reference:", userRef.path);
    
    // Überprüfe, ob es Änderungen an den Benutzerdaten gibt
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.warn("User document does not exist. Creating new document.");
      
      // Erstelle das Dokument, da es nicht existiert
      const newUserData = { 
        ...data,
        uid: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      };
      
      await setDoc(userRef, newUserData);
      console.log("New user profile created successfully");
      return;
    }
    
    // Bereite die Daten für das Update vor
    const updateData = { 
      ...data, 
      updatedAt: serverTimestamp() 
    };
    console.log("Update data being sent to Firestore:", updateData);
    
    // Führe das Update durch
    const result = await updateDoc(userRef, updateData);
    console.log("Profile update successful");
    
    return result;
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
};

export const getUserProfile = async (userId: string, forceRefresh = false) => {
  try {
    if (!userId) {
      console.error("getUserProfile called with empty userId");
      return null;
    }
    
    const userRef = doc(db, "users", userId);
    
    // Wenn Aktualisierung erzwungen wird, holen wir das Profil direkt vom Server
    // Hinweis: getDoc akzeptiert in der aktuellen Version keine options für die source
    const userSnapshot = await getDoc(userRef);
    
    if (!userSnapshot.exists()) {
      console.warn(`No user profile found for userId: ${userId}`);
      return null;
    }
    
    const userData = userSnapshot.data();
    console.log(`User profile data for user ${userId}:`, userData);
    
    // Stelle sicher, dass eine uid im Profil existiert
    if (userData && !userData.uid) {
      userData.uid = userId;
    }
    
    // Stelle sicher, dass unreadNotifications existiert
    if (userData && userData.unreadNotifications === undefined) {
      console.log(`Adding missing unreadNotifications field for user ${userId}`);
      await updateDoc(userRef, { unreadNotifications: 0 });
      userData.unreadNotifications = 0;
    }
    
    return userData;
  } catch (error) {
    console.error(`Error getting user profile for ${userId}:`, error);
    return null;
  }
};

// Überprüfen, ob ein Benutzername bereits existiert
export const usernameExists = async (username: string): Promise<boolean> => {
  try {
    // Abfrage erstellen, die nach dem Benutzernamen sucht
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("displayName", "==", username));
    const querySnapshot = await getDocs(q);
    
    // Wenn Ergebnisse vorhanden sind, dann existiert der Name bereits
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Fehler beim Überprüfen des Benutzernamens:", error);
    // Im Fehlerfall vorsichtshalber true zurückgeben (Annahme: Name ist belegt)
    return true;
  }
};

// Get all reviews for a user
export const getUserReviews = async (userId: string) => {
  try {
    console.log("Fetching reviews for user:", userId);
    const reviewsRef = collection(db, "reviews");
    // Suche nach Reviews, wo der Benutzer der Empfänger ist (userId)
    const reviewsQuery = query(reviewsRef, where("userId", "==", userId));
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    console.log("Reviews found:", reviewsSnapshot.size);
    
    // Falls keine Reviews gefunden wurden, versuche es mit reviewerId als Feldname
    if (reviewsSnapshot.empty) {
      console.log("No reviews found with userId, trying receiverId");
      // Prüfen, ob wir stattdessen receiverId als Feld nutzen sollten
      const alternativeQuery = query(reviewsRef, where("receiverId", "==", userId));
      const alternativeSnapshot = await getDocs(alternativeQuery);
      
      if (!alternativeSnapshot.empty) {
        console.log("Found reviews with receiverId:", alternativeSnapshot.size);
        
        // Get all reviewer details
        const reviewerIds = new Set(alternativeSnapshot.docs.map(doc => doc.data().reviewerId));
        const reviewerPromises = Array.from(reviewerIds).map(reviewerId => getDoc(doc(db, "users", reviewerId as string)));
        const reviewerDocs = await Promise.all(reviewerPromises);
        const reviewerData = reviewerDocs.reduce((acc, doc) => {
          if (doc.exists()) {
            acc[doc.id] = doc.data();
          }
          return acc;
        }, {} as Record<string, any>);
        
        const reviews = alternativeSnapshot.docs.map(doc => {
          const data = doc.data();
          const reviewer = reviewerData[data.reviewerId] || {};
          
          return {
            id: doc.id,
            ...data,
            authorName: reviewer.displayName || 'Unbekannter Benutzer',
            authorPhotoURL: reviewer.photoURL || undefined,
            createdAt: data.createdAt || new Date()
          };
        });
        
        // Sortiere die Reviews auf Client-Seite nach Datum absteigend
        return reviews.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
      }
    }
    
    // Original-Implementierung, wenn userId Reviews gefunden hat
    // Get all author/reviewer details in a single batch
    const authorIds = new Set(reviewsSnapshot.docs.map(doc => doc.data().reviewerId || doc.data().authorId));
    const authorPromises = Array.from(authorIds).map(authorId => {
      if (!authorId) return Promise.resolve(null);
      return getDoc(doc(db, "users", authorId as string));
    });
    const authorDocs = await Promise.all(authorPromises);
    const authorData = authorDocs.reduce((acc, doc) => {
      if (doc && doc.exists()) {
        acc[doc.id] = doc.data();
      }
      return acc;
    }, {} as Record<string, any>);
    
    // Map reviews with author details
    const reviews = reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      const authorId = data.reviewerId || data.authorId;
      const author = authorData[authorId] || {};
      
      return {
        id: doc.id,
        ...data,
        authorName: author.displayName || 'Unbekannter Benutzer',
        authorPhotoURL: author.photoURL || undefined,
        createdAt: data.createdAt || new Date()
      };
    });
    
    // Sortiere die Reviews auf Client-Seite nach Datum absteigend
    return reviews.sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    return [];
  }
};

// Create a review for a user
export const createReview = async (reviewData: {
  userId: string;
  authorId: string;
  taskId: string;
  taskTitle: string;
  rating: number;
  text: string;
}) => {
  try {
    const reviewsRef = collection(db, "reviews");
    
    // Add the review
    const reviewDoc = await addDoc(reviewsRef, {
      ...reviewData,
      createdAt: serverTimestamp()
    });
    
    // Update user's rating metrics
    const userRef = doc(db, "users", reviewData.userId);
    const userSnapshot = await getDoc(userRef);
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      const currentRating = userData.rating || 0;
      const currentCount = userData.ratingCount || 0;
      
      // Calculate new average rating
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + reviewData.rating) / newCount;
      
      // Update user profile
      await updateDoc(userRef, {
        rating: newRating,
        ratingCount: newCount
      });
    }
    
    return reviewDoc.id;
  } catch (error) {
    console.error("Error creating review:", error);
    throw error;
  }
};

// Task related helpers
export const createTask = async (userId: string, taskData: Record<string, any>) => {
  const tasksRef = collection(db, "tasks");
  const newTask = {
    ...taskData,
    creatorId: userId,
    status: "open",
    createdAt: serverTimestamp(),
    applications: [],
  };
  
  // Add the new task
  const taskDoc = await addDoc(tasksRef, newTask);
  
  // Increment user's postedTasks count
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    postedTasks: increment(1)
  });
  
  return taskDoc.id;
};

// Get tasks with filters
export const getTasks = async (filters: Record<string, any> = {}) => {
  const tasksRef = collection(db, "tasks");
  
  // Start with a simple query without complex filters to avoid index errors
  let taskQuery = query(tasksRef);
  
  try {
    // Add creatorId filter if provided - useful for "My Tasks" section
    if (filters.creatorId) {
      taskQuery = query(taskQuery, where("creatorId", "==", filters.creatorId));
    } else {
      // Only filter by status when not filtering by creator
      taskQuery = query(taskQuery, where("status", "==", "open"));
    }
    
    // Execute the query
    const taskSnapshot = await getDocs(taskQuery);
    
    // Process results in memory for now to avoid complex index requirements
    let tasks = taskSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Sicherstellen, dass imageUrls immer ein Array ist
      const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
      
      // Debug Ausgabe für die gefundenen Bilder
      console.debug(`Task ${doc.id} aus Firestore: ${imageUrls.length} Bilder gefunden`);
      
      return {
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        category: data.category || '',
        price: data.price || 0,
        status: data.status || 'open',
        location: data.location || '',
        locationCoordinates: data.locationCoordinates,
        creatorId: data.creatorId || '',
        creatorName: data.creatorName || '',
        creatorPhotoURL: data.creatorPhotoURL,
        creatorRating: data.creatorRating,
        assignedUserId: data.assignedUserId,
        requirements: data.requirements || '',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        applications: data.applications || [],
        timePreference: data.timePreference,
        timePreferenceDate: data.timePreferenceDate,
        // Stelle sicher, dass imageUrls immer ein Array ist
        imageUrls: imageUrls,
        // Stelle sicher, dass alte Tasks mit nur imageUrl auch funktionieren
        imageUrl: data.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null)
      } as Task;
    });
    
    // Apply category filter in memory if needed
    if (filters.category) {
      tasks = tasks.filter(task => task.category === filters.category);
    }
    
    // Sort by createdAt in memory for now
    tasks.sort((a, b) => {
      const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
      return dateB - dateA; // descending order (newest first)
    });
    
    // Batch fetch all unique creator profiles in a single operation
    const uniqueCreatorIds = Array.from(new Set(tasks.map(task => task.creatorId)));
    const creatorProfiles: Record<string, any> = {};
    
    // Efficiently fetch all creator profiles at once
    try {
      if (uniqueCreatorIds.length > 0) {
        console.log(`Fetching ${uniqueCreatorIds.length} user profiles in batch`);
        
        // Create promises for all profile fetches
        const profilePromises = uniqueCreatorIds.map(id => getDoc(doc(db, "users", id)));
        const profileDocs = await Promise.all(profilePromises);
        
        // Store profiles in a lookup map by ID
        profileDocs.forEach(doc => {
          if (doc.exists()) {
            creatorProfiles[doc.id] = doc.data();
          }
        });
        
        console.log("All creator profiles fetched in batch");
      }
    } catch (e) {
      console.error("Error fetching creator profiles:", e);
    }
    
    // Attach creator info to tasks
    const tasksWithCreatorInfo = tasks.map(task => {
      const creatorProfile = creatorProfiles[task.creatorId];
      
      return {
        ...task,
        creatorName: creatorProfile?.displayName || 'Unbekannter Benutzer',
        creatorPhotoURL: creatorProfile?.photoURL || '',
        creatorRating: creatorProfile?.rating || 0
      };
    });
    
    return tasksWithCreatorInfo;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    
    // In case of an error, fall back to getting all tasks without filters
    console.log("Falling back to simple query");
    const simpleSnapshot = await getDocs(collection(db, "tasks"));
    const simpleTasks = simpleSnapshot.docs.map(doc => {
      const data = doc.data();
      // Auch im Fallback-Modus sicherstellen, dass imageUrls ein Array ist
      const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
      
      return {
        id: doc.id,
        ...data,
        imageUrls: imageUrls,
        imageUrl: data.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null)
      };
    });
    
    // Even in fallback mode, use batch fetch for creator information
    try {
      // Use the same batch fetch logic for creator profiles
      const uniqueCreatorIds = Array.from(new Set(simpleTasks.map(task => (task as Task).creatorId)));
      const creatorProfiles: Record<string, any> = {};
      
      if (uniqueCreatorIds.length > 0) {
        console.log(`Fallback mode: Fetching ${uniqueCreatorIds.length} user profiles in batch`);
        
        const profilePromises = uniqueCreatorIds.map(id => getDoc(doc(db, "users", id)));
        const profileDocs = await Promise.all(profilePromises);
        
        profileDocs.forEach(doc => {
          if (doc.exists()) {
            creatorProfiles[doc.id] = doc.data();
          }
        });
      }
      
      // Attach creator info to tasks
      return simpleTasks.map(task => {
        const taskWithTypes = task as Task;
        const creatorProfile = creatorProfiles[taskWithTypes.creatorId];
        
        return {
          ...task,
          creatorName: creatorProfile?.displayName || 'Unbekannter Benutzer',
          creatorPhotoURL: creatorProfile?.photoURL || '',
          creatorRating: creatorProfile?.rating || 0
        };
      });
    } catch (e) {
      console.error("Error adding creator info in fallback mode:", e);
      return simpleTasks;
    }
  }
};

// Apply for a task
export const applyForTask = async (taskId: string, userId: string, message: string, price: number) => {
  const applicationRef = collection(db, "applications");
  
  return addDoc(applicationRef, {
    taskId,
    applicantId: userId,
    message,
    price,
    status: "pending",
    createdAt: serverTimestamp()
  });
};

// Accept an application
export const acceptApplication = async (applicationId: string, taskId: string) => {
  const applicationRef = doc(db, "applications", applicationId);
  const taskRef = doc(db, "tasks", taskId);
  
  // Update application status
  await updateDoc(applicationRef, {
    status: "accepted",
    updatedAt: serverTimestamp()
  });
  
  // Update task status
  await updateDoc(taskRef, {
    status: "matched",
    matchedApplicationId: applicationId,
    updatedAt: serverTimestamp()
  });
  
  // Create a chat room between the task creator and the applicant
  const applicationSnapshot = await getDoc(applicationRef);
  const taskSnapshot = await getDoc(taskRef);
  
  if (applicationSnapshot.exists() && taskSnapshot.exists()) {
    const applicationData = applicationSnapshot.data();
    const taskData = taskSnapshot.data();
    
    const chatRef = collection(db, "chats");
    const chatDoc = await addDoc(chatRef, {
      taskId,
      taskTitle: taskData.title,
      participants: [taskData.creatorId, applicationData.applicantId],
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastMessageAt: null
    });
    
    // Benachrichtigung für den Bewerber erstellen, dass seine Bewerbung angenommen wurde
    await createNotification(applicationData.applicantId, NotificationTypes.TASK_MATCHED, {
      taskId,
      taskTitle: taskData.title,
      chatId: chatDoc.id,
      requiresAction: false
    });
    
    return chatDoc;
  }
};

// Chat functions - Using Firestore instead of Realtime Database for now
export const sendMessage = async (chatId: string, userId: string, content: string) => {
  try {
    // Create message in Firestore collection
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const messageDoc = await addDoc(messagesRef, {
      senderId: userId,
      content,
      timestamp: serverTimestamp()
    });
    
    // Update the chat's lastMessage in Firestore
    const chatRef = doc(db, "chats", chatId);
    const chatSnapshot = await getDoc(chatRef);
    
    if (chatSnapshot.exists()) {
      const chatData = chatSnapshot.data();
      const taskId = chatData.taskId;
      const taskTitle = chatData.taskTitle || 'Aufgabe';
      const participants = chatData.participants || [];
      
      // Update the chat's lastMessage
      await updateDoc(chatRef, {
        lastMessage: content,
        lastMessageAt: serverTimestamp()
      });
      
      // Send notification to other participants
      const otherParticipants = participants.filter(id => id !== userId);
      
      for (const recipientId of otherParticipants) {
        await createNotification(recipientId, NotificationTypes.NEW_MESSAGE, {
          chatId,
          senderId: userId,
          taskId,
          taskTitle,
          requiresAction: false
        });
      }
    }
    
    return messageDoc.id;
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
};

/**
 * Upload für Chat-Bilder als Base64
 * 
 * @param imageData Bilddatei oder Base64-String
 * @param chatId Chat-ID
 * @param userId User-ID
 * @returns Base64-String oder URL des gespeicherten Bildes
 */
export const uploadChatImageBase64 = async (imageData: string | File, chatId: string, userId: string): Promise<string> => {
  try {
    // Falls ein File-Objekt übergeben wurde, erst zu Base64 konvertieren
    const { compressAndConvertToBase64 } = await import('@/utils/imageUtils');
    let base64Data = typeof imageData === 'string' 
      ? imageData 
      : await compressAndConvertToBase64(imageData, 0.3); // Max 0.3 MB für Chat-Bilder
    
    // Erstelle eine eindeutige Message-ID
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Base64-Bild als Nachricht speichern
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    await addDoc(messagesRef, {
      senderId: userId,
      messageType: 'image',
      content: base64Data,
      timestamp: serverTimestamp()
    });
    
    // Chat aktualisieren
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: "📷 Bild gesendet",
      lastMessageAt: serverTimestamp()
    });
    
    return base64Data;
  } catch (error) {
    console.error("Fehler beim Speichern des Chat-Bildes:", error);
    throw error;
  }
};

/**
 * Upload für Aufgaben-Bilder als Base64
 * 
 * @param imageData Bilddatei oder Base64-String
 * @param taskId Aufgaben-ID
 * @returns Base64-String oder URL des gespeicherten Bildes
 */
export const uploadTaskImageBase64 = async (imageData: string | File, taskId: string): Promise<string> => {
  try {
    // Falls ein File-Objekt übergeben wurde, erst zu Base64 konvertieren
    const { compressAndConvertToBase64 } = await import('@/utils/imageUtils');
    let base64Data = typeof imageData === 'string' 
      ? imageData 
      : await compressAndConvertToBase64(imageData, 0.7); // Max 0.7 MB für Aufgaben-Bilder
    
    // Das Aufgaben-Dokument aktualisieren
    const taskRef = doc(db, "tasks", taskId);
    
    // Prüfen, ob es bereits Bilder gibt
    const taskSnap = await getDoc(taskRef);
    
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();
      // Vorhandenes Array von Base64-Bildern oder neues erstellen
      const existingImages = taskData.imageBase64Array || [];
      
      // Neues Bild hinzufügen
      await updateDoc(taskRef, {
        imageBase64Array: [...existingImages, base64Data],
        updatedAt: serverTimestamp()
      });
    } else {
      // Aufgabe existiert nicht
      throw new Error("Aufgabe nicht gefunden");
    }
    
    return base64Data;
  } catch (error) {
    console.error("Fehler beim Speichern des Aufgaben-Bildes:", error);
    throw error;
  }
};

export const getMessages = (chatId: string, callback: (messages: any[]) => void) => {
  try {
    // Listen to Firestore collection instead of Realtime Database
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
    
    // Set up the listener
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));
      callback(messages);
    });
    
    // Return the unsubscribe function
    return unsubscribe;
  } catch (error) {
    console.error("Error getting messages:", error);
    callback([]);
    return () => {}; // Return empty function as unsubscribe
  }
};

/**
 * Schließt eine Aufgabe ab und fügt eine Bewertung hinzu
 */
export const completeTask = async (taskId: string, rating: number, review: string) => {
  try {
    const taskRef = doc(db, "tasks", taskId);
    const taskSnapshot = await getDoc(taskRef);
    
    if (!taskSnapshot.exists()) {
      throw new Error("Aufgabe nicht gefunden");
    }
    
    const taskData = taskSnapshot.data();
    
    // Prüfen, ob die Aufgabe bereits abgeschlossen ist
    if (taskData.status === "completed") {
      throw new Error("Diese Aufgabe wurde bereits abgeschlossen");
    }
    
    // Prüfen, ob ein Tasker zugewiesen wurde
    if (!taskData.taskerId) {
      throw new Error("Diese Aufgabe hat keinen zugewiesenen Tasker");
    }
    
    // Aufgabenstatus aktualisieren
    await updateDoc(taskRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      reviewStatus: "pending" // Neue Status-Property
    });

    // Bewertungsanforderung als Benachrichtigung für den Ersteller erstellen
    await createNotification(taskData.creatorId, NotificationTypes.REVIEW_REQUIRED, {
      taskId,
      taskTitle: taskData.title,
      taskerId: taskData.taskerId,
      requiresAction: true, // Erfordert eine Aktion vom Benutzer
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 Tage Zeit
    });

    // Benachrichtigung für den Tasker erstellen
    await createNotification(taskData.taskerId, NotificationTypes.TASK_COMPLETED, {
      taskId,
      taskTitle: taskData.title
    });
    
    // Tasker-Status aktualisieren (completedTasks und Rating)
    const userRef = doc(db, "users", taskData.taskerId);
    const userSnapshot = await getDoc(userRef);
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      const currentRatingTotal = userData.rating * (userData.ratingCount || 0);
      const newRatingCount = (userData.ratingCount || 0) + 1;
      const newRating = (currentRatingTotal + rating) / newRatingCount;
      
      await updateDoc(userRef, {
        completedTasks: increment(1),
        rating: newRating,
        ratingCount: newRatingCount
      });
    }
    
    // Benachrichtigung erstellen
    const notificationsRef = collection(db, "notifications");
    await addDoc(notificationsRef, {
      userId: taskData.taskerId,
      type: "task_completed",
      taskId: taskId,
      taskTitle: taskData.title,
      read: false,
      createdAt: serverTimestamp()
    });
    
    // Review erstellen für die Bewertung
    const reviewsRef = collection(db, "reviews");
    await addDoc(reviewsRef, {
      taskId,
      reviewerId: taskData.creatorId,
      userId: taskData.taskerId,
      rating,
      content: review,
      createdAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error("Fehler beim Abschließen der Aufgabe:", error);
    throw error;
  }
};

// Get user level based on tasks and rating
export const getUserLevel = (completedTasks: number, rating: number) => {
  let highestMatchingLevel = userLevels[0];
  
  for (const level of userLevels) {
    if (completedTasks >= level.minTasks && rating >= level.minRating) {
      highestMatchingLevel = level;
    } else {
      break;
    }
  }
  
  return highestMatchingLevel;
};

// Bookmarked tasks functionality
export const bookmarkTask = async (userId: string, taskId: string) => {
  try {
    // Add the task to user's bookmarks
    await updateDoc(doc(db, 'users', userId), {
      bookmarkedTasks: arrayUnion(taskId)
    });
    return true;
  } catch (error) {
    console.error('Error bookmarking task:', error);
    throw error;
  }
};

export const removeBookmark = async (userId: string, taskId: string) => {
  try {
    // Remove the task from user's bookmarks
    await updateDoc(doc(db, 'users', userId), {
      bookmarkedTasks: arrayRemove(taskId)
    });
    return true;
  } catch (error) {
    console.error('Error removing bookmark:', error);
    throw error;
  }
};

export const getBookmarkedTasks = async (userId: string) => {
  try {
    // Get user document to retrieve bookmarked task IDs
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return [];
    
    const userData = userDoc.data();
    const bookmarkedIds = userData.bookmarkedTasks || [];
    
    if (bookmarkedIds.length === 0) return [];
    
    // Fetch all bookmarked tasks
    const taskDocs = await Promise.all(
      bookmarkedIds.map((taskId: string) => getDoc(doc(db, 'tasks', taskId)))
    );
    
    // Filter out tasks that no longer exist and map to task objects
    return taskDocs
      .filter(doc => doc.exists())
      .map(doc => {
        const data = doc.data();
        
        // Sicherstellen, dass imageUrls ein Array ist
        const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
        
        // Debug-Ausgabe
        console.debug(`Bookmarked task ${doc.id}: ${imageUrls.length} Bilder gefunden`);
        
        return {
          id: doc.id,
          ...data,
          // Stelle sicher, dass imageUrls immer ein Array ist
          imageUrls: imageUrls,
          // Stelle sicher, dass die Abwärtskompatibilität gewährleistet ist
          imageUrl: data.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null)
        };
      });
  } catch (error) {
    console.error('Error getting bookmarked tasks:', error);
    throw error;
  }
};

// Check if a task is bookmarked by a user
export const isTaskBookmarked = async (userId: string, taskId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    const bookmarkedIds = userData.bookmarkedTasks || [];
    
    return bookmarkedIds.includes(taskId);
  } catch (error) {
    console.error('Error checking if task is bookmarked:', error);
    return false;
  }
};

/**
 * Update an existing task
 * @param taskId The ID of the task to update
 * @param taskData The updated task data
 * @returns True if update was successful
 */
export const updateTask = async (taskId: string, taskData: Record<string, any>) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    
    // Entferne Felder, die nicht aktualisiert werden sollen
    const { id, creatorId, createdAt, applications, status, ...updateData } = taskData;
    
    // Stelle sicher, dass Bilder-Array korrekt formatiert ist
    if (updateData.imageUrls && !Array.isArray(updateData.imageUrls)) {
      updateData.imageUrls = [];
    }
    
    // Füge Zeitstempel für die Aktualisierung hinzu
    updateData.updatedAt = serverTimestamp();
    
    // Task aktualisieren
    await updateDoc(taskRef, updateData);
    console.log('Task erfolgreich aktualisiert:', taskId);
    return true;
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Tasks:', error);
    throw error;
  }
};

/**
 * Save a search query to user's history
 * @param userId The ID of the user
 * @param searchQuery The search query to save
 * @param category Optional category filter
 */
/**
 * Speichert eine Suchanfrage in der Firebase-Datenbank
 * 
 * Diese Funktion speichert eine Suchanfrage in der persönlichen Suchhistorie des Nutzers
 * oder in einer gemeinsamen "trending_searches" Sammlung, wenn kein Nutzer angemeldet ist.
 * 
 * @param userId Die ID des authentifizierten Nutzers oder null
 * @param searchQuery Die Suchanfrage (wird getrimmt und in Kleinbuchstaben umgewandelt)
 * @param category Die optionale Kategorie
 */
/**
 * Anfrage zum Freigeben des Standorts senden
 * @param chatId Die Chat-ID
 * @param userId Die Benutzer-ID des Anfragenden
 * @returns ID der erstellten Nachricht
 */
export const requestLocationSharing = async (chatId: string, userId: string): Promise<string> => {
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
    
    // Nachricht über die Anfrage hinzufügen
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
      lastMessageAt: serverTimestamp()
    });
    
    return messageDoc.id;
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
    const isTasker = taskData.taskerId === userId;
    
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
      lastMessageAt: serverTimestamp()
    });
    
    // Wenn beide zugestimmt haben, standort freigeben
    const bothApproved = locationSharingStatus.creatorApproved && locationSharingStatus.taskerApproved;
    
    if (bothApproved && !chatData.locationSharingStatus?.sharedAt) {
      // Automatische Systembenachrichtigung erstellen
      await addDoc(messagesRef, {
        type: "location_shared",
        senderId: "system",
        timestamp: serverTimestamp(),
        taskId: taskId,
        location: taskData.location
      });
      
      // Standortfreigabe in Chat und Task aktualisieren
      await updateDoc(chatRef, {
        "locationSharingStatus.sharedAt": serverTimestamp(),
        lastMessage: "🗺️ Standort wurde freigegeben",
        lastMessageAt: serverTimestamp()
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

export const saveSearchQuery = async (userId: string, searchQuery: string, category?: string) => {
  if (!searchQuery || searchQuery.trim() === '') return;
  
  try {
    console.log('Saving search for userId:', userId);
    
    // Suchanfrage vorbereiten
    const query = searchQuery.trim().toLowerCase();
    const timestamp = serverTimestamp();
    const searchData = {
      query,
      category: category || 'all',
      timestamp
    };
    
    // Wenn ein Nutzer angemeldet ist, speichern wir in seiner persönlichen Collection
    if (userId) {
      // Reference to user document and search history subcollection
      const userRef = doc(db, 'users', userId);
      const searchHistoryRef = collection(userRef, 'searchHistory');
      
      // Add the search query to the user's history
      await addDoc(searchHistoryRef, searchData);
      console.log('Search query saved to user history');
    } 
    
    // In jedem Fall speichern wir die Suchanfrage auch in einer globalen "trending_searches" Collection
    // Dies ist nützlich für Analyse und für nicht angemeldete Nutzer
    const trendingSearchesRef = collection(db, 'trending_searches');
    await addDoc(trendingSearchesRef, {
      ...searchData,
      anonymized: !userId // Markiere, ob es von einem angemeldeten Nutzer kommt oder nicht
    });
    
    console.log('Search query saved successfully');
  } catch (error) {
    console.error('Error saving search query:', error);
    
    // Bei Fehlern dennoch true zurückgeben, da dies keine kritische Funktion ist
    // und wir den User-Flow nicht unterbrechen wollen
    return true;
  }
};

/**
 * Get recent search queries for a user
 * @param userId The ID of the user
 * @param limit Number of recent searches to fetch
 * @returns Array of recent search queries
 */
/**
 * Lädt die letzten Suchanfragen für einen Nutzer
 * 
 * Diese Funktion lädt die letzten Suchanfragen entweder aus der persönlichen History 
 * des angemeldeten Nutzers oder aus den allgemeinen Trending-Searches.
 * 
 * @param userId Die ID des authentifizierten Nutzers oder null
 * @param limit Anzahl der zu ladenden Suchanfragen
 * @returns Array mit den letzten Suchanfragen
 */
export const getRecentSearches = async (userId: string, limitParam: number = 8) => {
  try {
    console.log('Fetching recent searches for userId:', userId);
    
    // Wenn ein Nutzer angemeldet ist, laden wir seine persönlichen Suchanfragen
    if (userId) {
      try {
        // Zuerst versuchen wir die persönlichen Suchanfragen zu laden
        const userRef = doc(db, 'users', userId);
        const searchHistoryRef = collection(userRef, 'searchHistory');
        
        const personalSearchQuery = query(
          searchHistoryRef,
          orderBy('timestamp', 'desc'),
          limit(limitParam)
        );
        
        const snapshot = await getDocs(personalSearchQuery);
        console.log(`Found ${snapshot.docs.length} personal search history items`);
        
        // Wenn persönliche Suchanfragen vorhanden sind, diese zurückgeben
        if (snapshot.docs.length > 0) {
          // Extrahieren und deduplizieren
          const searches = new Map();
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!searches.has(data.query)) {
              searches.set(data.query, {
                id: doc.id,
                query: data.query,
                category: data.category || 'all',
                timestamp: data.timestamp,
                personal: true
              });
            }
          });
          
          const results = Array.from(searches.values());
          console.log('Personal searches:', results);
          return results;
        }
      } catch (personalError) {
        console.error('Error loading personal search history:', personalError);
        // Weiter zum Fallback mit Trending Searches
      }
    }
    
    // Als Fallback oder für anonyme Nutzer laden wir die globalen Trending Searches
    console.log('Loading trending searches as fallback');
    const trendingSearchesRef = collection(db, 'trending_searches');
    const trendingQuery = query(
      trendingSearchesRef,
      orderBy('timestamp', 'desc'),
      limit(limitParam * 2) // Doppelte Anzahl laden, da wir später deduplizieren
    );
    
    const trendingSnapshot = await getDocs(trendingQuery);
    console.log(`Found ${trendingSnapshot.docs.length} trending searches`);
    
    // Extrahieren und deduplizieren
    const trendingSearches = new Map();
    trendingSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!trendingSearches.has(data.query)) {
        trendingSearches.set(data.query, {
          id: doc.id,
          query: data.query,
          category: data.category || 'all',
          timestamp: data.timestamp,
          trending: true
        });
      }
    });
    
    // Auf das gewünschte Limit reduzieren
    const results = Array.from(trendingSearches.values()).slice(0, limitParam);
    console.log('Trending searches:', results);
    return results;
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    
    // Bei Fehlern leeres Array zurückgeben
    return [];
  }
};

/**
 * Lädt Task-Bilder hoch - entweder in Firebase Storage (Produktion) oder als Base64 (Entwicklung)
 * 
 * @param files - Array von File-Objekten
 * @param taskId - Optional: ID des Tasks, falls bekannt
 * @returns Array mit URLs der hochgeladenen Bilder oder Base64-Strings je nach Umgebung
 */
// Benachrichtigungstypen definieren
export const NotificationTypes = {
  NEW_MESSAGE: 'new_message',
  TASK_MATCHED: 'task_matched',
  TASK_COMPLETED: 'task_completed',
  REVIEW_REQUIRED: 'review_required',
  NEW_TASK_NEARBY: 'new_task_nearby',
  APPLICATION_RECEIVED: 'application_received',
  REVIEW_RECEIVED: 'review_received',
  REVIEW_REMINDER: 'review_reminder'  // Neuer Typ für die Erinnerung an ausstehende Bewertungen
};

/**
 * Erstellt eine Erinnerungsbenachrichtigung für eine ausstehende Bewertung
 * 
 * @param userId Die ID des Benutzers, der die Benachrichtigung erhalten soll
 * @param taskId Die ID der Aufgabe, für die eine Bewertung aussteht
 * @param taskTitle Der Titel der Aufgabe
 */
export const createReviewReminderNotification = async (
  userId: string,
  taskId: string,
  taskTitle: string
) => {
  if (!userId || !taskId) {
    console.error("Benutzer-ID oder Aufgaben-ID fehlt für Bewertungserinnerung");
    return;
  }

  try {
    // Prüfen, ob bereits eine Erinnerung für diese Aufgabe existiert
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef, 
      where("userId", "==", userId),
      where("type", "==", NotificationTypes.REVIEW_REMINDER),
      where("data.taskId", "==", taskId)
    );
    
    const existingNotifications = await getDocs(q);
    
    // Nur erstellen, wenn noch keine Erinnerung existiert
    if (existingNotifications.empty) {
      await createNotification(userId, NotificationTypes.REVIEW_REMINDER, {
        taskId,
        taskTitle,
        requiresAction: true, // Erfordert eine Aktion vom Benutzer
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 Tage Zeit
      });
      console.log("Bewertungserinnerung erstellt für Benutzer:", userId, "und Aufgabe:", taskId);
    } else {
      console.log("Bewertungserinnerung existiert bereits für diese Aufgabe");
    }
  } catch (error) {
    console.error("Fehler beim Erstellen der Bewertungserinnerung:", error);
  }
};

/**
 * Benachrichtigung erstellen
 * @param userId Empfänger-ID
 * @param type Benachrichtigungstyp
 * @param data Zusätzliche Daten
 */
export const createNotification = async (
  userId: string,
  type: string,
  data: Record<string, any>
) => {
  try {
    const notificationsRef = collection(db, "notifications");

    await addDoc(notificationsRef, {
      userId,
      type,
      data,
      read: false,
      acted: false, // Wurde auf die Benachrichtigung reagiert (z.B. Bewertung abgegeben)
      createdAt: serverTimestamp(),
      priority: (type === 'review_required' || type === 'review_reminder') ? 'high' : 'normal' // Priorisierung
    });

    // Ungelesene Benachrichtigungen zählen
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      unreadNotifications: increment(1),
      lastNotificationAt: serverTimestamp() // Zeitstempel der letzten Benachrichtigung
    });

    console.log(`✅ Benachrichtigung erstellt für Benutzer ${userId}`);

  } catch (error) {
    console.error("❌ Fehler beim Erstellen der Benachrichtigung:", error);
  }
};

/**
 * Benachrichtigungen für einen Benutzer abrufen
 */
export const getUserNotifications = async (userId: string) => {
  try {
    const notificationsRef = collection(db, "notifications");
    
    // Einfachere Abfrage ohne orderBy, um den "failed-precondition"-Fehler zu vermeiden
    // In der Produktionsumgebung sollte ein Index in Firebase erstellt werden
    const q = query(
      notificationsRef,
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    
    // Sortieren wir manuell nach createdAt
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Record<string, any>
    }));
    
    // Sortieren nach createdAt (neueste zuerst)
    return notifications.sort((a: any, b: any) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    }).slice(0, 50); // Limitieren auf 50
  } catch (error) {
    console.error("Fehler beim Abrufen der Benachrichtigungen:", error);
    return [];
  }
};

/**
 * Benachrichtigung als gelesen markieren
 */
export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  try {
    console.log(`⏱️ Markiere Benachrichtigung ${notificationId} als gelesen`);
    
    // Zuerst überprüfen, ob die Benachrichtigung bereits gelesen ist
    const notificationRef = doc(db, "notifications", notificationId);
    const notificationSnap = await getDoc(notificationRef);
    
    if (!notificationSnap.exists()) {
      console.warn(`⚠️ Benachrichtigung ${notificationId} existiert nicht`);
      return false;
    }
    
    const notificationData = notificationSnap.data();
    if (notificationData.read) {
      console.log(`ℹ️ Benachrichtigung ${notificationId} wurde bereits gelesen`);
      return true;
    }
    
    // Benachrichtigung als gelesen markieren
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });
    
    console.log(`✅ Benachrichtigung ${notificationId} als gelesen markiert`);
    
    // Ungelesene Benachrichtigungen zählen
    const userRef = doc(db, "users", userId);
    
    // Sicherheitshalber: Prüfe, ob der Zähler > 0 ist
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.warn(`⚠️ Benutzer ${userId} existiert nicht`);
      return false;
    }
    
    const userData = userSnap.data();
    const currentCount = userData.unreadNotifications || 0;
    
    // Nur dekrementieren, wenn der Zähler > 0 ist
    if (currentCount > 0) {
      await updateDoc(userRef, {
        unreadNotifications: increment(-1),
        lastNotificationReadAt: serverTimestamp()
      });
      console.log(`✅ Ungelesene Benachrichtigungen für Benutzer ${userId} reduziert (${currentCount} -> ${currentCount-1})`);
    } else {
      console.log(`ℹ️ Keine ungelesenen Benachrichtigungen zum Reduzieren für Benutzer ${userId}`);
      // Setze den Zähler auf 0, um sicherzustellen, dass er nicht negativ ist
      await updateDoc(userRef, {
        unreadNotifications: 0,
        lastNotificationReadAt: serverTimestamp()
      });
    }

    return true;
  } catch (error) {
    console.error("❌ Fehler beim Markieren der Benachrichtigung:", error);
    return false;
  }
};

/**
 * Benachrichtigung als bearbeitet markieren
 */
export const markNotificationAsActed = async (notificationId: string) => {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
      acted: true,
      actedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error("Fehler beim Markieren der Benachrichtigung:", error);
    return false;
  }
};

export const uploadTaskImages = async (files: File[], taskId?: string): Promise<string[]> => {
  if (!Array.isArray(files) || files.length === 0) {
    console.log("Keine Dateien zum Hochladen übergeben");
    return [];
  }
  
  console.log(`uploadTaskImages: Starte Upload von ${files.length} Bildern`);
  const urls: string[] = [];

  // Importiere die FEATURES und IS_DEVELOPMENT Konstanten aus der Konfiguration
  const { FEATURES, IS_DEVELOPMENT } = await import('@/lib/config');
  
  // Entscheide, ob Firebase Storage oder Base64 verwendet werden soll
  const useFirebaseStorage = FEATURES.USE_FIREBASE_STORAGE;
  
  if (IS_DEVELOPMENT) {
    console.log(`💾 ${useFirebaseStorage ? 'Verwende Firebase Storage' : 'Verwende Base64 für Bild-Upload (Entwicklungsmodus)'}`);
  }
  
  try {
    // Prüfen, ob Benutzer angemeldet ist
    if (!auth.currentUser) {
      throw new Error('Benutzer nicht angemeldet');
    }
    
    // Import der benötigten Funktionen
    const { compressImage } = await import('@/utils/imageUtils');
    
    // Base64-Modus: Bilder als Data-URLs zurückgeben
    if (!useFirebaseStorage) {
      for (const file of files) {
        try {
          if (!file || !file.name) {
            console.warn("Datei ist undefiniert oder hat keinen Namen");
            continue;
          }
          
          // Komprimierung mit stärkeren Einstellungen für Base64
          const compressedFile = await compressImage(file, {
            maxSizeMB: 0.3, // Noch stärkere Komprimierung für Base64
            maxWidthOrHeight: 1200,
            useWebWorker: true
          });
          
          if (!compressedFile) {
            console.error(`Komprimierung fehlgeschlagen für: ${file.name}`);
            continue;
          }
          
          // Konvertiere zu Base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(compressedFile);
          });
          
          const base64String = await base64Promise;
          urls.push(base64String);
          
          console.log(`Bild als Base64 kodiert: ${file.name} → ${base64String.substring(0, 50)}...`);
        } catch (error) {
          console.error(`Fehler bei Base64-Kodierung von ${file.name}:`, error);
        }
      }
      
      console.log(`Base64: ${urls.length} von ${files.length} Bildern erfolgreich kodiert`);
      return urls;
    } 
    // Firebase Storage Modus für Produktionsumgebung
    else {
      const folderPath = taskId 
        ? `tasks/${taskId}/images` 
        : `tasks/images/${Date.now()}`;
      
      for (const file of files) {
        try {
          if (!file || !file.name) {
            console.warn("Datei ist undefiniert oder hat keinen Namen");
            continue;
          }
  
          // Komprimierung mit der importierten Funktion
          const compressedFile = await compressImage(file, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1600,
            useWebWorker: true
          });
  
          if (!compressedFile) {
            console.error(`Komprimierung fehlgeschlagen für: ${file.name}`);
            continue;
          }
  
          // Sicherer Dateiname generieren
          const timestamp = Date.now();
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const storageRef = ref(storage, `${folderPath}/${timestamp}_${safeFileName}`);
  
          // Upload durchführen
          await uploadBytes(storageRef, compressedFile);
          const downloadURL = await getDownloadURL(storageRef);
  
          // URL zum Array hinzufügen
          urls.push(downloadURL);
          console.log(`Bild hochgeladen: ${file.name} → ${downloadURL.substring(0, 50)}...`);
        } catch (error) {
          console.error(`Fehler beim Hochladen von ${file.name}:`, error);
        }
      }
      
      console.log(`Firebase Storage: ${urls.length} von ${files.length} Bildern erfolgreich hochgeladen`);
      return urls;
    }
  } catch (error) {
    console.error("Fehler beim Hochladen der Task-Bilder:", error);
    return urls; // Gib zurück, was bereits erfolgreich hochgeladen wurde
  }
};

export {
  auth,
  db,
  storage,
  onAuthStateChanged
};