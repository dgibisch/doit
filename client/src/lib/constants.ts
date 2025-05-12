/**
 * Anwendungskonstanten für die DoIt-App
 */

// Task-Kategorien
export const TASK_CATEGORIES = [
  'Gartenarbeit',
  'Haushalt',
  'Umzug',
  'Transport',
  'Handwerk',
  'Computer & IT',
  'Nachhilfe',
  'Tierbetreuung',
  'Einkaufshilfe',
  'Sonstiges'
];

// Tageszeiten für Tasks
export const TIME_OPTIONS = [
  { id: 'morgens', label: 'Morgens', timeRange: '06:00–12:00' },
  { id: 'mittags', label: 'Mittags', timeRange: '12:00–17:00' },
  { id: 'abends', label: 'Abends', timeRange: '17:00–22:00' },
];

// Maximale Anzahl von Bildern pro Task
export const MAX_IMAGES = 5;

// Standard-Suchradius in Kilometern
export const DEFAULT_SEARCH_RADIUS = 5;

// Minimum Preis für Aufgaben
export const MIN_TASK_PRICE = 5;

// Maximum Preis für Aufgaben
export const MAX_TASK_PRICE = 100;