import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Share } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LocationShareButtonProps {
  taskId: string;
  location?: { lat: number; lng: number; };
  address?: string;
  isLocationShared: boolean;
  isCreator?: boolean;
  onClick?: (location: { lat: number; lng: number; }, address: string) => void;
}

/**
 * Button zum Teilen des genauen Standorts einer Aufgabe
 * 
 * Wird im Chat und in der Aufgabendetailansicht verwendet, wenn:
 * 1. Der Benutzer der Ersteller ist (aktiviert/deaktiviert die öffentliche Anzeige)
 * 2. Eine Aufgabe akzeptiert wurde (Bewerber kann auf den Button klicken, um den genauen Standort zu sehen)
 */
export default function LocationShareButton({
  taskId,
  location,
  address,
  isLocationShared = false,
  isCreator = false,
  onClick
}: LocationShareButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Prüfen, ob wir einen gültigen Standort haben
  const hasValidLocation = location && location.lat && location.lng && address;
  
  // Wenn kein Standort verfügbar ist, nichts anzeigen
  if (!hasValidLocation) {
    return null;
  }

  /**
   * Öffentliche Standortfreigabe umschalten (nur für Ersteller)
   */
  const toggleLocationSharing = async () => {
    if (!isCreator || !taskId) return;
    
    try {
      setIsUpdating(true);
      
      // Aktualisiere den Task mit dem neuen Freigabestatus
      await updateDoc(doc(db, 'tasks', taskId), {
        isLocationShared: !isLocationShared
      });
      
      toast({
        title: !isLocationShared ? "Standort öffentlich" : "Standort privat",
        description: !isLocationShared 
          ? "Der genaue Standort ist jetzt für akzeptierte Bewerber sichtbar." 
          : "Der genaue Standort ist jetzt privat.",
      });
      
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Standortfreigabe:", error);
      toast({
        title: "Fehler",
        description: "Die Standortfreigabe konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
      setIsDialogOpen(false);
    }
  };

  /**
   * Standort teilen (für Bewerber, wenn Standort freigegeben wurde)
   */
  const handleShowLocation = () => {
    if (!hasValidLocation || !onClick) return;
    
    onClick(location, address);
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
        onClick={() => setIsDialogOpen(true)}
        disabled={isUpdating}
      >
        <MapPin className="h-4 w-4 mr-1" />
        {isCreator ? (
          isLocationShared ? "Standort wird geteilt" : "Standort teilen"
        ) : (
          "Standort anzeigen"
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isCreator ? "Standort teilen" : "Standort anzeigen"}</DialogTitle>
            <DialogDescription>
              {isCreator ? (
                isLocationShared ? 
                  "Der genaue Standort dieser Aufgabe wird aktuell für akzeptierte Bewerber freigegeben. Möchtest du die Freigabe deaktivieren?" :
                  "Möchtest du den genauen Standort dieser Aufgabe für akzeptierte Bewerber freigeben?"
              ) : (
                "Möchtest du den genauen Standort dieser Aufgabe anzeigen?"
              )}
            </DialogDescription>
          </DialogHeader>
          
          {/* Adresse anzeigen */}
          <div className="p-4 bg-muted rounded-md">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium text-sm">Standort dieser Aufgabe:</div>
                <div className="mt-1 text-sm">{address}</div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex sm:justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDialogOpen(false)}
            >
              Abbrechen
            </Button>
            
            {isCreator ? (
              <Button
                type="button"
                variant={isLocationShared ? "destructive" : "default"}
                onClick={toggleLocationSharing}
                disabled={isUpdating}
              >
                {isUpdating ? "Wird aktualisiert..." : (
                  isLocationShared ? "Freigabe deaktivieren" : "Standort freigeben"
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleShowLocation}
                disabled={!hasValidLocation}
              >
                <Share className="h-4 w-4 mr-2" />
                Standort anzeigen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}