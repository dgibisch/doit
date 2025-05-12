import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import i18next from 'i18next';

/**
 * Direct function to send a location message
 * This function bypasses the complex location sharing logic and simply sends a message
 */
export async function sendLocationMessage(chatId: string, userId: string, taskId: string): Promise<boolean> {
  try {
    // 1. Retrieve task to get location data
    const taskRef = doc(db, "tasks", taskId);
    const taskSnap = await getDoc(taskRef);
    
    if (!taskSnap.exists()) {
      throw new Error("Task not found");
    }
    
    const taskData = taskSnap.data();
    
    // 2. Prepare address and coordinates
    const address = taskData.location?.address || i18next.t('chat.locationAddress');
    
    // Check if coordinates exist and extract them correctly
    console.log("Task location data:", JSON.stringify(taskData.location, null, 2));
    
    let lat = 0;
    let lng = 0;
    
    // Try different possible formats to find the coordinates
    if (taskData.location?.coordinates?.lat && taskData.location?.coordinates?.lng) {
      lat = taskData.location.coordinates.lat;
      lng = taskData.location.coordinates.lng;
    } else if (taskData.location?.lat && taskData.location?.lng) {
      lat = taskData.location.lat;
      lng = taskData.location.lng;
    } else if (taskData.location?.locationCoordinates?.lat && taskData.location?.locationCoordinates?.lng) {
      lat = taskData.location.locationCoordinates.lat;
      lng = taskData.location.locationCoordinates.lng;
    } else if (Array.isArray(taskData.location?.coordinates)) {
      // If coordinates are stored as an array
      lat = taskData.location.coordinates[0] || 0;
      lng = taskData.location.coordinates[1] || 0;
    }
    
    console.log(`Extracted coordinates: ${lat}, ${lng}`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    
    // 3. Send a normal chat message with HTML-formatted link
    const messagesRef = collection(db, "messages");  // Collection is directly in the root 
    await addDoc(messagesRef, {
      chatId: chatId,
      senderId: userId,
      content: `📍 ${i18next.t('chat.exactTaskLocation')}:\n\n<a href="${mapsUrl}" target="_blank" style="color:#3b82f6;text-decoration:underline;">🔗 ${i18next.t('chat.openInMaps')}</a>`,
      timestamp: serverTimestamp(),
      messageType: 'text',
      status: 'sent',
      isLocationMessage: true,
      isHtml: true
    });
    
    // 4. Update chat and task
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: `📍 ${i18next.t('chat.locationShared')}`,
      lastMessageTimestamp: serverTimestamp()
    });
    
    // 5. Update task
    await updateDoc(taskRef, {
      "location.locationShared": true
    });
    
    return true;
  } catch (error) {
    console.error("Error sending location message:", error);
    return false;
  }
}