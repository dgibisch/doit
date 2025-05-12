import { useState, useEffect } from 'react';

// Ein Hook, der es erlaubt, zwischen Vollbildmodus (ohne Bottom-Navigation) und normalem Modus zu wechseln
export function useFullscreenMode() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Aktivieren des Vollbildmodus - blendet die Bottom-Navigation aus
  const enableFullscreen = () => {
    setIsFullscreen(true);
    document.body.classList.add('fullscreen-mode');
  };

  // Deaktivieren des Vollbildmodus - stellt die Bottom-Navigation wieder her
  const disableFullscreen = () => {
    setIsFullscreen(false);
    document.body.classList.remove('fullscreen-mode');
  };

  // CSS-Styles hinzufügen, wenn der Hook geladen wird
  useEffect(() => {
    // CSS für den Vollbildmodus einfügen
    const style = document.createElement('style');
    style.id = 'fullscreen-mode-styles';
    style.innerHTML = `
      body.fullscreen-mode {
        /* Entfernt das Padding, das normalerweise für die Bottom-Nav reserviert ist */
        padding-bottom: 0 !important;
      }
      
      /* Die Bottom-Navigation ausblenden im Vollbildmodus */
      body.fullscreen-mode #bottom-nav-container,
      body.fullscreen-mode > div:has(> [style*="position: fixed"][style*="bottom: 0"]) {
        display: none !important;
      }
      
      /* Versteckt den create-task Button im Fullscreen-Modus */
      body.fullscreen-mode [style*="position: fixed"][style*="bottom: 34px"] {
        display: none !important;
      }
      
      /* Verhindert, dass Container mit fester Höhe im Vollbildmodus unten Platz lassen */
      body.fullscreen-mode .container, 
      body.fullscreen-mode main, 
      body.fullscreen-mode .content-area, 
      body.fullscreen-mode .scrollable {
        padding-bottom: 0 !important;
      }
      
      /* Spezifische Anpassung für Chat- und Kommentarbereiche */
      body.fullscreen-mode .chat-container,
      body.fullscreen-mode .comments-container {
        height: 100vh !important;
        padding-bottom: 0 !important;
      }
    `;
    document.head.appendChild(style);

    // Aufräumen beim Unmounten
    return () => {
      const styleElement = document.getElementById('fullscreen-mode-styles');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
      // Sicherstellen, dass die Klasse entfernt wird, wenn die Komponente unmountet
      document.body.classList.remove('fullscreen-mode');
    };
  }, []);

  return { isFullscreen, enableFullscreen, disableFullscreen };
}