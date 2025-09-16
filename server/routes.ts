import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  eventBookingFormSchema,
  updateEventBookingSchema,
  updateBookingStatusSchema,
  assignBookingSchema,
  insertActivityLogSchema,
  type EventBookingForm,
  type UpdateEventBooking,
  type UpdateBookingStatus,
  type AssignBooking,
  type BookingStatus,
  type EventType,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Middleware for JSON parsing
  app.use('/api', express.json());
  
  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Event Booking Routes
  
  // POST /api/bookings - Create a new event booking from form data
  app.post('/api/bookings', async (req, res) => {
    try {
      console.log('DEBUG - Raw request body:', req.body);
      const formData = eventBookingFormSchema.parse(req.body);
      console.log('DEBUG - Parsed form data:', formData);
      const booking = await storage.createEventBookingFromForm(formData);
      
      // Log the creation activity in Swedish
      const eventTypeNames = {
        'luciatag': 'Luciatåg',
        'sjungande_julgran': 'Sjungande Julgran'
      };
      
      await storage.createActivityLog({
        bookingId: booking.id,
        action: 'created',
        details: `Bokning skapad för ${eventTypeNames[booking.eventType]} den ${new Date(booking.startAt).toLocaleDateString('sv-SE')}`,
        userId: null,
        userName: 'System'
      });
      
      res.status(201).json({ success: true, booking });
    } catch (error) {
      console.error('Error creating booking:', error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: validationError.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create booking' 
      });
    }
  });
  
  // GET /api/bookings - Get all bookings with optional filtering (Admin only)
  app.get('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Admin privileges required.' 
        });
      }
      
      const {
        status,
        eventType,
        assignedTo,
        startDate,
        endDate,
      } = req.query;
      
      const filters: any = {};
      
      if (status) {
        // Handle multiple status values
        const statusArray = Array.isArray(status) ? status : [status];
        filters.status = statusArray as BookingStatus[];
      }
      
      if (eventType) {
        filters.eventType = eventType as EventType;
      }
      
      if (assignedTo) {
        filters.assignedTo = assignedTo as string;
      }
      
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const bookings = await storage.getEventBookings(filters);
      res.json({ success: true, bookings });
    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch bookings' 
      });
    }
  });
  
  // GET /api/bookings/:id - Get a specific booking (Admin only)
  app.get('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Admin privileges required.' 
        });
      }
      
      const booking = await storage.getEventBooking(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      res.json({ success: true, booking });
    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch booking' 
      });
    }
  });
  
  // PUT /api/bookings/:id - Update a booking (status, assignment, notes) (Admin only)
  app.put('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Admin privileges required.' 
        });
      }
      
      const updates = updateEventBookingSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(req.params.id);
      
      if (!existingBooking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      // Get admin user info for activity logging
      const adminUser = await storage.getUser(userId);
      const adminUserName = `${adminUser?.firstName} ${adminUser?.lastName}`.trim() || adminUser?.email || 'Admin';
      
      const updatedBooking = await storage.updateEventBooking(req.params.id, updates, userId, adminUserName);
      
      if (!updatedBooking) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update booking' 
        });
      }
      
      // Activity logging is now handled automatically in the storage method
      
      res.json({ success: true, booking: updatedBooking });
    } catch (error) {
      console.error('Error updating booking:', error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: validationError.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update booking' 
      });
    }
  });
  
  // GET /api/bookings/:id/activities - Get activity logs for a booking (Admin only)
  app.get('/api/bookings/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access denied. Admin privileges required.' 
        });
      }
      
      const activities = await storage.getActivityLogsForBooking(req.params.id);
      res.json({ success: true, activities });
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch activities' 
      });
    }
  });
  
  // Admin Kanban Workflow Routes
  
  // Helper function for admin authentication check
  const requireAdmin = async (req: any, res: any) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin privileges required.' 
      });
      return null;
    }
    return user;
  };
  
  // GET /api/admin/bookings - Get all bookings for kanban board (Admin only)
  app.get('/api/admin/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;
      
      const {
        status,
        eventType,
        assignedTo,
        startDate,
        endDate,
      } = req.query;
      
      const filters: any = {};
      
      if (status) {
        // Handle multiple status values for kanban columns
        const statusArray = Array.isArray(status) ? status : [status];
        filters.status = statusArray as BookingStatus[];
      }
      
      if (eventType) {
        filters.eventType = eventType as EventType;
      }
      
      if (assignedTo) {
        filters.assignedTo = assignedTo as string;
      }
      
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const bookings = await storage.getEventBookings(filters);
      res.json({ success: true, bookings });
    } catch (error) {
      console.error('Error fetching admin bookings:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch bookings' 
      });
    }
  });
  
  // GET /api/admin/bookings/:id - Get specific booking details (Admin only)
  app.get('/api/admin/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;
      
      const booking = await storage.getEventBooking(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      // Also get activity logs for the booking
      const activities = await storage.getActivityLogsForBooking(req.params.id);
      
      res.json({ 
        success: true, 
        booking,
        activities 
      });
    } catch (error) {
      console.error('Error fetching admin booking:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch booking' 
      });
    }
  });
  
  // PATCH /api/admin/bookings/:id/status - Update booking status (Admin only)
  app.patch('/api/admin/bookings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;
      
      const statusUpdate = updateBookingStatusSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(req.params.id);
      
      if (!existingBooking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      const updatedBooking = await storage.updateEventBooking(req.params.id, {
        status: statusUpdate.status
      });
      
      if (!updatedBooking) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update booking status' 
        });
      }
      
      // Log the status change activity
      if (statusUpdate.status !== existingBooking.status) {
        await storage.createActivityLog({
          bookingId: req.params.id,
          action: 'status_changed',
          details: `Status changed from ${existingBooking.status} to ${statusUpdate.status}`,
          userId: adminUser.id,
          userName: `${adminUser.firstName} ${adminUser.lastName}`.trim() || adminUser.email || 'Admin'
        });
      }
      
      res.json({ success: true, booking: updatedBooking });
    } catch (error) {
      console.error('Error updating booking status:', error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: validationError.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update booking status' 
      });
    }
  });
  
  // PATCH /api/admin/bookings/:id/assign - Assign booking to admin user (Admin only)
  app.patch('/api/admin/bookings/:id/assign', isAuthenticated, async (req: any, res) => {
    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;
      
      const assignmentUpdate = assignBookingSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(req.params.id);
      
      if (!existingBooking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      // Verify the assigned user exists and is an admin
      const assignedUser = await storage.getUser(assignmentUpdate.assignedTo);
      if (!assignedUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Assigned user not found' 
        });
      }
      
      if (!assignedUser.isAdmin) {
        return res.status(400).json({ 
          success: false, 
          error: 'Can only assign bookings to admin users' 
        });
      }
      
      const updatedBooking = await storage.updateEventBooking(req.params.id, {
        assignedTo: assignmentUpdate.assignedTo
      });
      
      if (!updatedBooking) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to assign booking' 
        });
      }
      
      // Log the assignment activity
      if (assignmentUpdate.assignedTo !== existingBooking.assignedTo) {
        const assignedUserName = `${assignedUser.firstName} ${assignedUser.lastName}`.trim() || assignedUser.email || 'Unknown User';
        await storage.createActivityLog({
          bookingId: req.params.id,
          action: 'assigned',
          details: `Booking assigned to ${assignedUserName}`,
          userId: adminUser.id,
          userName: `${adminUser.firstName} ${adminUser.lastName}`.trim() || adminUser.email || 'Admin'
        });
      }
      
      res.json({ success: true, booking: updatedBooking });
    } catch (error) {
      console.error('Error assigning booking:', error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: validationError.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to assign booking' 
      });
    }
  });
  
  // Calendar and Availability Routes
  
  // GET /api/calendar/availability - Check if a time slot is available
  app.get('/api/calendar/availability', async (req, res) => {
    try {
      const { startTime, durationMinutes } = req.query;
      
      if (!startTime || !durationMinutes) {
        return res.status(400).json({
          success: false,
          error: 'startTime and durationMinutes are required'
        });
      }
      
      const start = new Date(startTime as string);
      const duration = parseInt(durationMinutes as string, 10);
      
      if (isNaN(start.getTime()) || isNaN(duration)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid startTime or durationMinutes format'
        });
      }
      
      const isAvailable = await storage.isTimeSlotAvailable(start, duration);
      
      res.json({ 
        success: true, 
        available: isAvailable,
        startTime: start.toISOString(),
        durationMinutes: duration
      });
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to check availability' 
      });
    }
  });
  
  // GET /api/calendar/bookings - Get bookings in a time range for calendar display
  app.get('/api/calendar/bookings', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
      
      const bookings = await storage.getBookingsInTimeRange(start, end);
      
      res.json({ 
        success: true, 
        bookings,
        range: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching calendar bookings:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch calendar bookings' 
      });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
