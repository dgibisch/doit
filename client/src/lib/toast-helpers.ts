/**
 * Hilfs-Funktionen für Toast-Benachrichtigungen mit Übersetzung
 */
import { toast } from "../components/ui/use-toast";
import i18n from "./i18n";

/**
 * Zeigt eine Erfolgsmeldung mit übersetztem Titel und Beschreibung an
 */
export function showSuccessToast(titleKey: string, descriptionKey?: string, descriptionParams?: Record<string, string>) {
  toast({
    title: i18n.t(titleKey),
    description: descriptionKey ? i18n.t(descriptionKey, descriptionParams) : undefined,
    variant: "default",
  });
}

/**
 * Zeigt eine Fehlermeldung mit übersetztem Titel und Beschreibung an
 */
export function showErrorToast(titleKey: string, descriptionKey?: string, descriptionParams?: Record<string, string>) {
  toast({
    title: i18n.t(titleKey),
    description: descriptionKey ? i18n.t(descriptionKey, descriptionParams) : undefined,
    variant: "destructive",
  });
}

/**
 * Wandelt eine Fehlermeldung in einen übersetzten Text um, falls möglich
 * Falls es eine technische Fehlermeldung ist, die nicht übersetzt werden kann,
 * wird die Originalfehlermeldung zurückgegeben
 */
export function getTranslatedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Hier könnten in Zukunft bekannte Fehlercodes auf Übersetzungsschlüssel gemappt werden
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return i18n.t('unknownError');
}