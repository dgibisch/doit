import React, { useState, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  loadingClassName?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Eine optimierte Bild-Komponente, die Lazy-Loading und Placeholder unterstützt
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = '',
  className = '',
  width,
  height,
  loadingClassName = 'animate-pulse bg-gray-200',
  style,
  onLoad,
  onError,
  onClick
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  
  useEffect(() => {
    // Nur laden, wenn eine gültige src vorhanden ist
    if (!src) {
      setIsError(true);
      onError?.();
      return;
    }
    
    setIsLoaded(false);
    
    // Neues Bild erstellen und laden
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      setIsError(true);
      onError?.();
    };
    
    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);
  
  // Grundlegende Klassen, die auf dem Ladezustand basieren
  const imageClasses = isLoaded 
    ? className
    : `${className} ${loadingClassName}`;
  
  // Stil für Platzhalterbild oder Originalbildgröße
  const styleProps: React.CSSProperties = {...(style || {})};
  
  if (width) styleProps.width = width;
  if (height) styleProps.height = height;
  
  // Wenn ein Fehler auftritt und es keinen Platzhalter gibt, einen Standard-Fallback anzeigen
  if (isError && !placeholder) {
    return (
      <div 
        className={`${className} bg-gray-100 flex items-center justify-center`}
        style={styleProps}
      >
        <svg 
          className="w-1/3 h-1/3 text-gray-400" 
          fill="none" 
          stroke="currentColor"
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }
  
  // Entweder den Platzhalter oder das geladene Bild anzeigen
  return (
    <img
      src={currentSrc || placeholder}
      alt={alt}
      className={imageClasses}
      style={styleProps}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    />
  );
};

export default LazyImage;