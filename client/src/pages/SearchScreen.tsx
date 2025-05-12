import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Search, 
  X
} from 'lucide-react';
import { getTasks, saveSearchQuery, getRecentSearches } from '@/lib/firebase';
import TaskCard from '@/components/TaskCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

// Fallback beliebte Suchanfragen für neue Benutzer ohne Suchverlauf
const defaultSearches = [
  { id: 'babysitter', query: 'Babysitter', category: 'Childcare' },
  { id: 'fahrrad', query: 'Fahrrad', category: 'Errands' },
  { id: 'putzhilfe', query: 'Putzhilfe', category: 'Cleaning' },
  { id: 'hundesitting', query: 'Hundesitting', category: 'Pet Care' },
  { id: 'nachhilfe', query: 'Nachhilfe', category: 'Education' },
  { id: 'malerarbeiten', query: 'Malerarbeiten', category: 'Home Repair' },
  { id: 'flohmarkt', query: 'Flohmarkt', category: 'Shopping' },
  { id: 'kinder', query: 'Kinder', category: 'Childcare' },
];

// Konstanten für Kategorien
const categories = [
  { id: 'all', label: 'Alle Kategorien' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'pet-care', label: 'Pet Care' },
  { id: 'home-repair', label: 'Home Repair' },
  { id: 'technology', label: 'Technology' },
  { id: 'errands', label: 'Errands' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'childcare', label: 'Childcare' },
  { id: 'education', label: 'Education' },
  { id: 'shopping', label: 'Shopping' },
];

// Diese Komponente verwendet keine Sortieroptionen mehr

