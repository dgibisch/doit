import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { chatService, type Chat, type ChatMessage } from '@/lib/chat-service';
import { useToast } from '@/hooks/use-toast';

export function useChat(chatId?: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);

  // Load chat data
  useEffect(() => {
    if (!chatId || !user?.id) return;

    let chatUnsubscribe: () => void = () => {};
    let messagesUnsubscribe: () => void = () => {};
    
    try {
      setLoading(true);
      setError(null);

      // Subscribe to chat updates
      chatUnsubscribe = chatService.getChat(
        chatId,
        (chatData) => {
          setChat(chatData);
          setLoading(false);
        },
        (err) => {
          console.error('Failed to load chat:', err);
          setError(err);
          setLoading(false);
          toast({
            title: 'Fehler beim Laden des Chats',
            description: `${err.message}. Bitte versuchen Sie es später erneut.`,
            variant: 'destructive',
          });
        }
      );

      // Subscribe to messages updates
      messagesUnsubscribe = chatService.getChatMessages(
        chatId,
        (messagesData) => {
          setMessages(messagesData);
        },
        (err) => {
          console.error('Failed to load messages:', err);
          setError(err);
          toast({
            title: 'Fehler beim Laden der Nachrichten',
            description: `${err.message}. Bitte versuchen Sie es später erneut.`,
            variant: 'destructive',
          });
        }
      );

      // Mark messages as read when chat is opened
      if (user?.id) {
        chatService.markMessagesAsRead(chatId, user.id).catch(err => {
          console.error('Failed to mark messages as read:', err);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unbekannter Fehler beim Laden des Chats');
      console.error('Error in useChat effect:', error);
      setError(error);
      setLoading(false);
      toast({
        title: 'Fehler beim Laden des Chats',
        description: `${error.message}. Bitte versuchen Sie es später erneut.`,
        variant: 'destructive',
      });
    }

    // Clean up subscriptions
    return () => {
      chatUnsubscribe();
      messagesUnsubscribe();
    };
  }, [chatId, user?.id, toast]);

  // Function to send a message
  const sendMessage = useCallback(async (content: string, imageData?: string) => {
    if (!chatId || !user?.id || (!content.trim() && !imageData)) {
      return;
    }

    setSending(true);
    try {
      // Bestimmen, ob imageData eine URL oder Base64-String ist
      let imageUrl: string | undefined = undefined;
      let imageBase64: string | undefined = undefined;
      
      if (imageData) {
        // Wenn der String mit "data:" beginnt, ist es ein Base64-String
        if (imageData.startsWith('data:')) {
          imageBase64 = imageData;
        } else {
          imageUrl = imageData;
        }
      }
      
      // Sende die Nachricht mit richtiger Bildunterstützung
      await chatService.sendMessage(chatId, content, user.id, user.name, imageUrl, imageBase64);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unbekannter Fehler beim Senden der Nachricht');
      console.error('Failed to send message:', error);
      setError(error);
      toast({
        title: 'Fehler beim Senden der Nachricht',
        description: `${error.message}. Bitte versuchen Sie es später erneut.`,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }, [chatId, user?.id, user?.name, toast]);

  // Bewerber auswählen (für Task-Ersteller)
  const selectApplicant = useCallback(async () => {
    if (!chatId || !chat || !user?.id) {
      return;
    }

    try {
      // Nur für Task-Ersteller erlaubt
      if (chat.taskCreatorId !== user.id) {
        throw new Error('Nur der Task-Ersteller kann Bewerber auswählen');
      }
      
      await chatService.selectApplicantForTask(chatId);
      toast({
        title: 'Bewerber ausgewählt',
        description: 'Der Bewerber wurde erfolgreich für diesen Task ausgewählt.',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unbekannter Fehler bei der Auswahl des Bewerbers');
      console.error('Failed to select applicant:', error);
      toast({
        title: 'Fehler bei der Auswahl des Bewerbers',
        description: `${error.message}. Bitte versuchen Sie es später erneut.`,
        variant: 'destructive',
      });
    }
  }, [chatId, chat, user?.id, toast]);
  
  // Bewerber ablehnen (für Task-Ersteller)
  const rejectApplicant = useCallback(async () => {
    if (!chatId || !chat || !user?.id) {
      return;
    }

    try {
      // Nur für Task-Ersteller erlaubt
      if (chat.taskCreatorId !== user.id) {
        throw new Error('Nur der Task-Ersteller kann Bewerber ablehnen');
      }
      
      await chatService.rejectApplicant(chatId);
      toast({
        title: 'Bewerber abgelehnt',
        description: 'Der Bewerber wurde für diesen Task abgelehnt.',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unbekannter Fehler bei der Ablehnung des Bewerbers');
      console.error('Failed to reject applicant:', error);
      toast({
        title: 'Fehler bei der Ablehnung des Bewerbers',
        description: `${error.message}. Bitte versuchen Sie es später erneut.`,
        variant: 'destructive',
      });
    }
  }, [chatId, chat, user?.id, toast]);

  // Auswahl bestätigen (für Bewerber)
  const confirmSelection = useCallback(async () => {
    if (!chatId || !chat || !user?.id) {
      return;
    }

    try {
      // Nur für ausgewählte Bewerber erlaubt
      if (chat.applicantId !== user.id) {
        throw new Error('Nur der ausgewählte Bewerber kann die Auswahl bestätigen');
      }
      
      await chatService.confirmTaskSelection(chatId);
      toast({
        title: 'Auswahl bestätigt',
        description: 'Du hast die Auswahl für diesen Task bestätigt. Der Task ist jetzt in Bearbeitung.',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unbekannter Fehler bei der Bestätigung');
      console.error('Failed to confirm selection:', error);
      toast({
        title: 'Fehler bei der Bestätigung',
        description: `${error.message}. Bitte versuchen Sie es später erneut.`,
        variant: 'destructive',
      });
    }
  }, [chatId, chat, user?.id, toast]);

  // Task als abgeschlossen markieren (für Bewerber)
  const markTaskCompleted = useCallback(async () => {
    if (!chatId || !chat || !user?.id) {
      return;
    }

    try {
      if (chat.applicantId === user.id) {
        // Bewerber markiert den Task als abgeschlossen
        await chatService.applicantMarkTaskAsCompleted(chatId);
        toast({
          title: 'Task als abgeschlossen markiert',
          description: 'Du hast den Task als abgeschlossen markiert. Warte auf die Bestätigung durch den Auftraggeber.',
        });
      } else if (chat.taskCreatorId === user.id) {
        // Task-Ersteller markiert den Task als abgeschlossen
        await chatService.markTaskAsCompleted(chatId);
        toast({
          title: 'Task als abgeschlossen markiert',
          description: 'Du hast den Task als abgeschlossen markiert. Der Task ist jetzt erledigt.',
        });
      } else {
        throw new Error('Nur der Auftraggeber oder der ausgewählte Bewerber können den Task als abgeschlossen markieren');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unbekannter Fehler beim Markieren des Tasks als abgeschlossen');
      console.error('Failed to mark task as completed:', error);
      toast({
        title: 'Fehler beim Markieren des Tasks als abgeschlossen',
        description: `${error.message}. Bitte versuchen Sie es später erneut.`,
        variant: 'destructive',
      });
    }
  }, [chatId, chat, user?.id, toast]);

  return {
    chat,
    messages,
    loading,
    error,
    sending,
    sendMessage,
    selectApplicant,
    rejectApplicant,
    confirmSelection,
    markTaskCompleted,
  };
}

export function useUserChats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setChats([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    // Subscribe to user's chats
    const unsubscribe = chatService.getUserChats(
      user.id,
      (chatsData) => {
        setChats(chatsData);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load user chats:', err);
        setError(err);
        setLoading(false);
        toast({
          title: 'Fehler beim Laden der Chats',
          description: `${err.message}. Bitte versuchen Sie es später erneut.`,
          variant: 'destructive',
        });
      }
    );

    return () => unsubscribe();
  }, [user?.id, toast]);

  return {
    chats,
    loading,
    error,
  };
}