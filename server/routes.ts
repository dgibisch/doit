import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertTaskSchema, 
  insertApplicationSchema, 
  insertChatSchema, 
  insertMessageSchema, 
  insertReviewSchema 
} from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.get('/api/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/users/uid/:uid', async (req, res) => {
    try {
      const { uid } = req.params;
      const user = await storage.getUserByUid(uid);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/users', async (req, res) => {
    try {
      // Validate request body
      const result = insertUserSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid user data', errors: result.error.errors });
      }
      
      // Create user
      const user = await storage.createUser(result.data);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update user data
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Task routes
  app.get('/api/tasks', async (req, res) => {
    try {
      const filters = req.query;
      const tasks = await storage.getTasks(filters);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/tasks/:id', async (req, res) => {
    try {
      const taskId = req.params.id;
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/users/:uid/tasks', async (req, res) => {
    try {
      const creatorId = req.params.uid;
      const tasks = await storage.getTasksByCreator(creatorId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/tasks', async (req, res) => {
    try {
      // Validate request body
      const result = insertTaskSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid task data', errors: result.error.errors });
      }
      
      // Create task
      const task = await storage.createTask(result.data);
      
      // Increment user's postedTasks count
      const user = await storage.getUserByUid(task.creatorId);
      if (user) {
        await storage.updateUser(user.id, { postedTasks: (user.postedTasks || 0) + 1 });
      }
      
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const taskId = req.params.id;
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Update task data
      const updatedTask = await storage.updateTask(taskId, req.body);
      res.json(updatedTask);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Application routes
  app.get('/api/tasks/:taskId/applications', async (req, res) => {
    try {
      const taskId = req.params.taskId;
      const applications = await storage.getApplications(taskId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/users/:uid/applications', async (req, res) => {
    try {
      const applicantId = req.params.uid;
      const applications = await storage.getApplicationsByUser(applicantId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/applications', async (req, res) => {
    try {
      // Validate request body
      const result = insertApplicationSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid application data', errors: result.error.errors });
      }
      
      // Create application
      const application = await storage.createApplication(result.data);
      res.status(201).json(application);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/applications/:id', async (req, res) => {
    try {
      const applicationId = req.params.id;
      const application = await storage.getApplication(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
      
      // Update application data
      const updatedApplication = await storage.updateApplication(applicationId, req.body);
      
      // If application is accepted, update task status
      if (updatedApplication.status === 'accepted') {
        const task = await storage.getTask(updatedApplication.taskId);
        if (task) {
          await storage.updateTask(task.id, { 
            status: 'matched',
            matchedApplicationId: applicationId
          });
          
          // Create a chat between task creator and applicant
          await storage.createChat({
            taskId: task.id,
            participants: [task.creatorId, updatedApplication.applicantId],
            lastMessage: null,
            lastMessageAt: null
          });
        }
      }
      
      res.json(updatedApplication);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Chat routes
  app.get('/api/users/:uid/chats', async (req, res) => {
    try {
      const userId = req.params.uid;
      const chats = await storage.getChats(userId);
      res.json(chats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/chats/:id', async (req, res) => {
    try {
      const chatId = req.params.id;
      const chat = await storage.getChat(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: 'Chat not found' });
      }
      
      res.json(chat);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/chats', async (req, res) => {
    try {
      // Validate request body
      const result = insertChatSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid chat data', errors: result.error.errors });
      }
      
      // Create chat
      const chat = await storage.createChat(result.data);
      res.status(201).json(chat);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/chats/:id', async (req, res) => {
    try {
      const chatId = req.params.id;
      const chat = await storage.getChat(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: 'Chat not found' });
      }
      
      // Update chat data
      const updatedChat = await storage.updateChat(chatId, req.body);
      res.json(updatedChat);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Message routes
  app.get('/api/chats/:chatId/messages', async (req, res) => {
    try {
      const chatId = req.params.chatId;
      const messages = await storage.getMessages(chatId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/messages', async (req, res) => {
    try {
      // Validate request body
      const result = insertMessageSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid message data', errors: result.error.errors });
      }
      
      // Create message
      const message = await storage.createMessage(result.data);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Review routes
  app.get('/api/users/:uid/reviews', async (req, res) => {
    try {
      const userId = req.params.uid;
      const reviews = await storage.getReviews(userId);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/reviews', async (req, res) => {
    try {
      // Validate request body
      const result = insertReviewSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid review data', errors: result.error.errors });
      }
      
      // Create review
      const review = await storage.createReview(result.data);
      
      // Update task to completed status
      const task = await storage.getTask(review.taskId);
      if (task) {
        await storage.updateTask(task.id, { 
          status: 'completed',
          completedAt: new Date()
        });
        
        // Increment user's completedTasks count
        const user = await storage.getUserByUid(review.userId);
        if (user) {
          await storage.updateUser(user.id, { completedTasks: (user.completedTasks || 0) + 1 });
        }
      }
      
      res.status(201).json(review);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
