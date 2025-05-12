import { db } from './firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Typdefinition für Standortdaten
 */
export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  area?: string;
}

/**
 * Typdefinition für Geolocation-Optionen
 */
interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Service für Standort-bezogene Funktionen
 */
export const locationService = {
  /**
   * Aktuelle Position des Benutzers über die Browser-Geolocation API ermitteln
   * 
   * @param options Optionen für die Geolocation API
   * @returns Promise mit den Koordinaten (lat, lng)
   */
  getCurrentPosition(options: GeolocationOptions = {}): Promise<{ lat: number; lng: number }> {
    const defaultOptions: GeolocationOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 Minuten
    };

    const geoOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation wird von diesem Browser nicht unterstützt.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          let errorMessage = 'Unbekannter Standortfehler';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Standortzugriff verweigert. Bitte erlaube den Zugriff in deinen Browser-Einstellungen.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Standortinformationen sind derzeit nicht verfügbar.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Die Anfrage für deinen Standort ist abgelaufen.';
              break;
          }
          
          reject(new Error(errorMessage));
        },
        geoOptions
      );
    });
  },

  /**
   * Berechnet die Entfernung zwischen zwei Koordinaten in Kilometern
   * 
   * @param location1 Erster Standort (lat, lng)
   * @param location2 Zweiter Standort (lat, lng)
   * @returns Entfernung in Kilometern
   */
  calculateDistance(location1: { lat: number; lng: number }, location2: { lat: number; lng: number }): number {
    if (!location1 || !location2) return 0;
    if (!location1.lat || !location1.lng || !location2.lat || !location2.lng) return 0;

    // Umwandlung von Grad in Radian
    const lat1 = location1.lat * Math.PI / 180;
    const lng1 = location1.lng * Math.PI / 180;
    const lat2 = location2.lat * Math.PI / 180;
    const lng2 = location2.lng * Math.PI / 180;

    // Haversine-Formel für Entfernungsberechnung auf einer Kugel
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    // Erdradius in Kilometern
    const radius = 6371;
    
    // Entfernung berechnen
    return radius * c;
  },

  /**
   * Ermittelt den Ortsnamen für einen Standort mittels Reverse Geocoding
   * 
   * @param location Standortkoordinaten
   * @returns Promise mit Ortsname oder leerer String
   */
  async getAddressFromLocation(location: { lat: number; lng: number }): Promise<string> {
    try {
      // In einer Produktionsumgebung würde hier ein Aufruf an die 
      // Google Maps Geocoding API stehen
      // z.B. mit fetch an eine API-Endpoint
      
      // Hier geben wir nur einen Platzhalter zurück, da wir keine API-Calls durchführen
      return `Standort (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})`;
    } catch (error) {
      console.error('Fehler beim Reverse Geocoding:', error);
      return ''; // Leerer String statt null
    }
  },

  /**
   * Prüft, ob Standortkoordinaten gültig sind
   * 
   * @param location Standortkoordinaten
   * @returns true, wenn die Koordinaten gültig sind
   */
  isValidLocation(location: { lat: number; lng: number } | null): boolean {
    if (!location) return false;
    
    const { lat, lng } = location;
    
    // Prüfe, ob die Koordinaten im gültigen Bereich liegen
    const isValidLat = typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
    const isValidLng = typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
    
    // Prüfe, ob die Koordinaten nicht 0,0 sind (häufige Fehlerursache)
    const isNotNullIsland = !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001);
    
    return isValidLat && isValidLng && isNotNullIsland;
  },
  
  /**
   * Speichert den Standort eines Benutzers in Firebase
   * 
   * @param userId ID des Benutzers
   * @param location Standortdaten (lat, lng, address, area)
   * @returns Promise mit den aktualisierten Standortdaten oder void
   */
  async saveUserLocation(userId: string, location: LocationData): Promise<LocationData | void> {
    try {
      // Validiere die Standortdaten, bevor sie gespeichert werden
      if (!this.isValidLocation(location)) {
        console.error('Ungültige Standortdaten:', location);
        throw new Error('Die Standortdaten sind ungültig.');
      }
      
      console.log('Speichere Standort für Benutzer', userId, ':', location);
      
      let addressInfo = location.address;
      let areaInfo = location.area;
      
      // Wenn keine Adressinformation vorhanden ist, versuche Reverse Geocoding
      if (!addressInfo) {
        try {
          const geocodedAddress = await this.getAddressFromLocation({
            lat: location.lat,
            lng: location.lng
          });
          addressInfo = geocodedAddress || ''; // Konvertiere null zu leerem String
        } catch (e) {
          console.error('Fehler beim Geocoding:', e);
        }
      }
      
      // Standard-Standort-Updates
      const locationUpdate = {
        locationCoordinates: {
          lat: location.lat,
          lng: location.lng
        },
        location: addressInfo || '',
        locationSource: location.address ? 'manual' : 'gps',
        updatedAt: new Date()
      };
      
      // Wir prüfen beide Collections (userProfiles und users)
      const userProfileRef = doc(db, 'userProfiles', userId);
      const userProfileSnap = await getDoc(userProfileRef);
      
      if (userProfileSnap.exists()) {
        await updateDoc(userProfileRef, locationUpdate);
      } else {
        // Fallback: users-Collection prüfen
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          await updateDoc(userRef, locationUpdate);
        } else {
          console.warn('Benutzerprofil existiert nicht, kann Standort nicht speichern');
        }
      }
      
      // Aktualisierte Standortdaten zurückgeben
      return {
        lat: location.lat,
        lng: location.lng,
        address: addressInfo || undefined,
        area: areaInfo || undefined
      };
    } catch (error) {
      console.error('Fehler beim Speichern des Benutzerstandorts:', error);
      throw error;
    }
  },

  /**
   * Aktualisiert den öffentlich sichtbaren Standort einer Aufgabe (für Aufgabenersteller)
   * 
   * @param taskId ID der Aufgabe
   * @param isShared true, wenn der Standort freigegeben werden soll
   */
  async updateTaskLocationSharing(taskId: string, isShared: boolean): Promise<void> {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        isLocationShared: isShared
      });
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Standortfreigabe:', error);
      throw error;
    }
  },
  
  /**
   * Filtert Tasks nach Entfernung vom Benutzerstandort
   * 
   * @param tasks Liste von Tasks
   * @param userLocation Standort des Benutzers
   * @param radius Maximaler Radius in km
   * @returns Gefilterte Liste von Tasks
   */
  filterTasksByDistance(tasks: any[], userLocation: { lat: number; lng: number }, radius: number): any[] {
    if (!userLocation || !Array.isArray(tasks)) return tasks;
    
    return tasks.filter(task => {
      if (!task.location) return false;
      
      const distance = this.calculateDistance(userLocation, task.location);
      // Aktualisiere die Distanzinformation im Task
      task.distance = distance;
      
      return distance <= radius;
    });
  }
};