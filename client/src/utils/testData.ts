import { 
  collection, 
  getDocs, 
  query, 
  where, 
  getFirestore, 
  doc,
  setDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { createUserProfile, createReview, updateUserProfile } from '@/lib/firebase';
import { User } from 'firebase/auth';

// Profil-Bilder URLs für Testbenutzer
const TEST_PROFILE_IMAGES = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&auto=format&fit=crop"
];

// Testbiographien
const TEST_BIOS = [
  "Hallo! Ich bin neu in der Gegend und freue mich, anderen zu helfen. In meiner Freizeit bin ich gerne draußen in der Natur und lerne neue Leute kennen.",
  "Seit Jahren helfe ich in meiner Nachbarschaft aus und möchte das jetzt auch über diese App tun. Ich kann besonders gut mit Technik und Handwerksarbeiten umgehen.",
  "Als Studentin bin ich zeitlich flexibel und helfe gerne bei verschiedenen Aufgaben. Besonders gut kann ich mit Kindern und Haustieren umgehen.",
  "Ich bin Rentner und habe viel Erfahrung im Gärtnern und bei Reparaturen. Freue mich, mein Wissen zu teilen und neue Kontakte zu knüpfen.",
  "Ich arbeite als Krankenpfleger und kann in meiner Freizeit gut bei Einkäufen oder Pflegeaufgaben helfen. Habe ein Auto und bin mobil in der ganzen Stadt."
];

// Testfähigkeiten
const TEST_SKILLS = [
  ["Heimwerken", "Möbelbau", "Technik-Hilfe"],
  ["Einkaufen", "Kochen", "Gartenarbeit"],
  ["Kinderbetreuung", "Haustierbetreuung", "Nachhilfe"],
  ["Gartenarbeit", "Heimwerken", "Fahrradreparatur"],
  ["Pflegehilfe", "Einkaufen", "Transport"]
];

// Testbenutzer mit Namen, E-Mail-Adresse und Kategorien
const TEST_USERS = [
  { 
    displayName: "Laura Meyer", 
    email: "laura.meyer@example.com", 
    preferredCategories: ["Errands", "Pet Care"] 
  },
  { 
    displayName: "Thomas Schmidt", 
    email: "thomas.schmidt@example.com",
    preferredCategories: ["Home Repair", "Technology"] 
  },
  { 
    displayName: "Sophie Wagner", 
    email: "sophie.wagner@example.com",
    preferredCategories: ["Pet Care", "Children Care"]
  },
  { 
    displayName: "Markus Becker", 
    email: "markus.becker@example.com",
    preferredCategories: ["Gardening", "Home Repair"]
  },
  { 
    displayName: "Nina Hoffmann", 
    email: "nina.hoffmann@example.com",
    preferredCategories: ["Errands", "Assistance"]
  }
];

// Testbewertungen (positive, negative und neutrale)
const TEST_REVIEWS = [
  {
    rating: 5,
    text: "Absolut zuverlässig und pünktlich. Hat die Aufgabe perfekt erledigt. Immer wieder gerne!"
  },
  {
    rating: 4,
    text: "Sehr freundlich und hilfsbereit. Die Aufgabe wurde gut erledigt, nur kleine Abstriche."
  },
  {
    rating: 3,
    text: "War ok, hat die Aufgabe erledigt, aber die Kommunikation könnte besser sein."
  },
  {
    rating: 5,
    text: "Hervorragende Arbeit! Sehr gründlich und hat sogar mehr getan als vereinbart."
  },
  {
    rating: 2,
    text: "Ist zu spät gekommen und wirkte etwas unorganisiert. Die Aufgabe wurde nur teilweise erledigt."
  },
  {
    rating: 5,
    text: "Sehr professionell und freundlich. Würde ich sofort wieder beauftragen!"
  },
  {
    rating: 4,
    text: "Gute Arbeit und nette Person. Kleine Zeitverzögerung, ansonsten super."
  }
];

// Testaufgaben für Bewertungen
const TEST_TASKS = [
  { title: "Hilfe beim Umzug", category: "Home Repair" },
  { title: "Einkauf für ältere Nachbarin", category: "Errands" },
  { title: "Hund ausführen am Nachmittag", category: "Pet Care" },
  { title: "Gartenarbeit und Rasenmähen", category: "Gardening" },
  { title: "PC-Installation und WLAN einrichten", category: "Technology" },
  { title: "Babysitten am Wochenende", category: "Children Care" },
  { title: "Fahrt zum Arzttermin", category: "Assistance" }
];

/**
 * Prüft, ob bereits Testbenutzer in der Datenbank vorhanden sind
 */
