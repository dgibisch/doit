import React, { createContext, useState, useContext, useEffect } from 'react';

interface BottomNavContextType {
  isVisible: boolean;
  hideNav: () => void;
  showNav: () => void;
  toggleNav: () => void;
}

const defaultContext: BottomNavContextType = {
  isVisible: true,
  hideNav: () => {},
  showNav: () => {},
  toggleNav: () => {},
};

const BottomNavContext = createContext<BottomNavContextType>(defaultContext);

export const BottomNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(true);

  const hideNav = () => setIsVisible(false);
  const showNav = () => setIsVisible(true);
  const toggleNav = () => setIsVisible(prev => !prev);

  // Wenn die Detailansicht geschlossen wird und wir navigieren zurück,
  // sollten wir sicherstellen, dass die Navigation wieder sichtbar ist
  useEffect(() => {
    const handlePopState = () => {
      showNav();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const contextValue = {
    isVisible,
    hideNav,
    showNav,
    toggleNav,
  };

  return (
    <BottomNavContext.Provider value={contextValue}>
      {children}
    </BottomNavContext.Provider>
  );
};

export const useBottomNavContext = () => useContext(BottomNavContext);