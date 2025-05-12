import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BottomNavigation from '@/components/common/BottomNavigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook für die dynamische Erstellung der Bottom-Navigation
 * 
 * Dieser Hook erstellt direkt ein Portal im DOM und rendert
 * die Bottom-Navigation-Komponente, falls ein Benutzer eingeloggt ist.
 * 
 * @returns Nichts, da die Navigation direkt ins DOM eingefügt wird
 */
export function useBottomNav() {
  const { user } = useAuth();
  const [root, setRoot] = useState<ReturnType<typeof createRoot> | null>(null);
  
  useEffect(() => {
    // Wenn der Benutzer nicht angemeldet ist, nichts tun
    if (!user) return;
    
    // Container Element finden oder erstellen
    let container = document.getElementById('bottom-nav-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bottom-nav-container';
      document.body.appendChild(container);
    }
    
    // Erstellen und speichern der Root Instanz
    const newRoot = createRoot(container);
    setRoot(newRoot);
    
    // Rendern der Navigation mit der neuen gemeinsamen Komponente
    newRoot.render(<BottomNavigation variant="portal" />);
    
    // Aufräumen beim Unmounten
    return () => {
      if (root) {
        root.unmount();
      }
      if (container && document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [user]);
}