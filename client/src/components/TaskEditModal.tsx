import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { TASK_CATEGORIES } from '@/lib/constants';
import { APP_CONFIG } from '@/lib/config';
import { db, auth, storage } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import ImageGallery from './ImageGallery';
import PlacesAutocomplete from './PlacesAutocomplete';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Trash2, 
  Plus, 
  Image as ImageIcon 
} from 'lucide-react';

// Typen für Locationdaten
interface LocationData {
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  area?: string;  // Optional: Stadtteil oder Gebiet
}

// Interface für Props
interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any; // Der zu bearbeitende Task
  onTaskUpdated: () => void; // Callback nach erfolgreicher Aktualisierung
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  onClose,
  task,
  onTaskUpdated
}) => {
  const { t } = useTranslation();
  // Alle Formularwerte, die wir aus dem bestehenden Task laden
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [category, setCategory] = useState(task?.category || '');
  const [price, setPrice] = useState(task?.price || 20);
  const [taskAddress, setTaskAddress] = useState(task?.address || '');
  const [locationData, setLocationData] = useState<LocationData | null>(
    task?.location ? {
      address: task?.address || '',
      location: task?.location
    } : null
  );

  // Bilder
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>(
    Array.isArray(task?.imageUrls) ? task.imageUrls : 
    (task?.imageUrl ? [task.imageUrl] : [])
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Zeitauswahl
  const [isFlexible, setIsFlexible] = useState(
    task?.timeInfo?.isFlexible !== undefined ? task.timeInfo.isFlexible : true
  );
  
  // Sicheres Parsen des Datums mit Fehlerbehandlung
  const [date, setDate] = useState<Date | undefined>(() => {
    if (!task?.timeInfo?.date) return undefined;
    
    // Prüfe, ob wir ein Firestore-Timestamp-Objekt haben
    if (task.timeInfo.date && typeof task.timeInfo.date.toDate === 'function') {
      return task.timeInfo.date.toDate();
    }
    
    // Alternativ versuchen wir, aus einem String oder einer Zahl ein Datum zu erstellen
    try {
      const parsedDate = new Date(task.timeInfo.date);
      // Prüfen, ob das Datum gültig ist
      return isNaN(parsedDate.getTime()) ? undefined : parsedDate;
    } catch (e) {
      console.error("Fehler beim Parsen des Datums:", e);
      return undefined;
    }
  });
  
  const [timeOfDay, setTimeOfDay] = useState(task?.timeInfo?.timeOfDay || '');
  const [dateOpen, setDateOpen] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Konstanten
  const MAX_IMAGES = APP_CONFIG.MAX_IMAGES || 5;
  
  // Bilder-Upload-Funktion
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const MAX_UPLOAD_SIZE = APP_CONFIG.MAX_UPLOAD_SIZE || 5 * 1024 * 1024; // 5MB default
    
    // Überprüfen der Gesamtanzahl (bestehende + neue)
    if (imagePreviews.length + e.target.files.length > MAX_IMAGES) {
      toast({
        title: "Zu viele Bilder",
        description: `Du kannst maximal ${MAX_IMAGES} Bilder hochladen.`,
        variant: "destructive",
      });
      return;
    }
    
    // Alle Dateien überprüfen
    for (let i = 0; i < e.target.files.length; i++) {
      if (e.target.files[i].size > MAX_UPLOAD_SIZE) {
        toast({
          title: "Bild zu groß",
          description: `Das Bild ${e.target.files[i].name} ist zu groß. Maximale Größe: ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`,
          variant: "destructive",
        });
        return;
      }
    }
    
    // Zu bestehenden Bildern hinzufügen
    const filesArray = Array.from(e.target.files);
    setImages(prev => [...prev, ...filesArray]);
    
    // Vorschaubilder erstellen
    const newImagePreviews: string[] = [];
    
    for (const file of filesArray) {
      try {
        const preview = await convertToDataURL(file);
        newImagePreviews.push(preview);
      } catch (err) {
        console.error("Fehler beim Erstellen der Vorschau:", err);
      }
    }
    
    setImagePreviews(prev => [...prev, ...newImagePreviews]);
    
    // Datei-Input zurücksetzen
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Bild aus der Vorschau entfernen
  const removeImage = (index: number) => {
    // Wenn es ein bestehendes Bild aus dem Task ist oder ein neu hochgeladenes
    const updatedPreviews = [...imagePreviews];
    updatedPreviews.splice(index, 1);
    setImagePreviews(updatedPreviews);
    
    // Wenn es ein neues Bild ist, auch aus dem File-Array entfernen
    // Hier müssen wir prüfen, ob es sich um ein bestehendes oder neues Bild handelt
    const existingImagesCount = Array.isArray(task?.imageUrls) ? task.imageUrls.length : 
      (task?.imageUrl ? 1 : 0);
    
    if (index >= existingImagesCount && images.length > 0) {
      const newIndex = index - existingImagesCount;
      if (newIndex >= 0 && newIndex < images.length) {
        const updatedImages = [...images];
        updatedImages.splice(newIndex, 1);
        setImages(updatedImages);
      }
    }
    
    // Index anpassen, falls nötig
    if (currentImageIndex >= updatedPreviews.length) {
      setCurrentImageIndex(Math.max(0, updatedPreviews.length - 1));
    }
  };

  // Konvertiert ein Bild in eine Data-URL für die Vorschau
  const convertToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Fehler beim Lesen der Datei'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Bild komprimieren (optional)
  const compressImage = async (file: File): Promise<File> => {
    // Hier könnte Code zur Bildkomprimierung stehen, falls benötigt
    // Für jetzt geben wir das Original zurück
    return file;
  };

  // Bilder hochladen - verwendet jetzt die zentrale Funktion aus firebase.ts
  const uploadImages = async (images: File[]): Promise<string[]> => {
    if (images.length === 0) {
      // Wenn wir nur bestehende Bilder haben, geben wir diese zurück
      return Array.isArray(task?.imageUrls) ? task.imageUrls : 
        (task?.imageUrl ? [task.imageUrl] : []);
    }
    
    try {
      // Importiere die zentrale Funktion für Bild-Uploads
      const { uploadTaskImages } = await import('@/lib/firebase');
      const uploadedUrls = await uploadTaskImages(images, task?.id);
      
      console.log(`TaskEditModal: ${uploadedUrls.length} Bilder hochgeladen, erster Eintrag:`,
                uploadedUrls.length > 0 ? uploadedUrls[0].substring(0, 50) + '...' : 'none');
      
      // Wir müssen die bestehenden URLs beibehalten, die nicht entfernt wurden
      const existingImages = Array.isArray(task?.imageUrls) ? task.imageUrls : 
        (task?.imageUrl ? [task.imageUrl] : []);
      
      // Bestimmen, welche bestehenden URLs wir behalten (die noch in imagePreviews sind)
      const keptExistingUrls = existingImages.filter(url => imagePreviews.includes(url));
      
      // Kombinieren mit den neu hochgeladenen
      return [...keptExistingUrls, ...uploadedUrls];
    } catch (error) {
      console.error("Fehler beim Hochladen der Bilder:", error);
      toast({
        title: "Upload-Fehler",
        description: "Einige Bilder konnten nicht hochgeladen werden.",
        variant: "destructive",
      });
      // Bestehende Bilder zurückgeben, wenn wir welche haben
      return Array.isArray(task?.imageUrls) ? task.imageUrls : 
        (task?.imageUrl ? [task.imageUrl] : []);
    }
  };

  // Formular abschicken
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Überprüfen der Pflichtfelder
    if (!title || !description || !category) {
      toast({
        title: "Fehlende Felder",
        description: "Bitte fülle alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }
    
    // Prüfen, ob Zeit angegeben wurde (entweder flexibel oder Datum+Tageszeit)
    if (!isFlexible && (!date || !timeOfDay)) {
      toast({
        title: "Zeitangabe fehlt",
        description: "Bitte wähle entweder ein Datum und eine Tageszeit oder aktiviere 'Zeitlich flexibel'.",
        variant: "destructive",
      });
      return;
    }
    
    if (!auth.currentUser) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Du musst angemeldet sein, um Aufgaben zu bearbeiten.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Bilder hochladen oder bestehende verwenden
      const imageUrls = await uploadImages(images);
      
      // Debug-Ausgabe für imageUrls
      console.debug(`EditTask: Speichere ${imageUrls.length} Bilder, Format:`, 
                  imageUrls.length > 0 ? imageUrls[0].substring(0, 50) + '...' : 'keine Bilder');
      
      // Adressinformationen vorbereiten
      const locationInfo = locationData ? {
        address: locationData.address,
        location: locationData.location, // { lat, lng } Objekt
        area: locationData.area || (task?.address ? task.address.split(',')[0].trim() : ''), // Stadtteil/Gebiet extrahieren
        isLocationShared: false // Standardmäßig wird der genaue Standort nicht öffentlich angezeigt
      } : {
        address: task?.address || '',
        location: task?.location || { lat: 0, lng: 0 }, // Fallback für nicht angegebene Standorte
        area: task?.address ? task.address.split(',')[0].trim() : '',
        isLocationShared: task?.isLocationShared || false
      };
      
      // Zeitinformationen vorbereiten
      let timeInfo;
      if (isFlexible) {
        timeInfo = {
          isFlexible: true,
          date: null,
          formattedDate: null,
          timeOfDay: null,
          displayText: "Zeitlich flexibel"
        };
      } else {
        // Sicherstellen, dass wir ein gültiges Datumsformat haben
        const formattedDate = date && !isNaN(date.getTime()) 
          ? format(date, "dd.MM.yyyy", { locale: de }) 
          : "";
        
        timeInfo = {
          isFlexible: false,
          date: date && !isNaN(date.getTime()) ? date : null,
          formattedDate: formattedDate,
          timeOfDay: timeOfDay,
          displayText: `${formattedDate} – Am besten ${timeOfDay}`
        };
      }
      
      // Task-Dokument in Firestore aktualisieren
      const taskData = {
        title,
        description,
        category,
        price,
        imageUrls: imageUrls, // Sicherstellen, dass es ein Array ist
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, // Auch das erste Bild als imageUrl für Abwärtskompatibilität
        address: locationInfo.address,
        location: locationInfo.location,
        area: locationInfo.area, // Stadteil/Bereich für grobe Anzeige
        isLocationShared: locationInfo.isLocationShared, // Zeigt an, ob der Standort öffentlich ist
        updatedAt: serverTimestamp(),
        timeInfo: timeInfo
      };
      
      await updateDoc(doc(db, 'tasks', task.id), taskData);
      
      toast({
        title: t('notifications.taskUpdated'),
        description: t('notifications.taskUpdatedDescription'),
      });
      
      // Callback aufrufen und Modal schließen
      onTaskUpdated();
      onClose();
      
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: t('common.error'),
        description: t('notifications.taskUpdateError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Aufgabe bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeite die Informationen zu deiner Aufgabe.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Titel */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Titel*
            </label>
            <Input
              id="title"
              placeholder="z.B. Hilfe bei der Gartenpflege"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          {/* Beschreibung */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              {t('task.description')}*
            </label>
            <Textarea
              id="description"
              placeholder={t('task.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="min-h-[120px]"
            />
          </div>
          
          {/* Kategorie und Preis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">
                {t('task.category')}*
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('task.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="price" className="text-sm font-medium">
                {t('task.budget', {amount: price})}
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Slider
                    value={[price]}
                    onValueChange={(values) => setPrice(values[0])}
                    min={5}
                    max={100}
                    step={5}
                    className="py-4"
                  />
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setPrice(value);
                      }
                    }}
                    className="text-right"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Adresse/Standort */}
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium flex items-center">
              <MapPin className="h-4 w-4 mr-1" /> {t('addressLocation')}
            </label>
            <PlacesAutocomplete
              initialAddress={taskAddress}
              placeholder={t('addressPlaceholder')}
              onLocationSelect={(data) => {
                if (data) {
                  setTaskAddress(data.address);
                  setLocationData(data);
                }
              }}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Optional: Hilft anderen Nutzern, Aufgaben in ihrer Nähe zu finden
            </p>
          </div>
          
          {/* Zeitauswahl-Bereich */}
          <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-medium flex items-center">
              <Clock className="h-4 w-4 mr-1" /> {t('task.whenShouldTaskBeCompleted')}*
            </h3>
            
            {/* Checkbox für "Zeitlich flexibel" */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="timeFlexible" 
                checked={isFlexible} 
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  setIsFlexible(isChecked);
                  
                  // Wenn "Zeitlich flexibel" aktiviert wird, 
                  // setzen wir Datum und Tageszeit zurück
                  if (isChecked) {
                    setDate(undefined);
                    setTimeOfDay('');
                  }
                }}
              />
              <label
                htmlFor="timeFlexible"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('tasks.timeFlexible')}
              </label>
            </div>

            {/* Datum und Tageszeit Auswahl (nur aktiv, wenn nicht zeitlich flexibel) */}
            <div className={`space-y-4 ${isFlexible ? 'opacity-50' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Datums-Auswahl */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('tasks.selectDate')}
                  </label>
                  <Popover open={dateOpen && !isFlexible} onOpenChange={isFlexible ? undefined : setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!date && !isFlexible ? "text-muted-foreground" : ""}`}
                        disabled={isFlexible}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {date && !isNaN(date.getTime()) ? format(date, "dd.MM.yyyy", { locale: de }) : t('tasks.selectDatePlaceholder')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={isFlexible}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Tageszeit Auswahl */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('tasks.preferredTime')}
                  </label>
                  <RadioGroup 
                    value={timeOfDay} 
                    onValueChange={setTimeOfDay}
                    disabled={isFlexible}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="morgens" id="edit-morgens" disabled={isFlexible} />
                        <Label htmlFor="edit-morgens">{t('tasks.morning')}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mittags" id="edit-mittags" disabled={isFlexible} />
                        <Label htmlFor="edit-mittags">{t('tasks.afternoon')}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="abends" id="edit-abends" disabled={isFlexible} />
                        <Label htmlFor="edit-abends">{t('tasks.evening')}</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bildergalerie-Bereich */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('tasks.images', {count: imagePreviews.length, max: MAX_IMAGES})}
              </label>
              {imagePreviews.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {currentImageIndex + 1} / {imagePreviews.length}
                </Badge>
              )}
            </div>
            
            {/* Bildergalerie-Vorschau */}
            {imagePreviews.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <ImageGallery 
                  images={imagePreviews}
                  category={category || 'Other'}
                  showNavigation={true}
                  height="medium"
                  currentIndex={currentImageIndex}
                  onIndexChange={setCurrentImageIndex}
                />
                
                {/* Bild-Aktionen */}
                <div className="p-2 bg-gray-50 border-t flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImage(currentImageIndex)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('tasks.removeImages')}
                  </Button>
                </div>
              </div>
            ) : (
              // Leerer Zustand - Upload-Aufforderung
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center 
                         hover:bg-gray-50 transition cursor-pointer"
                onClick={(e) => {
                  e.preventDefault(); // Verhindert Formular-Absenden
                  fileInputRef.current?.click();
                }}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <ImageIcon className="h-12 w-12 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      {t('tasks.clickToAddImages')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('tasks.imageFormats', {size: APP_CONFIG.MAX_UPLOAD_SIZE / (1024 * 1024)})}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Bild-Upload-Button und verstecktes Input-Feld */}
            <div className="flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault(); // Verhindert Formular-Absenden
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
                disabled={imagePreviews.length >= MAX_IMAGES}
                className="ml-auto"
              >
                <Plus className="h-4 w-4 mr-1" />
                Bild hinzufügen
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                multiple
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert..." : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditModal;