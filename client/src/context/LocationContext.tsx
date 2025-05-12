import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { locationService } from '@/lib/location-service';
import { useAuth } from './AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LocationData } from '@/utils/geoUtils';

// Typdefinition für den Standort-Kontext
interface LocationContextType {
  userLocation: { lat: number; lng: number } | null;
  isLocationLoading: boolean;
  locationError: string | null;
  searchRadius: number;
  setSearchRadius: (radius: number) => void;
  requestUserLocation: () => Promise<{ lat: number; lng: number } | null>;
  calculateDistance: (targetLocation: { lat: number; lng: number }) => number;
  getUserLocationName: () => Promise<string | null>;
  setManualLocation: (locationData: LocationData) => Promise<void>;
  locationSource: 'gps' | 'manual' | null;
}

// Erstellen des Kontexts mit Default-Werten
const LocationContext = createContext<LocationContextType>({
  userLocation: null,
  isLocationLoading: false,
  locationError: null,
  searchRadius: 10,
  setSearchRadius: () => {},
  requestUserLocation: async () => null,
  calculateDistance: () => 0,
  getUserLocationName: async () => null,
  setManualLocation: async () => {},
  locationSource: null
});

// Hook für einfachen Zugriff auf den Standort-Kontext
// Wegen Fast Refresh Kompatibilität: Wir exportieren den Hook direkt aus einer Funktion
function useUserLocationHook() {
  return useContext(LocationContext);
}

export { useUserLocationHook as useUserLocation };

