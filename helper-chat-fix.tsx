// Auf ReviewSubmitted-Events hören
useEffect(() => {
  // Event-Listener registrieren
  const unsubscribe = useReview().onReviewSubmitted((taskId, reviewerId) => {
    // Wenn der aktuelle Chat und Nutzer betroffen sind
    if (taskId === chat?.taskId && reviewerId === user?.id) {
      setHasReviewed(true);
    }
  });
  
  // Cleanup beim Unmount
  return unsubscribe;
}, [chat?.taskId, user?.id]);