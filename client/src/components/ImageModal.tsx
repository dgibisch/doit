import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useEmblaCarousel from 'embla-carousel-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
}

/**
 * Vollbild-Modal für Bildergalerie mit Swipe-Unterstützung
 */
const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0
}) => {
  // Embla Carousel für Touch-Swipe
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: images && images.length > 1,
    align: 'center'
  });
  
  // Aktiver Bild-Index
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Wenn sich der initialIndex ändert, oder das Modal geöffnet wird
  useEffect(() => {
    if (isOpen && emblaApi) {
      // Scroll zum initialen Index
      emblaApi.scrollTo(initialIndex);
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, isOpen, emblaApi]);
  
  // Wenn emblaApi initialisiert ist, Events hinzufügen
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setCurrentIndex(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);
  
  // Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, emblaApi]);
  
  const navigatePrev = () => {
    if (emblaApi) emblaApi.scrollPrev();
  };
  
  const navigateNext = () => {
    if (emblaApi) emblaApi.scrollNext();
  };
  
  // Teilen-Funktion
  const handleShare = async () => {
    // Prüfen, ob die Web Share API verfügbar ist
    if (typeof navigator !== 'undefined' && 'share' in navigator && images[currentIndex]) {
      try {
        await navigator.share({
          title: 'Geteiltes Bild',
          text: 'Schau dir dieses Bild an',
          url: images[currentIndex]
        });
      } catch (error) {
        console.error('Fehler beim Teilen:', error);
      }
    }
  };
  
  if (!isOpen || !images || images.length === 0) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-full w-full h-[100vh] p-0 bg-black/95 flex flex-col">
        {/* Header mit Titel und Schließen-Button */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <div className="text-white font-medium">
            Bilder <span className="text-gray-400">{currentIndex + 1}/{images.length}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Share Button - nur anzeigen, wenn Share API unterstützt wird */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleShare}
                className="text-white hover:bg-gray-800"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            )}
            
            {/* Schließen-Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="text-white hover:bg-gray-800"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
        
        {/* Hauptinhalt mit Bildern */}
        <div className="flex-1 overflow-hidden relative">
          {/* Carousel */}
          <div className="h-full w-full" ref={emblaRef}>
            <div className="flex h-full">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="flex-[0_0_100%] h-full flex items-center justify-center p-4"
                >
                  <img
                    src={image}
                    alt={`Bild ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white hover:bg-black/50"
                onClick={navigatePrev}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white hover:bg-black/50"
                onClick={navigateNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
        
        {/* Bottom Indicators */}
        {images.length > 1 && (
          <div className="py-4 flex justify-center gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx === currentIndex ? 'bg-white' : 'bg-gray-600'
                }`}
                onClick={() => emblaApi?.scrollTo(idx)}
                aria-label={`Gehe zu Bild ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImageModal;