import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { commentService } from '@/lib/comment-service';
import { FEATURES, IS_DEVELOPMENT, logger } from '@/lib/config';

/**
 * Storage-Konfigurationspanel
 * 
 * Diese Komponente ermöglicht es, zwischen Firebase Storage und Data-URL für Bilduploads umzuschalten
 * und die Storage-Konfiguration zu testen
 */
const StorageConfigPanel: React.FC = () => {
  // Wir verwenden einen State, um die UI zu aktualisieren, aber die tatsächliche
  // Einstellung kommt immer aus den FEATURES mit localStorage-Persistenz
  const [useFirebaseStorage, setUseFirebaseStorage] = useState<boolean>(FEATURES.USE_FIREBASE_STORAGE);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Teste die Firebase Storage-Konfiguration
  const testStorageConfig = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const isAvailable = await commentService.checkStorageConfiguration();
      
      if (isAvailable) {
        setTestResult({ 
          success: true, 
          message: 'Firebase Storage ist korrekt konfiguriert und verfügbar!' 
        });
      } else {
        setTestResult({ 
          success: false, 
          message: 'Firebase Storage ist nicht verfügbar oder nicht korrekt konfiguriert.' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `Fehler beim Testen der Storage-Konfiguration: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` 
      });
    } finally {
      setTesting(false);
    }
  };
  
  // Handle Storage-Umschaltung mit persistenter Speicherung
  const handleStorageToggle = (checked: boolean) => {
    // Einstellung in der localStorage über den Setter speichern
    FEATURES.USE_FIREBASE_STORAGE = checked;
    
    // UI aktualisieren
    setUseFirebaseStorage(checked);
    
    logger.info(`Die Storage-Einstellung wurde auf "${checked ? 'Firebase Storage' : 'Data-URL'}" geändert.`);
    
    // Optional: Teste automatisch beim Umschalten auf Firebase Storage
    if (checked) {
      testStorageConfig();
    }
  };
  
  // AutoTest beim ersten Laden und wenn sich die Einstellung ändert
  useEffect(() => {
    // Stelle sicher, dass der State mit dem gespeicherten Feature-Flag synchron ist
    if (useFirebaseStorage !== FEATURES.USE_FIREBASE_STORAGE) {
      setUseFirebaseStorage(FEATURES.USE_FIREBASE_STORAGE);
    }
    
    // Teste beim ersten Laden, wenn Firebase Storage aktiviert ist
    if (useFirebaseStorage) {
      testStorageConfig();
    }
  }, []);
  
  return (
    <Card className="max-w-md mx-auto my-6">
      <CardHeader>
        <CardTitle>Bild-Storage Konfiguration</CardTitle>
        <CardDescription>
          Wähle zwischen Firebase Storage und Data-URL für Bilduploads
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="storage-toggle">Firebase Storage verwenden</Label>
            <p className="text-sm text-muted-foreground">
              {useFirebaseStorage 
                ? 'Bilder werden in Firebase Storage gespeichert (Produktion)' 
                : 'Bilder werden als Data-URL gespeichert (Entwicklung)'}
            </p>
          </div>
          <Switch 
            id="storage-toggle" 
            checked={useFirebaseStorage} 
            onCheckedChange={handleStorageToggle} 
          />
        </div>
        
        {testResult && (
          <div className={`p-3 rounded-md ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-start">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
              )}
              <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {/* Umgebungsstatus */}
          <div className={`p-3 rounded-md ${IS_DEVELOPMENT ? 'bg-amber-50' : 'bg-green-50'}`}>
            <div className="flex items-start">
              <Info className={`h-5 w-5 ${IS_DEVELOPMENT ? 'text-amber-500' : 'text-green-500'} mt-0.5 mr-2`} />
              <div className={`text-sm ${IS_DEVELOPMENT ? 'text-amber-700' : 'text-green-700'}`}>
                <p className="font-medium">Umgebungserkennung:</p>
                <p>
                  {IS_DEVELOPMENT 
                    ? 'Entwicklungsmodus erkannt (DEV oder replit.dev). Base64 als Standard eingestellt.' 
                    : 'Produktionsmodus erkannt. Firebase Storage als Standard eingestellt.'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Produktionshinweise */}
          <div className="p-3 rounded-md bg-blue-50">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
              <div className="text-sm text-blue-700">
                <p>Für Produktion:</p>
                <ol className="list-decimal ml-4 mt-1 space-y-1">
                  <li>Aktiviere Firebase Storage</li>
                  <li>Konfiguriere die Storage-Regeln für öffentlichen Lesezugriff</li>
                  <li>Setze CORS-Konfiguration für den Storage-Bucket</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-4">
        <Button 
          onClick={testStorageConfig} 
          disabled={!useFirebaseStorage || testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Teste Storage-Konfiguration...
            </>
          ) : (
            'Firebase Storage testen'
          )}
        </Button>
        
        <p className="text-xs text-gray-500 text-center">
          Die Einstellung wird in deinem Browser gespeichert und bleibt auch nach dem Neuladen der Seite erhalten.
        </p>
      </CardFooter>
    </Card>
  );
};

export default StorageConfigPanel;