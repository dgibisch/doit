/**
 * Utility functions for geolocation functionality
 */

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface LocationData {
  address: string;
  location: GeoLocation;
  area?: string;  // Stadtteil oder Gebiet (z.B. "Berlin-Mitte")
}

/**
 * Calculate distance between two points using the Haversine formula
 * @param p1 First point with lat/lng coordinates
 * @param p2 Second point with lat/lng coordinates
 * @returns Distance in kilometers
 */
export function calculateDistance(p1: GeoLocation, p2: GeoLocation): number {
  if (!p1 || !p2) return 0;
  
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert degrees to radians
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  
  // Haversine formula
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Distance in kilometers
  return R * c;
}

/**
 * Format distance in a human-readable format
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance === 0) return '';
  
  // Round to 1 decimal place
  const rounded = Math.round(distance * 10) / 10;
  return `${rounded} km entfernt`;
}

/**
 * Convert degrees to radians
 */
function toRad(value: number): number {
  return value * Math.PI / 180;
}

/**
 * Extract the location data from a Google Places Autocomplete result
 * @param place Google Places Autocomplete result
 * @returns LocationData with address string and lat/lng coordinates
 */
export function extractLocationFromPlace(place: google.maps.places.PlaceResult): LocationData | null {
  if (!place || !place.geometry || !place.geometry.location) {
    return null;
  }
  
  const location = {
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng()
  };
  
  const address = place.formatted_address || '';
  
  // Versuche, den Stadtteil/Bereich aus der Adresse zu extrahieren
  // Dies ist ein einfacher Ansatz - normalerweise würde man hierfür die Geocoding API verwenden
  let area = '';
  if (address) {
    // Typische Adressformate:
    // "Straße 123, Berlin-Mitte, 10115 Berlin, Deutschland"
    // "Straße 123, 10115 Berlin, Deutschland"
    
    // Versuche, den ersten Teil der Adresse zu extrahieren
    const parts = address.split(',');
    if (parts.length > 1) {
      // Der zweite Teil enthält oft den Stadtteil oder die Stadt
      const secondPart = parts[1].trim();
      
      // Prüfe, ob wir einen Bindestrich haben (z.B. "Berlin-Mitte")
      if (secondPart.includes('-')) {
        area = secondPart;
      } else {
        // Sonst nutze einfach den ersten Teil als Bereich
        area = parts[0].trim();
      }
    }
  }
  
  return {
    address,
    location,
    area
  };
}