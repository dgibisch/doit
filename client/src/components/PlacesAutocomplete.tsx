import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { LocationData } from '@/utils/geoUtils';
import { cleanupGoogleAutocomplete } from '@/utils/cleanupGoogleElements';

// Helper-Funktion zum Extrahieren des Gebiets aus einer Adresse
function extractAreaFromAddress(address: string): string {
  // Versuche, das erste Segment zu extrahieren (normalerweise die Stadt)
  const parts = address.split(',');
  return parts[0].trim();
}

interface PlacesAutocompleteProps {
  onLocationSelect: (locationData: LocationData | null) => void;
  initialAddress?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Eine Google Places Autocomplete Komponente
 * 
 * Diese Komponente lädt die Google Maps API und erstellt ein Autocomplete-Eingabefeld.
 */
export default function PlacesAutocomplete({
  onLocationSelect,
  initialAddress = '',
  placeholder = 'Stadt oder Gebiet eingeben...',
  className = '',
  disabled = false,
  required = false
}: PlacesAutocompleteProps) {
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  // Wenn sich initialAddress ändert und der Benutzer nicht gerade tippt,
  // aktualisiere das Eingabefeld
  useEffect(() => {
    if (!userTyping && initialAddress) {
      setAddress(initialAddress);
    }
  }, [initialAddress, userTyping]);
  
  // Lade die Google Maps API und initialisiere Autocomplete
  useEffect(() => {
    // Wenn das Skript bereits geladen wurde, initialisiere Autocomplete direkt
    if (window.google?.maps?.places) {
      initializeAutocomplete();
      return;
    }
    
    // Andernfalls lade die Google Maps API
    const loadGoogleMapsAPI = async () => {
      try {
        setIsLoading(true);
        
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          console.error('No Google Maps API key provided');
          setIsLoading(false);
          return;
        }
        
        // Erstelle globale Callback-Funktion
        window.initGoogleMapsCallback = () => {
          setIsLoading(false);
          initializeAutocomplete();
        };
        
        // Füge das Skript zum Dokument hinzu, wenn es nicht bereits existiert
        if (!document.getElementById('google-maps-script')) {
          const script = document.createElement('script');
          script.id = 'google-maps-script';
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
          script.async = true;
          script.defer = true;
          document.body.appendChild(script);
        }
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
        setIsLoading(false);
      }
    };
    
    loadGoogleMapsAPI();
    
    // Aufräumen
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      
      // Bereinige die Google Autocomplete-Dropdown-Elemente
      cleanupGoogleAutocomplete();
    };
  }, []);
  
  // Initialisiere Autocomplete mit dem Input-Element
  const initializeAutocomplete = () => {
    if (!inputRef.current) return;
    
    try {
      // Erstelle Autocomplete-Objekt
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode'], // Nur Orte, keine Geschäfte
      });
      
      // Event-Listener für Ortsauswahl
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        
        // Wenn der Ort keine Geometrie hat, ignoriere ihn
        if (!place || !place.geometry || !place.geometry.location) {
          return;
        }
        
        // Extrahiere Koordinaten und Adresse
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const formattedAddress = place.formatted_address || '';
        
        // LocationData erstellen
        const locationData: LocationData = {
          address: formattedAddress,
          location: { lat, lng },
          area: extractAreaFromAddress(formattedAddress)
        };
        
        // Adresse im Eingabefeld aktualisieren
        setAddress(formattedAddress);
        setUserTyping(false);
        
        // Entferne das Autocomplete-Dropdown nach kurzer Verzögerung
        // um sicherzustellen, dass alle Google-Events verarbeitet wurden
        setTimeout(() => {
          const pacContainers = document.querySelectorAll('.pac-container');
          pacContainers.forEach(el => el.remove());
        }, 200);
        
        // Callback aufrufen
        onLocationSelect(locationData);
      });
      
      // Verhindere, dass Enter die Form abschickt
      inputRef.current.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      });
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
    }
  };
  
  // Behandle Eingabeänderungen
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserTyping(true);
    setAddress(e.target.value);
    
    // Wenn die Eingabe gelöscht wird, setze den Location-State zurück
    if (e.target.value === '') {
      onLocationSelect(null);
    }
  };
  
  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={address}
        onChange={handleInputChange}
        className={`${className} google-places-input`}
        disabled={disabled || isLoading}
        required={required}
        autoComplete="off"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}

// Die globalen Typendefinitionen wurden nach client/src/types.d.ts verschoben