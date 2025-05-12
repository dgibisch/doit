import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Interface für Standortdaten
 */
interface LocationInfo {
  lat: number;
  lng: number;
  address: string;
  area?: string;
}

/**
 * Service für die Verwaltung von Standortdaten
 */
class LocationService {
  /**
   * Speichert den Standort eines Benutzers
   * @param userId Die Benutzer-ID
   * @param location Die Standortdaten
   */
  async saveUserLocation(userId: string, location: LocationInfo): Promise<void> {
    try {
      // Zuerst in userProfiles-Collection versuchen
      const userProfileRef = doc(db, 'userProfiles', userId);
      const userProfileSnap = await getDoc(userProfileRef);
      
      const locationData = {
        locationCoordinates: {
          lat: location.lat,
          lng: location.lng
        },
        location: location.address,
        locationSource: 'manual',
        updatedAt: new Date()
      };
      
      if (userProfileSnap.exists()) {
        // Aktualisiere das bestehende Dokument
        await updateDoc(userProfileRef, locationData);
        console.log('Standort in userProfiles gespeichert');
        return;
      }
      
      // Wenn nicht in userProfiles, dann in users-Collection versuchen
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Aktualisiere das bestehende Dokument
        await updateDoc(userRef, locationData);
        console.log('Standort in users gespeichert');
        return;
      }
      
      // Wenn der Benutzer in keiner Collection gefunden wurde, 
      // erstelle einen neuen Eintrag in userProfiles
      await setDoc(userProfileRef, {
        ...locationData,
        uid: userId,
        createdAt: new Date()
      });
      console.log('Neues Benutzerprofil mit Standort erstellt');
      
    } catch (error) {
      console.error('Fehler beim Speichern des Standorts:', error);
      throw new Error('Standort konnte nicht gespeichert werden');
    }
  }
  
  /**
   * Prüft, ob Standortkoordinaten gültig sind
   * @param location Die zu prüfenden Koordinaten
   * @returns true, wenn die Koordinaten gültig sind
   */
  isValidLocation(location: { lat: number, lng: number } | null): boolean {
    if (!location) return false;
    
    const { lat, lng } = location;
    
    // Prüfe, ob die Koordinaten im gültigen Bereich liegen
    const isValidLat = typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
    const isValidLng = typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
    
    // Prüfe, ob die Koordinaten nicht 0,0 sind (häufige Fehlerursache)
    const isNotNullIsland = !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001);
    
    return isValidLat && isValidLng && isNotNullIsland;
  }
}

// Exportiere eine Instanz des Services
const locationService = new LocationService();
export default locationService;