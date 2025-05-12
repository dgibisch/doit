import { useCallback } from 'react';
import { useLocation } from 'wouter';

/**
 * Custom Hook für die Navigation mit verbessertem Zurück-Verhalten.
 * Ermöglicht das Übergeben des aktuellen Pfades beim Navigieren zu einer neuen Seite,
 * damit die Zurück-Funktion korrekt funktioniert.
 */
export const useNavigation = () => {
  const [location, setLocation] = useLocation();
  
  /**
   * Navigiert zur angegebenen Profilseite und speichert den aktuellen Pfad als Referrer.
   * 
   * @param userId Die ID des Benutzers, dessen Profil angezeigt werden soll
   */
  const navigateToProfile = useCallback((userId: string) => {
    // Aktuellen Pfad als URL-Parameter anhängen, um später zurücknavigieren zu können
    const encodedCurrentPath = encodeURIComponent(location);
    setLocation(`/user/${userId}?from=${encodedCurrentPath}`);
  }, [location, setLocation]);
  
  /**
   * Navigiert zur angegebenen Task-Detailseite und speichert den aktuellen Pfad als Referrer.
   * 
   * @param taskId Die ID des Tasks, dessen Details angezeigt werden sollen
   */
  const navigateToTask = useCallback((taskId: string) => {
    const encodedCurrentPath = encodeURIComponent(location);
    setLocation(`/task/${taskId}?from=${encodedCurrentPath}`);
  }, [location, setLocation]);
  
  /**
   * Navigiert zur vorherigen Seite oder zur angegebenen Fallback-Seite,
   * wenn kein previousPath in den URL-Parametern gefunden wurde.
   * 
   * @param fallbackPath Pfad, zu dem navigiert werden soll, wenn kein vorheriger Pfad gefunden wurde
   */
  const goBack = useCallback((fallbackPath: string = '/') => {
    // Aktuelle URL-Parameter auslesen
    const searchParams = new URLSearchParams(window.location.search);
    const previousPath = searchParams.get('from');
    
    if (previousPath) {
      // Wenn ein vorheriger Pfad existiert, dorthin zurückkehren
      setLocation(decodeURIComponent(previousPath));
    } else {
      // Ansonsten zum Fallback-Pfad navigieren
      setLocation(fallbackPath);
    }
  }, [setLocation]);
  
  return {
    location,
    navigateToProfile,
    navigateToTask,
    goBack,
    navigateTo: setLocation
  };
};