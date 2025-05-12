/**
 * Zentrale Definition aller Routen der Anwendung
 * 
 * Diese Datei dient als Single Source of Truth für alle Navigations-Pfade
 * und hilft bei konsistenter Navigation und besserer Wartbarkeit.
 */

export const routes = {
  // Hauptseiten
  home: '/',
  login: '/login',
  tasks: '/tasks',
  taskSearch: '/search',
  myTasks: '/my-tasks',
  bookmarkedTasks: '/bookmarks',
  createTask: '/create-task',
  profile: '/profile',
  notifications: '/notifications',
  settings: '/settings',
  analytics: '/analytics',
  
  // Dynamische Routen
  task: (id: string) => `/task/${id}`,
  user: (id: string) => `/user/${id}`,
  messages: '/messages',
  chat: (id: string) => `/chat/${id}`,
  
  // Admin/Debug Routen
  storageConfig: '/storage-config',
};

/**
 * Typen für die verschiedenen Bereiche der App
 */
export type AppSection = 'discover' | 'myTasks' | 'messages' | 'profile' | 'create';

/**
 * Prüft, ob ein bestimmter Pfad zu einem Abschnitt der App gehört
 * 
 * @param path Der zu prüfende Pfad
 * @param section Der Abschnitt, zu dem der Pfad gehören könnte
 * @returns true, wenn der Pfad zu dem Abschnitt gehört
 */
export function isPathInSection(path: string, section: AppSection): boolean {
  switch(section) {
    case 'discover':
      return path === routes.tasks || path.startsWith('/tasks') || path.startsWith('/task/');
    case 'myTasks':
      return path === routes.myTasks || path === routes.bookmarkedTasks;
    case 'messages':
      return path === routes.messages || path.startsWith('/chat/');
    case 'profile':
      return path === routes.profile || path === routes.settings || path.startsWith('/user/');
    case 'create':
      return path === routes.createTask;
    default:
      return false;
  }
}

export default routes;