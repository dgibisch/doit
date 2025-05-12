# Architecture Overview

## 1. Overview

DoIt is a task marketplace application that allows users to post and apply for tasks in their local area. The application follows a full-stack JavaScript architecture with a React frontend and Express backend. It uses a PostgreSQL database via Drizzle ORM and integrates with Firebase for authentication, storage, and potentially real-time features.

The application follows a client-server architecture with:

- **Client:** React-based single-page application (SPA) using modern React patterns and UI components
- **Server:** Express.js backend that serves the API and the static frontend assets in production
- **Database:** PostgreSQL database accessed through Drizzle ORM
- **Authentication:** Firebase Authentication for user management
- **Storage:** Firebase Storage for user uploads (images, etc.)

## 2. System Architecture

### 2.1 Frontend Architecture

The frontend is built with React and follows a component-based architecture. It uses:

- **TypeScript** for type safety
- **Wouter** for routing (lightweight alternative to React Router)
- **Tailwind CSS** with shadcn/ui components for styling
- **Tanstack Query** for data fetching and state management
- **React Hook Form** with Zod for form validation
- **Firebase SDK** for direct interaction with Firebase services

The frontend is organized into:
- `client/src/components/` - Reusable UI components
- `client/src/context/` - React context providers
- `client/src/hooks/` - Custom React hooks
- `client/src/lib/` - Utility functions and service modules
- `client/src/pages/` - Page components
- `client/src/utils/` - Helper functions

### 2.2 Backend Architecture

The backend is an Express.js server written in TypeScript that:

- Serves the API endpoints
- Serves the static frontend assets in production
- Interfaces with the database using Drizzle ORM

The backend is organized into:
- `server/` - Express server setup and configuration
- `server/routes.ts` - API route definitions
- `server/db.ts` - Database connection setup
- `server/storage.ts` - Storage interface implementation
- `shared/` - Shared code between frontend and backend

### 2.3 Database Architecture

The application uses PostgreSQL with Drizzle ORM. The database schema is defined in `shared/schema.ts` and includes these main entities:

- **users** - User profiles and authentication information
- **tasks** - Task listings with details
- **applications** - Applications from users to tasks

## 3. Key Components

### 3.1 Authentication System

The application uses Firebase Authentication for user management. Key aspects:
- User credentials are stored in Firebase Auth
- User profile data is stored in both Firebase and the PostgreSQL database
- Auth state is managed through a React context provider (`AuthContext`)

### 3.2 Task Management

Tasks are the core entity of the application:
- Tasks can be created, viewed, edited, and applied to
- Tasks have categories, locations, and optional images
- Task status progresses from "open" to "matched" to "completed"

### 3.3 Chat System

The application features a real-time chat system:
- Users can communicate about tasks
- Chats are organized by task and participants
- Messages can include text and images
- Chat functionality is provided by a service layer (`chat-service.ts`)

### 3.4 Review and Rating System

After task completion, users can review each other:
- Reviews include ratings and optional comments
- User ratings accumulate to form reputation scores
- The review system is managed by a dedicated context (`ReviewContext`)

### 3.5 Location-based Features

The application has location-based features:
- Tasks have location data
- Google Maps integration for address selection and visualization
- Distance calculation between users and tasks

## 4. Data Flow

### 4.1 Client-Server Communication

1. Client-side code makes API requests to the Express backend
2. Express routes handle the requests and interact with the database
3. Responses are returned as JSON data
4. React components update based on the received data

Alternative patterns:
- Direct Firebase SDK usage from the frontend for real-time features
- Server-rendered initial state for faster initial page loads

### 4.2 State Management

The application uses multiple approaches for state management:
- React Context for global application state (auth, review, location)
- React Query for server state and caching
- Local component state for UI-specific state

## 5. External Dependencies

### 5.1 Google Maps API

- Used for location selection, geocoding, and map visualization
- Integrated through `@react-google-maps/api` library
- Custom utility functions handle Google Places Autocomplete integration

### 5.2 Firebase Services

- **Authentication:** User sign-up, login, and session management
- **Firestore:** Real-time data storage (likely for chats and notifications)
- **Storage:** Image uploads for tasks, user profiles, and chat messages

### 5.3 Neon Database (PostgreSQL)

- Serverless PostgreSQL database
- Connected through `@neondatabase/serverless` package
- Primary data storage for application entities

## 6. Deployment Strategy

The application is configured for deployment in multiple environments:

### 6.1 Development Environment

- Uses Vite's development server for frontend
- Runs Express backend concurrently
- Hot module replacement for rapid development

### 6.2 Production Environment

- Frontend assets are built with Vite and served statically by Express
- Backend is compiled with esbuild for production
- Environment variables control feature flags and API keys

### 6.3 Replit Deployment

The application is configured for hosting on Replit:
- Uses Replit-specific plugins for error handling and source mapping
- Configures ports and startup scripts for the Replit environment
- Sets up automatic deployment workflows

## 7. Architecture Decisions

### 7.1 Full-stack JavaScript/TypeScript

**Decision:** Use TypeScript for both frontend and backend.

**Rationale:** 
- Shared types between client and server
- Improved developer experience and type safety
- Consistent language across the stack

### 7.2 PostgreSQL with Drizzle ORM

**Decision:** Use PostgreSQL with Drizzle ORM instead of only using Firebase Firestore.

**Rationale:**
- Better structure and schema enforcement
- SQL database benefits (transactions, complex queries)
- Drizzle ORM provides type safety and schema migrations

### 7.3 Firebase Integration

**Decision:** Use Firebase for authentication, storage, and potentially real-time features.

**Rationale:**
- Simplified auth implementation
- Managed file storage solution
- Real-time capabilities for chat features

### 7.4 Component Library Approach

**Decision:** Use shadcn/ui with Tailwind CSS.

**Rationale:**
- Consistent design system
- Customizable components
- Reduces implementation time for common UI patterns

### 7.5 Server-Side Rendering Strategy

**Decision:** SPA with API-based data fetching rather than full SSR.

**Rationale:**
- Simpler architecture
- Better separation of concerns
- Easier development workflow