const SearchScreen = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [loadingSearches, setLoadingSearches] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Vereinfachte Suche ohne Filter

  // Vereinfachte Suchen-Funktion ohne Filter
  const handleSearch = async (query: string = searchQuery, categoryOverride?: string) => {
    setIsLoading(true);
    
    try {
      // Firebase-Abfrage durchführen - IMMER ALLE TASKS HOLEN
      const tasks = await getTasks({});
      
      // Lokale Filterung nur nach Suchtext
      let filteredTasks = tasks;
      
      // Nach Suchbegriff filtern - NUR WENN QUERY VORHANDEN
      if (query && query.trim()) {
        const queryLower = query.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
          task.title.toLowerCase().includes(queryLower) || 
          task.description.toLowerCase().includes(queryLower)
        );
      }
      
      // Standardmäßig nach Datum sortieren (neueste zuerst)
      filteredTasks.sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });
      
      setSearchResults(filteredTasks);
      
      // Toastmeldung, wenn keine Ergebnisse UND eine Suchanfrage vorhanden ist
      if (filteredTasks.length === 0 && query && query.trim()) {
        toast({
          title: "Keine Ergebnisse",
          description: "Zu deiner Suche wurden keine passenden Aufgaben gefunden.",
        });
      }
    } catch (error) {
      console.error("Fehler bei der Suche:", error);
      toast({
        variant: "destructive",
        title: "Fehler bei der Suche",
        description: "Ein Fehler ist aufgetreten. Bitte versuche es später noch einmal.",
      });
    } finally {
      setIsLoading(false);
    }
  };



  // Funktion zum Laden der letzten Suchanfragen aus Firebase oder Fallback
  const loadRecentSearches = async () => {
    try {
      setLoadingSearches(true);
      
      // Versuchen, Suchanfragen aus Firebase zu laden
      try {
        const userId = user?.id || null;
        const searches = await getRecentSearches(userId);
        console.log("Geladene Suchanfragen:", searches.length);
        
        if (searches.length > 0) {
          setRecentSearches(searches);
        } else {
          // Wenn keine Firebase-Daten gefunden wurden, prüfen wir den localStorage als Backup
          const searchesJson = localStorage.getItem('recentSearches');
          if (searchesJson) {
            const localSearches = JSON.parse(searchesJson);
            console.log("Suchanfragen aus localStorage geladen:", localSearches.length);
            setRecentSearches(localSearches);
          } else {
            console.log("Keine Suchanfragen gefunden");
            setRecentSearches([]);
          }
        }
      } catch (searchError) {
        console.error('Fehler beim Laden der Suchanfragen:', searchError);
        setRecentSearches([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der letzten Suchanfragen:', error);
    } finally {
      setLoadingSearches(false);
    }
  };

  // Suchanfrage aktualisieren und in der History speichern
  const executeSearch = async (query: string, category: string = 'all') => {
    // Suchbegriff setzen
    setSearchQuery(query);
    setSelectedCategory(category);
    
    // Suche durchführen
    handleSearch(query, category);
    
    // Suchanfrage in der History speichern und dann neu laden
    if (query.trim()) {
      try {
        console.log('Speichere Suchanfrage im localStorage:', query);
        
        // Generiere eine eindeutige ID für die Suchanfrage
        const searchId = Date.now().toString();
        
        // Aktuelle Sucheinträge laden
        let existingSearches = [];
        const existingJson = localStorage.getItem('recentSearches');
        
        if (existingJson) {
          existingSearches = JSON.parse(existingJson);
        }
        
        // Neue Suchanfrage vorne hinzufügen (max. 10 speichern)
        const newSearch = {
          id: searchId,
          query: query,
          category: category || 'all',
          timestamp: new Date().toISOString()
        };
        
        // Prüfen, ob die Suchanfrage bereits existiert (um Dopplung zu vermeiden)
        const existingIndex = existingSearches.findIndex(s => s.query.toLowerCase() === query.toLowerCase());
        
        if (existingIndex !== -1) {
          // Lösche die existierende Suchanfrage
          existingSearches.splice(existingIndex, 1);
        }
        
        // Füge neue Suchanfrage am Anfang hinzu
        existingSearches.unshift(newSearch);
        
        // Limite auf 10 Einträge
        if (existingSearches.length > 10) {
          existingSearches = existingSearches.slice(0, 10);
        }
        
        // Speichere im localStorage
        localStorage.setItem('recentSearches', JSON.stringify(existingSearches));
        
        // Nach dem Speichern die aktuellen Suchanfragen neu laden
        loadRecentSearches();
        
        // Trotzdem in Firebase speichern, falls es funktioniert
        if (user?.id) {
          try {
            await saveSearchQuery(user.id, query, category);
          } catch (firebaseError) {
            console.error("Fehler beim Speichern in Firebase:", firebaseError);
          }
        }
      } catch (error) {
        console.error("Fehler beim Speichern der Suchanfrage:", error);
      }
    }
  };

  // Kategoriefilter ändern (vereinfacht)
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    executeSearch(searchQuery, category);
  };

  // Automatische Suche bei Seitenaufruf und letzte Suchanfragen laden
  useEffect(() => {
    executeSearch('', 'all');
    
    // Immer Suchanfragen laden, auch für anonyme Benutzer
    loadRecentSearches();
  }, [user]);

  // Fokus auf Suchinput setzen
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Task-Karte anklicken
  const handleTaskClick = (taskId: string) => {
    navigate(`/task/${taskId}`);
  };

  // Zurück-Button - zur Aufgabenübersicht statt zur Login-Seite
  const handleBack = () => {
    navigate('/tasks');
  };

  // Aufgabe bewerben-Funktion
  const handleApplyClick = (taskId: string) => {
    navigate(`/task/${taskId}`);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-white flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={handleBack} className="text-gray-700">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold flex-1 text-center">Suche</h1>
      </div>
      
      {/* Suchleiste */}
      <div className="p-4 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Suchbegriff eingeben..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              setLoadingSearches(false);
              setShowDropdown(true);
            }}
            onBlur={(e) => {
              // Kurze Verzögerung, damit der Klick auf ein Dropdown-Element verarbeitet werden kann
              setTimeout(() => setShowDropdown(false), 200);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                executeSearch(searchQuery, selectedCategory);
                setShowDropdown(false);
              }
            }}
            className="pl-10 pr-10 py-2"
          />
          {searchQuery && (
            <button 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              onClick={() => {
                setSearchQuery('');
                executeSearch('', 'all');
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {/* Dropdown für letzte Suchanfragen */}
          {showDropdown && !searchQuery && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-md shadow-md z-20 max-h-64 overflow-y-auto">
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Letzte Suchanfragen</h3>
                {loadingSearches ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="p-2 bg-gray-50 rounded">
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentSearches.length > 0 ? (
                      recentSearches.slice(0, 5).map(search => (
                        <button
                          key={search.id}
                          className="flex items-center w-full gap-2 p-2 hover:bg-gray-50 rounded text-left"
                          onClick={() => {
                            executeSearch(search.query, search.category);
                            setShowDropdown(false);
                          }}
                          onMouseDown={(e) => {
                            // Verhindert, dass onBlur des Input-Feldes ausgelöst wird
                            e.preventDefault();
                          }}
                        >
                          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{search.query}</span>
                          {search.category !== 'all' && (
                            <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {search.category}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-2">
                        Keine Suchanfragen gefunden
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        

      </div>
      
      {/* Keine permanente Anzeige von Suchanfragen mehr - nur im Dropdown */}
      
      {/* Suchergebnisse */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          // Lade-Zustand
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-16 w-16 rounded-md" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-1" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : searchResults.length > 0 ? (
          // Ergebnisliste
          <div className="space-y-4">
            {searchResults.map(task => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                description={task.description}
                category={task.category}
                creatorName={task.creatorName}
                creatorId={task.creatorId}
                creatorPhotoURL={task.creatorPhotoURL}
                creatorRating={task.creatorRating}
                createdAt={task.createdAt}
                distance={task.distance || 5}
                imageUrl={task.imageUrl}
                imageUrls={task.imageUrls}
                price={task.price}
                commentCount={task.commentCount}
                onApplyClick={handleApplyClick}
              />
            ))}
          </div>
        ) : searchQuery ? (
          // Keine Ergebnisse mit Suchbegriff
          <div className="text-center py-8">
            <p className="text-gray-500">Keine Ergebnisse für "{searchQuery}"</p>
            <p className="text-gray-400 text-sm mt-1">Versuche einen anderen Suchbegriff oder Filter</p>
          </div>
        ) : null}
      </div>
      

    </div>
  );
};

export default SearchScreen;