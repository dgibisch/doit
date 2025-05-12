import { useLocation } from 'wouter';

/**
 * Navigation-Hook für einheitliche Navigation innerhalb der App
 */
export const useNavigation = () => {
  const [location, navigate] = useLocation();

  /**
   * Navigiert zur vorherigen Seite oder zur Startseite
   */
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  };

  /**
   * Navigiert zum Detail einer Aufgabe
   * @param taskId ID der Aufgabe
   */
  const navigateToTask = (taskId: string) => {
    navigate(`/task/${taskId}`);
  };

  /**
   * Navigiert zum Chat
   * @param chatId ID des Chats
   */
  const navigateToChat = (chatId: string) => {
    navigate(`/chat/${chatId}`);
  };

  /**
   * Navigiert zum Benutzerprofil
   * @param userId ID des Benutzers
   */
  const navigateToUserProfile = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  return {
    location,
    navigate,
    goBack,
    navigateToTask,
    navigateToChat,
    navigateToUserProfile
  };
};