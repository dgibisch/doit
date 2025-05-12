import React from 'react';

interface DoItLogoProps {
  size?: number;
  gradient?: boolean;
  className?: string;
}

/**
 * Das DoIt Logo als Komponente
 * 
 * Kann in verschiedenen Größen und mit oder ohne Gradient dargestellt werden
 */
const DoItLogo: React.FC<DoItLogoProps> = ({ 
  size = 32, 
  gradient = false, 
  className = '' 
}) => {
  const gradientId = 'doitLogoGradient';
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size}
      height={size}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      )}
      <path 
        d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" 
        stroke={gradient ? `url(#${gradientId})` : 'currentColor'}
      />
    </svg>
  );
};

export default DoItLogo;