/**
 * Dienstprogramm für Bildverarbeitung und -validierung
 */
import imageCompression from 'browser-image-compression';

/**
 * Validiert ein Bild basierend auf Typ und Größe
 * 
 * @param file Die zu validierende Datei
 * @param maxSize Maximale Dateigröße in Bytes (optional, Standard: 1MB)
 * @returns Ein Validierungsergebnis mit Status und ggf. Fehlermeldung
 */
export const validateImage = (file: File, maxSize?: number) => {
  const maxSizeInBytes = maxSize || 1024 * 1024; // Standard: 1MB
  const maxSizeInMB = maxSizeInBytes / (1024 * 1024);
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false,
      title: 'Ungültiges Dateiformat',
      message: 'Nur JPG, PNG oder WEBP Bilder sind erlaubt.' 
    };
  }
  
  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      title: 'Bild zu groß',
      message: `Die Datei überschreitet die maximale Größe von ${maxSizeInMB.toFixed(1)} MB.`
    };
  }
  
  // Bild ist gültig
  return { valid: true, error: null };
};

/**
 * Komprimiert ein Bild mit der browser-image-compression Bibliothek
 * 
 * @param file Die zu komprimierende Bilddatei
 * @param options Optionale Konfiguration für die Komprimierung
 * @returns Ein Promise, das eine komprimierte File-Instanz zurückgibt
 */
export const compressImage = async (
  file: File,
  options?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    fileType?: string;
  }
): Promise<File> => {
  // Standard-Optionen für hochqualitative Komprimierung
  const defaultOptions = {
    maxSizeMB: 0.5,             // max 500KB
    maxWidthOrHeight: 600,      // max Dimensionen
    useWebWorker: true,         // für bessere Performance
    fileType: file.type,        // Originaltyp beibehalten
  };

  // Kombiniere default Optionen mit übergebenen Optionen
  const compressionOptions = {
    ...defaultOptions,
    ...options
  };

  try {
    console.log("Komprimiere Bild mit Optionen:", compressionOptions);
    
    // Bild komprimieren mit der Bibliothek
    const compressedFile = await imageCompression(file, compressionOptions);
    
    // Sicherstellen, dass das Ergebnis ein File-Objekt ist
    const isFile = compressedFile instanceof File;
    
    console.log("Komprimierung erfolgreich:", {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      compressedSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`, 
      reduction: `${Math.round((1 - compressedFile.size / file.size) * 100)}%`,
      isFile: isFile,
      type: compressedFile.type
    });
    
    // Wenn das Ergebnis kein File-Objekt ist, konvertieren wir es
    if (!isFile) {
      console.warn("Komprimierungsergebnis ist kein File-Objekt, konvertiere...");
      const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg"; // Ändern der Dateiendung zu .jpg
      const fileObject = new File(
        [compressedFile], 
        newFileName, 
        { type: "image/jpeg" }
      );
      console.log("Konvertiert zu File-Objekt:", fileObject instanceof File);
      return fileObject;
    }
    
    return compressedFile;
  } catch (error) {
    console.error("Fehler bei der Bildkomprimierung:", error);
    throw new Error("Bild konnte nicht komprimiert werden");
  }
};

/**
 * Konvertiert ein Blob-Objekt in eine File-Instanz
 * 
 * @param blob Das zu konvertierende Blob-Objekt
 * @param fileName Name der zu erstellenden Datei
 * @param fileType MIME-Typ der zu erstellenden Datei
 * @returns Eine File-Instanz, die dem Blob entspricht
 */
export const blobToFile = (blob: Blob, fileName: string, fileType?: string): File => {
  // Erstelle ein neues File-Objekt aus dem Blob
  return new File(
    [blob],
    fileName,
    { type: fileType || blob.type }
  );
};

/**
 * Wandelt ein File-Objekt in einen Base64-String um
 * 
 * @param file Die zu konvertierende Datei
 * @returns Ein Promise, das einen Base64-String zurückgibt
 */
export const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Konvertierung zu Base64 fehlgeschlagen'));
      }
    };
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
    reader.readAsDataURL(file);
  });
};

/**
 * Komprimiert ein Bild und wandelt es in Base64 um
 * 
 * @param file Die zu verarbeitende Bilddatei
 * @param maxSizeMB Maximale Größe in MB (Standard: 0.5)
 * @returns Ein Promise, das einen Base64-String zurückgibt
 */
export const compressAndConvertToBase64 = async (file: File, maxSizeMB = 0.5): Promise<string> => {
  try {
    // Validiere Datei
    if (!file.type.startsWith('image/')) {
      throw new Error('Datei ist kein Bild');
    }
    
    let compressedFile = file;
    
    // Komprimieren, wenn Datei zu groß ist
    if (file.size > maxSizeMB * 1024 * 1024) {
      try {
        compressedFile = await compressImage(file, {
          maxSizeMB,
          maxWidthOrHeight: 800,
          useWebWorker: true
        });
        console.log(`Bild komprimiert: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
      } catch (error) {
        console.warn("Komprimierung fehlgeschlagen, verwende Original:", error);
        compressedFile = file;
      }
    }
    
    // Zu Base64 konvertieren
    return await convertToBase64(compressedFile);
  } catch (error) {
    console.error("Fehler bei der Bildverarbeitung:", error);
    throw error;
  }
};

/**
 * Stellt sicher, dass ein Base64-String eine bestimmte Größe nicht überschreitet
 * 
 * @param base64 Der zu überprüfende Base64-String
 * @param maxSizeKB Maximale Größe in KB
 * @returns Ein Promise, das einen (möglicherweise komprimierten) Base64-String zurückgibt
 */
export const ensureSmallerThan = async (base64: string, maxSizeKB: number): Promise<string> => {
  // Größe grob schätzen (Base64 ist etwa 33% größer als Binärdaten)
  const sizeInKB = Math.round(base64.length / 1.37 / 1024);
  
  if (sizeInKB <= maxSizeKB) {
    return base64; // Bereits klein genug
  }
  
  // Versuche, das Bild zu komprimieren
  try {
    // Base64 zu Blob konvertieren
    const fetchResponse = await fetch(base64);
    const blob = await fetchResponse.blob();
    
    // Bild-Dimensionen reduzieren
    const img = new Image();
    img.src = base64;
    await new Promise(resolve => { img.onload = resolve; });
    
    // Skalierungsfaktor berechnen (Quadratwurzel, da Fläche quadratisch wächst)
    const scaleFactor = Math.sqrt(maxSizeKB / sizeInKB);
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scaleFactor;
    canvas.height = img.height * scaleFactor;
    
    // Auf Canvas zeichnen
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas-Kontext konnte nicht erstellt werden');
    }
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Als komprimiertes JPEG mit reduzierter Qualität zurückgeben
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.error('Fehler bei der Bildkomprimierung:', error);
    return base64; // Original zurückgeben im Fehlerfall
  }
};