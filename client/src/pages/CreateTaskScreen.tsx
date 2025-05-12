import { useState, FormEvent, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db, storage, auth, uploadTaskImages } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Plus, Trash2, Image, MapPin, Calendar, Clock } from 'lucide-react';
import { FEATURES, APP_CONFIG, logger } from '@/lib/config';
import ImageGallery from '@/components/ImageGallery';
import { Badge } from '@/components/ui/badge';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { type LocationData } from '@/utils/geoUtils';
import { CheckIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { compressImage, validateImage } from '@/utils/imageUtils';

import { TASK_CATEGORIES } from '@/lib/categories';

const MAX_IMAGES = 5; // Maximale Anzahl an Bildern

const CreateTaskScreen = () => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState(20);
  const [taskAddress, setTaskAddress] = useState('');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); // Neuer Zustand für den Bildupload-Status
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Zeitauswahl-Variablen
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeOfDay, setTimeOfDay] = useState<string>('');
  const [isFlexible, setIsFlexible] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  /**
   * Erstellt eine temporäre URL für ein Bild zur Vorschauanzeige
   * Verwendet URL.createObjectURL für bessere Performance statt Base64 Data-URLs
   * 
   * @param file Die Datei, für die eine Vorschau-URL erstellt werden soll
   * @returns URL-String für die Vorschau
   */
  const createPreviewUrl = (file: File): string => {
    // Erstellt eine temporäre Object-URL (Blob-URL)
    return URL.createObjectURL(file);
  };
  
  // Aufräumfunktion, um Object-URLs wieder freizugeben
  useEffect(() => {
    // Beim Unmount der Komponente alle Object-URLs bereinigen
    return () => {
      imagePreviews.forEach(url => {
        // Nur Object-URLs (nicht Data-URLs) bereinigen
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imagePreviews]);
  
  /**
   * Verarbeitet die Auswahl mehrerer Bilder
   * Validiert, komprimiert und erstellt Vorschaubilder
   */  
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault(); // Verhindert, dass das Formular abgeschickt wird
    
    if (e.target.files && e.target.files.length > 0) {
      // Maximale Anzahl prüfen
      const totalImages = images.length + e.target.files.length;
      if (totalImages > MAX_IMAGES) {
        toast({
          title: "Zu viele Bilder",
          description: `Du kannst maximal ${MAX_IMAGES} Bilder hochladen.`,
          variant: "destructive",
        });
        return;
      }
      
      // Alle Bilder validieren
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const validationResult = validateImage(file, APP_CONFIG.MAX_UPLOAD_SIZE);
        
        if (!validationResult.valid) {
          const errorTitle = 'title' in validationResult 
            ? validationResult.title 
            : "Ungültiges Bild";
            
          const errorMessage = 'message' in validationResult 
            ? validationResult.message 
            : (validationResult.error || "Das Bild konnte nicht verarbeitet werden.");
          
          toast({
            title: errorTitle,
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
      }
      
      // Alle neuen Bilder verarbeiten
      const newFiles: File[] = [];
      const newPreviews: string[] = [];
      
      try {
        setUploading(true); // Komprimierung startet
        
        for (let i = 0; i < e.target.files.length; i++) {
          // Bild komprimieren mit der importierten Funktion
          const compressedFile = await compressImage(e.target.files[i], {
            maxSizeMB: 0.5,          // 500KB Maximalgröße
            maxWidthOrHeight: 1200,   // Max. Dimension
            useWebWorker: true        // Bessere Performance
          });
          
          newFiles.push(compressedFile);
          
          // Vorschau als Object-URL erstellen (performance-freundlicher)
          const previewUrl = createPreviewUrl(compressedFile);
          newPreviews.push(previewUrl);
          
          logger.info(`Bild komprimiert: ${e.target.files[i].name} - von ${Math.round(e.target.files[i].size/1024)}KB auf ${Math.round(compressedFile.size/1024)}KB`);
        }
      } catch (error) {
        console.error("Fehler beim Verarbeiten der Bilder:", error);
        toast({
          title: "Fehler bei der Bildverarbeitung",
          description: "Ein oder mehrere Bilder konnten nicht verarbeitet werden.",
          variant: "destructive",
        });
      } finally {
        setUploading(false); // Komprimierung beendet
      }
      
      // State aktualisieren
      setImages([...images, ...newFiles]);
      setImagePreviews([...imagePreviews, ...newPreviews]);
      
      // Input zurücksetzen, damit man das gleiche Bild nochmal auswählen kann
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Einzelnes Bild entfernen
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    
    // Aktuellen Index anpassen
    if (currentImageIndex >= index && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };
  
  // Firebase Storage Upload für Bilder mit der zentralen Funktion
  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (!files.length) return [];
    
    logger.info(`Starte Upload von ${files.length} Bildern über uploadTaskImages`);
    setUploading(true);
    
    try {
      // Verwende die zentrale uploadTaskImages-Funktion aus firebase.ts
      const urls = await uploadTaskImages(files);
      
      // Fehlermeldungen bei Bedarf ausgeben
      if (urls.length === 0 && files.length > 0) {
        toast({
          title: "Upload fehlgeschlagen",
          description: "Es konnten keine Bilder hochgeladen werden. Bitte versuche es erneut.",
          variant: "destructive"
        });
      } else if (urls.length < files.length) {
        toast({
          title: "Teilweiser Upload",
          description: `Nur ${urls.length} von ${files.length} Bildern wurden hochgeladen.`,
          variant: "default"
        });
      }
      
      return urls;
    } catch (error) {
      console.error("Fehler beim Hochladen der Bilder:", error);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Die Bilder konnten nicht hochgeladen werden. Bitte versuche es erneut.",
        variant: "destructive"
      });
      return []; // Leeres Array zurückgeben bei Fehler
    } finally {
      setUploading(false); // Bildupload-Status zurücksetzen
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Verhindert Event-Bubbling
    
    // Prüfen, ob gerade Bilder hochgeladen werden
    if (uploading) {
      toast({
        title: "Bitte warten",
        description: "Die Bilder werden noch verarbeitet. Bitte warten Sie einen Moment.",
        variant: "default"
      });
      return;
    }
    
    // Pflichtfelder prüfen
    if (!title || !description || !category) {
      toast({
        title: "Fehlende Felder",
        description: "Bitte fülle alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }
    
    // Standort-Pflichtfeld prüfen
    if (!locationData) {
      toast({
        title: "Standort erforderlich",
        description: "Bitte gib einen Standort für die Aufgabe an.",
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
    
    if (!user || !auth.currentUser) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Du musst angemeldet sein, um Aufgaben zu erstellen.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Bilder hochladen
      const imageUrls = await uploadImages(images);
      
      // Debug-Ausgabe für imageUrls
      console.debug(`CreateTask: Speichere ${imageUrls.length} Bilder, Format:`, 
                  imageUrls.length > 0 ? imageUrls[0].substring(0, 50) + '...' : 'keine Bilder');
      
      // Adressinformationen vorbereiten
      const locationInfo = {
        address: locationData.address,
        location: locationData.location // { lat, lng } Objekt
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
        const formattedDate = date ? format(date, "dd.MM.yyyy", { locale: de }) : "";
        timeInfo = {
          isFlexible: false,
          date: date ? date : null,
          formattedDate: formattedDate,
          timeOfDay: timeOfDay,
          displayText: `${formattedDate} – Am besten ${timeOfDay}`
        };
      }
      
      // Task-Dokument in Firestore erstellen
      const taskData = {
        title,
        description,
        category,
        price,
        imageUrls: imageUrls, // Sicherstellen, dass es ein Array ist
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, // Auch das erste Bild als imageUrl für Abwärtskompatibilität
        address: locationInfo.address,
        location: locationInfo.location,
        status: 'open',
        creatorId: auth.currentUser.uid,
        creatorName: auth.currentUser.displayName || 'Anonymous',
        creatorRef: doc(db, 'users', auth.currentUser.uid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        applicationsCount: 0,
        viewsCount: 0,
        
        // Zeitinformationen
        timeInfo: timeInfo
      };
      
      await addDoc(collection(db, 'tasks'), taskData);
      
      toast({
        title: "Aufgabe erstellt",
        description: "Deine Aufgabe wurde erfolgreich veröffentlicht!",
      });
      setLocation('/tasks');
      
    } catch (error) {
      console.error("Fehler beim Erstellen der Aufgabe:", error);
      toast({
        title: "Fehler",
        description: "Bei der Erstellung deiner Aufgabe ist ein Fehler aufgetreten. Bitte versuche es erneut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('tasks.newTask')}</CardTitle>
          <CardDescription>
            {t('tasks.createTaskDescription')}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                {t('tasks.title')}*
              </label>
              <Input
                id="title"
                placeholder={t('tasks.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                {t('tasks.description')}*
              </label>
              <Textarea
                id="description"
                placeholder={t('tasks.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="min-h-[120px]"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="category" className="text-sm font-medium">
                  {t('tasks.category')}*
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('tasks.categorySelect')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="price" className="text-sm font-medium">
                  {t('tasks.budget', { amount: price })}
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
            
            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium flex items-center">
                <MapPin className="h-4 w-4 mr-1" /> {t('tasks.addressLocation')}*
              </label>
              <PlacesAutocomplete
                initialAddress={taskAddress}
                placeholder={t('tasks.addressPlaceholder')}
                onLocationSelect={(data) => {
                  if (data) {
                    setTaskAddress(data.address);
                    setLocationData(data);
                  }
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                {t('tasks.locationHelpText')}
              </p>
            </div>
            
            {/* Zeitauswahl-Bereich */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-1" /> {t('tasks.taskTimeSchedule')}*
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
                          {date ? format(date, "dd.MM.yyyy", { locale: de }) : t('tasks.selectDatePlaceholder')}
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
                          <RadioGroupItem value="morgens" id="morgens" disabled={isFlexible} />
                          <Label htmlFor="morgens">{t('tasks.morning')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mittags" id="mittags" disabled={isFlexible} />
                          <Label htmlFor="mittags">{t('tasks.afternoon')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="abends" id="abends" disabled={isFlexible} />
                          <Label htmlFor="abends">{t('tasks.evening')}</Label>
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
                  {t('tasks.images')} ({imagePreviews.length}/{MAX_IMAGES})
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
                      Bild entfernen
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
                    <Image className="h-12 w-12 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500 font-medium">
                        {t('tasks.clickToAddImages')}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t('tasks.imageFormats')} {APP_CONFIG.MAX_UPLOAD_SIZE / (1024 * 1024)}MB
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
                  {t('tasks.addImage')}
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
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation('/tasks')}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('tasks.creating') : t('tasks.createTask')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default CreateTaskScreen;