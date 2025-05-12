import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword as firebaseSignInWithEmail, 
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, createUserProfile, getUserProfile } from '@/lib/firebase';

/**
 * Vereinfachte User-Schnittstelle, die direkt die Felder des Firebase-Users verwendet
 * Wir vermeiden die Konvertierung und Umbenennung, um Kompatibilitätsprobleme zu vermeiden
 */
// Verwende die globale User-Definition

// Verwende die global definierte UserProfile Schnittstelle

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshUserProfile: async () => {},
});

// Helper to convert Firebase user to our User type
const mapFirebaseUser = (firebaseUser: FirebaseUser): User => {
  return {
    uid: firebaseUser.uid,
    id: firebaseUser.uid, // Backward compatibility
    displayName: firebaseUser.displayName,
    name: firebaseUser.displayName, // Backward compatibility
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    avatarUrl: undefined // Wird später aus dem Benutzerprofil ergänzt
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for Firebase auth state changes
  useEffect(() => {
    console.log('Setting up Firebase auth listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('Firebase user authenticated:', firebaseUser.email);
          // User is signed in
          const mappedUser = mapFirebaseUser(firebaseUser);
          setUser(mappedUser);
          
          // Get user profile from Firestore
          try {
            console.log('Loading user profile for:', firebaseUser.uid);
            const userProfile = await getUserProfile(firebaseUser.uid);
            if (userProfile) {
              console.log('Found existing user profile');
              
              // Setze das Profil
              setProfile(userProfile as UserProfile);
              
              // Aktualisiere auch das User-Objekt mit den Profildaten
              // Besonders wichtig: avatarUrl, avatarBase64 und photoURL aus dem Profil
              const enhancedUser = {
                ...mappedUser,
                avatarUrl: userProfile.avatarUrl || userProfile.photoURL,
                avatarBase64: userProfile.avatarBase64 || userProfile.avatarUrl
              };
              
              // Aktualisiere den Benutzer mit diesen zusätzlichen Daten
              setUser(enhancedUser);
              
            } else {
              console.log('Creating new user profile');
              // Create a new profile if one doesn't exist
              const newProfile: UserProfile = {
                uid: mappedUser.uid,
                displayName: mappedUser.displayName || mappedUser.email?.split('@')[0] || 'User',
                email: mappedUser.email || '',
                photoURL: mappedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(mappedUser.displayName || 'User')}`,
                completedTasks: 0,
                postedTasks: 0,
                rating: 0,
                ratingCount: 0,
                skills: [],
              };
              
              await createUserProfile(firebaseUser, newProfile);
              setProfile(newProfile);
            }
          } catch (profileError) {
            console.error('Error loading user profile:', profileError);
          }
        } else {
          // User is signed out
          console.log('No user signed in');
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });
    
    // Clean up the listener
    return () => {
      console.log('Cleaning up Firebase auth listener');
      unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('Signing in with email:', email);
      await firebaseSignInWithEmail(auth, email, password);
      console.log('Sign in successful');
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      console.log('Signing out');
      await firebaseSignOut(auth);
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Refresh user profile from Firebase
  const refreshUserProfile = async () => {
    if (user) {
      try {
        console.log('Refreshing user profile for:', user.uid);
        
        // Profilaktualisierung forcieren durch Setzen eines Flags
        const forceRefresh = true;
        const userProfileData = await getUserProfile(user.uid, forceRefresh);
        
        if (userProfileData) {
          console.log('User profile refreshed, new data:', userProfileData);
          
          // Sicherstellen, dass das Profil wirklich aktualisiert wurde
          const updatedProfile = {
            ...userProfileData,
            uid: user.uid, // Stelle sicher, dass uid immer gesetzt ist
          } as UserProfile;
          
          // Aktualisiere das UI
          setProfile(updatedProfile);
          
          // Firebase Auth Profil aktualisieren
          if (auth.currentUser) {
            console.log('Updating auth profile display name:', userProfileData.displayName);
            try {
              // Importiere die updateProfile-Funktion und wende sie auf currentUser an
              const { updateProfile } = await import('firebase/auth');
              
              // Prüfe ob die photoURL ein Base64-String ist und zu lang
              let photoURLToUse = userProfileData.photoURL || null;
              
              // Wenn es ein Base64-String ist oder zu lang, verwende einen Fallback-Avatar
              if (photoURLToUse && (
                  photoURLToUse.startsWith('data:image') || 
                  photoURLToUse.length > 500
              )) {
                console.log('PhotoURL ist Base64 oder zu lang, verwende UI-Avatars-URL stattdessen');
                // Alternativen Placeholder verwenden (ui-avatars.com generiert Avatare aus Namen)
                const name = userProfileData.displayName || 'User';
                photoURLToUse = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
              }
              
              await updateProfile(auth.currentUser, {
                displayName: userProfileData.displayName || null,
                photoURL: photoURLToUse
              });
              
              // Aktualisiere auch den user-Zustand
              const updatedUser = mapFirebaseUser(auth.currentUser);
              setUser(updatedUser);
              
              console.log('Auth user profile also updated');
            } catch (authUpdateError) {
              console.error('Failed to update auth user profile:', authUpdateError);
              // Trotz Fehler weitermachen - nur eine Warnung anzeigen
            }
          }
        } else {
          console.error('Unable to refresh user profile: No profile data returned');
        }
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    } else {
      console.error('Cannot refresh profile: No user is signed in');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile: profile, 
      loading, 
      signIn, 
      signOut,
      refreshUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);