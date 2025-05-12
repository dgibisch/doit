import { 
  users, 
  tasks, 
  applications, 
  chats, 
  messages, 
  reviews,
  type User, 
  type InsertUser,
  type Task,
  type InsertTask,
  type Application,
  type InsertApplication,
  type Chat,
  type InsertChat,
  type Message,
  type InsertMessage,
  type Review,
  type InsertReview
} from "@shared/schema";

// Storage interface for CRUD operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUid(uid: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  
  // Task operations
  getTasks(filters?: any): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByCreator(creatorId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task>;
  
  // Application operations
  getApplications(taskId: string): Promise<Application[]>;
  getApplicationsByUser(applicantId: string): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, data: Partial<Application>): Promise<Application>;
  
  // Chat operations
  getChats(userId: string): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChat(id: string, data: Partial<Chat>): Promise<Chat>;
  
  // Message operations
  getMessages(chatId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Review operations
  getReviews(userId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tasks: Map<string, Task>;
  private applications: Map<string, Application>;
  private chats: Map<string, Chat>;
  private messages: Map<string, Message>;
  private reviews: Map<string, Review>;
  private userIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.tasks = new Map();
    this.applications = new Map();
    this.chats = new Map();
    this.messages = new Map();
    this.reviews = new Map();
    this.userIdCounter = 1;
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUid(uid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.uid === uid);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedTasks: insertUser.completedTasks || 0,
      postedTasks: insertUser.postedTasks || 0,
      rating: insertUser.rating || 0,
      ratingCount: insertUser.ratingCount || 0,
      skills: insertUser.skills || []
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updatedUser: User = { 
      ...user, 
      ...data,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Task operations
  async getTasks(filters?: any): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        tasks = tasks.filter(task => task.status === filters.status);
      }
      
      if (filters.category) {
        tasks = tasks.filter(task => task.category === filters.category);
      }
      
      if (filters.creatorId) {
        tasks = tasks.filter(task => task.creatorId === filters.creatorId);
      }
      
      // Sort by createdAt descending
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    
    return tasks;
  }
  
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }
  
  async getTasksByCreator(creatorId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.creatorId === creatorId);
  }
  
  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = `task_${Date.now()}`;
    const task: Task = {
      ...insertTask,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: insertTask.status || 'open',
      completedAt: null
    };
    
    this.tasks.set(id, task);
    return task;
  }
  
  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const task = await this.getTask(id);
    if (!task) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    const updatedTask: Task = {
      ...task,
      ...data,
      updatedAt: new Date()
    };
    
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
  
  // Application operations
  async getApplications(taskId: string): Promise<Application[]> {
    return Array.from(this.applications.values()).filter(app => app.taskId === taskId);
  }
  
  async getApplicationsByUser(applicantId: string): Promise<Application[]> {
    return Array.from(this.applications.values()).filter(app => app.applicantId === applicantId);
  }
  
  async getApplication(id: string): Promise<Application | undefined> {
    return this.applications.get(id);
  }
  
  async createApplication(insertApplication: InsertApplication): Promise<Application> {
    const id = `app_${Date.now()}`;
    const application: Application = {
      ...insertApplication,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: insertApplication.status || 'pending'
    };
    
    this.applications.set(id, application);
    return application;
  }
  
  async updateApplication(id: string, data: Partial<Application>): Promise<Application> {
    const application = await this.getApplication(id);
    if (!application) {
      throw new Error(`Application with ID ${id} not found`);
    }
    
    const updatedApplication: Application = {
      ...application,
      ...data,
      updatedAt: new Date()
    };
    
    this.applications.set(id, updatedApplication);
    return updatedApplication;
  }
  
  // Chat operations
  async getChats(userId: string): Promise<Chat[]> {
    return Array.from(this.chats.values()).filter(chat => 
      chat.participants.includes(userId)
    );
  }
  
  async getChat(id: string): Promise<Chat | undefined> {
    return this.chats.get(id);
  }
  
  async createChat(insertChat: InsertChat): Promise<Chat> {
    const id = `chat_${Date.now()}`;
    const chat: Chat = {
      ...insertChat,
      id,
      createdAt: new Date(),
      lastMessageAt: insertChat.lastMessageAt || null,
      unread: insertChat.unread || false
    };
    
    this.chats.set(id, chat);
    return chat;
  }
  
  async updateChat(id: string, data: Partial<Chat>): Promise<Chat> {
    const chat = await this.getChat(id);
    if (!chat) {
      throw new Error(`Chat with ID ${id} not found`);
    }
    
    const updatedChat: Chat = {
      ...chat,
      ...data
    };
    
    this.chats.set(id, updatedChat);
    return updatedChat;
  }
  
  // Message operations
  async getMessages(chatId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.chatId === chatId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = `msg_${Date.now()}`;
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date()
    };
    
    this.messages.set(id, message);
    
    // Update the chat's last message and timestamp
    const chat = await this.getChat(insertMessage.chatId);
    if (chat) {
      await this.updateChat(chat.id, {
        lastMessage: insertMessage.content,
        lastMessageAt: new Date(),
        unread: true
      });
    }
    
    return message;
  }
  
  // Review operations
  async getReviews(userId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = `review_${Date.now()}`;
    const review: Review = {
      ...insertReview,
      id,
      createdAt: new Date()
    };
    
    this.reviews.set(id, review);
    
    // Update user's rating
    const user = await this.getUserByUid(insertReview.userId);
    if (user) {
      const currentRatingTotal = user.rating * (user.ratingCount || 0);
      const newRatingCount = (user.ratingCount || 0) + 1;
      const newRating = (currentRatingTotal + insertReview.rating) / newRatingCount;
      
      await this.updateUser(user.id, {
        rating: newRating,
        ratingCount: newRatingCount
      });
    }
    
    return review;
  }
}

export const storage = new MemStorage();
