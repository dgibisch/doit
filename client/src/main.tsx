import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/google-places-fixes.css"; // Import für Google Places Autocomplete Fixes
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { addGlobalStyle, fixGooglePlacesAutocompleteClicks, fixGooglePlacesContainerPosition } from "./utils/domHelpers";
import { setupAutomaticPositioning } from "./utils/fixGooglePlacesPosition";
import { initializeI18n } from "./lib/i18n-init"; // i18n-Konfiguration importieren und initialisieren

// Initialisiere i18n vor dem Rendern der App
initializeI18n();

// Google Places Autocomplete CSS-Fixes direkt in den DOM einbinden
addGlobalStyle(`
  /* Höchste Priorität für Google Places Vorschläge */
  .pac-container {
    z-index: 9999 !important;
    pointer-events: auto !important;
    background-color: white !important;
    position: fixed !important;
    max-width: 100% !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
  }
  
  /* Ensure dialog content appears above all other UI elements except Places autocomplete */
  [data-radix-popper-content-wrapper] {
    z-index: 9998 !important; /* Knapp unter pac-container */
  }
  
  /* Fix for Google attribution - legally required */ 
  .pac-logo:after {
    display: block !important;
  }
  
  /* Mobile optimization - bigger targets */
  .pac-item {
    cursor: pointer !important;
    padding: 12px !important;
    touch-action: manipulation !important;
    min-height: 48px !important; /* Mobile-freundliche Höhe */
  }
`);

// Event-Listener für Klicks auf Autocomplete-Vorschläge und DOM-Manipulation
document.addEventListener('DOMContentLoaded', () => {
  fixGooglePlacesAutocompleteClicks();
  fixGooglePlacesContainerPosition(); // Positionierung der Autocomplete-Dropdown-Liste verbessern
  
  // Neue verbesserte Google Places Positionskorrektur
  setupAutomaticPositioning();
  
  console.log('Google Places Autocomplete fixes initialized');
});

// Simplified version to bypass Firebase auth issues
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <App />
    </TooltipProvider>
  </QueryClientProvider>
);
