import { 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { chatService } from './chat-service';

export interface TaskApplication {
  id: string;
  taskId: string;
  taskTitle: string;
  applicantId: string;
  applicantName: string;
  message: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  chatId?: string;
}

class TaskApplicationService {
  /**
   * Apply for a task and create a chat channel
   */
  async applyForTask(
    taskId: string, 
    taskTitle: string,
    taskCreatorId: string,
    taskCreatorName: string,
    message: string, 
    price: number, // Obwohl wir keinen Preis mehr verwenden, behalten wir den Parameter für Kompatibilität
    currentUserId: string,
    currentUserName: string
  ): Promise<{ applicationId: string, chatId: string }> {
    try {
      if (!taskId || !message.trim()) {
        throw new Error('Task ID und Nachricht werden benötigt, um sich auf eine Aufgabe zu bewerben');
      }

      if (!currentUserId) {
        throw new Error('User must be logged in to apply for a task');
      }

      // Check if user has already applied for this task
      const applicationsRef = collection(db, 'applications');
      const existingApplicationQuery = query(
        applicationsRef,
        where('taskId', '==', taskId),
        where('applicantId', '==', currentUserId)
      );
      
      const existingApplications = await getDocs(existingApplicationQuery);
      if (!existingApplications.empty) {
        throw new Error('Sie haben sich bereits für diese Aufgabe beworben');
      }

      // Auch zum Task die Bewerbung hinzufügen
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Aufgabe nicht gefunden');
      }
      
      // Create application
      const applicationData = {
        taskId,
        taskTitle,
        applicantId: currentUserId,
        applicantName: currentUserName,
        message: message.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      };

      const applicationRef = await addDoc(applicationsRef, applicationData);

      // Create chat for the application
      const chatId = await chatService.createChatForApplication(
        taskId,
        taskTitle,
        taskCreatorId,
        taskCreatorName,
        currentUserId,
        currentUserName,
        applicationRef.id,
        message.trim()
      );

      // Update application with chat ID
      await updateDoc(applicationRef, {
        chatId
      });
      
      // Aktualisieren Sie den Task mit dem neuen Bewerber
      const taskData = taskSnapshot.data();
      const applicants = taskData.applicants || [];
      
      // Prüfen, ob der Bewerber bereits vorhanden ist
      const existingApplicant = Array.isArray(applicants) && applicants.find && 
        applicants.find(app => typeof app === 'object' && app.userId === currentUserId);
      
      if (!existingApplicant) {
        // Neuen Bewerber mit erweiterten Informationen hinzufügen
        const now = new Date();
        const newApplicant = {
          userId: currentUserId,
          name: currentUserName,
          timestamp: Timestamp.fromDate(now), // Hier verwenden wir explizit Timestamp statt serverTimestamp
          message: message.trim(),
          applicationId: applicationRef.id,
          chatId: chatId
        };
        
        await updateDoc(taskRef, {
          applicants: [...applicants, newApplicant],
          applicantsCount: (taskData.applicantsCount || 0) + 1,
          updatedAt: serverTimestamp()
        });
      }

      return {
        applicationId: applicationRef.id,
        chatId
      };
    } catch (error) {
      console.error('Error applying for task:', error);
      // Provide more detailed error message for Firebase permission errors
      if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
        alert('Fehler: Zugriff auf Firestore verweigert. Bitte stellen Sie sicher, dass Sie Firestore in der Firebase-Konsole aktiviert und die Sicherheitsregeln angepasst haben.');
      }
      throw error;
    }
  }

  /**
   * Überprüft, ob sich der aktuelle Benutzer auf einen Task beworben hat
   */
  async hasUserAppliedForTask(taskId: string): Promise<boolean> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !taskId) {
        return false;
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        return false;
      }
      
      const taskData = taskSnapshot.data();
      const applicants = taskData.applicants || [];
      
      // Prüfen, ob der aktuelle Benutzer in der Liste der Bewerber ist
      return Array.isArray(applicants) && applicants.some(app => 
        (typeof app === 'object' && app.userId === currentUser.uid) || 
        app === currentUser.uid // Für Abwärtskompatibilität mit altem Format
      );
    } catch (error) {
      console.error('Error checking if user applied for task:', error);
      return false;
    }
  }
  
  /**
   * Wählt einen Bewerber für einen Task aus
   * @returns Die Chat-ID für die Weiterleitung nach der Auswahl
   */
  async selectApplicant(taskId: string, applicantId: string): Promise<string | null> {
    try {
      if (!taskId || !applicantId) {
        throw new Error('Task ID und Bewerber ID werden benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Bewerber auszuwählen');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Prüfen, ob der aktuelle Benutzer der Ersteller des Tasks ist
      if (taskData.creatorId !== currentUser.uid) {
        throw new Error('Nur der Ersteller der Aufgabe kann einen Bewerber auswählen');
      }
      
      // Prüfen, ob der Task noch offen ist
      if (taskData.status !== 'open' && taskData.status !== 'pending') {
        throw new Error('Diese Aufgabe ist nicht mehr offen für Bewerbungen');
      }
      
      // Prüfen, ob bereits ein Bewerber ausgewählt wurde
      if (taskData.selectedApplicant) {
        throw new Error('Für diese Aufgabe wurde bereits ein Bewerber ausgewählt');
      }
      
      // Bewerber-Infos aus dem applicants-Array abrufen
      const applicants = taskData.applicants || [];
      const selectedApplicant = Array.isArray(applicants) ? 
        applicants.find(app => 
          (typeof app === 'object' && app.userId === applicantId) || 
          app === applicantId
        ) : null;
      
      if (!selectedApplicant) {
        throw new Error('Der ausgewählte Bewerber hat sich nicht auf diese Aufgabe beworben');
      }
      
      // Task updaten
      await updateDoc(taskRef, {
        selectedApplicant: applicantId,
        status: 'pending',
        confirmedBy: [currentUser.uid], // Ersteller bestätigt automatisch
        updatedAt: serverTimestamp()
      });
      
      // Chat-ID abrufen, um Benachrichtigung zu senden
      let chatId;
      if (typeof selectedApplicant === 'object' && selectedApplicant.chatId) {
        chatId = selectedApplicant.chatId;
      } else {
        // Suche nach der Chat-ID in der applications-Collection
        const applicationsRef = collection(db, 'applications');
        const applicationsQuery = query(
          applicationsRef,
          where('taskId', '==', taskId),
          where('applicantId', '==', applicantId)
        );
        
        const applicationsSnapshot = await getDocs(applicationsQuery);
        if (!applicationsSnapshot.empty) {
          const applicationData = applicationsSnapshot.docs[0].data();
          chatId = applicationData.chatId;
        }
      }
      
      // Benachrichtigungen im Chat senden
      if (chatId) {
        // Systemnachricht NUR für den Task-Ersteller senden
        await chatService.sendSystemMessage(
          chatId,
          `Du hast ${typeof selectedApplicant === 'object' ? selectedApplicant.name : 'diesen Bewerber'} für die Aufgabe "${taskData.title}" ausgewählt.`,
          currentUser.uid  // Diese Nachricht ist nur für den Ersteller sichtbar
        );
        
        // Nachricht NUR an den Bewerber senden
        await chatService.sendSystemMessage(
          chatId,
          `Du wurdest für diese Aufgabe ausgewählt! Bitte bestätige, um zu beginnen.`,
          applicantId  // Diese Nachricht ist nur für den Bewerber sichtbar
        );
      }
      
      // Chat-ID für die Weiterleitung zurückgeben
      return chatId || null;
    } catch (error) {
      console.error('Error selecting applicant:', error);
      throw error;
    }
  }
  
  /**
   * Findet oder erstellt die Chat-ID für eine Bewerbung
   * @param taskId ID des Tasks
   * @param applicantId ID des Bewerbers
   * @returns Die Chat-ID oder null, wenn keine gefunden wurde
   */
  async getChatIdForApplication(taskId: string, applicantId: string): Promise<string | null> {
    try {
      if (!taskId || !applicantId) {
        throw new Error('Task ID und Bewerber ID werden benötigt');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Chat-ID aus den applicants abrufen
      const applicants = taskData.applicants || [];
      const applicant = Array.isArray(applicants) ? 
        applicants.find(app => 
          (typeof app === 'object' && app.userId === applicantId) || 
          app === applicantId
        ) : null;
      
      if (typeof applicant === 'object' && applicant.chatId) {
        return applicant.chatId;
      }
      
      // Wenn keine Chat-ID im applicants-Array gefunden wurde, in der applications-Collection suchen
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef,
        where('taskId', '==', taskId),
        where('applicantId', '==', applicantId)
      );
      
      const applicationsSnapshot = await getDocs(applicationsQuery);
      if (!applicationsSnapshot.empty) {
        const applicationData = applicationsSnapshot.docs[0].data();
        if (applicationData.chatId) {
          return applicationData.chatId;
        }
      }
      
      // Wenn wir bis hierher kommen, wurde keine Chat-ID gefunden
      return null;
    } catch (error) {
      console.error('Error getting chat ID for application:', error);
      throw error;
    }
  }
  
  async confirmTask(taskId: string): Promise<void> {
    try {
      if (!taskId) {
        throw new Error('Task ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Task zu bestätigen');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Prüfen, ob der aktuelle Benutzer berechtigt ist zu bestätigen
      const isCreator = taskData.creatorId === currentUser.uid;
      const isSelectedApplicant = taskData.selectedApplicant === currentUser.uid;
      
      if (!isCreator && !isSelectedApplicant) {
        throw new Error('Sie sind nicht berechtigt, diesen Task zu bestätigen');
      }
      
      // Prüfen, ob der Status korrekt ist
      if (taskData.status !== 'pending') {
        throw new Error('Dieser Task kann nicht bestätigt werden');
      }
      
      // Bisherige Bestätigungen abrufen
      const confirmedBy = taskData.confirmedBy || [];
      
      // Prüfen, ob der Benutzer bereits bestätigt hat
      if (confirmedBy.includes(currentUser.uid)) {
        return; // Nichts tun, wenn bereits bestätigt
      }
      
      // Bestätigung hinzufügen
      const updatedConfirmedBy = [...confirmedBy, currentUser.uid];
      
      // Task aktualisieren
      await updateDoc(taskRef, {
        confirmedBy: updatedConfirmedBy,
        updatedAt: serverTimestamp()
      });
      
      // Prüfen, ob beide Seiten bestätigt haben
      const creatorConfirmed = updatedConfirmedBy.includes(taskData.creatorId);
      const applicantConfirmed = updatedConfirmedBy.includes(taskData.selectedApplicant);
      
      if (creatorConfirmed && applicantConfirmed) {
        // Beide haben bestätigt, Task auf "in_progress" setzen
        await updateDoc(taskRef, {
          status: 'in_progress',
          updatedAt: serverTimestamp()
        });
        
        // Chat-ID abrufen, um Benachrichtigung zu senden
        let chatId;
        const applicants = taskData.applicants || [];
        const selectedApplicant = Array.isArray(applicants) ? 
          applicants.find(app => 
            (typeof app === 'object' && app.userId === taskData.selectedApplicant) || 
            app === taskData.selectedApplicant
          ) : null;
        
        if (typeof selectedApplicant === 'object' && selectedApplicant.chatId) {
          chatId = selectedApplicant.chatId;
        } else {
          // Suche nach der Chat-ID in der applications-Collection
          const applicationsRef = collection(db, 'applications');
          const applicationsQuery = query(
            applicationsRef,
            where('taskId', '==', taskId),
            where('applicantId', '==', taskData.selectedApplicant)
          );
          
          const applicationsSnapshot = await getDocs(applicationsQuery);
          if (!applicationsSnapshot.empty) {
            const applicationData = applicationsSnapshot.docs[0].data();
            chatId = applicationData.chatId;
          }
        }
        
        // Benachrichtigung senden - an BEIDE Teilnehmer
        if (chatId) {
          await chatService.sendSystemMessage(
            chatId,
            `Die Aufgabe wurde offiziell gestartet!`
            // Hier kein dritter Parameter, weil diese Nachricht für beide sichtbar sein soll
          );
        }
      }
    } catch (error) {
      console.error('Error confirming task:', error);
      throw error;
    }
  }

  /**
   * Accept a task application (legacy method)
   */
  async acceptApplication(applicationId: string): Promise<void> {
    try {
      if (!applicationId) {
        throw new Error('Application ID is required');
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to accept an application');
      }

      // Get application
      const applicationRef = doc(db, 'applications', applicationId);
      const applicationSnapshot = await getDoc(applicationRef);
      
      if (!applicationSnapshot.exists()) {
        throw new Error('Application not found');
      }

      const applicationData = applicationSnapshot.data() as TaskApplication;
      
      // Get task to verify current user is task creator
      const taskRef = doc(db, 'tasks', applicationData.taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task not found');
      }
      
      const taskData = taskSnapshot.data();
      
      if (taskData.creatorId !== currentUser.uid) {
        throw new Error('Only the task creator can accept applications');
      }

      if (taskData.status !== 'open') {
        throw new Error('This task is no longer open for applications');
      }

      // Update application status
      await updateDoc(applicationRef, {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });

      // Update task status
      await updateDoc(taskRef, {
        status: 'assigned',
        assignedTo: applicationData.applicantId,
        assignedApplicationId: applicationId,
        updatedAt: serverTimestamp()
      });

      // Notify the applicant via chat if chatId exists
      if (applicationData.chatId) {
        await chatService.sendMessage(
          applicationData.chatId, 
          'Your application has been accepted! You can now start working on this task.'
        );
      }
    } catch (error) {
      console.error('Error accepting application:', error);
      throw error;
    }
  }

  /**
   * Reject a task application
   */
  async rejectApplication(applicationId: string): Promise<void> {
    try {
      if (!applicationId) {
        throw new Error('Application ID is required');
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to reject an application');
      }

      // Get application
      const applicationRef = doc(db, 'applications', applicationId);
      const applicationSnapshot = await getDoc(applicationRef);
      
      if (!applicationSnapshot.exists()) {
        throw new Error('Application not found');
      }

      const applicationData = applicationSnapshot.data() as TaskApplication;
      
      // Get task to verify current user is task creator
      const taskRef = doc(db, 'tasks', applicationData.taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task not found');
      }
      
      const taskData = taskSnapshot.data();
      
      if (taskData.creatorId !== currentUser.uid) {
        throw new Error('Only the task creator can reject applications');
      }

      // Update application status
      await updateDoc(applicationRef, {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });

      // Notify the applicant via chat if chatId exists
      if (applicationData.chatId) {
        await chatService.sendMessage(
          applicationData.chatId, 
          'Your application has been rejected for this task.'
        );
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
      throw error;
    }
  }

  /**
   * Get applications for a task
   */
  async getTaskApplications(taskId: string): Promise<TaskApplication[]> {
    try {
      if (!taskId) {
        throw new Error('Task ID is required');
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to view applications');
      }

      // Get task to verify current user is task creator
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task not found');
      }
      
      const taskData = taskSnapshot.data();
      
      if (taskData.creatorId !== currentUser.uid) {
        throw new Error('Only the task creator can view applications');
      }

      // Get applications for this task
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef,
        where('taskId', '==', taskId)
      );
      
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      return applicationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskApplication[];
    } catch (error) {
      console.error('Error getting task applications:', error);
      throw error;
    }
  }

  /**
   * Get applications made by the current user
   */
  async getUserApplications(): Promise<TaskApplication[]> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be logged in to view their applications');
      }

      // Get applications by this user
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef,
        where('applicantId', '==', currentUser.uid)
      );
      
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      return applicationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskApplication[];
    } catch (error) {
      console.error('Error getting user applications:', error);
      throw error;
    }
  }

  /**
   * Bestätigt als ausgewählter Bewerber, dass der Task abgeschlossen wurde
   */
  async confirmTaskCompletion(taskId: string): Promise<void> {
    try {
      if (!taskId) {
        throw new Error('Task ID wird benötigt');
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Sie müssen angemeldet sein, um einen Task zu bestätigen');
      }
      
      // Task-Daten abrufen
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnapshot = await getDoc(taskRef);
      
      if (!taskSnapshot.exists()) {
        throw new Error('Task nicht gefunden');
      }
      
      const taskData = taskSnapshot.data();
      
      // Prüfen, ob der aktuelle Benutzer der ausgewählte Bewerber ist
      if (taskData.selectedApplicant !== currentUser.uid) {
        throw new Error('Nur der ausgewählte Bewerber kann die Fertigstellung des Tasks bestätigen');
      }
      
      // Prüfen, ob der Status korrekt ist
      if (taskData.status !== 'assigned' && taskData.status !== 'in_progress') {
        throw new Error('Dieser Task kann nicht als abgeschlossen markiert werden');
      }
      
      // Task als "completed by applicant" markieren
      await updateDoc(taskRef, {
        status: 'completed_by_applicant',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Chat-ID abrufen, um Benachrichtigung zu senden
      let chatId;
      const applicants = taskData.applicants || [];
      const selectedApplicant = Array.isArray(applicants) ? 
        applicants.find(app => 
          (typeof app === 'object' && app.userId === currentUser.uid) || 
          app === currentUser.uid
        ) : null;
      
      if (typeof selectedApplicant === 'object' && selectedApplicant.chatId) {
        chatId = selectedApplicant.chatId;
      } else {
        // Suche nach der Chat-ID in der applications-Collection
        const applicationsRef = collection(db, 'applications');
        const applicationsQuery = query(
          applicationsRef,
          where('taskId', '==', taskId),
          where('applicantId', '==', currentUser.uid)
        );
        
        const applicationsSnapshot = await getDocs(applicationsQuery);
        if (!applicationsSnapshot.empty) {
          const applicationData = applicationsSnapshot.docs[0].data();
          chatId = applicationData.chatId;
        }
      }
      
      // Benachrichtigung senden - NUR für den Task-Ersteller
      if (chatId) {
        await chatService.sendSystemMessage(
          chatId,
          `Der Bewerber hat den Auftrag als erledigt markiert. Bitte bestätige die Fertigstellung.`,
          taskData.creatorId  // Diese Nachricht ist nur für den Task-Ersteller
        );
      }
    } catch (error) {
      console.error('Error confirming task completion:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const taskApplicationService = new TaskApplicationService();