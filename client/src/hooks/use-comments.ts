import { useState, useEffect, useCallback } from 'react';
import { commentService, TaskComment } from '@/lib/comment-service';

export function useTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Organize comments with replies
  const organizeComments = useCallback((flatComments: TaskComment[]): TaskComment[] => {
    const parentComments: TaskComment[] = [];
    const replyMap: Record<string, TaskComment[]> = {};
    
    // First pass: identify parent comments and organize replies by parentId
    flatComments.forEach(comment => {
      if (!comment.parentId) {
        // This is a top-level comment
        parentComments.push({...comment, replies: []});
      } else {
        // This is a reply
        if (!replyMap[comment.parentId]) {
          replyMap[comment.parentId] = [];
        }
        replyMap[comment.parentId].push(comment);
      }
    });
    
    // Second pass: attach replies to their parent comments
    parentComments.forEach(parent => {
      if (replyMap[parent.id]) {
        parent.replies = replyMap[parent.id].sort((a, b) => {
          // Sort replies by timestamp (oldest first)
          const dateA = a.timestamp?.toDate?.() || new Date();
          const dateB = b.timestamp?.toDate?.() || new Date();
          return dateA.getTime() - dateB.getTime();
        });
      }
    });
    
    return parentComments;
  }, []);

  // Fetch comments for the specified task
  useEffect(() => {
    let unsubscribe = () => {};
    
    if (taskId) {
      setLoading(true);
      setError(null);
      
      unsubscribe = commentService.getTaskComments(
        taskId,
        (loadedComments) => {
          // Organize comments with replies
          const organizedComments = organizeComments(loadedComments);
          setComments(organizedComments);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching comments:', err);
          setError(err);
          setLoading(false);
        }
      );
    } else {
      setComments([]);
      setLoading(false);
    }
    
    return () => {
      unsubscribe();
    };
  }, [taskId, organizeComments]);

  // Add a new comment to the task
  const addComment = async (content: string): Promise<void> => {
    if (!taskId || !content.trim()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      let imageUrl = '';
      
      // Upload image if selected
      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = await commentService.uploadCommentImage(selectedImage);
        setUploadingImage(false);
        setSelectedImage(null);
      }
      
      await commentService.addComment(taskId, content, undefined, undefined, undefined, imageUrl);
      // No need to update state manually as the listener will do it
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err instanceof Error ? err : new Error('Failed to add comment'));
    } finally {
      setSubmitting(false);
    }
  };

  // Reply to a comment
  const replyToComment = async (commentId: string, content: string): Promise<void> => {
    if (!content.trim()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      let imageUrl = '';
      
      // Upload image if selected
      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = await commentService.uploadCommentImage(selectedImage);
        setUploadingImage(false);
        setSelectedImage(null);
      }
      
      await commentService.replyToComment(commentId, content, imageUrl);
      setReplyingTo(null); // Reset replying state
      // No need to update state manually as the listener will do it
    } catch (err) {
      console.error('Error replying to comment:', err);
      setError(err instanceof Error ? err : new Error('Failed to reply to comment'));
    } finally {
      setSubmitting(false);
    }
  };

  // Like a comment
  const likeComment = async (commentId: string): Promise<void> => {
    try {
      await commentService.likeComment(commentId);
      // No need to update state manually as the listener will do it
    } catch (err) {
      console.error('Error liking comment:', err);
      setError(err instanceof Error ? err : new Error('Failed to like comment'));
    }
  };

  // Handle image selection
  const handleImageSelect = (file: File | null) => {
    setSelectedImage(file);
  };

  // Start replying to a comment
  const startReply = (commentId: string) => {
    setReplyingTo(commentId);
  };

  // Cancel replying
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Get all comments including replies (flat structure)
  const getAllComments = (): TaskComment[] => {
    const allComments: TaskComment[] = [];
    
    comments.forEach(comment => {
      allComments.push(comment);
      if (comment.replies && comment.replies.length > 0) {
        allComments.push(...comment.replies);
      }
    });
    
    return allComments;
  };

  return {
    comments,
    loading,
    error,
    submitting,
    addComment,
    likeComment,
    replyToComment,
    replyingTo,
    startReply,
    cancelReply,
    handleImageSelect,
    selectedImage,
    uploadingImage,
    getAllComments
  };
}