import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { extractLocationFromPlace, type LocationData } from '@/utils/geoUtils';

interface PlacesAutocompleteProps {
  onLocationSelect: (locationData: LocationData | null) => void;
  initialAddress?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Eine stark vereinfachte Google Places Autocomplete Komponente
 * 
 * Diese Version verwendet einen minimalistischen Ansatz ohne komplexe
 * Mechanismen zur Synchronisierung zwischen React und dem DOM.
 */
const SimplePlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  onLocationSelect,
  initialAddress = '',
  placeholder = 'Stadt oder Gebiet manuell eingeben',
  className = '',
  disabled = false,
  required = false
}) => {
  const [address, setAddress] = useState(initialAddress);
  const [loading, setLoading] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const ignoreNextInputUpdate = useRef(false);
  
  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      setGoogleMapsLoaded(true);
      return;
    }
    
    setLoading(true);
    
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API Key fehlt');
      setLoading(false);
      return;
    }
    
    // Global callback
    (window as any).initPlacesAPI = () => {
      console.log('Google Maps API erfolgreich geladen');
      setGoogleMapsLoaded(true);
      setLoading(false);
    };
    
    // Create script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initPlacesAPI`;
    script.async = true;
    script.defer = true;
    
    document.head.appendChild(script);
    
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);
  
  // Initialize autocomplete
  useEffect(() => {
    if (!googleMapsLoaded || !inputRef.current) return;
    
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['geocode'],
        fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      });
      
      // Handle place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        
        if (!place || !place.geometry || !place.geometry.location) {
          console.error('Ungültige Ortsauswahl:', place);
          return;
        }
        
        // Flag setzen, damit wir die nächste Aktualisierung ignorieren
        ignoreNextInputUpdate.current = true;
        
        // Orts-Objekt extrahieren
        const locationData = extractLocationFromPlace(place);
        
        // Sicherstellung, dass locationData nicht null ist
        if (locationData) {
          // React-State aktualisieren und Parent informieren
          setAddress(locationData.address);
          onLocationSelect(locationData);
        } else {
          console.error('Konnte keine Locationdaten aus Place extrahieren:', place);
        }
        
        // Visuelles Feedback
        if (inputRef.current) {
          inputRef.current.classList.add('border-green-500');
          setTimeout(() => inputRef.current?.classList.remove('border-green-500'), 1000);
        }
      });
    } catch (error) {
      console.error('Fehler bei Autocomplete:', error);
    }
    
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [googleMapsLoaded, onLocationSelect]);
  
  // Update from props
  useEffect(() => {
    if (initialAddress && initialAddress !== address) {
      setAddress(initialAddress);
    }
  }, [initialAddress]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Wenn wir eine Auswahl hatten, ignorieren wir diese Änderung
    if (ignoreNextInputUpdate.current) {
      ignoreNextInputUpdate.current = false;
      return;
    }
    
    const newValue = e.target.value;
    setAddress(newValue);
    
    // Bei leerer Eingabe den Wert zurücksetzen
    if (!newValue.trim()) {
      onLocationSelect(null);
      
      // Alle hängenden Dropdowns entfernen
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => container.remove());
    }
  };
  
  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={address}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`${className} location-input`}
        disabled={disabled || loading || !googleMapsLoaded}
        required={required}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default SimplePlacesAutocomplete;