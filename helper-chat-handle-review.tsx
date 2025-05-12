// Bewertung erstellen
const handleCreateReview = () => {
  if (!chat || !user) return;
  
  const otherParticipantId = chat.participants.find(id => id !== user.id) || '';
  const isTaskCreator = chat.taskCreatorId === user.id;
  
  openReviewModal({
    taskId: chat.taskId,
    userId: otherParticipantId,
    userName: chat.participantNames?.[otherParticipantId] || 'Benutzer',
    userRole: isTaskCreator ? 'applicant' : 'creator',
    chatId: chat.id
  });
};