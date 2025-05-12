import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import GoogleLocationInput from '@/components/GoogleLocationInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { LoaderCircle, UserCircle, MapPin, Upload, Check, X } from 'lucide-react';
import { 
  uploadUserAvatar, 
  updateUserProfile, 
  usernameExists 
} from '@/lib/firebase';
import { compressImage, validateImage } from '@/utils/imageUtils';

/**
 * Initial-Setup-Modal für neue Benutzer
 * 
 * Erscheint einmalig nach der ersten Registrierung und
 * fordert zur Eingabe von Nutzername und Standort auf
 */
export default function InitialSetupModal() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Überprüfen, ob Setup-Modal angezeigt werden soll
  useEffect(() => {
    console.log("InitialSetupModal: Checking if setup is needed", { 
      user: user ? { uid: user.uid, displayName: user.displayName } : null,
      userProfile
    });
    
    if (user && userProfile) {
      // Zeige das Modal, wenn Nutzername oder Standort fehlen
      const needsSetup = !userProfile.displayName || !userProfile.locationCoordinates?.lat;
      console.log("Profile setup needed:", needsSetup, 
        { displayName: userProfile.displayName, hasLocation: !!userProfile.locationCoordinates?.lat });
      
      if (needsSetup) {
        // Modal öffnen und ggf. Nutzernamen aus dem Profil laden
        if (userProfile.displayName) {
          setUsername(userProfile.displayName);
        }
        
        // Lade Google Maps API für die Standortsuche
        if (!window.google?.maps?.places) {
          // Globale Callback-Funktion erstellen
          window.initGoogleMapsCallback = () => {
            console.log('Google Maps API für Profil geladen');
          };
          
          // Script einfügen, wenn es noch nicht existiert
          if (!document.getElementById('google-maps-script')) {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
            console.log('Google Maps Script für Profil eingefügt:', script.src);
          }
        }
      }
      
      setOpen(needsSetup);
    }
  }, [user, userProfile]);

  // Username-Verfügbarkeit überprüfen
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        return;
      }

      setIsCheckingUsername(true);
      try {
        // Firestore-Abfrage
        const { usernameExists } = await import('@/lib/firebase');
        const exists = await usernameExists(username);
        setUsernameAvailable(!exists);
      } catch (error) {
        console.error('Fehler beim Überprüfen des Nutzernamens:', error);
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const debounce = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounce);
  }, [username]);
  
  // Cleanup für temporäre Objekt-URLs
  useEffect(() => {
    // Cleanup-Funktion, die beim Unmounten ausgeführt wird
    return () => {
      // Wenn eine temporäre Bild-URL existiert, diese freigeben
      if (imageUrl && imageUrl.startsWith('blob:')) {
        console.log("Cleanup: Temporäre Bild-URL freigeben");
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // Bild-Upload
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      console.log("⭐️ Bild-Upload gestartet");
      const files = e.target.files;
      
      if (!files || files.length === 0) {
        console.warn("⚠️ Keine Dateien ausgewählt");
        return;
      }
      
      const file = files[0];
      
      if (!file) {
        console.error("⚠️ Datei ist null oder undefined");
        toast({
          title: "Fehler bei der Bildauswahl",
          description: "Die ausgewählte Datei konnte nicht verarbeitet werden",
          variant: "destructive"
        });
        return;
      }
      
      // Validierung
      const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validImageTypes.includes(file.type)) {
        toast({
          title: "Nicht unterstützter Dateityp",
          description: "Bitte verwende JPG, PNG, WebP oder GIF.",
          variant: "destructive"
        });
        return;
      }
      
      const maxSizeMB = 5;
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast({
          title: "Datei zu groß",
          description: `Maximum: ${maxSizeMB} MB. Aktuelle Größe: ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
          variant: "destructive"
        });
        return;
      }
      
      // Alte Vorschau-URL freigeben, wenn vorhanden
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
      
      // Bild in den State setzen
      setImage(file);
      
      // Neue Vorschau erstellen
      const objectUrl = URL.createObjectURL(file);
      setImageUrl(objectUrl);
      
      console.log(`✅ Bild akzeptiert: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Input zurücksetzen für erneutes Hochladen desselben Bildes
      e.target.value = '';
    } catch (error) {
      console.error("❌ Fehler bei der Bildverarbeitung:", error);
      toast({
        title: "Fehler bei der Bildverarbeitung",
        description: error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  // Hilfsfunktion zum Absenden des Formulars ohne Bild (für Fehlerbehandlung)
  const submitProfileWithoutImage = async () => {
    try {
      if (!user?.uid) {
        throw new Error("Benutzer-ID nicht verfügbar");
      }
      
      // Standort prüfen
      if (!location) {
        toast({
          title: 'Standort fehlt',
          description: 'Bitte wähle einen Standort aus, bevor du fortfährst',
          variant: 'destructive',
        });
        return;
      }
      
      // Lokale Variable für TypeScript Null-Prüfung
      const userLocation = location;
      
      // Profilaktualisierungsdaten vorbereiten (ohne Bild)
      const profileData: Record<string, any> = {
        displayName: username,
        location: userLocation.address,
        locationCoordinates: {
          lat: userLocation.lat,
          lng: userLocation.lng
        },
        locationSource: 'manual',
      };
      
      console.log("👤 Aktualisiere Benutzerprofil (ohne Bild):", user.uid);
      await updateUserProfile(user.uid, profileData);
      
      // Nutzerprofil aktualisieren
      await refreshUserProfile();
      
      toast({
        title: 'Profil gespeichert',
        description: 'Dein Profil wurde erfolgreich eingerichtet! Du kannst später ein Profilbild hinzufügen.',
      });
      
      // Modal schließen
      setOpen(false);
    } catch (error) {
      console.error('❌ Fehler beim Speichern des Profils (ohne Bild):', error);
      toast({
        title: 'Fehler',
        description: 'Beim Speichern ist ein Fehler aufgetreten. Bitte versuche es erneut.',
        variant: 'destructive',
      });
    }
  };
  
  // Profil speichern
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("🔍 FORM SUBMISSION - Formular wird abgeschickt");
    
    // Validierung
    if (!username || username.length < 3) {
      toast({
        title: 'Ungültiger Nutzername',
        description: 'Bitte wähle einen Nutzernamen mit mindestens 3 Zeichen',
        variant: 'destructive',
      });
      return;
    }

    if (!location) {
      toast({
        title: 'Standort fehlt',
        description: 'Bitte gib deinen Standort an',
        variant: 'destructive',
      });
      return;
    }

    if (!usernameAvailable) {
      toast({
        title: 'Nutzername nicht verfügbar',
        description: 'Bitte wähle einen anderen Nutzernamen',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      let finalAvatarUrl = null;

      // Bild hochladen, falls vorhanden
      if (image) {
        setUploadingImage(true);
        try {
          console.log("🖼️ Starte Profilbild-Upload");
          
          if (!user?.uid) {
            throw new Error("Benutzer-ID nicht verfügbar");
          }
          
          // Upload mit der verbesserten Funktion
          finalAvatarUrl = await uploadUserAvatar(image, user.uid);
          
          console.log("✅ Profilbild erfolgreich hochgeladen:", 
                      finalAvatarUrl ? finalAvatarUrl.substring(0, 50) + "..." : "keine URL");
          
          // Ressourcen freigeben
          if (imageUrl && imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(imageUrl);
          }
          setImage(null);
          setImageUrl(null);
        } catch (uploadError) {
          console.error('❌ Fehler beim Hochladen des Avatars:', uploadError);
          
          // Spezielles Handling für bekannte Fehler
          let errorTitle = 'Upload fehlgeschlagen';
          let errorMsg = uploadError instanceof Error ? uploadError.message : 'Das Profilbild konnte nicht hochgeladen werden';
          
          // Prüfen auf bekannte Fehlermeldungen
          if (errorMsg.includes('zu groß für Firestore') || 
              errorMsg.includes('exceeds the maximum allowed size') ||
              errorMsg.includes('Firestore')) {
            
            errorTitle = 'Bild ist zu groß';
            errorMsg = 'Bitte wähle ein kleineres Bild oder eine andere Bildkomprimierung. Du kannst auch später in den Einstellungen ein Profilbild hinzufügen.';
            
            // Optionale Frage, ob der Benutzer fortfahren möchte
            if (confirm('Das Bild ist zu groß für die automatische Komprimierung. Möchtest du ohne Profilbild fortfahren? Du kannst es später in den Einstellungen hinzufügen.')) {
              console.log('Benutzer hat entschieden, ohne Profilbild fortzufahren');
              // Bildstates zurücksetzen
              setImage(null);
              setImageUrl(null);
              if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
              }
              // Hochladen und Formular-Submitting beenden
              setUploadingImage(false);
              setSubmitting(false);
              // Den Rest des Formulars absenden
              submitProfileWithoutImage();
              return;
            }
          }
          
          toast({
            title: errorTitle,
            description: errorMsg,
            variant: 'destructive',
          });
          
          setUploadingImage(false);
          setSubmitting(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      // Profil aktualisieren
      if (!user?.uid) {
        throw new Error("Benutzer-ID nicht verfügbar");
      }
      
      // Profilaktualisierungsdaten vorbereiten
      // Lokale Variable für TypeScript Null-Prüfung
      const userLocation = location; // location ist hier definitiv nicht null, wurde vorher geprüft
      
      const profileData: Record<string, any> = {
        displayName: username,
        location: userLocation.address,
        locationCoordinates: {
          lat: userLocation.lat,
          lng: userLocation.lng
        },
        locationSource: 'manual',
      };
      
      // Füge die Bild-URL nur hinzu, wenn ein neues Bild hochgeladen wurde
      if (finalAvatarUrl) {
        profileData.photoURL = finalAvatarUrl;
        profileData.avatarUrl = finalAvatarUrl;
      }
      
      console.log("👤 Aktualisiere Benutzerprofil:", user.uid);
      await updateUserProfile(user.uid, profileData);

      // Nutzerprofil aktualisieren
      await refreshUserProfile();

      toast({
        title: 'Profil gespeichert',
        description: 'Dein Profil wurde erfolgreich eingerichtet!',
      });

      // Modal schließen
      setOpen(false);
    } catch (error) {
      console.error('❌ Fehler beim Speichern des Profils:', error);
      toast({
        title: 'Fehler',
        description: 'Beim Speichern ist ein Fehler aufgetreten. Bitte versuche es erneut.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Modal kann nicht geschlossen werden, bevor Setup abgeschlossen ist
  const cannotClose = true;

  return (
    <Dialog open={open} onOpenChange={cannotClose ? undefined : setOpen}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Willkommen bei DoIt!</DialogTitle>
          <DialogDescription>
            Richte dein Profil ein, um loszulegen. Diese Informationen helfen anderen, dich zu finden und mit dir zusammenzuarbeiten.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Profilbild */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              {imageUrl ? (
                <AvatarImage src={imageUrl} />
              ) : (
                <>
                  <AvatarImage src={userProfile?.photoURL || ''} />
                  <AvatarFallback>
                    <UserCircle className="h-12 w-12 text-muted-foreground" />
                  </AvatarFallback>
                </>
              )}
            </Avatar>

            <div>
              <Label htmlFor="avatar" className="block text-center mb-2">
                Profilbild (optional)
              </Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Direkter, zuverlässiger Zugriff auf das Eingabefeld
                  const fileInput = document.getElementById('avatar') as HTMLInputElement;
                  if (fileInput) {
                    console.log("File input gefunden, klicke darauf:", fileInput);
                    fileInput.click();
                  } else {
                    console.error("File input nicht gefunden!");
                    toast({
                      title: 'Fehler',
                      description: 'Dateiauswahl konnte nicht geöffnet werden',
                      variant: 'destructive',
                    });
                  }
                }}
                disabled={uploadingImage}
                className="w-full"
              >
                {uploadingImage ? (
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Bild auswählen
              </Button>
            </div>
          </div>

          {/* Nutzername */}
          <div className="space-y-2">
            <Label htmlFor="username" className="font-medium flex items-center">
              Nutzername
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Wähle einen einzigartigen Namen"
                required
                minLength={3}
                maxLength={20}
                className={`pr-10 ${
                  usernameAvailable === true
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : usernameAvailable === false
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : ''
                }`}
              />
              {isCheckingUsername && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isCheckingUsername && usernameAvailable === true && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
              )}
              {!isCheckingUsername && usernameAvailable === false && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <X className="h-4 w-4 text-red-500" />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Dies ist dein öffentlicher Name in der App
            </p>
            {usernameAvailable === false && (
              <p className="text-sm text-red-500">
                Dieser Nutzername ist bereits vergeben
              </p>
            )}
          </div>

          {/* Standort */}
          <div className="space-y-2">
            <Label htmlFor="location" className="font-medium flex items-center">
              Dein Standort
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative bg-background">
              <GoogleLocationInput 
                initialValue=""
                onSelect={(address: string, lat: number, lng: number) => {
                  setLocation({
                    address,
                    lat,
                    lng
                  });
                }}
              />
              {location && (
                <div className="mt-2 p-2 bg-muted rounded-md flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm">{location.address}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Hilft dir, Aufgaben in deiner Nähe zu finden
            </p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || isCheckingUsername || usernameAvailable === false || !location}
              className="w-full"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                'Profil speichern'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}