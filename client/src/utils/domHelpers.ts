/**
 * Helper-Funktionen für DOM-Manipulationen
 */

// Verschiebt die Google Places Autocomplete Container zur Body-Wurzel, um z-index Konflikte zu beheben
export function fixGooglePlacesContainerPosition() {
  // MutationObserver erstellen, um DOM-Änderungen zu überwachen und auf neue .pac-container Elemente zu reagieren
  const observer = new MutationObserver((mutations) => {
    try {
      // Suche nach allen .pac-container Elementen nach jeder DOM-Änderung
      const containers = document.querySelectorAll('.pac-container');
      if (containers.length > 0) {
        containers.forEach((container) => {
          // Nur verschieben, wenn es sich nicht bereits im document.body befindet
          if (container.parentElement !== document.body) {
            // Aufzeichnen der ursprünglichen Position und Größe
            const rect = container.getBoundingClientRect();
            
            // Verschiebe an document.body
            document.body.appendChild(container);
            console.log('Google Places Autocomplete container moved to body');
            
            // Position und Stil anpassen
            Object.assign((container as HTMLElement).style, {
              zIndex: '9999',
              position: 'fixed', // Fixed position für bessere mobile Unterstützung
              top: `${rect.top + window.scrollY}px`,
              left: `${rect.left + window.scrollX}px`,
              width: 'calc(100% - 40px)', // Volle Breite mit Rand
              maxWidth: '600px', // Maximale Breite für Desktop
              display: 'block',
              pointerEvents: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            });
          }
        });
      }
    } catch (error) {
      console.error('Error handling Places Autocomplete container:', error);
    }
  });
  
  // Observer starten und gesamtes Dokument beobachten
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Callback für den Fall, dass bereits Container existieren
  setTimeout(() => {
    const existingContainers = document.querySelectorAll('.pac-container');
    if (existingContainers.length > 0) {
      existingContainers.forEach((container) => {
        if (container.parentElement !== document.body) {
          document.body.appendChild(container);
          console.log('Existing Google Places container moved to body');
        }
      });
    }
  }, 1000);
  
  return observer; // Observer zurückgeben für mögliche spätere Bereinigung
}

// Funktion zum Setzen eines globalen CSS-Styles
export function addGlobalStyle(css: string) {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    head.appendChild(style);
    return style;
  } catch (e) {
    console.error('Error adding global style:', e);
    return null;
  }
}

// Fügt einen Event-Listener hinzu, der auf Klicks in der Autocomplete-Liste reagiert
export function fixGooglePlacesAutocompleteClicks() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Wenn auf ein Element in der Autocomplete-Liste geklickt wurde
    if (target.closest('.pac-item') || target.classList.contains('pac-item') || 
        target.closest('.pac-container') || target.classList.contains('pac-container')) {
      e.stopPropagation();
      // Dieser Teil hilft bei bestimmten UI-Frameworks, die versuchen könnten, das Klick-Event zu stoppen
      console.log('Autocomplete item clicked, stopping propagation');
      setTimeout(() => {
        // Lokalisiere das aktiv fokussierte Eingabefeld
        const inputs = document.querySelectorAll('input:focus');
        if (inputs.length > 0) {
          (inputs[0] as HTMLInputElement).blur();
          (inputs[0] as HTMLInputElement).focus();
        }
      }, 100);
    }
  }, true); // Der dritte Parameter auf "true" setzen, um die Capture-Phase zu verwenden
}