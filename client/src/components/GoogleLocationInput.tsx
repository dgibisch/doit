import { useEffect, useRef, useState } from "react";
import { cleanupGoogleAutocomplete, fixGooglePlacesPositionInModal } from '@/utils/cleanupGoogleElements';

interface Props {
  initialValue?: string;
  onSelect: (value: string, lat: number, lng: number) => void;
}

export default function GoogleLocationInput({ initialValue = "", onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    // Wenn Google Maps noch nicht geladen ist, lade es
    if (!window.google?.maps?.places) {
      loadGoogleMapsAPI();
    } else {
      // Wenn bereits geladen, initialisiere Autocomplete
      initializeAutocomplete();
    }

    // Aufräumen beim Unmount
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      // Bereinige die Google Autocomplete-Dropdown-Elemente
      cleanupGoogleAutocomplete();
    };
  }, []);
  
  // Effect für die Kennzeichnung des Eingabefelds für automatische Positionierung
  useEffect(() => {
    // Warten, bis das Eingabefeld geladen ist
    if (inputRef.current) {
      // Eingabefeld als Google Places Autocomplete kennzeichnen
      const htmlInput = inputRef.current as HTMLInputElement;
      
      // Daten-Attribut setzen, damit unsere Positionierungsfunktion es erkennt
      if (htmlInput.dataset) {
        htmlInput.dataset.googleAutocomplete = 'true';
      }
      
      // Spezielle Klasse hinzufügen, die ebenfalls erkannt wird
      htmlInput.classList.add('google-places-input');
    }
  }, []);

  // Google Maps API laden
  const loadGoogleMapsAPI = async () => {
    try {
      setIsLoading(true);
      
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('Kein Google Maps API-Key vorhanden');
        setIsLoading(false);
        return;
      }
      
      // Globale Callback-Funktion erstellen
      window.initGoogleMapsCallback = () => {
        console.log('Google Maps API für Profil geladen');
        setIsLoading(false);
        initializeAutocomplete();
      };
      
      // Script nur einfügen, wenn es noch nicht existiert
      if (!document.getElementById('google-maps-script')) {
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
        console.log('Google Maps Script für Profil eingefügt:', script.src);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Google Maps API:', error);
      setIsLoading(false);
    }
  };

  // Autocomplete initialisieren
  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return;

    try {
      // Bestehende Instanz aufräumen, falls vorhanden
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      
      // Neu initialisieren
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["(cities)"], // Nur Städte
        // Keine Länderbeschränkung, damit internationale Standorte ausgewählt werden können
      });

      // Google Places Dropdown optimal in Modalen anzeigen
      setTimeout(() => {
        if (inputRef.current) {
          // Position des Eingabefelds identifizieren
          const rect = inputRef.current.getBoundingClientRect();
          
          // Alle Dropdowns finden und korrekt positionieren
          const pacContainers = document.querySelectorAll('.pac-container');
          if (pacContainers.length > 0) {
            pacContainers.forEach(container => {
              const element = container as HTMLElement;
              element.style.position = 'fixed';
              element.style.top = `${rect.bottom}px`;
              element.style.left = `${rect.left}px`;
              element.style.width = `${rect.width}px`;
              element.style.zIndex = '99999'; // Sehr hoher z-index, damit es über Modal erscheint
            });
            console.log("Google Places Dropdown für Eingabefeld positioniert:", rect.left, rect.bottom);
          }
        }
      }, 300);

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        
        // Prüfe, ob ein gültiger Ort ausgewählt wurde
        if (!place || !place.geometry || !place.geometry.location) {
          return;
        }
        
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const name = place.formatted_address || place.name || "";
        
        // Eingabefeld aktualisieren
        setValue(name);
        
        // Entferne das Dropdown nach kurzer Verzögerung
        setTimeout(() => {
          const pacContainers = document.querySelectorAll('.pac-container');
          pacContainers.forEach(el => el.remove());
          console.log(`${pacContainers.length} Google Places Dropdown-Elemente aus Profil entfernt`);
        }, 200);
        
        // Callback aufrufen
        onSelect(name, lat, lng);
      });
      
      // Verhindere, dass Enter die Form abschickt
      inputRef.current.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      });
      
      console.log("Google Places Autocomplete erfolgreich initialisiert");
    } catch (error) {
      console.error('Fehler bei der Initialisierung von Autocomplete:', error);
    }
  };

  return (
    <div className="relative w-full" style={{ position: 'relative', zIndex: 1 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Wohnort eingeben"
        className="w-full border border-gray-300 p-2 rounded google-places-input"
        disabled={isLoading}
        style={{ position: 'relative' }}
        data-google-autocomplete="true"
        autoComplete="off"
        onClick={(e) => {
          // Stelle sicher, dass Autocomplete neu initialisiert wird bei Klick
          if (inputRef.current && !autocompleteRef.current && window.google?.maps?.places) {
            console.log("Reinitialisiere Autocomplete nach Klick");
            initializeAutocomplete();
          }
        }}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <span className="text-gray-400 text-sm">Lädt...</span>
        </div>
      )}
    </div>
  );
}

// TypeScript-Deklaration entfernt, da sie bereits in PlacesAutocomplete.tsx existiert