export const checkIfTestUsersExist = async (): Promise<boolean> => {
  const db = getFirestore();
  const usersRef = collection(db, "users");
  
  // Nach einem Testbenutzer suchen
  const testUserQuery = query(usersRef, where("email", "==", TEST_USERS[0].email));
  const snapshot = await getDocs(testUserQuery);
  
  return !snapshot.empty;
};

/**
 * Erstellt einen einzelnen Testbenutzer und gibt seine ID zurück
 */
const createTestUser = async (userData: typeof TEST_USERS[0], index: number) => {
  const db = getFirestore();
  
  // Erstelle ein Firebase-Auth-ähnliches Nutzerobjekt
  const fakeAuthUser = {
    uid: `test-user-${Date.now()}-${index}`,
    email: userData.email,
    displayName: userData.displayName
  } as User;
  
  // Erstelle das Benutzerprofil
  const userRef = await createUserProfile(fakeAuthUser, {
    photoURL: TEST_PROFILE_IMAGES[index % TEST_PROFILE_IMAGES.length],
    bio: TEST_BIOS[index % TEST_BIOS.length],
    skills: TEST_SKILLS[index % TEST_SKILLS.length],
    completedTasks: Math.floor(Math.random() * 10) + 2,
    postedTasks: Math.floor(Math.random() * 8) + 1,
    // Füge eine anfängliche Bewertung hinzu
    rating: 4.0 + (Math.random() * 1.0), // 4.0-5.0 Bewertung
    ratingCount: Math.floor(Math.random() * 5) + 3
  });
  
  return fakeAuthUser.uid;
};

/**
 * Erstellt Testbewertungen für einen Benutzer
 */
const createTestReviewsForUser = async (userId: string, createdUserIds: string[]) => {
  // Zufällige Anzahl von Bewertungen (2-5) für jeden Benutzer
  const numReviews = Math.floor(Math.random() * 4) + 2;
  
  for (let i = 0; i < numReviews; i++) {
    // Wähle einen zufälligen Autor aus den anderen Testbenutzern
    const authorIndex = Math.floor(Math.random() * createdUserIds.length);
    const authorId = createdUserIds[authorIndex];
    
    // Überspringe, wenn der Autor der gleiche Benutzer ist
    if (authorId === userId) continue;
    
    // Wähle eine zufällige Bewertung und Aufgabe
    const reviewIndex = Math.floor(Math.random() * TEST_REVIEWS.length);
    const taskIndex = Math.floor(Math.random() * TEST_TASKS.length);
    
    // Erstelle die Bewertung
    await createReview({
      userId,
      authorId,
      taskId: `fake-task-${Date.now()}-${i}`,
      taskTitle: TEST_TASKS[taskIndex].title,
      rating: TEST_REVIEWS[reviewIndex].rating,
      text: TEST_REVIEWS[reviewIndex].text
    });
  }
};

/**
 * Erstellt einen vollständigen Satz von Testbenutzern mit Profilen und Bewertungen
 */
export const createTestUsers = async (): Promise<void> => {
  try {
    console.log("Erstelle Testbenutzer...");
    
    // Prüfe, ob bereits Testbenutzer existieren
    const testUsersExist = await checkIfTestUsersExist();
    if (testUsersExist) {
      console.log("Testbenutzer sind bereits vorhanden. Überspringe Erstellung.");
      return;
    }
    
    // Erstelle nacheinander alle Testbenutzer
    const createdUserIds: string[] = [];
    
    for (let i = 0; i < TEST_USERS.length; i++) {
      const userId = await createTestUser(TEST_USERS[i], i);
      createdUserIds.push(userId);
      console.log(`Testbenutzer erstellt: ${TEST_USERS[i].displayName}`);
    }
    
    // Erstelle Bewertungen für jeden Benutzer 
    // (nachdem alle Benutzer erstellt wurden, damit sie sich gegenseitig bewerten können)
    for (const userId of createdUserIds) {
      await createTestReviewsForUser(userId, createdUserIds);
    }
    
    console.log("Alle Testbenutzer und Bewertungen wurden erfolgreich erstellt!");
  } catch (error) {
    console.error("Fehler beim Erstellen der Testbenutzer:", error);
  }
};

