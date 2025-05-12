import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  CheckCheck
} from 'lucide-react';
import TaskCard from '@/components/TaskCard';
import { useToast } from '@/hooks/use-toast';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';


// Komponente für leere Listen
const EmptyState = ({ 
  title, 
  message, 
  action, 
  actionText 
}: { 
  title: string; 
  message: string; 
  action?: () => void; 
  actionText?: string;
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg bg-white shadow-sm">
    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
      <AlertCircle className="w-8 h-8 text-primary" />
    </div>
    <h3 className="text-lg font-medium mb-2">{title}</h3>
    <p className="text-gray-500 mb-6">{message}</p>
    {action && actionText && (
      <Button onClick={action}>{actionText}</Button>
    )}
  </div>
);

// Loading-Skeleton für Tasks
const TasksLoadingSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="animate-pulse p-4">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="flex items-center justify-between">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function MyTasksScreen() {
  const [activeTab, setActiveTab] = useState('created');
  const [createdTasks, setCreatedTasks] = useState<any[]>([]);
  const [appliedTasks, setAppliedTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [bookmarkedTasks, setBookmarkedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user, activeTab]);

  const fetchTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    
    console.log("Fetching tasks for tab:", activeTab);
    console.log("Current user:", user);
    
    try {
      if (activeTab === 'bookmarked') {
        // Gemerkte Aufgaben abrufen (direkte Implementierung)
        console.log("Lade gemerkte Aufgaben...");
        
        // Benutzerprofile können entweder in der users oder userProfiles-Sammlung gespeichert sein
        console.log("Benutzer-ID für Bookmarks:", user.id);
        
        // Zuerst in users-Collection suchen
        let userProfileSnap = await getDoc(doc(db, "users", user.id));
        
        // Falls nicht in users, dann in userProfiles-Collection suchen
        if (!userProfileSnap.exists()) {
          console.log("Kein Profil in users Collection gefunden, prüfe in userProfiles");
          userProfileSnap = await getDoc(doc(db, "userProfiles", user.id));
        }
        
        if (!userProfileSnap.exists()) {
          console.log("Benutzer-Profil in keiner Collection gefunden");
          setBookmarkedTasks([]);
          setLoading(false);
          return;
        }
        
        const userProfileData = userProfileSnap.data();
        console.log("Benutzerprofil geladen:", userProfileData);
        
        // Gemerkte Aufgaben-IDs extrahieren
        const bookmarkedTaskIds = userProfileData.bookmarkedTasks || [];
        console.log(`Gefundene Lesezeichen: ${bookmarkedTaskIds.length}`, bookmarkedTaskIds);
        
        if (bookmarkedTaskIds.length === 0) {
          setBookmarkedTasks([]);
          setLoading(false);
          return;
        }
        
        // Gemerkte Aufgaben abrufen
        const bookmarkedTasksData = await Promise.all(
          bookmarkedTaskIds.map(async (taskId: string) => {
            try {
              const taskDoc = await getDoc(doc(db, "tasks", taskId));
              if (!taskDoc.exists()) {
                console.log(`Task ${taskId} existiert nicht mehr`);
                return null;
              }
              
              const taskData = taskDoc.data();
              
              // Benutzerprofil des Erstellers abrufen - zuerst in users, dann in userProfiles
              let creatorProfileSnap = await getDoc(doc(db, "users", taskData.creatorId));
              if (!creatorProfileSnap.exists()) {
                creatorProfileSnap = await getDoc(doc(db, "userProfiles", taskData.creatorId));
              }
              const creatorData = creatorProfileSnap.exists() ? creatorProfileSnap.data() : {};
              
              return {
                id: taskId,
                ...taskData,
                creatorName: creatorData.displayName || taskData.creatorName || 'Unbekannt',
                creatorPhotoURL: creatorData.photoURL || taskData.creatorPhotoURL,
                distance: Math.round(Math.random() * 50) / 10, // Mock-Distanz für Testzwecke
                timeInfo: taskData.timeInfo || {
                  isFlexible: true,
                  displayText: 'Zeitlich flexibel'
                }
              };
            } catch (error) {
              console.error(`Fehler beim Laden der Aufgabe ${taskId}:`, error);
              return null;
            }
          })
        );
        
        // Nur gültige Aufgaben anzeigen
        const validBookmarkedTasks = bookmarkedTasksData.filter(Boolean);
        console.log(`${validBookmarkedTasks.length} gültige gemerkte Aufgaben geladen`);
        
        setBookmarkedTasks(validBookmarkedTasks);
      }
      else if (activeTab === 'created') {
        // ANFORDERUNG: Zeige alle Tasks, bei denen task.creatorId === currentUserId
        // UND status === 'open' ODER status === 'assigned'
        
        console.log("Benutzer-ID für erstellte Aufgaben:", user.id);
        
        try {
          // Eine einfache Abfrage ohne orderBy, nur nach creatorId filtern
          const createdTasksQuery = query(
            collection(db, "tasks"),
            where("creatorId", "==", user.id)
          );
          
          // Abfrage ausführen
          const createdTasksSnapshot = await getDocs(createdTasksQuery);
          
          console.log(`Einfache Abfrage hat ${createdTasksSnapshot.docs.length} Tasks gefunden`);
          
          // Alle Tasks filtern - zeige alle außer "completed" oder "done"
          // Der Task sollte im "Created"-Tab bleiben, bis er vollständig abgeschlossen ist
          const filteredDocs = createdTasksSnapshot.docs.filter(doc => {
            const status = doc.data().status;
            return status !== "completed" && status !== "done";
          });
          
          // Nach createdAt sortieren (manuell in JavaScript)
          filteredDocs.sort((a, b) => {
            const dateA = a.data().createdAt ? a.data().createdAt.toDate().getTime() : 0;
            const dateB = b.data().createdAt ? b.data().createdAt.toDate().getTime() : 0;
            return dateB - dateA; // Absteigend sortieren
          });
          
          console.log(`Gefundene erstellte Aufgaben nach JS-Filterung: ${filteredDocs.length}`, {
            creatorId: user.id
          });
          
          // Aufgabendaten mit Bewerbungsinformationen abrufen
          const tasksData = await Promise.all(filteredDocs.map(async (docSnapshot: any) => {
            const taskData = docSnapshot.data();
            const taskId = docSnapshot.id;
            
            // Bewerbungen für diese Aufgabe abrufen
            const applicationsQuery = query(
              collection(db, "applications"),
              where("taskId", "==", taskId)
            );
            const applicationsSnapshot = await getDocs(applicationsQuery);
            
            // Bewerbungen in das erwartete Format umwandeln
            const applications = applicationsSnapshot.docs.map(appDoc => {
              const appData = appDoc.data();
              return {
                userId: appData.applicantId,
                isAccepted: appData.isAccepted || false,
                isRejected: appData.isRejected || false,
                chatId: appData.chatId || null
              };
            });
            
            // Chats für diese Aufgabe (Bewerbungschats) abrufen
            const chatsQuery = query(
              collection(db, "chats"),
              where("taskId", "==", taskId),
              where("isTaskApplicationChat", "==", true)
            );
            const chatsSnapshot = await getDocs(chatsQuery);
            
            // Chat-Informationen mit Status zusammenführen
            const applicantChats = await Promise.all(chatsSnapshot.docs.map(async chatDoc => {
              const chatData = chatDoc.data();
              
              return {
                id: chatDoc.id,
                applicantId: chatData.applicantId,
                applicantName: chatData.participantNames?.[chatData.applicantId] || 'Unbekannt',
                applicantAvatar: chatData.participantAvatars?.[chatData.applicantId] || '',
                isSelected: chatData.isSelected || false,
                isRejected: chatData.isRejected || false,
                isConfirmedByApplicant: chatData.isConfirmedByApplicant || false,
                applicationId: chatData.applicationId,
                message: chatData.applicationMessage || ''
              };
            }));
            
            let assignedUserId = null;
            // Falls ein Bewerber ausgewählt wurde, ist das der zugewiesene Benutzer
            const selectedApplicant = applicantChats.find(chat => chat.isSelected);
            if (selectedApplicant) {
              assignedUserId = selectedApplicant.applicantId;
            }
            
            return {
              id: taskId,
              ...taskData,
              ownerId: taskData.creatorId, // Für Konsistenz mit den Anforderungen
              applications: applications,
              applicationsCount: applicationsSnapshot.size,
              applicantChats: applicantChats,
              assignedUserId: assignedUserId,
              // Weitere nützliche Informationen
              timeInfo: taskData.timeInfo || { 
                isFlexible: true, 
                displayText: 'Zeitlich flexibel' 
              }
            };
          }));
          
          setCreatedTasks(tasksData);
        } catch (error) {
          console.error("Fehler beim Laden der erstellten Aufgaben:", error);
          toast({
            title: "Fehler",
            description: "Die erstellten Aufgaben konnten nicht geladen werden.",
            variant: "destructive"
          });
          setCreatedTasks([]);
        }
      } 
      else if (activeTab === 'applied') {
        // ANFORDERUNG: Zeige Tasks, bei denen currentUserId sich beworben hat
        // Zeige Status: offen, abgelehnt, angenommen
        
        // Zuerst alle Bewerbungen des aktuellen Benutzers abrufen
        const applicationsQuery = query(
          collection(db, "applications"),
          where("applicantId", "==", user.id)
        );
        
        const applicationsSnapshot = await getDocs(applicationsQuery);
        console.log(`Gefundene Bewerbungen: ${applicationsSnapshot.docs.length}`);
        
        if (applicationsSnapshot.empty) {
          setAppliedTasks([]);
          setLoading(false);
          return;
        }
        
        // Aufgaben-IDs extrahieren
        const taskIds = applicationsSnapshot.docs.map(doc => doc.data().taskId);
        
        // Für jede Task-ID die zugehörige Aufgabe und Chat abrufen
        const tasksData = await Promise.all(
          taskIds.map(async (taskId) => {
            const taskDoc = await getDoc(doc(db, "tasks", taskId));
            
            if (!taskDoc.exists()) {
              console.log(`Task ${taskId} existiert nicht mehr`);
              return null;
            }
            
            const taskData = taskDoc.data();
            
            // Die Bewerbung des Benutzers finden
            const application = applicationsSnapshot.docs.find(
              doc => doc.data().taskId === taskId
            );
            
            if (!application) {
              console.log(`Keine Bewerbung gefunden für Task ${taskId}`);
              return null;
            }
            
            const applicationData = application.data();
            
            // Den zugehörigen Chat finden
            const chatQuery = query(
              collection(db, "chats"),
              where("taskId", "==", taskId),
              where("applicantId", "==", user.id),
              where("isTaskApplicationChat", "==", true)
            );
            
            const chatSnapshot = await getDocs(chatQuery);
            let chatId = null;
            let applicationStatus = 'pending';
            
            if (!chatSnapshot.empty) {
              const chatData = chatSnapshot.docs[0].data();
              chatId = chatSnapshot.docs[0].id;
              applicationStatus = chatData.isSelected ? 'accepted' : (chatData.isRejected ? 'rejected' : 'pending');
            }
            
            // Benutzerprofil des Erstellers abrufen (wichtig für Profilbild)
            let creatorProfileSnap = await getDoc(doc(db, "users", taskData.creatorId));
            if (!creatorProfileSnap.exists()) {
              creatorProfileSnap = await getDoc(doc(db, "userProfiles", taskData.creatorId));
            }
            const creatorData = creatorProfileSnap.exists() ? creatorProfileSnap.data() : {};
            
            return {
              id: taskId,
              ...taskData,
              ownerId: taskData.creatorId,
              chatId: chatId,
              applicationStatus: applicationStatus,
              isAccepted: applicationData.isAccepted || false,
              isRejected: applicationData.isRejected || false,
              // Benutzerdaten des Erstellers hinzufügen
              creatorName: creatorData.displayName || taskData.creatorName || 'Unbekannt',
              creatorPhotoURL: creatorData.photoURL || creatorData.avatarUrl || taskData.creatorPhotoURL,
              // Weitere nützliche Informationen
              timeInfo: taskData.timeInfo || { 
                isFlexible: true, 
                displayText: 'Zeitlich flexibel' 
              }
            };
          })
        );
        
        setAppliedTasks(tasksData.filter(Boolean));
      } 
      else if (activeTab === 'completed') {
        // ANFORDERUNG: Zeige alle Tasks mit status === done, wenn:
        // task.creatorId === currentUserId oder
        // currentUserId === task.assignedUserId
        
        console.log("Lade abgeschlossene Aufgaben...");
        
        // Abgeschlossene Aufgaben des aktuellen Benutzers
        const completedCreatedTasksQuery = query(
          collection(db, "tasks"),
          where("creatorId", "==", user.id),
          where("status", "==", "done")
        );
        
        // Zweite Abfrage für Aufgaben, deren Status "completed" ist (andere Schreibweise)
        const completedCreatedTasksQuery2 = query(
          collection(db, "tasks"),
          where("creatorId", "==", user.id),
          where("status", "==", "completed")
        );
        
        // Jetzt müssen wir auch abgeschlossene Aufgaben finden, bei denen der Benutzer ausgewählt wurde
        // d.h. er ist nicht der Ersteller, aber assignedUserId = user.id
        const completedAssignedTasksQuery = query(
          collection(db, "chats"),
          where("applicantId", "==", user.id),
          where("isSelected", "==", true)
        );
        
        try {
          // Alle Abfragen ausführen
          const [createdSnapshot1, createdSnapshot2, assignedChatsSnapshot] = await Promise.all([
            getDocs(completedCreatedTasksQuery),
            getDocs(completedCreatedTasksQuery2),
            getDocs(completedAssignedTasksQuery)
          ]);
          
          // Ergebnisse der eigen erstellten Aufgaben zusammenführen
          const allCreatedCompletedDocs = [...createdSnapshot1.docs, ...createdSnapshot2.docs];
          
          // Jetzt die Tasks finden, bei denen der Benutzer als Bewerber ausgewählt wurde
          const assignedTaskIds = assignedChatsSnapshot.docs.map(doc => doc.data().taskId);
          const assignedTasksPromises = assignedTaskIds.map(async taskId => {
            const taskDoc = await getDoc(doc(db, "tasks", taskId));
            
            if (!taskDoc.exists()) {
              return null;
            }
            
            const taskData = taskDoc.data();
            
            // Nur abgeschlossene Aufgaben berücksichtigen
            if (taskData.status !== 'done' && taskData.status !== 'completed') {
              return null;
            }
            
            return {
              docSnapshot: taskDoc,
              chatId: assignedChatsSnapshot.docs.find(doc => doc.data().taskId === taskId)?.id || null
            };
          });
          
          const assignedTasksResults = await Promise.all(assignedTasksPromises);
          
          // Zusammenführen aller abgeschlossenen Aufgaben (erstellt und zugewiesen)
          console.log(`Gefundene abgeschlossene Aufgaben: erstellt=${allCreatedCompletedDocs.length}, zugewiesen=${assignedTasksResults.filter(Boolean).length}`);
          
          // Zunächst die erstellten abgeschlossenen Aufgaben verarbeiten
          const createdCompletedTasks = await Promise.all(
            allCreatedCompletedDocs.map(async (docSnapshot: any) => {
              const taskData = docSnapshot.data();
              const taskId = docSnapshot.id;
              const isOwner = taskData.creatorId === user.id;
              
              // Falls der Benutzer nicht der Ersteller ist, prüfen ob er der Ausgewählte ist
              if (!isOwner) {
                // Chat finden, in dem der Benutzer der ausgewählte Bewerber ist
                const assignedChatQuery = query(
                  collection(db, "chats"),
                  where("taskId", "==", taskId),
                  where("applicantId", "==", user.id),
                  where("isSelected", "==", true)
                );
                
                const assignedChatSnapshot = await getDocs(assignedChatQuery);
                
                // Wenn kein Chat gefunden wurde, in dem der Benutzer ausgewählt ist, 
                // ist diese Aufgabe nicht relevant
                if (assignedChatSnapshot.empty) {
                  return null;
                }
              }
              
              return {
                id: taskId,
                ...taskData,
                ownerId: taskData.creatorId,
                type: 'created',
                timeInfo: taskData.timeInfo || { 
                  isFlexible: true, 
                  displayText: 'Zeitlich flexibel' 
                }
              };
            })
          );
          
          // Dann die Aufgaben verarbeiten, bei denen der Benutzer der Ausgewählte ist
          const assignedCompletedTasks = await Promise.all(
            assignedTasksResults.filter(Boolean).map(async (result: any) => {
              const taskDoc = result.docSnapshot;
              const taskData = taskDoc.data();
              const taskId = taskDoc.id;
              const chatId = result.chatId;
              
              return {
                id: taskId,
                ...taskData,
                ownerId: taskData.creatorId,
                chatId: chatId,
                type: 'assigned',
                timeInfo: taskData.timeInfo || { 
                  isFlexible: true, 
                  displayText: 'Zeitlich flexibel' 
                }
              };
            })
          );
          
          // Alle gültigen Aufgaben zusammenführen
          const allCompletedTasks = [...createdCompletedTasks.filter(Boolean), ...assignedCompletedTasks.filter(Boolean)];
          
          // Nach Datum sortieren (neueste zuerst)
          allCompletedTasks.sort((a, b) => {
            const dateA = a.completedAt ? a.completedAt.toDate().getTime() : (a.createdAt ? a.createdAt.toDate().getTime() : 0);
            const dateB = b.completedAt ? b.completedAt.toDate().getTime() : (b.createdAt ? b.createdAt.toDate().getTime() : 0);
            return dateB - dateA;
          });
          
          console.log(`Insgesamt ${allCompletedTasks.length} abgeschlossene Aufgaben gefunden`);
          
          setCompletedTasks(allCompletedTasks);
        } catch (error) {
          console.error("Fehler beim Laden der abgeschlossenen Aufgaben:", error);
          toast({
            title: "Fehler",
            description: "Die abgeschlossenen Aufgaben konnten nicht geladen werden.",
            variant: "destructive"
          });
          setCompletedTasks([]);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Fehler beim Laden der Aufgaben:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgaben konnten nicht geladen werden. Bitte versuche es erneut.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };
  
  // Navigiere zur Task-Detailseite
  const handleTaskClick = (taskId: string) => {
    setLocation(`/tasks/${taskId}`);
  };
  
  // Neuen Task erstellen
  const handleCreateTask = () => {
    setLocation('/tasks/new');
  };
  
  // Aufgabenkarten für unterschiedliche Tabs
  const renderTaskCards = (tasks: any[], mode: 'myTasks' | 'applications' | 'saved') => {
    if (loading) {
      return <TasksLoadingSkeleton />;
    }
    
    if (tasks.length === 0) {
      let emptyStateProps = {
        title: "Keine Aufgaben gefunden",
        message: "Es wurden keine passenden Aufgaben gefunden.",
        action: undefined,
        actionText: undefined
      };
      
      switch (activeTab) {
        case 'created':
          emptyStateProps = {
            title: t('tasks.noCreatedTasks'),
            message: t('tasks.noCreatedTasksDesc'),
            action: handleCreateTask,
            actionText: t('tasks.createFirstTask')
          };
          break;
        case 'applied':
          emptyStateProps = {
            title: "Keine Bewerbungen",
            message: "Du hast dich noch auf keine Aufgaben beworben. Entdecke passende Aufgaben in deiner Nähe.",
            action: () => setLocation('/discover'),
            actionText: "Aufgaben entdecken"
          };
          break;
        case 'completed':
          emptyStateProps = {
            title: "Keine abgeschlossenen Aufgaben",
            message: "Du hast noch keine Aufgaben abgeschlossen. Aufgaben werden hier angezeigt, sobald sie abgeschlossen sind.",
            action: undefined,
            actionText: undefined
          };
          break;
        case 'bookmarked':
          emptyStateProps = {
            title: "Keine gemerkten Aufgaben",
            message: "Du hast noch keine Aufgaben gespeichert. Speichere interessante Aufgaben, um sie später wiederzufinden.",
            action: () => setLocation('/discover'),
            actionText: "Aufgaben entdecken"
          };
          break;
      }
      
      return <EmptyState {...emptyStateProps} />;
    }
    
    return (
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            mode={mode}
            {...task}
            onApplyClick={handleTaskClick}
            extraData={mode === 'applications' ? {
              applicationStatus: task.applicationStatus,
              isAccepted: task.isAccepted,
              isRejected: task.isRejected,
              chatId: task.chatId
            } : undefined}
          />
        ))}
      </div>
    );
  };
  
  // Status-Badge für Bewerbungen
  const ApplicationStatusBadge = ({ status }: { status: string }) => {
    if (status === 'accepted') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" /> {t('tasks.status.accepted')}
        </Badge>
      );
    } else if (status === 'rejected') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-300">
          <XCircle className="w-3 h-3 mr-1" /> {t('tasks.status.rejected')}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <Clock className="w-3 h-3 mr-1" /> {t('tasks.status.inProgress')}
        </Badge>
      );
    }
  };
  
  const { t } = useTranslation();
  
  return (
    <div className="container max-w-3xl px-4 py-4 mx-auto">
      <h1 className="text-2xl font-bold mb-4">{t('common.myTasks')}</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="created">{t('tasks.created')}</TabsTrigger>
          <TabsTrigger value="applied">{t('tasks.applied')}</TabsTrigger>
          <TabsTrigger value="completed">{t('tasks.completed')}</TabsTrigger>
          <TabsTrigger value="bookmarked">{t('tasks.bookmarked')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="created" className="space-y-4">
          {renderTaskCards(createdTasks, 'myTasks')}
        </TabsContent>
        
        <TabsContent value="applied" className="space-y-4">
          {renderTaskCards(appliedTasks, 'applications')}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {renderTaskCards(completedTasks, 'myTasks')}
        </TabsContent>
        
        <TabsContent value="bookmarked" className="space-y-4">
          {renderTaskCards(bookmarkedTasks, 'saved')}
        </TabsContent>
      </Tabs>
    </div>
  );
}