import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { collection, getDocs, deleteDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminTools() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<{
    tasks: number;
    applications: number;
    chats: number;
    messages: number;
  }>({ tasks: 0, applications: 0, chats: 0, messages: 0 });
  
  const { toast } = useToast();

  const cleanupDatabase = async () => {
    setIsDeleting(true);
    
    try {
      // Lösche alle Tasks
      await deleteCollection('tasks');
      
      // Lösche alle Anwendungen
      await deleteCollection('applications');
      
      // Lösche alle Chats außer Welcome-Chats
      await deleteCollection('chats', 'taskId', '!=', 'welcome-task');
      
      // Hole Welcome-Chat-IDs
      const welcomeChatsSnapshot = await getDocs(
        query(collection(db, 'chats'), where('taskId', '==', 'welcome-task'))
      );
      
      const welcomeChatIds = welcomeChatsSnapshot.docs.map(doc => doc.id);
      
      // Lösche Nachrichten, die nicht zu Welcome-Chats gehören
      if (welcomeChatIds.length > 0) {
        // Wir müssen alle Nachrichten holen und dann filtern
        const messagesSnapshot = await getDocs(collection(db, 'messages'));
        const batch = writeBatch(db);
        let count = 0;
        let batchCount = 0;
        const BATCH_SIZE = 500;
        
        for (const messageDoc of messagesSnapshot.docs) {
          const messageData = messageDoc.data();
          if (!welcomeChatIds.includes(messageData.chatId)) {
            batch.delete(messageDoc.ref);
            count++;
            batchCount++;
            
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              setProgress(prev => ({ ...prev, messages: count }));
              batchCount = 0;
            }
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          setProgress(prev => ({ ...prev, messages: count }));
        }
      }
      
      toast({
        title: "Datenbank erfolgreich bereinigt",
        description: "Alle Tasks, Anwendungen und zugehörige Daten wurden gelöscht.",
      });
      
    } catch (error) {
      console.error("Fehler beim Bereinigen der Datenbank:", error);
      toast({
        title: "Fehler beim Bereinigen der Datenbank",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const deleteCollection = async (
    collectionName: string, 
    filterField?: string, 
    filterOperator?: any, 
    filterValue?: any
  ) => {
    try {
      let collectionRef = collection(db, collectionName);
      
      // Optional nach bestimmten Dokumenten filtern
      let snapshot;
      if (filterField && filterOperator && filterValue !== undefined) {
        const q = query(collectionRef, where(filterField, filterOperator, filterValue));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collectionRef);
      }
      
      if (snapshot.empty) {
        console.log(`Keine Dokumente in der Collection ${collectionName} gefunden.`);
        return;
      }
      
      // Lösche die Dokumente in Batches
      const BATCH_SIZE = 500; // Firestore-Limit
      let batch = writeBatch(db);
      let count = 0;
      let batchCount = 0;
      
      for (const document of snapshot.docs) {
        batch.delete(document.ref);
        count++;
        batchCount++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          
          // Update Progress
          setProgress(prev => ({ 
            ...prev, 
            [collectionName]: count 
          }));
        }
      }
      
      // Committe den letzten Batch
      if (batchCount > 0) {
        await batch.commit();
        
        // Update Progress
        setProgress(prev => ({ 
          ...prev, 
          [collectionName]: count 
        }));
      }
      
      console.log(`${count} Dokumente aus ${collectionName} gelöscht.`);
      
    } catch (error) {
      console.error(`Fehler beim Löschen der Collection ${collectionName}:`, error);
      throw error;
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Admin-Tools</h2>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Alle Tasks löschen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion wird alle Tasks, Anwendungen, Chat-Konversationen und zugehörige Daten unwiderruflich löschen.
              <br /><br />
              Welcome-Chats bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={cleanupDatabase} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lösche...
                </>
              ) : (
                "Ja, alles löschen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
          
          {isDeleting && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Fortschritt:</p>
              <ul className="text-sm">
                <li>Tasks gelöscht: {progress.tasks}</li>
                <li>Anwendungen gelöscht: {progress.applications}</li>
                <li>Chats gelöscht: {progress.chats}</li>
                <li>Nachrichten gelöscht: {progress.messages}</li>
              </ul>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}