import React from 'react';

interface LoadingScreenProps {
  label?: string;
  size?: 'small' | 'medium' | 'large';
  center?: boolean;
  showLogo?: boolean;
}

/**
 * Ein optimiertes Lade-Overlay mit verschiedenen Größenoptionen und Beschriftung
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({
  label = 'Wird geladen...',
  size = 'medium',
  center = true,
  showLogo = false
}) => {
  // Spinner-Größe basierend auf der gewählten Größe bestimmen
  const spinnerSize = {
    small: 'w-6 h-6 border-2',
    medium: 'w-10 h-10 border-3',
    large: 'w-16 h-16 border-4'
  }[size];
  
  // Container-Klasse basierend auf der center-Option
  const containerClass = center 
    ? 'flex flex-col items-center justify-center min-h-[200px]' 
    : 'flex flex-col items-center py-6';
  
  return (
    <div className={containerClass}>
      {showLogo && (
        <div className="mb-4 w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-md">
          <h1 className="text-2xl font-bold text-white">DoIt</h1>
        </div>
      )}
      
      <div className={`${spinnerSize} border-primary border-t-transparent rounded-full animate-spin`}></div>
      
      {label && (
        <p className="mt-4 text-gray-600">{label}</p>
      )}
    </div>
  );
};

export default LoadingScreen;