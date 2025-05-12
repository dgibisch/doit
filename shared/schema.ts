import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table for storing user profile data
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase UID
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  completedTasks: integer("completed_tasks").default(0),
  postedTasks: integer("posted_tasks").default(0),
  rating: integer("rating").default(0),
  ratingCount: integer("rating_count").default(0),
  skills: text("skills").array(),
  location: json("location"), // GeoPoint { lat, lng }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task table for storing task data
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  location: json("location"), // GeoPoint { lat, lng }
  creatorId: text("creator_id").notNull().references(() => users.uid),
  status: text("status").default("open"), // open, matched, completed
  matchedApplicationId: text("matched_application_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Applications table for storing task applications
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  applicantId: text("applicant_id").notNull().references(() => users.uid),
  message: text("message").notNull(),
  price: integer("price").notNull(),
  status: text("status").default("pending"), // pending, accepted, rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat table for storing chat metadata
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  participants: text("participants").array().notNull(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  unread: boolean("unread").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages table for storing chat messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id),
  senderId: text("sender_id").notNull().references(() => users.uid),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Reviews table for storing user reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  reviewerId: text("reviewer_id").notNull().references(() => users.uid),
  userId: text("user_id").notNull().references(() => users.uid),
  rating: integer("rating").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas for each table
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true, 
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
