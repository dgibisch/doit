import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface UserActivityMetrics {
  tasksCompleted: number;
  tasksPosted: number;
  averageRating: number;
  totalEarnings: number;
}

export interface MonthlyActivityData {
  month: string;
  completed: number;
  posted: number;
}

export interface CategoryDistribution {
  name: string;
  value: number;
}

export interface RecentActivity {
  type: 'completed' | 'posted' | 'applied' | 'rating';
  title: string;
  date: Date;
  additionalInfo?: string;
}

/**
 * Fetch user activity metrics from Firestore
 */
export const getUserActivityMetrics = async (userId: string): Promise<UserActivityMetrics> => {
  try {
    // Get user profile for rating data
    const userRef = collection(db, "users");
    const userQuery = query(userRef, where("uid", "==", userId));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error("User not found");
    }
    
    const userData = userSnapshot.docs[0].data();
    
    // Get tasks completed count
    const applicationsRef = collection(db, "applications");
    const completedAppsQuery = query(
      applicationsRef,
      where("applicantId", "==", userId),
      where("status", "==", "accepted")
    );
    const completedAppsSnapshot = await getDocs(completedAppsQuery);
    
    // Get tasks posted count from user data
    const postedTasks = userData.postedTasks || 0;
    
    // Calculate earnings from completed tasks
    let totalEarnings = 0;
    completedAppsSnapshot.forEach(doc => {
      const appData = doc.data();
      totalEarnings += appData.price || 0;
    });
    
    return {
      tasksCompleted: completedAppsSnapshot.size,
      tasksPosted: postedTasks,
      averageRating: userData.rating || 0,
      totalEarnings
    };
  } catch (error) {
    console.error("Error fetching user metrics:", error);
    // Return default values on error
    return {
      tasksCompleted: 0,
      tasksPosted: 0,
      averageRating: 0,
      totalEarnings: 0
    };
  }
};

/**
 * Get monthly activity data for charts
 */
export const getMonthlyActivityData = async (userId: string): Promise<MonthlyActivityData[]> => {
  try {
    // This is a simplified implementation - in a real app, you'd use 
    // aggregation queries or Cloud Functions to transform this data properly
    
    // Get the last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleString('default', { month: 'short' });
      months.push({
        month: monthName,
        date: month,
        completed: 0,
        posted: 0
      });
    }
    
    // Get completed tasks
    const applicationsRef = collection(db, "applications");
    const completedAppsQuery = query(
      applicationsRef,
      where("applicantId", "==", userId),
      where("status", "==", "accepted")
    );
    const completedAppsSnapshot = await getDocs(completedAppsQuery);
    
    // Get posted tasks
    const tasksRef = collection(db, "tasks");
    const postedTasksQuery = query(
      tasksRef,
      where("creatorId", "==", userId)
    );
    const postedTasksSnapshot = await getDocs(postedTasksQuery);
    
    // Process completed tasks
    completedAppsSnapshot.forEach(doc => {
      const appData = doc.data();
      const completedAt = appData.updatedAt?.toDate() || new Date();
      
      const monthIndex = months.findIndex(m => 
        m.date.getMonth() === completedAt.getMonth() && 
        m.date.getFullYear() === completedAt.getFullYear()
      );
      
      if (monthIndex !== -1) {
        months[monthIndex].completed += 1;
      }
    });
    
    // Process posted tasks
    postedTasksSnapshot.forEach(doc => {
      const taskData = doc.data();
      const createdAt = taskData.createdAt?.toDate() || new Date();
      
      const monthIndex = months.findIndex(m => 
        m.date.getMonth() === createdAt.getMonth() && 
        m.date.getFullYear() === createdAt.getFullYear()
      );
      
      if (monthIndex !== -1) {
        months[monthIndex].posted += 1;
      }
    });
    
    // Return the data without the date property
    return months.map(({ month, completed, posted }) => ({
      month,
      completed, 
      posted
    }));
  } catch (error) {
    console.error("Error fetching monthly activity data:", error);
    // Return empty data on error
    return [];
  }
};

/**
 * Get category distribution data for the pie chart
 */
