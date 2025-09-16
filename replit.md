# Event Booking System - Swedish Christmas Events

## Overview

This is a full-stack event booking system designed specifically for Swedish Christmas events, including "Luciatåg" (Lucia processions) and "Sjungande Julgran" (Singing Christmas Tree). The application provides a public-facing booking interface for customers and an admin panel for managing bookings through a kanban-style workflow.

The system features a clean, professional design inspired by Swedish institutional aesthetics with seasonal warmth. It includes public calendar views for checking availability, event registration forms, and comprehensive admin tools for booking management with activity logging.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **Styling**: Tailwind CSS with a custom design system based on Swedish institutional aesthetics
- **UI Components**: Shadcn/ui component library with Radix UI primitives for accessibility
- **State Management**: TanStack Query for server state management and data fetching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Server**: Node.js with Express.js for RESTful API endpoints
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Built-in support for Replit Auth with session management
- **Validation**: Zod schemas shared between frontend and backend for data validation

### Database Design
- **Session Storage**: Required tables for Replit Auth session management
- **User Management**: User profiles with admin role support
- **Event Bookings**: Central booking entity with temporal data (start time, duration)
- **Activity Logging**: Comprehensive audit trail for all booking changes
- **Type Safety**: PostgreSQL enums for event types and booking statuses

### Data Models
- **Event Types**: "luciatag" and "sjungande_julgran" with different booking requirements
- **Booking Workflow**: Four-stage process (pending → reviewing → approved → completed)
- **Contact Information**: Full contact details with validation
- **Temporal Scheduling**: Start time and duration-based booking system

### Design System
- **Color Palette**: Deep forest green primary with warm gold accents and soft red highlights
- **Typography**: Inter for body text with Playfair Display for institutional elegance
- **Component Strategy**: Card-based layouts with consistent spacing using Tailwind's design tokens
- **Responsive Design**: Mobile-first approach with progressive enhancement

### API Architecture
- **RESTful Endpoints**: Standard CRUD operations for bookings and activity logs
- **Form Processing**: Dedicated endpoint for converting form data to booking records
- **Calendar Queries**: Specialized endpoints for availability checking and time slot validation
- **Activity Tracking**: Automatic logging of all booking state changes and assignments

### Development Environment
- **Hot Reloading**: Vite development server with React Fast Refresh
- **Type Checking**: Full TypeScript coverage with strict configuration
- **Path Aliases**: Organized imports using @ aliases for components and shared code
- **Build Process**: Optimized production builds with code splitting

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection for Replit environment
- **drizzle-orm**: Type-safe ORM with schema-first approach
- **express**: Web server framework for API endpoints
- **@tanstack/react-query**: Server state management and caching

### UI and Styling
- **@radix-ui/react-***: Accessible primitive components for all interactive elements
- **tailwindcss**: Utility-first CSS framework with custom design tokens
- **class-variance-authority**: Type-safe variant management for components
- **lucide-react**: Icon library for consistent iconography

### Form Handling and Validation
- **react-hook-form**: Performant form management with minimal re-renders
- **@hookform/resolvers**: Integration adapters for validation libraries
- **zod**: Runtime type validation for forms and API data
- **drizzle-zod**: Automatic Zod schema generation from database schemas

### Development Tools
- **typescript**: Static type checking across the entire application
- **vite**: Fast build tool with development server
- **date-fns**: Date manipulation and formatting utilities
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Authentication and Session Management
- **Built-in Replit Auth**: Integrated authentication system
- **PostgreSQL Session Store**: Persistent session storage required for Replit environment