// Provider-Komponente für den Standort-Kontext
export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(10); // Standardradius: 10 km
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Laden und Speichern der Benutzereinstellungen für den Standort
  useEffect(() => {
    // Wir prüfen zuerst, ob der Benutzer bereits einen gespeicherten Standort hat
    if (user?.id) {
      const fetchUserLocationSettings = async () => {
        try {
          // Zuerst userProfiles-Collection prüfen
          const userProfileRef = doc(db, 'userProfiles', user.id);
          const userProfileSnap = await getDoc(userProfileRef);
          
          if (userProfileSnap.exists()) {
            const userData = userProfileSnap.data();
            
            // Standortkoordinaten laden
            if (userData.locationCoordinates) {
              const storedLocation = userData.locationCoordinates;
              if (storedLocation.lat && storedLocation.lng) {
                setUserLocation(storedLocation);
                setLocationName(userData.location || null);
              }
            }
            
            // Suchradius laden, falls vorhanden
            if (userData.radius) {
              setSearchRadius(userData.radius);
            }
            
            // Standortquelle laden
            if (userData.locationSource) {
              setLocationSource(userData.locationSource);
            }
          } else {
            // Fallback: users-Collection prüfen
            const userRef = doc(db, 'users', user.id);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              
              // Standortkoordinaten laden
              if (userData.locationCoordinates) {
                const storedLocation = userData.locationCoordinates;
                if (storedLocation.lat && storedLocation.lng) {
                  setUserLocation(storedLocation);
                  setLocationName(userData.location || null);
                }
              }
              
              // Suchradius laden, falls vorhanden
              if (userData.radius) {
                setSearchRadius(userData.radius);
              }
              
              // Standortquelle laden
              if (userData.locationSource) {
                setLocationSource(userData.locationSource);
              }
            }
          }
        } catch (error) {
          console.error('Fehler beim Laden der Standorteinstellungen:', error);
        }
      };
      
      fetchUserLocationSettings();
    }
  }, [user]);

  // Speichern der Suchradiuseinstellung
  const saveSearchRadius = useCallback(async (radius: number) => {
    if (!user?.id) return;

    try {
      // Prüfen, in welcher Collection der Benutzer gespeichert ist
      const userProfileRef = doc(db, 'userProfiles', user.id);
      const userProfileSnap = await getDoc(userProfileRef);
      
      if (userProfileSnap.exists()) {
        await updateDoc(userProfileRef, { radius });
      } else {
        // Fallback: users-Collection
        const userRef = doc(db, 'users', user.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          await updateDoc(userRef, { radius });
        }
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Suchradius:', error);
    }
  }, [user]);

  // Suchradius ändern und speichern
  const handleSetSearchRadius = useCallback((radius: number) => {
    setSearchRadius(radius);
    saveSearchRadius(radius);
  }, [saveSearchRadius]);

  // Funktion zum Anfordern des Benutzerstandorts
  const requestUserLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      setIsLocationLoading(true);
      setLocationError(null);
      
      const position = await locationService.getCurrentPosition();
      setUserLocation(position);
      setLocationSource('gps');
      
      // Wenn ein Benutzer eingeloggt ist, speichern wir seinen Standort
      if (user?.id) {
        try {
          const locationResult = await locationService.saveUserLocation(user.id, position);
          // Wenn die Ortsinformation zurückkommt, setzen wir den Namen
          if (locationResult && typeof locationResult === 'object' && 'address' in locationResult) {
            setLocationName(locationResult.address || null);
          }
        } catch (e) {
          console.error('Fehler beim Speichern des Standorts:', e);
        }
      }
      
      return position;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Standortfehler';
      setLocationError(errorMessage);
      
      toast({
        title: "Standort nicht verfügbar",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsLocationLoading(false);
    }
  };

  // Manuell eingegebenen Standort setzen
  const setManualLocation = async (locationData: LocationData): Promise<void> => {
    try {
      setIsLocationLoading(true);
      setLocationError(null);
      
      setUserLocation(locationData.location);
      setLocationName(locationData.address);
      setLocationSource('manual');
      
      // Wenn ein Benutzer eingeloggt ist, speichern wir seinen Standort
      if (user?.id) {
        await locationService.saveUserLocation(user.id, {
          lat: locationData.location.lat,
          lng: locationData.location.lng,
          address: locationData.address,
          area: locationData.area
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Setzen des Standorts';
      setLocationError(errorMessage);
      
      toast({
        title: "Standort konnte nicht gesetzt werden",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLocationLoading(false);
    }
  };

  // Funktion zur Entfernungsberechnung
  const calculateDistance = (targetLocation: { lat: number; lng: number }): number => {
    if (!userLocation || !targetLocation) return 0;
    return locationService.calculateDistance(userLocation, targetLocation);
  };

  // Name des aktuellen Standorts abrufen
  const getUserLocationName = async (): Promise<string | null> => {
    if (!userLocation) return null;
    
    // Wenn wir bereits einen Namen haben, diesen zurückgeben
    if (locationName) return locationName;
    
    // Ansonsten versuchen wir, den Namen aus dem Benutzerprofil zu laden
    if (user?.id) {
      try {
        const userProfileRef = doc(db, 'userProfiles', user.id);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (userProfileSnap.exists() && userProfileSnap.data().location) {
          return userProfileSnap.data().location;
        }
        
        // Fallback: users-Collection
        const userRef = doc(db, 'users', user.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().location) {
          return userSnap.data().location;
        }
      } catch (error) {
        console.error('Fehler beim Laden des Standortnamens:', error);
      }
    }
    
    // Fallback: "Unbekannter Ort"
    return "Unbekannter Ort";
  };

  // Bei erstem Laden automatisch nach dem Standort fragen (einmalig)
  useEffect(() => {
    // Automatisch nach dem Benutzerstandort fragen, aber nur einmal
    const shouldAutoRequest = !localStorage.getItem('locationRequested');
    
    if (shouldAutoRequest) {
      // Wir markieren, dass wir nach dem Standort gefragt haben
      localStorage.setItem('locationRequested', 'true');
      
      // Nach einer Verzögerung nach dem Standort fragen
      const timeoutId = setTimeout(() => {
        requestUserLocation().catch(error => {
          console.error('Fehler beim automatischen Abrufen des Standorts:', error);
        });
      }, 2000); // 2 Sekunden Verzögerung
      
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Provider-Werte
  const contextValue: LocationContextType = {
    userLocation,
    isLocationLoading,
    locationError,
    searchRadius,
    setSearchRadius: handleSetSearchRadius,
    requestUserLocation,
    calculateDistance,
    getUserLocationName,
    setManualLocation,
    locationSource
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};