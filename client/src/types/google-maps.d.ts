/**
 * Google Maps API - TypeScript-Definitionen
 * 
 * Diese Datei enthält TypeScript-Definitionen für die Google Maps JavaScript API.
 * Es ist eine vereinfachte Version, die nur die für unsere Anwendung benötigten Typen enthält.
 */

// Globale Callback-Funktion für die asynchrone Ladung der Google Maps API
interface Window {
  google?: typeof google;
  initPlacesAPI?: () => void;
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: Element, opts?: MapOptions);
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      getCenter(): LatLng;
      getZoom(): number;
    }

    class LatLng {
      constructor(lat: number, lng: number, noWrap?: boolean);
      lat(): number;
      lng(): number;
      toString(): string;
      toUrlValue(precision?: number): string;
      toJSON(): LatLngLiteral;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latLng: LatLng | LatLngLiteral): void;
      getPosition(): LatLng | null;
    }

    class Circle {
      constructor(opts?: CircleOptions);
      setMap(map: Map | null): void;
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setRadius(radius: number): void;
    }

    const event: {
      clearInstanceListeners(instance: Object): void;
      addListener(instance: Object, eventName: string, handler: Function): MapsEventListener;
    };

    interface MapsEventListener {
      remove(): void;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      [key: string]: any;
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map;
      [key: string]: any;
    }

    interface CircleOptions {
      center?: LatLng | LatLngLiteral;
      radius?: number;
      map?: Map;
      [key: string]: any;
    }

    namespace places {
      class Autocomplete {
        constructor(inputElement: HTMLInputElement, opts?: AutocompleteOptions);
        addListener(eventName: string, handler: Function): MapsEventListener;
        getPlace(): PlaceResult;
      }

      interface AutocompleteOptions {
        types?: string[];
        componentRestrictions?: { country: string[] | string };
        fields?: string[];
        bounds?: any;
        [key: string]: any;
      }

      interface PlaceResult {
        name?: string;
        formatted_address?: string;
        geometry?: {
          location?: {
            lat(): number;
            lng(): number;
          };
        };
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
        [key: string]: any;
      }
    }

    namespace geometry {
      namespace spherical {
        function computeDistanceBetween(
          from: LatLng | LatLngLiteral,
          to: LatLng | LatLngLiteral,
          radius?: number
        ): number;
      }
    }
  }
}

// Anmerkung: Die Window-Schnittstellenerweiterung ist bereits oben definiert