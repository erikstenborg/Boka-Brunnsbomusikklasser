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
  insertWorkflowStatusSchema,
  updateWorkflowStatusSchema,
  insertEventTypeSchema,
  updateEventTypeSchema,
  type EventBookingForm,
  type UpdateEventBooking,
  type UpdateBookingStatus,
  type AssignBooking,
  type EventType,
  type InsertEventType,
  type UpdateEventType,
  type WorkflowStatus,
  type InsertWorkflowStatus,
  type UpdateWorkflowStatus,
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
  
  // Public Event Types Routes (no authentication required)
  
  // GET /api/event-types - Get all active event types for booking form
  app.get('/api/event-types', async (req, res) => {
    try {
      const eventTypes = await storage.getEventTypes({ isActive: true });
      res.json({ success: true, eventTypes });
    } catch (error) {
      console.error('Error fetching event types:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch event types' 
      });
    }
  });
  
  // GET /api/event-types/:id - Get specific event type details
  app.get('/api/event-types/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid event type ID' 
        });
      }
      
      const eventType = await storage.getEventType(id);
      
      if (!eventType) {
        return res.status(404).json({ 
          success: false, 
          error: 'Event type not found' 
        });
      }
      
      res.json({ success: true, eventType });
    } catch (error) {
      console.error('Error fetching event type:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch event type' 
      });
    }
  });

  // Public Calendar Routes (no authentication required)
  
  // GET /api/calendar/blocked-slots - Get blocked time slots for public calendar view
  app.get('/api/calendar/blocked-slots', async (req, res) => {
    try {
      const blockedSlots = await storage.getBlockedSlotsForCalendar();
      res.json({ success: true, blockedSlots });
    } catch (error) {
      console.error('Error fetching blocked slots:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch blocked slots' 
      });
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
      
      // Log the creation activity in Swedish using the actual event type name
      await storage.createActivityLog({
        bookingId: booking.id,
        action: 'created',
        details: `Bokning skapad för ${booking.eventType.name} den ${new Date(booking.startAt).toLocaleDateString('sv-SE')}`,
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
        statusIds,
        statusSlugs,
        eventTypeId,
        eventTypeIds,
        assignedTo,
        startDate,
        endDate,
      } = req.query;
      
      const filters: any = {};
      
      if (statusIds) {
        // Handle multiple status ID values and convert to numbers
        const statusIdArray = Array.isArray(statusIds) ? statusIds : [statusIds];
        filters.statusIds = statusIdArray.map((id: string) => Number(id)).filter(id => !isNaN(id));
      }
      
      if (statusSlugs) {
        // Handle multiple status slug values (for backward compatibility)
        const statusSlugArray = Array.isArray(statusSlugs) ? statusSlugs : [statusSlugs];
        filters.statusSlugs = statusSlugArray as string[];
      }
      
      if (eventTypeId) {
        const eventTypeIdNum = Number(eventTypeId);
        if (!isNaN(eventTypeIdNum)) {
          filters.eventTypeId = eventTypeIdNum;
        }
      }
      
      if (eventTypeIds) {
        // Handle multiple event type ID values and convert to numbers
        const eventTypeIdArray = Array.isArray(eventTypeIds) ? eventTypeIds : [eventTypeIds];
        filters.eventTypeIds = eventTypeIdArray.map((id: string) => Number(id)).filter(id => !isNaN(id));
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
      
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid booking ID' 
        });
      }
      
      const booking = await storage.getEventBooking(id);
      
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
      
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid booking ID' 
        });
      }
      
      const updates = updateEventBookingSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(id);
      
      if (!existingBooking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      // Get admin user info for activity logging
      const adminUser = await storage.getUser(userId);
      const adminUserName = `${adminUser?.firstName} ${adminUser?.lastName}`.trim() || adminUser?.email || 'Admin';
      
      const updatedBooking = await storage.updateEventBooking(id, updates, userId, adminUserName);
      
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
        statusIds,
        statusSlugs,
        eventTypeId,
        eventTypeIds,
        assignedTo,
        startDate,
        endDate,
      } = req.query;
      
      const filters: any = {};
      
      if (statusIds) {
        // Handle multiple status ID values for kanban columns
        const statusIdArray = Array.isArray(statusIds) ? statusIds : [statusIds];
        filters.statusIds = statusIdArray as string[];
      }
      
      if (statusSlugs) {
        // Handle multiple status slug values for kanban columns
        const statusSlugArray = Array.isArray(statusSlugs) ? statusSlugs : [statusSlugs];
        filters.statusSlugs = statusSlugArray as string[];
      }
      
      if (eventTypeId) {
        filters.eventTypeId = eventTypeId as string;
      }
      
      if (eventTypeIds) {
        // Handle multiple event type ID values for kanban columns
        const eventTypeIdArray = Array.isArray(eventTypeIds) ? eventTypeIds : [eventTypeIds];
        filters.eventTypeIds = eventTypeIdArray as string[];
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
      
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid booking ID' 
        });
      }
      
      const booking = await storage.getEventBooking(id);
      
      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      // Also get activity logs for the booking
      const activities = await storage.getActivityLogsForBooking(id);
      
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
      
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid booking ID' 
        });
      }
      
      const statusUpdate = updateBookingStatusSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(id);
      
      if (!existingBooking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      const updatedBooking = await storage.updateEventBooking(id, {
        statusId: statusUpdate.statusId
      }, adminUser.id, `${adminUser.firstName} ${adminUser.lastName}`.trim() || adminUser.email || 'Admin');
      
      if (!updatedBooking) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update booking status' 
        });
      }
      
      // Log the status change activity
      if (statusUpdate.statusId !== existingBooking.statusId) {
        await storage.createActivityLog({
          bookingId: id,
          action: 'status_changed',
          details: `Status changed from ${existingBooking.status.name} to ${updatedBooking.status.name}`,
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
      
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid booking ID' 
        });
      }
      
      const assignmentUpdate = assignBookingSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(id);
      
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
      
      const updatedBooking = await storage.updateEventBooking(id, {
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
      const { startTime, durationMinutes, eventTypeId } = req.query;
      
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
      
      // Include eventTypeId for buffer time calculations
      const eventTypeIdNum = eventTypeId ? Number(eventTypeId) : undefined;
      const isAvailable = await storage.isTimeSlotAvailable(start, duration, eventTypeIdNum);
      
      res.json({ 
        success: true, 
        available: isAvailable,
        startTime: start.toISOString(),
        durationMinutes: duration,
        eventTypeId: eventTypeId || null
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
  
  // Workflow Status Management Routes (Admin only)
  
  // GET /api/admin/workflow-statuses - Get all workflow statuses
  app.get('/api/admin/workflow-statuses', isAuthenticated, async (req: any, res) => {
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

      const { isActive } = req.query;
      const filters: any = {};
      
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }
      
      const statuses = await storage.getWorkflowStatuses(filters);
      res.json({ success: true, statuses });
    } catch (error) {
      console.error('Error fetching workflow statuses:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch workflow statuses' 
      });
    }
  });
  
  // GET /api/admin/workflow-statuses/:id - Get specific workflow status
  app.get('/api/admin/workflow-statuses/:id', isAuthenticated, async (req: any, res) => {
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
      
      const status = await storage.getWorkflowStatus(req.params.id);
      
      if (!status) {
        return res.status(404).json({ 
          success: false, 
          error: 'Workflow status not found' 
        });
      }
      
      res.json({ success: true, status });
    } catch (error) {
      console.error('Error fetching workflow status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch workflow status' 
      });
    }
  });
  
  // POST /api/admin/workflow-statuses - Create new workflow status
  app.post('/api/admin/workflow-statuses', isAuthenticated, async (req: any, res) => {
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
      
      const statusData = insertWorkflowStatusSchema.parse(req.body);
      const status = await storage.createWorkflowStatus(statusData);
      
      // Log the creation
      const adminUserName = `${user.firstName} ${user.lastName}`.trim() || user.email || 'Admin';
      console.log(`Admin ${adminUserName} created workflow status: ${status.name} (${status.slug})`);
      
      res.status(201).json({ success: true, status });
    } catch (error) {
      console.error('Error creating workflow status:', error);
      
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
        error: 'Failed to create workflow status' 
      });
    }
  });
  
  // PUT /api/admin/workflow-statuses/:id - Update workflow status
  app.put('/api/admin/workflow-statuses/:id', isAuthenticated, async (req: any, res) => {
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
      
      const updates = updateWorkflowStatusSchema.parse(req.body);
      const status = await storage.updateWorkflowStatus(req.params.id, updates);
      
      if (!status) {
        return res.status(404).json({ 
          success: false, 
          error: 'Workflow status not found' 
        });
      }
      
      // Log the update
      const adminUserName = `${user.firstName} ${user.lastName}`.trim() || user.email || 'Admin';
      console.log(`Admin ${adminUserName} updated workflow status: ${status.name} (${status.slug})`);
      
      res.json({ success: true, status });
    } catch (error) {
      console.error('Error updating workflow status:', error);
      
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
        error: 'Failed to update workflow status' 
      });
    }
  });
  
  // DELETE /api/admin/workflow-statuses/:id - Delete workflow status
  app.delete('/api/admin/workflow-statuses/:id', isAuthenticated, async (req: any, res) => {
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
      
      const success = await storage.deleteWorkflowStatus(req.params.id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: 'Workflow status not found or could not be deleted' 
        });
      }
      
      // Log the deletion
      const adminUserName = `${user.firstName} ${user.lastName}`.trim() || user.email || 'Admin';
      console.log(`Admin ${adminUserName} deleted workflow status with ID: ${req.params.id}`);
      
      res.json({ success: true, message: 'Workflow status deleted successfully' });
    } catch (error) {
      console.error('Error deleting workflow status:', error);
      
      // Handle specific errors from storage layer
      if (error instanceof Error) {
        return res.status(400).json({ 
          success: false, 
          error: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete workflow status' 
      });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
