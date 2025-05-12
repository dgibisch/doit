import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import BottomNavigation from '@/components/common/BottomNavigation';

/**
 * A bottom navigation bar that's directly rendered to the DOM
 * using a portal to bypass any potential styling issues
 */
export default function DirectBottomNav() {
  // Wir prüfen, ob document bereits existiert (für SSR-Kompatibilität)
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    
    // CSS Reset für eventuell vorhandene Padding-Styles
    const style = document.createElement('style');
    style.id = 'bottom-nav-reset';
    style.innerHTML = `
      .fixed.bottom-0 {
        bottom: 0 !important;
        margin-bottom: 0 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const styleElement = document.getElementById('bottom-nav-reset');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);
  
  // Erst rendern, wenn wir client-seitig sind
  if (!mounted) return null;
  
  return createPortal(
    <BottomNavigation variant="portal" showNotifications={true} />,
    document.body
  );
}