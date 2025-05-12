import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { getCategoryImage } from '@/lib/categoryImages';
import ImageModal from './ImageModal';
import { Button } from '@/components/ui/button';

interface ImageGalleryProps {
  images: string[];
  category: string;
  showNavigation?: boolean;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'wide';
  height?: 'small' | 'medium' | 'large';
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  allowZoom?: boolean;
}

/**
 * Eine mobile-optimierte Bildergalerie-Komponente mit Swipe-Funktion
 * 
 * Diese Komponente zeigt Bilder in einem Karussell an und unterstützt:
 * - Touch-Swipe für mobile Nutzer
 * - Pfeilnavigation für Desktop-Nutzer
 * - Fallback auf Kategorie-Bild wenn keine Bilder vorhanden sind
 * - Vollbild-Ansicht durch Klicken auf die Bilder
 */
const ImageGallery: React.FC<ImageGalleryProps> = ({
  images = [],
  category,
  showNavigation = true,
  className = '',
  aspectRatio = 'square',
  height = 'medium',
  currentIndex = 0,
  onIndexChange,
  allowZoom = true,
}) => {
  // Initialisiere Embla Carousel für Swipe-Unterstützung
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: images && images.length > 1,
    align: 'center',
    dragFree: false
  });
  
  // Zustand für die Auswahl und Navigation
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false);
  
  // State für die Vollbild-Ansicht
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Höhen-Klassen basierend auf Prop
  const heightClasses = {
    small: 'h-48 sm:h-56', // Moderat erhöht
    medium: 'h-60 sm:h-72', // Moderat erhöht
    large: 'h-72 sm:h-96', // Moderat erhöht
  };
  
  // Fallback wenn keine Bilder vorhanden sind
  const hasImages = images && images.length > 0;
  const fallbackImage = getCategoryImage(category);
  
  // Navigation-Handler
  const scrollPrev = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Navigationszustand aktualisieren
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    
    const canScrollPrev = emblaApi.canScrollPrev();
    const canScrollNext = emblaApi.canScrollNext();
    
    setPrevBtnEnabled(canScrollPrev);
    setNextBtnEnabled(canScrollNext);
    
    const currentIndex = emblaApi.selectedScrollSnap();
    setSelectedIndex(currentIndex);
    
    if (onIndexChange) {
      onIndexChange(currentIndex);
    }
  }, [emblaApi, onIndexChange]);
  
  // Initiale Einrichtung und Aufräumen
  useEffect(() => {
    if (!emblaApi) return;
    
    emblaApi.on('select', onSelect);
    onSelect();
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);
  
  // Zu Index scrollen wenn sich currentIndex ändert
  useEffect(() => {
    if (emblaApi && currentIndex !== selectedIndex) {
      emblaApi.scrollTo(currentIndex);
    }
  }, [currentIndex, emblaApi, selectedIndex]);
  
  // Handle Bildklick für Vollbild-Modus
  const openImageModal = (e: React.MouseEvent) => {
    // Nur öffnen, wenn Zoom erlaubt ist und Bilder vorhanden sind
    if (allowZoom && hasImages) {
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(true);
    }
  };
  
  // Modal schließen
  const closeImageModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Carousel-Container mit ref für embla */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className={`flex ${heightClasses[height]}`}>
            {hasImages ? (
              // Rendere alle Bilder für Carousel
              images.map((image, index) => (
                <div
                  key={index}
                  className="relative flex-[0_0_100%] flex items-center justify-center h-full"
                >
                  <img
                    src={image}
                    alt={`Task image ${index + 1}`}
                    className="object-cover w-full h-full cursor-pointer"
                    onClick={openImageModal}
                  />
                </div>
              ))
            ) : (
              // Fallback auf Kategorie-Bild
              <div className="relative flex-[0_0_100%] h-full">
                <img
                  src={fallbackImage}
                  alt={`${category} category`}
                  className="w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/30">
                  <span className="text-white font-semibold text-lg">{category}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Vollbild-Button entfernt */}
        
        {/* Navigations-Buttons - separat vom Carousel-Container */}
        {showNavigation && hasImages && images.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 
                hover:bg-white/90 flex items-center justify-center z-10 shadow-md"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button" 
              onClick={scrollNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 
                hover:bg-white/90 flex items-center justify-center z-10 shadow-md"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        
        {/* Indikator-Punkte */}
        {hasImages && images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === selectedIndex ? 'bg-primary' : 'bg-gray-300'
                }`}
                type="button"
                onClick={() => emblaApi?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Vollbild-Modal */}
      {isModalOpen && (
        <ImageModal
          isOpen={isModalOpen}
          onClose={closeImageModal}
          images={images}
          initialIndex={selectedIndex}
        />
      )}
    </>
  );
};

export default ImageGallery;