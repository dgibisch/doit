import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { taskApplicationService } from '@/lib/task-application-service';

interface TaskApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  taskCreatorId: string;
  taskCreatorName: string;
}

const TaskApplicationModal: React.FC<TaskApplicationModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  taskCreatorId,
  taskCreatorName
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein, um sich auf Aufgaben zu bewerben.',
        variant: 'destructive'
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Nachricht erforderlich',
        description: 'Bitte fügen Sie Ihrer Bewerbung eine Nachricht hinzu.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Verwenden Sie den taskApplicationService, um die Bewerbung zu erstellen
      const result = await taskApplicationService.applyForTask(
        taskId,
        taskTitle,
        taskCreatorId,
        taskCreatorName,
        message.trim(),
        0, // Preisfeld entfernt, daher 0 als Platzhalter
        user.id,
        user.name
      );

      toast({
        title: 'Bewerbung eingereicht',
        description: 'Chat mit dem Aufgabenersteller wird geöffnet...',
      });

      // Navigieren Sie zum Chat mit der neuen Chat-ID
      setLocation(`/chat/${result.chatId}`);
      onClose();
    } catch (err) {
      console.error('Error applying for task:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(errorMessage);
      toast({
        title: 'Bewerbung fehlgeschlagen',
        description: `Es gab einen Fehler beim Einreichen Ihrer Bewerbung: ${errorMessage}`,
        variant: 'destructive'
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Auf Aufgabe bewerben</DialogTitle>
          <DialogDescription>
            Senden Sie eine Nachricht an den Aufgabenersteller und erklären Sie, warum Sie der richtige für diese Aufgabe sind.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fehler bei der Bewerbung</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taskTitle">Aufgabe</Label>
            <Input id="taskTitle" value={taskTitle} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Bewerbungsnachricht</Label>
            <Textarea
              id="message"
              placeholder="Stellen Sie sich vor und erklären Sie, warum Sie an dieser Aufgabe interessiert sind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              required
            />
          </div>
          
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-100">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Neue Chat-basierte Bewerbung
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Ihre Bewerbung erstellt automatisch einen Chat mit dem Auftraggeber. Dort können Sie direkt kommunizieren und den gesamten Bewerbungsprozess abwickeln.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? 'Wird gesendet...' : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Bewerbung & Chat senden
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskApplicationModal;