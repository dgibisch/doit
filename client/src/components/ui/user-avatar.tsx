import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle } from 'lucide-react';

export interface UserAvatarProps {
  /**
   * Benutzerdaten (muss zumindest photoURL oder displayName enthalten).
   * Unterstützt verschiedene Objektstrukturen (Firebase User, userProfile, etc.)
   */
  user?: {
    photoURL?: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    avatarBase64?: string;  // Neu: Base64-kodiertes Bild in Entwicklungsumgebung
    uid?: string;
  } | null;
  
  /**
   * Größe des Avatars (in Pixeln)
   * @default 40
   */
  size?: number;
  
  /**
   * Zeigt den Benutzernamen neben dem Avatar an
   * @default false
   */
  showName?: boolean;
  
  /**
   * CSS-Klassen für zusätzliche Styling-Optionen des Containers
   */
  className?: string;
  
  /**
   * CSS-Klassen für den Avatar
   */
  avatarClassName?: string;
  
  /**
   * CSS-Klassen für den Benutzernamen
   */
  nameClassName?: string;
  
  /**
   * Alternative URL für das Fallback-Bild bei Ladefehlern oder fehlenden Bildern
   * @default '/default-avatar.png'
   */
  fallbackImageUrl?: string;
  
  /**
   * Optional: Runde Ecken des Avatars anzeigen
   * @default true
   */
  rounded?: boolean;
}

/**
 * Wiederverwendbare Komponente zur Anzeige von Benutzeravataren
 * 
 * Diese Komponente stellt einen Benutzeravatar mit folgenden Features dar:
 * - Automatisches Fallback auf Initialen oder Standard-Avatar
 * - Optionaler Benutzername daneben
 * - Flexibel anpassbare Größe
 * - Fehlerbehandlung für Bildladungen
 * - Konsistentes Design in der gesamten Anwendung
 * 
 * @example
 * // Einfache Verwendung:
 * <UserAvatar user={currentUser} />
 * 
 * // Mit Namen und angepasster Größe:
 * <UserAvatar user={profile} size={64} showName={true} />
 * 
 * // Mit angepasstem Fallback-Bild:
 * <UserAvatar user={null} fallbackImageUrl="/images/guest.png" />
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 40,
  showName = false,
  className = '',
  avatarClassName = '',
  nameClassName = '',
  fallbackImageUrl = '/default-avatar.png',
  rounded = true
}) => {
  // Zustand für Bildladefehler
  const [imageError, setImageError] = useState(false);
  
  // Benutzernamen extrahieren (verschiedene mögliche Quellen)
  const displayName = user?.displayName || user?.username || 'Unbekannt';
  
  // Bild-URL extrahieren (verschiedene mögliche Quellen)
  // Falls ein Bildfehler aufgetreten ist, wird direkt das Fallback-Bild verwendet
  const imageUrl = !imageError 
    ? (user?.avatarBase64 || user?.photoURL || user?.avatarUrl || fallbackImageUrl)
    : fallbackImageUrl;
    
  // Erkenne Base64-Bilder für Debugging
  const isBase64Image = imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:image/');
  
  // Initialen für den Fallback ermitteln
  const getInitials = () => {
    if (!displayName || displayName === 'Unbekannt') return '?';
    
    // Bei Namen mit Leerzeichen: Initialen beider Wörter
    const parts = displayName.split(' ');
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    
    return displayName.charAt(0).toUpperCase();
  };
  
  // Behandlung von Bildladefehlern
  const handleImageError = () => {
    console.log(`Avatar-Bild konnte nicht geladen werden: ${imageUrl}`);
    setImageError(true);
  };
  
  // Container-Stil-Klassen
  const containerClasses = `flex items-center ${showName ? 'gap-2' : ''} ${className}`;
  
  // Avatar-Stil-Klassen
  const avatarClasses = `${rounded ? 'rounded-full' : 'rounded-md'} ${avatarClassName}`;
  
  return (
    <div className={containerClasses}>
      <div className="relative">
        <Avatar 
          className={avatarClasses}
          style={{ width: size, height: size }}
        >
          <AvatarImage 
            src={imageUrl} 
            alt={`Avatar von ${displayName}`}
            onError={handleImageError}
            // Falls es ein Base64-Bild ist, vorsichtshalber einen Titel mit Hinweis anzeigen
            title={isBase64Image ? 'Base64-Bild (Entwicklungsmodus)' : undefined}
          />
          <AvatarFallback className="bg-primary/10">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {/* Visueller Indikator für Base64-Bilder im Entwicklungsmodus */}
        {isBase64Image && process.env.NODE_ENV === 'development' && (
          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-3 h-3 border border-white" 
               title="Base64-Bild (Entwicklungsmodus)"/>
        )}
      </div>
      
      {showName && (
        <span className={`text-sm font-medium ${nameClassName}`}>
          {displayName}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;