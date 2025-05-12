import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { LocationData } from '@/utils/geoUtils';

interface SimpleGoogleAutocompleteProps {
  onLocationSelect: (locationData: LocationData | null) => void;
  initialAddress?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Einfache Google Places Autocomplete Komponente
 * 
 * Diese Version verwendet eine direkte Implementierung mit dem
 * Google Places Autocomplete API ohne komplexe Wrapper
 */
const SimpleGoogleAutocomplete: React.FC<SimpleGoogleAutocompleteProps> = ({
  onLocationSelect,
  initialAddress = '',
  placeholder = 'Stadt oder Gebiet eingeben...',
  className = ''
}) => {
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  // Styles für Google Places Dropdown
  useEffect(() => {
    // Hinzufügen von CSS für die richtige Anzeige der Dropdowns
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .pac-container {
        z-index: 10000 !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  // Initialisiere die Autocomplete-Funktionalität
  useEffect(() => {
    const checkGoogleMapsLoaded = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('Google Maps API ist geladen');
        setIsLoading(false);
        initializeAutocomplete();
      } else {
        console.log('Warte auf Google Maps API...');
        // Erneut versuchen in 500ms
        setTimeout(checkGoogleMapsLoaded, 500);
      }
    };
    
    // Sofort prüfen und dann ggf. periodisch
    checkGoogleMapsLoaded();
    
    // Event Listener für Script-Load
    const handleScriptLoad = () => {
      console.log('Google Maps Script geladen');
      checkGoogleMapsLoaded();
    };
    
    // Globalen Callback registrieren (alternativ)
    window.initGoogleMapsCallback = handleScriptLoad;
    
    return () => {
      // Aufräumen
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      
      // Globalen Callback zurücksetzen
      window.initGoogleMapsCallback = () => {};
    };
  }, []);
  

  
  // Initialisiere das Autocomplete-Objekt
  const initializeAutocomplete = () => {
    if (!inputRef.current) return;
    
    try {
      console.log('Initialisiere Google Places Autocomplete');
      
      // Autocomplete-Objekt erstellen
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode'], // Nur Orte, keine Geschäfte
      });
      
      // Event-Listener für place_changed hinzufügen
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        
        if (!place || !place.geometry || !place.geometry.location) {
          console.error('Ausgewählter Ort hat keine gültigen Koordinaten');
          return;
        }
        
        // Koordinaten und Adresse extrahieren
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const formattedAddress = place.formatted_address || place.name || '';
        
        // LocationData erstellen
        const locationData: LocationData = {
          address: formattedAddress,
          location: { lat, lng },
          area: formattedAddress.split(',')[0] || ''
        };
        
        console.log('Ort ausgewählt:', locationData);
        
        // Eingabefeld mit der ausgewählten Adresse aktualisieren
        setAddress(formattedAddress);
        
        // Parent-Komponente informieren
        onLocationSelect(locationData);
      });
      
      console.log('Google Places Autocomplete initialisiert');
    } catch (error) {
      console.error('Fehler bei der Initialisierung von Google Places Autocomplete:', error);
    }
  };
  
  // Handler für Eingabeänderungen
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };
  
  return (
    <div className="relative google-places-wrapper">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={address}
        onChange={handleInputChange}
        className={`${className} google-places-input`}
        disabled={isLoading}
        autoComplete="off"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default SimpleGoogleAutocomplete;