// Testaufgabeninhalte für die Erstellung von Testaufgaben
const TEST_TASK_CONTENT = [
  {
    title: "Hilfe beim Umzug benötigt",
    description: "Ich ziehe am Wochenende um und brauche Hilfe beim Tragen von Möbeln und Kisten. Es sind etwa 3-4 Stunden Arbeit.",
    category: "Home Repair",
    price: 25
  },
  {
    title: "Einkauf für ältere Nachbarin",
    description: "Meine Nachbarin (78) braucht jemanden, der für sie einkaufen geht. Es handelt sich um einen normalen Wocheneinkauf.",
    category: "Errands",
    price: 15
  },
  {
    title: "Hund ausführen am Nachmittag",
    description: "Suche jemanden, der meinen freundlichen Labrador am Nachmittag für 30-45 Minuten ausführt. Er ist gut erzogen und liebt lange Spaziergänge.",
    category: "Pet Care",
    price: 12
  },
  {
    title: "Gartenarbeit und Rasenmähen",
    description: "Mein Garten braucht etwas Pflege. Es geht um Rasenmähen, Unkraut jäten und allgemeine Aufräumarbeiten.",
    category: "Gardening",
    price: 20
  },
  {
    title: "PC-Installation und WLAN einrichten",
    description: "Ich habe einen neuen PC gekauft und brauche Hilfe bei der Einrichtung sowie bei der Konfiguration meines WLAN-Netzwerks.",
    category: "Technology",
    price: 30
  },
  {
    title: "Babysitten am Wochenende",
    description: "Suche einen zuverlässigen Babysitter für meine 4-jährige Tochter am Samstagabend von 18-22 Uhr.",
    category: "Children Care",
    price: 18
  },
  {
    title: "Fahrt zum Arzttermin",
    description: "Ich benötige eine Fahrt zu einem Arzttermin und zurück am Mittwochmorgen. Ich bin gehbehindert und brauche etwas Unterstützung.",
    category: "Assistance",
    price: 22
  }
];

/**
 * Erstellt Testaufgaben im System
 */
export const createTestTasks = async (): Promise<{ success: boolean, message: string }> => {
  try {
    const db = getFirestore();
    
    // Prüfe, ob es bereits Testbenutzer gibt
    const testUsersExist = await checkIfTestUsersExist();
    if (!testUsersExist) {
      console.log("Keine Testbenutzer vorhanden. Erstelle zuerst Testbenutzer.");
      await createTestUsers();
    }
    
    // Suche nach Testbenutzern
    const usersRef = collection(db, "users");
    const testUsersQuery = query(usersRef, where("email", "==", TEST_USERS[0].email));
    const testUserSnapshot = await getDocs(testUsersQuery);
    
    if (testUserSnapshot.empty) {
      return { 
        success: false, 
        message: "Konnte keine Testbenutzer finden. Bitte erstelle zuerst Testbenutzer." 
      };
    }
    
    // Alle Testbenutzer abrufen
    const testUserIds: string[] = [];
    for (const testUser of TEST_USERS) {
      const userQuery = query(usersRef, where("email", "==", testUser.email));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        testUserIds.push(userSnapshot.docs[0].id);
      }
    }
    
    if (testUserIds.length === 0) {
      return { 
        success: false, 
        message: "Keine Testbenutzer-IDs gefunden." 
      };
    }
    
    // Prüfe, ob bereits Testaufgaben existieren
    const tasksRef = collection(db, "tasks");
    const tasksSnapshot = await getDocs(tasksRef);
    
    if (!tasksSnapshot.empty) {
      console.log("Es existieren bereits Aufgaben. Überspringe Erstellung von Testaufgaben.");
      return { 
        success: true, 
        message: "Es existieren bereits Aufgaben. Keine neuen Testaufgaben erstellt." 
      };
    }
    
    // Erstelle Testaufgaben
    for (let i = 0; i < TEST_TASK_CONTENT.length; i++) {
      const taskData = TEST_TASK_CONTENT[i];
      // Wähle einen zufälligen Benutzer als Ersteller
      const creatorIndex = Math.floor(Math.random() * testUserIds.length);
      const creatorId = testUserIds[creatorIndex];
      
      // Erstelle eine neue Aufgabe
      await addDoc(tasksRef, {
        title: taskData.title,
        description: taskData.description,
        category: taskData.category,
        creatorId: creatorId,
        price: taskData.price,
        status: "open",
        createdAt: serverTimestamp(),
        location: {
          lat: 52.520008 + (Math.random() * 0.1 - 0.05), // Berlin approx
          lng: 13.404954 + (Math.random() * 0.1 - 0.05)
        }
      });
      
      console.log(`Testaufgabe erstellt: ${taskData.title}`);
    }
    
    return { 
      success: true, 
      message: `${TEST_TASK_CONTENT.length} Testaufgaben wurden erfolgreich erstellt.` 
    };
  } catch (error) {
    console.error("Fehler beim Erstellen der Testaufgaben:", error);
    return { 
      success: false, 
      message: `Fehler beim Erstellen der Testaufgaben: ${error}` 
    };
  }
};