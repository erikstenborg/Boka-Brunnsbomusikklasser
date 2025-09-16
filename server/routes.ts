import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  eventBookingFormSchema,
  updateEventBookingSchema,
  insertActivityLogSchema,
  type EventBookingForm,
  type UpdateEventBooking,
  type BookingStatus,
  type EventType,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware for JSON parsing
  app.use('/api', express.json());
  
  // Event Booking Routes
  
  // POST /api/bookings - Create a new event booking from form data
  app.post('/api/bookings', async (req, res) => {
    try {
      console.log('DEBUG - Raw request body:', req.body);
      const formData = eventBookingFormSchema.parse(req.body);
      console.log('DEBUG - Parsed form data:', formData);
      const booking = await storage.createEventBookingFromForm(formData);
      
      // Log the creation activity
      await storage.createActivityLog({
        bookingId: booking.id,
        action: 'created',
        details: `Booking created for ${booking.eventType} on ${new Date(booking.startAt).toLocaleDateString()}`,
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
  
  // GET /api/bookings - Get all bookings with optional filtering
  app.get('/api/bookings', async (req, res) => {
    try {
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
  
  // GET /api/bookings/:id - Get a specific booking
  app.get('/api/bookings/:id', async (req, res) => {
    try {
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
  
  // PUT /api/bookings/:id - Update a booking (status, assignment, notes)
  app.put('/api/bookings/:id', async (req, res) => {
    try {
      const updates = updateEventBookingSchema.parse(req.body);
      const existingBooking = await storage.getEventBooking(req.params.id);
      
      if (!existingBooking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      const updatedBooking = await storage.updateEventBooking(req.params.id, updates);
      
      if (!updatedBooking) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update booking' 
        });
      }
      
      // Log the update activity
      const changes = [];
      if (updates.status && updates.status !== existingBooking.status) {
        changes.push(`Status changed from ${existingBooking.status} to ${updates.status}`);
      }
      if (updates.assignedTo && updates.assignedTo !== existingBooking.assignedTo) {
        changes.push(`Assigned to ${updates.assignedTo}`);
      }
      if (updates.additionalNotes && updates.additionalNotes !== existingBooking.additionalNotes) {
        changes.push('Notes updated');
      }
      
      if (changes.length > 0) {
        await storage.createActivityLog({
          bookingId: req.params.id,
          action: 'updated',
          details: changes.join(', '),
          userId: req.body.userId || null,
          userName: req.body.userName || 'System'
        });
      }
      
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
  
  // GET /api/bookings/:id/activities - Get activity logs for a booking
  app.get('/api/bookings/:id/activities', async (req, res) => {
    try {
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
