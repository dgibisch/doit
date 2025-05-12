import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useBottomNavContext } from '@/context/BottomNavContext';
import BottomNavigation from '@/components/common/BottomNavigation';

/**
 * Portalisierte Bottom-Navigation-Komponente
 * 
 * Diese Komponente fügt die Navigation über ein createPortal
 * direkt in den Body ein, um Layout-Probleme zu umgehen.
 */
export default function DirectBottomNav() {
  const { user } = useAuth();
  const { isVisible } = useBottomNavContext();
  
  if (!user || !isVisible) {
    return null;
  }
  
  // Verwende ein Portal direkt zum body
  try {
    return document.body ? createPortal(
      <BottomNavigation variant="portal" showNotifications={true} />,
      document.body
    ) : null;
  } catch (error) {
    console.error('Portal creation failed:', error);
    return null;
  }
}