// Globale Typdeklarationen für die gesamte Anwendung

// Google Maps API Typdeklaration
declare namespace google.maps.places {
  class Autocomplete extends google.maps.MVCObject {
    constructor(inputField: HTMLInputElement, opts?: google.maps.places.AutocompleteOptions);
    addListener(eventName: string, handler: Function): google.maps.MapsEventListener;
    getPlace(): google.maps.places.PlaceResult;
  }

  interface AutocompleteOptions {
    bounds?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral;
    componentRestrictions?: { country: string | string[] };
    fields?: string[];
    types?: string[];
  }

  interface PlaceResult {
    address_components?: google.maps.GeocoderAddressComponent[];
    formatted_address?: string;
    geometry?: {
      location: google.maps.LatLng;
      viewport?: google.maps.LatLngBounds;
    };
    name?: string;
    types?: string[];
  }
}

// Window-Erweiterung für Google Maps und Callback
interface Window {
  google?: typeof google;
  googleMapsLoaded?: boolean;
  initGoogleMapsCallback?: () => void;
}