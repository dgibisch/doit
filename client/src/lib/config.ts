/**
 * Globale Konfiguration für die DoIt-App
 * 
 * Dieses Modul verwaltet Feature-Flags und andere Konfigurationsoptionen,
 * die über Environment-Variablen gesteuert werden können.
 */

// Erkennung der Entwicklungsumgebung
// Wir sind in Entwicklung, wenn:
// 1. Vite's DEV-Flag gesetzt ist ODER
// 2. Wir auf einer replit.dev Domain laufen
export const IS_DEVELOPMENT = import.meta.env.DEV || 
  (typeof window !== 'undefined' && window.location.hostname.includes('replit.dev'));

// Feature-Flags mit localStorage-Persistenz
// Wir versuchen, die gespeicherte Einstellung aus localStorage zu laden
// und fallen auf die ENV-Variable zurück, wenn keine Einstellung existiert
const getStoredFeatureFlag = (key: string, defaultValue: boolean): boolean => {
  try {
    const storedValue = localStorage.getItem(`feature_${key}`);
    if (storedValue !== null) {
      return storedValue === 'true';
    }
  } catch (e) {
    console.warn('localStorage nicht verfügbar:', e);
  }
  return defaultValue;
};

// Feature-Flags mit Gettern und Settern
export const FEATURES = {
  // Firebase Storage für Bild-Uploads verwenden
  // Wenn false, werden Bilder als Data-URLs gespeichert
  get USE_FIREBASE_STORAGE(): boolean {
    // TEMPORÄR: Immer Base64 verwenden, um CORS-Probleme zu vermeiden
    // Später können wir das auf !IS_DEVELOPMENT ändern
    const defaultValue = false; // Immer false für jetzt
    
    // Ermöglicht überschreiben via localStorage für Tests
    return getStoredFeatureFlag('USE_FIREBASE_STORAGE', defaultValue);
  },
  set USE_FIREBASE_STORAGE(value: boolean) {
    try {
      localStorage.setItem('feature_USE_FIREBASE_STORAGE', String(value));
    } catch (e) {
      console.warn('Konnte Feature-Flag nicht speichern:', e);
    }
  },
  
  // Weitere Feature-Flags können hier hinzugefügt werden
  ENABLE_IMAGE_COMPRESSION: true, // Immer aktivieren, damit Base64-Bilder nicht zu groß werden
  ENABLE_OFFLINE_MODE: false,
};

// App-Konstanten
export const APP_CONFIG = {
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB maximale Dateigröße
  MAX_IMAGES: 5, // Maximale Anzahl von Bildern pro Task
  IMAGE_COMPRESSION_QUALITY: 0.8,   // Qualität für Bildkomprimierung (0.0-1.0)
  DEFAULT_PROFILE_IMAGE: 'https://ui-avatars.com/api/?background=random',
  FIREBASE_STORAGE_BASE_PATH: 'comment_images',
};

// Cache-Konfiguration
export const CACHE_CONFIG = {
  PROFILE_CACHE_MINUTES: 15,
  TASK_CACHE_MINUTES: 5,
};

// Logging-Konfiguration
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const LOG_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

/**
 * Logger-Funktion für konsistente Anwendungslogs
 */
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (LOG_LEVEL === 'debug') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'info' || LOG_LEVEL === 'warn') {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'warn' || LOG_LEVEL === 'info') {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};