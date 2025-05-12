/**
 * Hilfsfunktionen für Google Places API
 * 
 * Diese Datei enthält Hilfsfunktionen für die Arbeit mit der Google Places API,
 * um die Implementierung zu vereinfachen und die Konsistenz zu gewährleisten.
 */

/**
 * Fügt CSS-Styles hinzu, um sicherzustellen, dass die Google Places-Dropdown-Menüs
 * korrekt angezeigt werden und nicht von anderen Elementen überdeckt werden.
 */
export function fixGooglePlacesStyles() {
  // Prüfen, ob die Styles bereits hinzugefügt wurden
  if (document.getElementById('google-places-styles')) return;
  
  // Style-Element erstellen
  const styleEl = document.createElement('style');
  styleEl.id = 'google-places-styles';
  styleEl.textContent = `
    /* Google Places-Dropdowns über alles andere legen */
    .pac-container {
      z-index: 10000 !important;
      pointer-events: auto !important;
    }
    
    /* Dialog mit hohem z-index, aber unter den Dropdowns */
    .location-selector-dialog {
      z-index: 9999 !important;
    }
    
    /* Keine Überlappung von Dialoginhalten mit Dropdowns */
    .location-selector-dialog * {
      pointer-events: auto !important;
    }
    
    /* Sicherstellen, dass die Eingabefelder klickbar sind */
    .google-places-input {
      position: relative;
      z-index: 1000;
    }
  `;
  
  // Dem Dokument hinzufügen
  document.head.appendChild(styleEl);
}

/**
 * Lädt die Google Maps API mit dem angegebenen Callback, falls sie noch nicht geladen ist.
 * @param callback Funktion, die aufgerufen wird, wenn die API geladen ist
 */
export function loadGoogleMapsApi(callback: () => void) {
  // Wenn bereits geladen, Callback direkt aufrufen
  if (window.google?.maps?.places) {
    callback();
    return;
  }
  
  // Globalen Callback für das Script-Tag definieren
  window.initGoogleMapsCallback = () => {
    callback();
  };
  
  // Prüfen, ob das Script bereits im Dokument ist
  if (document.getElementById('google-maps-script')) return;
  
  // API Key aus den Umgebungsvariablen holen
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[Google Places] API Key fehlt in .env (VITE_GOOGLE_MAPS_API_KEY)');
    return;
  }
  
  // Script-Element erstellen und einfügen
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
  script.async = true;
  script.defer = true;
  
  document.head.appendChild(script);
}

// Die globalen Typendefinitionen wurden nach client/src/types.d.ts verschoben