import React, { useState } from 'react';
import LazyImage from './LazyImage';
import { Dialog, DialogContent } from './dialog';

interface ZoomableLazyImageProps {
  src: string;
  alt: string;
  maxHeight?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Eine optimierte, zoombare Bildkomponente, die LazyLoading verwendet
 */
const ZoomableLazyImage: React.FC<ZoomableLazyImageProps> = ({
  src,
  alt,
  maxHeight = 300,
  objectFit = 'cover',
  className = '',
}) => {
  const [isZoomed, setIsZoomed] = useState(false);

  const handleClick = () => {
    setIsZoomed(true);
  };

  const handleClose = () => {
    setIsZoomed(false);
  };

  const imgStyle: React.CSSProperties = {
    maxHeight: `${maxHeight}px`,
    objectFit,
    cursor: 'zoom-in',
  };

  return (
    <>
      <LazyImage
        src={src}
        alt={alt}
        className={`rounded-md ${className}`}
        style={imgStyle}
        onClick={handleClick}
      />

      <Dialog open={isZoomed} onOpenChange={handleClose}>
        <DialogContent className="p-1 max-w-[90vw] max-h-[90vh]" onEscapeKeyDown={handleClose}>
          <div className="w-full h-full flex items-center justify-center">
            <LazyImage
              src={src}
              alt={alt}
              className="max-w-full max-h-[85vh] object-contain"
              onClick={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ZoomableLazyImage;