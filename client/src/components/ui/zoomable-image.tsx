import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: 'square' | 'video' | 'wide';
  maxHeight?: number | string;
  objectFit?: 'cover' | 'contain';
}

/**
 * Eine wiederverwendbare Komponente für zoombare Bilder
 * Klicken auf das Bild öffnet es in einem Vollbild-Modal
 */
const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt = 'Bild',
  className = '',
  containerClassName = '',
  aspectRatio = 'wide',
  maxHeight = 300,
  objectFit = 'contain'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bestimme die Aspect Ratio-Klasse
  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[16/9]',
  }[aspectRatio];

  // Handle Bildklick für Vollbild-Modus
  const openImageModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Bild mit Zoom-Indikator */}
      <div 
        className={cn(
          "group relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50",
          aspectRatio !== 'wide' && aspectRatioClass,
          containerClassName
        )}
        style={{ maxHeight }}
        onClick={openImageModal}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn(
            "w-full h-full object-center cursor-pointer transition-opacity hover:opacity-95",
            objectFit === 'cover' ? 'object-cover' : 'object-contain',
            className
          )}
        />
        
        {/* Zoom-Indikator (nur auf Desktop anzeigen) */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 text-white rounded-full p-1">
          <ZoomIn className="h-4 w-4" />
        </div>
      </div>

      {/* Vollbild-Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 flex items-center justify-center overflow-hidden">
          {/* Schließen-Button */}
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          
          {/* Großes Bild */}
          <div className="w-full h-full max-h-[90vh] flex items-center justify-center p-4">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ZoomableImage;