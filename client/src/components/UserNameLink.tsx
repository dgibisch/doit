import { useLocation } from 'wouter';

interface UserNameLinkProps {
  userId: string;
  name: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Eine Komponente für klickbare Benutzernamen, die zum jeweiligen Profil führen
 * 
 * @param userId Die ID des Benutzers, zu dessen Profil navigiert werden soll
 * @param name Der anzuzeigende Name des Benutzers
 * @param className Optionale zusätzliche CSS-Klassen
 * @param showIcon Ob ein Benutzer-Icon angezeigt werden soll (Standard: false)
 */
const UserNameLink = ({ userId, name, className = "", showIcon = false }: UserNameLinkProps) => {
  const [, setLocation] = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindert, dass das Klickereignis an übergeordnete Elemente weitergeleitet wird
    setLocation(`/user/${userId}`);
  };

  return (
    <span
      className={`text-primary font-medium cursor-pointer hover:underline ${className}`}
      onClick={handleClick}
      data-testid="user-name-link"
      data-user-id={userId}
    >
      {showIcon && (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="w-4 h-4 inline-block mr-1"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )}
      {name}
    </span>
  );
};

export default UserNameLink;