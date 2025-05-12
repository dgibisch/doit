/**
 * Berechnet das Nutzerlevel basierend auf der Anzahl abgeschlossener Aufgaben
 * 
 * @param completedCount Die Anzahl der abgeschlossenen Aufgaben
 * @returns Ein Objekt mit Level-Nummer und Level-Namen
 */
export const getUserLevel = (completedCount: number) => {
  if (completedCount >= 100) return { level: 6, name: "🦄 Local Hero" };
  if (completedCount >= 50) return { level: 5, name: "🧙 Experte" };
  if (completedCount >= 20) return { level: 4, name: "🌟 Profi" };
  if (completedCount >= 10) return { level: 3, name: "🚀 Macher" };
  if (completedCount >= 5) return { level: 2, name: "🛠️ Helfer" };
  return { level: 1, name: "🐣 Anfänger" };
};

/**
 * Berechnet den Fortschritt innerhalb des aktuellen Levels als Prozentsatz
 * 
 * @param completedCount Die Anzahl der abgeschlossenen Aufgaben
 * @returns Ein Prozentsatz zwischen 0 und 100
 */
export const getLevelProgress = (completedCount: number) => {
  const currentLevel = getUserLevel(completedCount);
  
  // Level-Grenzwerte definieren
  const thresholds = [0, 5, 10, 20, 50, 100, Infinity];
  
  // Aktuelles und nächstes Level ermitteln
  const currentThreshold = thresholds[currentLevel.level - 1];
  const nextThreshold = thresholds[currentLevel.level];
  
  // Fortschritt berechnen
  const progress = ((completedCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  
  // Im höchsten Level (Local Hero) ist der Fortschritt immer 100%
  if (currentLevel.level === 6) return 100;
  
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * Gibt die benötigte Anzahl abgeschlossener Aufgaben für das nächste Level zurück
 * 
 * @param completedCount Die aktuelle Anzahl abgeschlossener Aufgaben
 * @returns Die Anzahl der benötigten Aufgaben für das nächste Level oder null, wenn das höchste Level erreicht ist
 */
export const getTasksToNextLevel = (completedCount: number) => {
  const currentLevel = getUserLevel(completedCount);
  
  // Bei maximaler Stufe gibt es kein nächstes Level
  if (currentLevel.level === 6) return null;
  
  // Level-Grenzwerte
  const thresholds = [5, 10, 20, 50, 100];
  
  // Nächstes Level berechnen
  const nextThreshold = thresholds[currentLevel.level - 1];
  
  return nextThreshold - completedCount;
};