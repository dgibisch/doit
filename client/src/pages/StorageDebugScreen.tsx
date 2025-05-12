import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import StorageConfigPanel from '@/components/StorageConfigPanel';
import { commentService } from '@/lib/comment-service';
import { APP_CONFIG } from '@/lib/config';
import { getTasks } from '@/lib/firebase';
import { createTestTasks, createTestUsers } from '@/utils/testData';
import { deleteRecentTasks } from '@/utils/cleanupTestData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

/**
 * Test- und Debug-Screen für Firebase Storage
 * 
 * Ermöglicht das Testen der Bildupload-Funktionalität und
 * das Umschalten zwischen Firebase Storage und Data-URL.
 */
const StorageDebugScreen: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<{ url: string; method: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Handler für Dateiauswahl
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    
    // Reset Ergebnisse
    setUploadResult(null);
    setError(null);
    
    if (file && file.size > APP_CONFIG.MAX_UPLOAD_SIZE) {
      setError(`Datei zu groß: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: ${APP_CONFIG.MAX_UPLOAD_SIZE / 1024 / 1024}MB`);
    }
  };
  
  // Test-Upload Funktion
  const handleTestUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    setUploadResult(null);
    
    try {
      // Verwende den gleichen Service wie für Kommentar-Bilder
      const imageUrl = await commentService.uploadCommentImage(selectedFile);
      
      setUploadResult({
        url: imageUrl,
        method: imageUrl.startsWith('data:') ? 'Data-URL (Base64)' : 'Firebase Storage URL'
      });
    } catch (err) {
      setError(`Upload fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Function to create test data
  const handleCreateTestData = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Testdaten zu erstellen.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await createTestTasks();
      if (result.success) {
        toast({
          title: "Testdaten erstellt",
          description: `${result.count} Testaufgaben wurden erfolgreich erstellt.`
        });
      } else {
        toast({
          title: "Fehler",
          description: result.message || "Testdaten konnten nicht erstellt werden.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test data:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };
  
  // Function to delete recent test tasks
  const handleDeleteRecentTasks = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Testdaten zu löschen.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await deleteRecentTasks(7); // Die letzten 7 Testeinträge löschen
      if (result.success) {
        toast({
          title: "Testdaten gelöscht",
          description: result.message
        });
      } else {
        toast({
          title: "Fehler",
          description: result.message
        });
      }
    } catch (error) {
      console.error("Error deleting test tasks:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten."
      });
    }
  };
  
  // Function to create test users with reviews
  const handleCreateTestUsers = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Testnutzer zu erstellen.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await createTestUsers();
      if (result.success) {
        toast({
          title: "Testnutzer erstellt",
          description: result.message || "Testnutzer wurden erfolgreich erstellt."
        });
      } else {
        toast({
          title: "Fehler",
          description: result.message || "Testnutzer konnten nicht erstellt werden.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test users:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="container py-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Storage-Konfiguration</h1>
      <p className="text-gray-500 mb-6">
        Teste und konfiguriere das Bild-Upload-System für die DoIt-App
      </p>
      
      <StorageConfigPanel />
      
      <Separator className="my-8" />
      
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Upload-Test</h2>
        <p className="text-gray-500">
          Teste den Bildupload mit der aktuellen Konfiguration
        </p>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="image-upload">Bild auswählen</Label>
            <Input 
              id="image-upload" 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              disabled={uploading}
              className="mt-1"
            />
          </div>
          
          <Button 
            onClick={handleTestUpload} 
            disabled={!selectedFile || uploading || !!error}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bild wird hochgeladen...
              </>
            ) : (
              'Test-Upload starten'
            )}
          </Button>
          
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {uploadResult && (
            <div className="space-y-4 p-4 border rounded-md">
              <div>
                <h3 className="font-medium">Upload erfolgreich!</h3>
                <p className="text-sm text-gray-500">Methode: {uploadResult.method}</p>
              </div>
              
              <div className="border rounded-md overflow-hidden">
                <img 
                  src={uploadResult.url} 
                  alt="Hochgeladenes Bild" 
                  className="max-w-full max-h-96 object-contain mx-auto"
                />
              </div>
              
              {uploadResult.url.length > 50 && (
                <div className="text-xs overflow-auto p-2 bg-gray-50 rounded-md">
                  {uploadResult.url.slice(0, 50)}...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <Separator className="my-8" />
      
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Test-Daten</h2>
        <p className="text-gray-500">
          Testdaten für die Entwicklung erstellen und löschen
        </p>
        
        <div className="flex flex-wrap gap-4">
          <Button 
            variant="outline" 
            onClick={handleCreateTestData}
            className="flex-1"
          >
            Testaufgaben erstellen
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDeleteRecentTasks}
            className="flex-1"
          >
            Letzte 7 Aufgaben löschen
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCreateTestUsers}
            className="flex-1"
          >
            Testnutzer erstellen
          </Button>
        </div>
      </div>
      
    </div>
  );
};

export default StorageDebugScreen;