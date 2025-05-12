/**
 * Spezielle Hilfsfunktionen für die Korrektur der Google Places Dropdown-Position
 * 
 * Diese Funktionen beheben das Problem, dass Google Places Autocomplete-Dropdowns
 * an der falschen Stelle angezeigt werden, besonders in modalen Dialogen oder auf mobilen Geräten.
 */

/**
 * Korrigiert die Position aller Google Places Dropdowns im Dokument
 * 
 * @returns Die Anzahl der korrigierten Dropdown-Elemente
 */
export function fixAllGooglePlacesDropdowns(): number {
  try {
    // Finde alle Google Places Eingabefelder
    const inputs = document.querySelectorAll('input[autocomplete="off"]');
    let count = 0;
    
    // Für jedes Eingabefeld...
    inputs.forEach(input => {
      // Prüfe, ob es sich um ein Google Places Autocomplete-Feld handelt
      const htmlInput = input as HTMLInputElement;
      if ((htmlInput.dataset && htmlInput.dataset.googleAutocomplete === 'true') || 
          htmlInput.classList.contains('pac-target-input')) {
        fixDropdownForInput(input as HTMLElement);
        count++;
      }
    });
    
    // Zusätzlich alle .pac-container finden, die keinem Eingabefeld zugeordnet sind
    const pacContainers = document.querySelectorAll('.pac-container');
    
    if (pacContainers.length > 0 && count === 0) {
      // Wenn es Dropdown-Elemente gibt, aber keine Eingabefelder, die wir korrigiert haben...
      // ...positioniere sie in der Mitte des sichtbaren Bereichs
      pacContainers.forEach(container => {
        const element = container as HTMLElement;
        element.style.position = 'fixed';
        element.style.top = '50%';
        element.style.left = '50%';
        element.style.transform = 'translate(-50%, -50%)';
        element.style.maxWidth = '90vw';
        element.style.width = '350px';
        count++;
      });
    }
    
    return count;
  } catch (error) {
    console.error('Fehler beim Korrigieren der Google Places Dropdown-Position:', error);
    return 0;
  }
}

/**
 * Korrigiert die Position des Google Places Dropdowns für ein bestimmtes Eingabefeld
 * 
 * @param inputElement Das Eingabefeld, für das das Dropdown positioniert werden soll
 */
export function fixDropdownForInput(inputElement: HTMLElement) {
  try {
    // Die Position und Maße des Eingabefelds bestimmen
    const rect = inputElement.getBoundingClientRect();
    
    // Alle zugehörigen pac-container finden
    setTimeout(() => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => {
        const element = container as HTMLElement;
        
        // Absolute Positionierung relativ zum Eingabefeld
        element.style.position = 'fixed';
        element.style.top = `${rect.bottom}px`;
        element.style.left = `${rect.left}px`;
        element.style.width = `${rect.width}px`;
        
        // Weitere wichtige Styles für korrektes Rendering
        element.style.zIndex = '9999';
        element.style.maxHeight = '300px';
        element.style.overflowY = 'auto';
        element.style.display = 'block';
        element.style.visibility = 'visible';
        
        console.log(`Google Places Dropdown für Eingabefeld positioniert: ${rect.top}, ${rect.left}`);
      });
    }, 100);
  } catch (error) {
    console.error('Fehler beim Positionieren eines Google Places Dropdowns:', error);
  }
}

/**
 * Richtet Event-Listener ein, um Google Places Dropdowns automatisch neu zu positionieren,
 * wenn das Eingabefeld Fokus erhält oder wenn der Nutzer etwas eingibt
 */
export function setupAutomaticPositioning() {
  try {
    // Globaler Event-Listener für Fokus auf Eingabefelder
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      
      // Prüfe, ob es sich um ein Google Places Autocomplete-Feld handelt
      if (target.tagName === 'INPUT' &&
          (target.getAttribute('autocomplete') === 'off' ||
           target.classList.contains('pac-target-input'))) {
        // Positioniere das Dropdown für dieses Eingabefeld
        fixDropdownForInput(target);
      }
    });
    
    // Auch bei Eingabe neu positionieren
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLElement;
      
      if (target.tagName === 'INPUT' &&
          (target.getAttribute('autocomplete') === 'off' ||
           target.classList.contains('pac-target-input'))) {
        fixDropdownForInput(target);
      }
    });
    
    // Timer für regelmäßige Überprüfung, ob neue Dropdowns erschienen sind
    setInterval(() => {
      const count = fixAllGooglePlacesDropdowns();
      if (count > 0) {
        console.log(`${count} Google Places Dropdowns automatisch neu positioniert`);
      }
    }, 500);
    
    console.log('Automatische Positionierung für Google Places eingerichtet');
  } catch (error) {
    console.error('Fehler beim Einrichten der automatischen Positionierung:', error);
  }
}