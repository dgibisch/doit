import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import CommentSlideIn from './CommentSlideIn';

interface CommentButtonProps {
  taskId: string;
  commentCount?: number;
  compact?: boolean;
  className?: string;
}

/**
 * Kommentar-Button mit Slide-In-Ansicht
 */
const CommentButton: React.FC<CommentButtonProps> = ({ 
  taskId, 
  commentCount = 0, 
  compact = false,
  className = ""
}) => {
  const [isCommentViewOpen, setIsCommentViewOpen] = useState(false);
  
  const openCommentView = () => {
    setIsCommentViewOpen(true);
    // Verhindern, dass die Hauptseite im Hintergrund scrollbar bleibt
    document.body.style.overflow = 'hidden';
  };
  
  const closeCommentView = () => {
    setIsCommentViewOpen(false);
    // Scrollen wieder erlauben
    document.body.style.overflow = '';
  };
  
  return (
    <>
      <Button
        onClick={openCommentView}
        variant="ghost"
        size={compact ? "sm" : "default"}
        className={`hover:bg-gray-100 ${className}`}
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        {!compact && "Kommentare"} 
        {commentCount > 0 && (
          <span className="ml-1 text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">
            {commentCount}
          </span>
        )}
      </Button>
      
      {isCommentViewOpen && (
        <CommentSlideIn 
          taskId={taskId} 
          isOpen={isCommentViewOpen} 
          onClose={closeCommentView} 
        />
      )}
    </>
  );
};

export default CommentButton;