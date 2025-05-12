import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { LocationData } from '@/utils/geoUtils';

// List of German cities with coordinates
const GERMAN_CITIES: Record<string, { name: string; lat: number; lng: number }> = {
  'berlin': { name: 'Berlin', lat: 52.520008, lng: 13.404954 },
  'münchen': { name: 'München', lat: 48.137154, lng: 11.576124 },
  'hamburg': { name: 'Hamburg', lat: 53.551086, lng: 9.993682 },
  'köln': { name: 'Köln', lat: 50.937531, lng: 6.960279 },
  'frankfurt': { name: 'Frankfurt', lat: 50.110924, lng: 8.682127 },
  'stuttgart': { name: 'Stuttgart', lat: 48.775846, lng: 9.182932 },
  'düsseldorf': { name: 'Düsseldorf', lat: 51.227741, lng: 6.773456 },
  'leipzig': { name: 'Leipzig', lat: 51.339695, lng: 12.373075 },
  'dortmund': { name: 'Dortmund', lat: 51.513587, lng: 7.465298 },
  'essen': { name: 'Essen', lat: 51.455643, lng: 7.011555 },
  'bremen': { name: 'Bremen', lat: 53.079296, lng: 8.801694 },
  'hannover': { name: 'Hannover', lat: 52.375892, lng: 9.732010 },
  'nürnberg': { name: 'Nürnberg', lat: 49.452030, lng: 11.076750 },
  'dresden': { name: 'Dresden', lat: 51.050409, lng: 13.737262 },
  'bochum': { name: 'Bochum', lat: 51.481845, lng: 7.216236 },
  'wuppertal': { name: 'Wuppertal', lat: 51.256213, lng: 7.150764 },
  'bielefeld': { name: 'Bielefeld', lat: 52.021236, lng: 8.534830 },
  'bonn': { name: 'Bonn', lat: 50.733963, lng: 7.099064 },
  'mannheim': { name: 'Mannheim', lat: 49.488888, lng: 8.469168 },
  'karlsruhe': { name: 'Karlsruhe', lat: 49.006890, lng: 8.403653 },
  'münster': { name: 'Münster', lat: 51.960665, lng: 7.626135 },
  'wiesbaden': { name: 'Wiesbaden', lat: 50.078217, lng: 8.239761 },
  'augsburg': { name: 'Augsburg', lat: 48.370545, lng: 10.897790 },
  'aachen': { name: 'Aachen', lat: 50.776351, lng: 6.083862 },
  'kiel': { name: 'Kiel', lat: 54.323293, lng: 10.122765 },
  'freiburg': { name: 'Freiburg', lat: 47.997791, lng: 7.842609 },
  'rostock': { name: 'Rostock', lat: 54.092441, lng: 12.099810 },
  'mainz': { name: 'Mainz', lat: 50.000000, lng: 8.271000 },
  'gelsenkirchen': { name: 'Gelsenkirchen', lat: 51.517744, lng: 7.085717 },
  'heidelberg': { name: 'Heidelberg', lat: 49.398750, lng: 8.672434 },
  'potsdam': { name: 'Potsdam', lat: 52.390568, lng: 13.064472 },
  'paderborn': { name: 'Paderborn', lat: 51.718829, lng: 8.757390 },
  'würzburg': { name: 'Würzburg', lat: 49.791304, lng: 9.953332 },
  'regensburg': { name: 'Regensburg', lat: 49.013432, lng: 12.101624 },
  'ingolstadt': { name: 'Ingolstadt', lat: 48.765690, lng: 11.424017 },
  'ulm': { name: 'Ulm', lat: 48.398312, lng: 9.991692 },
  'wolfsburg': { name: 'Wolfsburg', lat: 52.423050, lng: 10.787130 },
  'koblenz': { name: 'Koblenz', lat: 50.356977, lng: 7.594241 },
  'erfurt': { name: 'Erfurt', lat: 50.984768, lng: 11.029880 },
  'kassel': { name: 'Kassel', lat: 51.312801, lng: 9.479460 },
  'halle': { name: 'Halle', lat: 51.482780, lng: 11.969090 },
  'chemnitz': { name: 'Chemnitz', lat: 50.827845, lng: 12.921370 },
  'magdeburg': { name: 'Magdeburg', lat: 52.120533, lng: 11.627624 },
  'braunschweig': { name: 'Braunschweig', lat: 52.268874, lng: 10.526770 },
  'flensburg': { name: 'Flensburg', lat: 54.783329, lng: 9.433327 },
};

// Helper to normalize German umlauts
function normalizeString(str: string): string {
  return str.toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

interface ManualCitySearchProps {
  onLocationSelect: (locationData: LocationData | null) => void;
  initialAddress?: string;
  placeholder?: string;
  className?: string;
}

export default function ManualCitySearch({
  onLocationSelect,
  initialAddress = '',
  placeholder = 'Stadt eingeben...',
  className = ''
}: ManualCitySearchProps) {
  const [searchTerm, setSearchTerm] = useState(initialAddress);
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search cities when the search term changes
  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const normalizedTerm = normalizeString(searchTerm);
    
    const matchedCities = Object.entries(GERMAN_CITIES)
      .filter(([key, city]) => {
        return normalizeString(key).includes(normalizedTerm) || 
               normalizeString(city.name).includes(normalizedTerm);
      })
      .map(([key, city]) => ({
        id: key,
        name: city.name
      }));
    
    setResults(matchedCities.slice(0, 10)); // Limit to 10 results
    setShowResults(matchedCities.length > 0);
  }, [searchTerm]);

  // Handle clicks outside the results dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle city selection
  const handleCitySelect = (cityId: string) => {
    const city = GERMAN_CITIES[cityId];
    if (!city) return;

    setSearchTerm(city.name);
    setShowResults(false);

    const locationData: LocationData = {
      address: city.name,
      location: { lat: city.lat, lng: city.lng },
      area: city.name
    };

    onLocationSelect(locationData);
  };

  // Clear the search
  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    onLocationSelect(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClick={() => searchTerm.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className={`pr-8 ${className}`}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-2"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showResults && (
        <div 
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 bg-white shadow-lg rounded-md border overflow-hidden max-h-60 overflow-y-auto"
        >
          {results.length > 0 ? (
            <ul className="py-1">
              {results.map((city) => (
                <li 
                  key={city.id}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                  onClick={() => handleCitySelect(city.id)}
                >
                  <Search className="h-4 w-4 mr-2 text-gray-500" />
                  {city.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
              Keine Ergebnisse gefunden
            </div>
          )}
        </div>
      )}
    </div>
  );
}