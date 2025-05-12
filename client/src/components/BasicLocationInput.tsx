import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { LocationData } from '@/utils/geoUtils';

interface BasicLocationInputProps {
  onLocationSelect: (locationData: LocationData | null) => void;
  initialAddress?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Eine sehr einfache Standorteingabe als Fallback
 * 
 * Anstatt eine komplexe Google Places Integration zu verwenden,
 * erlaubt diese Komponente eine manuelle Eingabe und Suche.
 */
const BasicLocationInput: React.FC<BasicLocationInputProps> = ({
  onLocationSelect,
  initialAddress = '',
  placeholder = 'Stadt oder Gebiet eingeben...',
  className = ''
}) => {
  const [inputValue, setInputValue] = useState(initialAddress);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      onLocationSelect(null);
      return;
    }
    
    // Für Berlin als Beispiel
    const locationData: LocationData = {
      address: inputValue,
      location: {
        lat: 52.520008,
        lng: 13.404954
      },
      area: inputValue
    };
    
    onLocationSelect(locationData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full space-x-2">
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className={`${className} flex-1`}
      />
      <Button type="submit" variant="outline" size="icon">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default BasicLocationInput;