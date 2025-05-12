import { FC, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface UserLinkProps {
  userId: string;
  children?: ReactNode;
  className?: string;
  type?: 'name' | 'avatar' | 'both';
  name?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Komponente zum Rendern eines klickbaren Benutzernamens oder Avatars,
 * der zur Profilseite des Benutzers navigiert.
 * Kann überall verwendet werden, wo ein Benutzername angezeigt wird.
 * 
 * @param userId ID des Benutzers für die Navigation
 * @param children Optionale Kinder-Elemente (wenn nicht name verwendet wird)
 * @param className Optionale CSS-Klassen
 * @param type Art des Links ('name', 'avatar' oder 'both')
 * @param name Anzuzeigender Name (Alternative zu children)
 * @param showIcon Ob ein Benutzer-Icon angezeigt werden soll
 * @param size Größe des Elements ('sm', 'md', 'lg')
 */
const UserLink: FC<UserLinkProps> = ({ 
  userId, 
  children, 
  className,
  type = 'name',
  name,
  showIcon = false,
  size = 'md'
}) => {
  const [, setLocation] = useLocation();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation(`/user/${userId}`);
  };
  
  // Größen-Klassen für das Icon
  const iconSizeClasses = {
    sm: 'w-3 h-3 mr-0.5',
    md: 'w-4 h-4 mr-1',
    lg: 'w-5 h-5 mr-1.5'
  };
  
  return (
    <span 
      className={cn(
        "cursor-pointer hover:underline inline-flex items-center", 
        type === 'name' && "font-medium", 
        {
          'text-xs': size === 'sm',
          'text-sm': size === 'md',
          'text-base': size === 'lg',
          'text-primary': !className?.includes('text-')
        },
        className
      )}
      onClick={handleClick}
      data-testid="user-link"
      data-user-id={userId}
    >
      {showIcon && (
        <User className={iconSizeClasses[size]} />
      )}
      {children || name}
    </span>
  );
};

export default UserLink;