export const getCategoryDistribution = async (userId: string): Promise<CategoryDistribution[]> => {
  try {
    // Get tasks posted by user
    const tasksRef = collection(db, "tasks");
    const tasksQuery = query(
      tasksRef,
      where("creatorId", "==", userId)
    );
    const tasksSnapshot = await getDocs(tasksQuery);
    
    // Get tasks completed by user
    const applicationsRef = collection(db, "applications");
    const appsQuery = query(
      applicationsRef,
      where("applicantId", "==", userId),
      where("status", "==", "accepted")
    );
    const appsSnapshot = await getDocs(appsQuery);
    
    // Get task IDs from applications
    const taskIds = appsSnapshot.docs.map(doc => doc.data().taskId);
    
    // Get tasks from task IDs
    const completedTasksRef = collection(db, "tasks");
    const completedTasksQuery = query(
      completedTasksRef,
      where("__name__", "in", taskIds.length > 0 ? taskIds : ["dummy"])
    );
    const completedTasksSnapshot = await getDocs(completedTasksQuery);
    
    // Combine all tasks
    const allTasks = [...tasksSnapshot.docs, ...completedTasksSnapshot.docs];
    
    // Count categories
    const categories: Record<string, number> = {};
    
    allTasks.forEach(doc => {
      const taskData = doc.data();
      const category = taskData.category || "Other";
      
      if (categories[category]) {
        categories[category] += 1;
      } else {
        categories[category] = 1;
      }
    });
    
    // Convert to array format for the chart
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value
    }));
  } catch (error) {
    console.error("Error fetching category distribution:", error);
    return [];
  }
};

/**
 * Get recent activity for the user
 */
export const getRecentActivity = async (userId: string, limit = 5): Promise<RecentActivity[]> => {
  try {
    const activities: RecentActivity[] = [];
    
    // Get completed tasks
    const completedAppsRef = collection(db, "applications");
    const completedAppsQuery = query(
      completedAppsRef,
      where("applicantId", "==", userId),
      where("status", "==", "accepted"),
      orderBy("updatedAt", "desc"),
      limit(limit)
    );
    const completedAppsSnapshot = await getDocs(completedAppsQuery);
    
    // Get task details for completed applications
    const taskIds = completedAppsSnapshot.docs.map(doc => doc.data().taskId);
    let completedTasks: Record<string, any> = {};
    
    if (taskIds.length > 0) {
      const tasksRef = collection(db, "tasks");
      const tasksQuery = query(
        tasksRef,
        where("__name__", "in", taskIds)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      tasksSnapshot.forEach(doc => {
        completedTasks[doc.id] = doc.data();
      });
    }
    
    // Process completed applications
    completedAppsSnapshot.forEach(doc => {
      const appData = doc.data();
      const taskData = completedTasks[appData.taskId] || {};
      
      activities.push({
        type: 'completed',
        title: taskData.title || 'Task',
        date: appData.updatedAt?.toDate() || new Date(),
        additionalInfo: `€${appData.price || 0}`
      });
    });
    
    // Get posted tasks
    const postedTasksRef = collection(db, "tasks");
    const postedTasksQuery = query(
      postedTasksRef,
      where("creatorId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limit)
    );
    const postedTasksSnapshot = await getDocs(postedTasksQuery);
    
    // Process posted tasks
    postedTasksSnapshot.forEach(doc => {
      const taskData = doc.data();
      
      activities.push({
        type: 'posted',
        title: taskData.title || 'Task',
        date: taskData.createdAt?.toDate() || new Date()
      });
    });
    
    // Get applications
    const applicationsRef = collection(db, "applications");
    const applicationsQuery = query(
      applicationsRef,
      where("applicantId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limit)
    );
    const applicationsSnapshot = await getDocs(applicationsQuery);
    
    // Get task details for applications
    const appTaskIds = applicationsSnapshot.docs.map(doc => doc.data().taskId);
    let appTasks: Record<string, any> = {};
    
    if (appTaskIds.length > 0) {
      const tasksRef = collection(db, "tasks");
      const tasksQuery = query(
        tasksRef,
        where("__name__", "in", appTaskIds)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      tasksSnapshot.forEach(doc => {
        appTasks[doc.id] = doc.data();
      });
    }
    
    // Process applications
    applicationsSnapshot.forEach(doc => {
      const appData = doc.data();
      const taskData = appTasks[appData.taskId] || {};
      
      if (appData.status !== 'accepted') {
        activities.push({
          type: 'applied',
          title: taskData.title || 'Task',
          date: appData.createdAt?.toDate() || new Date(),
          additionalInfo: `€${appData.price || 0}`
        });
      }
    });
    
    // Get ratings
    const reviewsRef = collection(db, "reviews");
    const reviewsQuery = query(
      reviewsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limit)
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    // Process ratings
    reviewsSnapshot.forEach(doc => {
      const reviewData = doc.data();
      
      activities.push({
        type: 'rating',
        title: `Received ${reviewData.rating}★ rating`,
        date: reviewData.createdAt?.toDate() || new Date(),
        additionalInfo: reviewData.content || ''
      });
    });
    
    // Sort all activities by date and limit
    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }
};