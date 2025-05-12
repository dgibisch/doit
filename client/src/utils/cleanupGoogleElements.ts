/**
 * Hilfsfunktionen zum Bereinigen der von Google Places erzeugten DOM-Elemente
 * 
 * Diese Funktionen lösen ein wichtiges Problem mit Google Places:
 * Die Dropdown-Elemente (.pac-container) werden direkt an body angehängt und 
 * bleiben oft nach dem Schließen eines Dialogs übrig, was zu UI-Problemen führt.
 */

/**
 * Entfernt alle Google Places Autocomplete-Dropdown-Elemente aus dem DOM
 */
export function cleanupGoogleAutocomplete() {
  try {
    const pacContainers = document.querySelectorAll('.pac-container');
    if (pacContainers.length > 0) {
      pacContainers.forEach(el => el.remove());
      console.log(`${pacContainers.length} Google Autocomplete-Container entfernt`);
    }
  } catch (error) {
    console.error('Fehler beim Entfernen der Google Places Elemente:', error);
  }
}

/**
 * Richtet einen Beobachter ein, der Google Places-Dropdown-Elemente automatisch bereinigt,
 * wenn sie außerhalb des ursprünglichen Elements angeklickt werden
 */
export function setupAutoCleanupForGooglePlaces() {
  try {
    // Event-Listener auf body, der Klicks außerhalb von Autocomplete-Elementen erkennt
    document.body.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      // Wenn nicht auf ein Autocomplete-Element geklickt wurde...
      if (!target.closest('.pac-container') && !target.closest('input[autocomplete="off"]')) {
        // ...entferne alle Dropdown-Elemente
        setTimeout(() => cleanupGoogleAutocomplete(), 100);
      }
    });

    console.log('Google Places Autocomplete auto-cleanup eingerichtet');
  } catch (error) {
    console.error('Fehler beim Einrichten des Google Places auto-cleanup:', error);
  }
}

/**
 * Korrigiert die Position der Google Places-Dropdown-Elemente in einem Dialog
 * 
 * @param inputElement Das Eingabefeld, an dem das Dropdown ausgerichtet werden soll
 */
export function fixGooglePlacesPositionInModal(inputElement: HTMLElement) {
  try {
    // Ensure the input element and its container have the correct positioning
    const inputRect = inputElement.getBoundingClientRect();
    
    // Find pac-container elements and position them correctly
    setTimeout(() => {
      const pacContainers = document.querySelectorAll('.pac-container');
      
      if (pacContainers.length > 0) {
        console.log('Positioniere Google Places Dropdown für Eingabefeld:', inputRect.left, inputRect.bottom);
        
        pacContainers.forEach(container => {
          const element = container as HTMLElement;
          element.style.position = 'fixed';
          element.style.top = `${inputRect.bottom}px`;
          element.style.left = `${inputRect.left}px`;
          element.style.width = `${inputRect.width}px`;
          element.style.zIndex = '9999'; // Höherer z-index, damit es immer sichtbar ist
        });
      }
    }, 100);
  } catch (error) {
    console.error('Fehler beim Positionieren der Google Places-Dropdown-Liste:', error);
  }
}