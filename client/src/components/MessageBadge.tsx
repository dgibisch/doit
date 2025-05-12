import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

interface MessageBadgeProps {
  className?: string;
}

const MessageBadge: React.FC<MessageBadgeProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // For simplicity, we'll just count all chats with the user as a participant
    // A more accurate implementation would check if lastReadTimestamp < lastMessageTimestamp
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Count chats with unread messages
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = user.id as string;
        
        // If the chat has a lastMessageTimestamp and the user hasn't read it (or read an older message)
        if (data.lastMessageTimestamp && 
            (!data.lastReadBy || 
             !data.lastReadBy[userId] || 
             data.lastReadBy[userId].toDate() < data.lastMessageTimestamp.toDate())) {
          count++;
        }
      });
      
      setUnreadCount(count);
    });

    return () => unsubscribe();
  }, [user]);

  if (unreadCount === 0) return null;

  // Display badge with unread count
  return (
    <div className={`absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 font-bold min-w-[18px] text-center ${className}`}>
      {unreadCount > 9 ? '9+' : unreadCount}
    </div>
  );
};

export default MessageBadge;