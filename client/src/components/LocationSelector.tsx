import { useState, useEffect } from 'react';
import { MapPin, Compass, Building2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { cleanupGoogleAutocomplete, fixGooglePlacesPositionInModal } from '@/utils/cleanupGoogleElements';
import { useUserLocation } from '@/context/LocationContext';
import { LocationData } from '@/utils/geoUtils';
import { useToast } from '@/hooks/use-toast';
import { locationService } from '@/lib/location-service';
import { useTranslation } from 'react-i18next';

interface LocationSelectorProps {
  onRadiusChange?: (radius: number) => void;
}

/**
 * Komponente zur Anzeige und Auswahl des Standorts für den Task-Feed
 * 
 * Zeigt den aktuellen Standort an und ermöglicht es dem Benutzer:
 * - Seinen Standort automatisch zu ermitteln (via Browser Geolocation API)
 * - Einen Standort manuell einzugeben (via Google Places Autocomplete)
 * - Den Suchradius anzupassen
 */
export default function LocationSelector({ onRadiusChange }: LocationSelectorProps) {
  const { t } = useTranslation();
  const { 
    userLocation, 
    requestUserLocation, 
    getUserLocationName, 
    setManualLocation,
    isLocationLoading,
    locationError,
    searchRadius,
    setSearchRadius
  } = useUserLocation();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [currentRadius, setCurrentRadius] = useState<number>(searchRadius);
  const { toast } = useToast();

  // Standortname abrufen, wenn sich der Standort ändert
  useEffect(() => {
    async function getLocationName() {
      if (userLocation) {
        const name = await getUserLocationName();
        setLocationName(name || t('location.unknown_location'));
      } else {
        setLocationName(t('location.no_location'));
      }
    }
    
    getLocationName();
  }, [userLocation, getUserLocationName]);

  // Standort automatisch ermitteln
  const handleAutoDetectLocation = async () => {
    try {
      const location = await requestUserLocation();
      if (!location) {
        toast({
          title: t('location.location_update_error.title'),
          description: t('location.location_update_error.description'),
          variant: "destructive"
        });
      } else {
        toast({
          title: t('location.location_updated.title'),
          description: t('location.location_updated.description')
        });
        setIsDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Fehler bei der Standortermittlung",
        description: "Bitte versuche es später noch einmal oder gib deinen Standort manuell ein.",
        variant: "destructive"
      });
    }
  };

  // Zwischenspeichern des manuell eingegebenen Standorts
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  
  // Manuell eingegebenen Standort in State speichern (noch nicht anwenden)
  const handleManualLocationSelect = (locationData: LocationData | null) => {
    // Prüfe, ob wir ein vollständiges LocationData-Objekt mit gültigen Koordinaten haben
    if (locationData && locationData.location) {
      console.log('Standort manuell ausgewählt (vollständig):', locationData);
      
      // Nutze den location-service für die Validierung der Koordinaten
      const isValid = locationService.isValidLocation(locationData.location);
      
      if (!isValid) {
        console.error('Ungültige Koordinaten:', locationData.location);
        toast({
          title: "Ungültiger Standort",
          description: "Die ausgewählten Koordinaten sind ungültig. Bitte wähle einen anderen Ort.",
          variant: "destructive"
        });
        return;
      }
      
      // Nur verarbeiten, wenn sich die Daten wirklich geändert haben
      if (JSON.stringify(locationData) !== JSON.stringify(selectedLocation)) {
        setSelectedLocation(locationData);
        
        toast({
          title: "Standort ausgewählt",
          description: `"${locationData.address}" ausgewählt. Bitte auf "Übernehmen" klicken, um zu bestätigen.`
        });
      }
    } else if (locationData === null) {
      // Standort zurücksetzen
      setSelectedLocation(null);
    } else {
      // Unvollständige Daten erhalten
      console.error('Unvollständige Standortdaten erhalten:', locationData);
      toast({
        title: "Unvollständiger Standort",
        description: "Der ausgewählte Ort enthält keine gültigen Koordinaten. Bitte wähle einen anderen Ort.",
        variant: "destructive"
      });
    }
  };

  // Suchradius aktualisieren
  const handleRadiusChange = (value: number[]) => {
    setCurrentRadius(value[0]);
  };

  // Änderungen anwenden
  const applyChanges = async () => {
    try {
      // Aktualisiere den Suchradius
      setSearchRadius(currentRadius);
      if (onRadiusChange) {
        onRadiusChange(currentRadius);
      }
      
      // Wenn ein manueller Standort ausgewählt wurde, speichere diesen jetzt
      if (selectedLocation) {
        console.log('Manuell ausgewählten Standort speichern:', selectedLocation);
        await setManualLocation(selectedLocation);
        
        toast({
          title: "Standort aktualisiert",
          description: `Standort wurde auf "${selectedLocation.address}" gesetzt und Suchradius auf ${currentRadius} km angepasst.`
        });
      } else {
        toast({
          title: "Einstellungen gespeichert",
          description: `Suchradius auf ${currentRadius} km angepasst.`
        });
      }
      
      // Bereinigung der Google Places Elemente
      cleanupGoogleAutocomplete();
      
      // Zurücksetzen des ausgewählten Standorts nach dem Speichern
      setSelectedLocation(null);
      
      // Dialog schließen
      setIsDialogOpen(false);
      
    } catch (error) {
      console.error("Fehler beim Anwenden der Änderungen:", error);
      toast({
        title: "Fehler beim Speichern",
        description: "Deine Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive"
      });
    }
  };

  // Dialog-Öffnung überwachen
  useEffect(() => {
    if (isDialogOpen) {
      // Sicherstellen, dass der Dialog die höchste z-index hat
      const dialogElement = document.querySelector('.location-selector-dialog');
      if (dialogElement) {
        dialogElement.classList.add('z-[1000]');
      }
      
      // Warte einen Moment und korrigiere dann die Positionierung der Google Places Dropdowns
      setTimeout(() => {
        const inputs = document.querySelectorAll('.location-field input');
        if (inputs.length > 0) {
          fixGooglePlacesPositionInModal(inputs[0] as HTMLElement);
        }
      }, 200);
    } else {
      // Beim Schließen des Dialogs Google Places Elemente bereinigen
      cleanupGoogleAutocomplete();
    }
  }, [isDialogOpen]);
  
  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div 
          className="flex items-center justify-between cursor-pointer" 
          onClick={() => setIsDialogOpen(true)}
        >
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-primary mr-2" />
            <div>
              <p className="text-sm text-gray-500">{t('location.your_area')}</p>
              <p className="font-medium">
                {isLocationLoading ? (
                  t('location.location_loading')
                ) : locationError ? (
                  t('location.location_unavailable')
                ) : locationName}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm">{t('location.change')}</Button>
        </div>
        {userLocation && (
          <div className="mt-2 text-sm text-gray-500 flex items-center">
            <MapPin className="h-3 w-3 mr-1 text-gray-400" />
            {t('location.search_radius', { radius: searchRadius })}
          </div>
        )}
      </div>

      {/* Standort-Auswahlmodal */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          // In allen Fällen verarbeiten, da der Dialog jetzt preventAutoClose=true hat
          // und automatisch Klicks auf Google Places verhindert
          setIsDialogOpen(open);
          
          // Wenn der Dialog geschlossen wird, auch die Locations zurücksetzen
          if (!open) {
            setSelectedLocation(null);
          }
        }}>
        <DialogContent 
          preventAutoClose={true} // Verhindert automatisches Schließen bei Google Places Interaktion
          className="sm:max-w-md location-selector-dialog">
          <DialogHeader>
            <DialogTitle>{t('location.select_location_title')}</DialogTitle>
            <DialogDescription>
              {t('location.where_search')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Automatische Standorterkennung */}
            <div>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleAutoDetectLocation}
                disabled={isLocationLoading}
              >
                <Compass className="mr-2 h-4 w-4" />
                {isLocationLoading ? t('location.detecting') : t('location.auto_detect')}
              </Button>
            </div>
            
            {/* Manuelle Standorteingabe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('location.enter_city')}</Label>
                {selectedLocation && (
                  <span className="text-xs text-green-600 flex items-center">
                    <Check className="h-3 w-3 mr-1" />
                    {t('location.location_selected')}
                  </span>
                )}
              </div>
              <div className="flex flex-col space-y-4">
                {/* Stadt-Suche mit automatischer Vervollständigung */}
                <div className="w-full">
                  <PlacesAutocomplete
                    initialAddress=""
                    placeholder="Stadt oder Gebiet eingeben..."
                    onLocationSelect={handleManualLocationSelect}
                    className={`w-full location-field ${selectedLocation ? 'border-green-500' : ''}`}
                  />
                </div>
                
                {/* Alternative: Stadt direkt eingeben */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-muted-foreground">
                      {t('location.or')}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const cityName = prompt(t('location.enter_city'));
                    if (cityName && cityName.length > 1) {
                      // Koordinaten für einige bekannte deutsche Städte
                      const cityCoordinates: Record<string, { lat: number, lng: number }> = {
                        'berlin': { lat: 52.520008, lng: 13.404954 },
                        'münchen': { lat: 48.137154, lng: 11.576124 },
                        'hamburg': { lat: 53.551086, lng: 9.993682 },
                        'köln': { lat: 50.937531, lng: 6.960279 },
                        'frankfurt': { lat: 50.110924, lng: 8.682127 },
                        'stuttgart': { lat: 48.775846, lng: 9.182932 },
                        'düsseldorf': { lat: 51.227741, lng: 6.773456 },
                        'leipzig': { lat: 51.339695, lng: 12.373075 },
                        'dortmund': { lat: 51.513587, lng: 7.465298 },
                        'essen': { lat: 51.455643, lng: 7.011555 },
                        'bremen': { lat: 53.079296, lng: 8.801694 },
                        'hannover': { lat: 52.375892, lng: 9.732010 },
                      };
                      
                      // Suche nach bekannter Stadt oder nutze Berlin als Default
                      const lowercaseCity = cityName.toLowerCase();
                      const coordinates = 
                        Object.entries(cityCoordinates).find(([key]) => 
                          lowercaseCity.includes(key))?.[1] || cityCoordinates.berlin;
                        
                      const manualLocation: LocationData = {
                        address: cityName,
                        location: coordinates,
                        area: cityName
                      };
                      
                      handleManualLocationSelect(manualLocation);
                      toast({
                        title: "Standort ausgewählt",
                        description: `"${cityName}" wurde als Standort ausgewählt.`
                      });
                    }
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {t('location.enter_city_directly')}
                </Button>
                
                <div className="text-xs text-muted-foreground">
                  {t('location.recognized_cities')}
                  <span className="italic block mt-1">
                    Berlin, München, Hamburg, Köln, Frankfurt, Stuttgart, Düsseldorf,
                    Leipzig, Dortmund, Essen, Bremen, Hannover
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedLocation ? (
                  <span className="text-green-600">
                    {t('location.location_selected_toast.description', { address: selectedLocation.address })}
                  </span>
                ) : (
                  t('location.select_location_prompt')
                )}
              </p>
            </div>
            
            {/* Suchradius einstellen */}
            {userLocation && (
              <div className="space-y-2">
                <Label>{t('location.radius_label', { radius: currentRadius })}</Label>
                <Slider
                  value={[currentRadius]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={handleRadiusChange}
                />
                <p className="text-xs text-gray-500">
                  {t('location.radius_description', { radius: currentRadius })}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              // Nur Dialog schließen, Container nicht entfernen
              setIsDialogOpen(false);
            }}>
              {t('location.cancel')}
            </Button>
            <Button onClick={applyChanges}>
              {t('location.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Information anzeigen, wenn kein Standort verfügbar ist */}
      {(!userLocation && !isLocationLoading) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">{t('location.no_location_found')}</h3>
          <p className="text-gray-600 mb-4">
            {t('location.select_location_prompt')}
          </p>
          <div className="space-y-2">
            <Button 
              onClick={handleAutoDetectLocation} 
              className="w-full"
              disabled={isLocationLoading}
            >
              <Compass className="mr-2 h-4 w-4" />
              {t('location.auto_detect')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(true)} 
              className="w-full"
            >
              <Building2 className="mr-2 h-4 w-4" />
              {t('location.enter_city')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}