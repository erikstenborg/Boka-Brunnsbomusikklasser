import {
  users,
  eventBookings,
  activityLogs,
  type User,
  type UpsertUser,
  type EventBooking,
  type InsertEventBooking,
  type UpdateEventBooking,
  type ActivityLog,
  type InsertActivityLog,
  type EventBookingForm,
  type EventType,
  type BookingStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for storage operations with enhanced calendar queries
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Event booking operations with temporal improvements
  createEventBooking(booking: InsertEventBooking): Promise<EventBooking>;
  createEventBookingFromForm(form: EventBookingForm): Promise<EventBooking>;
  getEventBookings(filters?: {
    status?: BookingStatus[];
    eventType?: EventType;
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EventBooking[]>;
  getEventBooking(id: string): Promise<EventBooking | undefined>;
  updateEventBooking(id: string, updates: UpdateEventBooking): Promise<EventBooking | undefined>;
  
  // Calendar-specific queries for availability checking
  getBookingsInTimeRange(startTime: Date, endTime: Date): Promise<EventBooking[]>;
  isTimeSlotAvailable(startTime: Date, durationMinutes: number): Promise<boolean>;
  
  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsForBooking(bookingId: string): Promise<ActivityLog[]>;
  
  // Calendar-specific operations for public view
  getBlockedSlotsForCalendar(): Promise<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    eventType: EventType;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Event booking operations with temporal improvements
  async createEventBooking(bookingData: InsertEventBooking): Promise<EventBooking> {
    const [booking] = await db
      .insert(eventBookings)
      .values({
        ...bookingData,
        id: randomUUID(),
      })
      .returning();
    return booking;
  }

  async createEventBookingFromForm(formData: EventBookingForm): Promise<EventBooking> {
    // Convert form data to proper temporal format
    const startAt = new Date(`${formData.requestedDate}T${formData.startTime}`);
    const durationMinutes = Math.round(formData.durationHours * 60);
    
    // Debug logging
    console.log('DEBUG - Form data:', formData);
    console.log('DEBUG - Created startAt:', startAt);
    console.log('DEBUG - startAt type:', typeof startAt);
    console.log('DEBUG - startAt instanceof Date:', startAt instanceof Date);
    console.log('DEBUG - startAt.toISOString():', startAt.toISOString());
    
    const bookingData: InsertEventBooking = {
      eventType: formData.eventType,
      contactName: formData.contactName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      startAt: startAt, // Pass Date object directly, not ISO string
      durationMinutes,
      additionalNotes: formData.additionalNotes || null,
    };
    
    console.log('DEBUG - Booking data before insert:', bookingData);
    
    return this.createEventBooking(bookingData);
  }

  async getEventBookings(filters?: {
    status?: BookingStatus[];
    eventType?: EventType;
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EventBooking[]> {
    let query = db.select().from(eventBookings);
    
    if (filters) {
      const conditions = [];
      
      if (filters.status && filters.status.length > 0) {
        // For array of statuses, use OR conditions
        if (filters.status.length === 1) {
          conditions.push(eq(eventBookings.status, filters.status[0]));
        } else {
          const statusConditions = filters.status.map(status => eq(eventBookings.status, status));
          conditions.push(or(...statusConditions));
        }
      }
      
      if (filters.eventType) {
        conditions.push(eq(eventBookings.eventType, filters.eventType));
      }
      
      if (filters.assignedTo) {
        conditions.push(eq(eventBookings.assignedTo, filters.assignedTo));
      }
      
      if (filters.dateRange) {
        conditions.push(
          and(
            gte(eventBookings.startAt, filters.dateRange.start),
            lte(eventBookings.startAt, filters.dateRange.end)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(eventBookings.createdAt));
  }

  async getEventBooking(id: string): Promise<EventBooking | undefined> {
    const [booking] = await db
      .select()
      .from(eventBookings)
      .where(eq(eventBookings.id, id));
    return booking;
  }

  async updateEventBooking(id: string, updates: UpdateEventBooking, userId?: string, userName?: string): Promise<EventBooking | undefined> {
    // First get the current booking to track changes
    const existingBooking = await this.getEventBooking(id);
    if (!existingBooking) {
      return undefined;
    }

    // Update the booking
    const [booking] = await db
      .update(eventBookings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(eventBookings.id, id))
      .returning();

    if (!booking) {
      return undefined;
    }

    // Track changes and create activity logs with Swedish descriptions
    const changes = [];
    
    if (updates.status && updates.status !== existingBooking.status) {
      const statusTranslations = {
        'pending': 'Väntar på granskning',
        'reviewing': 'Under granskning', 
        'approved': 'Godkänd',
        'completed': 'Slutförd'
      };
      
      changes.push(`Status ändrad från "${statusTranslations[existingBooking.status]}" till "${statusTranslations[updates.status]}"`);
      
      await this.createActivityLog({
        bookingId: id,
        action: 'status_changed',
        details: `Status ändrad från "${statusTranslations[existingBooking.status]}" till "${statusTranslations[updates.status]}"`,
        userId: userId || null,
        userName: userName || 'System'
      });
    }
    
    if (updates.assignedTo !== undefined && updates.assignedTo !== existingBooking.assignedTo) {
      const oldAssignee = existingBooking.assignedTo || 'Ingen';
      const newAssignee = updates.assignedTo || 'Ingen';
      
      changes.push(`Ansvarig ändrad från "${oldAssignee}" till "${newAssignee}"`);
      
      await this.createActivityLog({
        bookingId: id,
        action: 'assigned',
        details: `Ansvarig ändrad från "${oldAssignee}" till "${newAssignee}"`,
        userId: userId || null,
        userName: userName || 'System'
      });
    }
    
    if (updates.additionalNotes !== undefined && updates.additionalNotes !== existingBooking.additionalNotes) {
      await this.createActivityLog({
        bookingId: id,
        action: 'notes_added',
        details: updates.additionalNotes ? 'Anteckningar uppdaterades' : 'Anteckningar togs bort',
        userId: userId || null,
        userName: userName || 'System'
      });
    }
    
    return booking;
  }

  // Activity log operations
  async createActivityLog(logData: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values({
        ...logData,
        id: randomUUID(),
      })
      .returning();
    return log;
  }

  // Calendar-specific queries for availability checking
  async getBookingsInTimeRange(startTime: Date, endTime: Date): Promise<EventBooking[]> {
    return await db
      .select()
      .from(eventBookings)
      .where(
        and(
          gte(eventBookings.startAt, startTime),
          lte(eventBookings.startAt, endTime),
          // Only consider non-pending bookings as potential conflicts
          or(
            eq(eventBookings.status, "approved"),
            eq(eventBookings.status, "reviewing"),
            eq(eventBookings.status, "completed")
          )
        )
      )
      .orderBy(eventBookings.startAt);
  }
  
  async isTimeSlotAvailable(startTime: Date, durationMinutes: number): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    
    // Check for any overlapping bookings (excluding pending status which might be rejected)
    // We need to find bookings that overlap with our requested time slot
    // Overlap occurs when: booking_start < our_end AND booking_end > our_start
    const conflictingBookings = await db
      .select({ id: eventBookings.id, startAt: eventBookings.startAt, durationMinutes: eventBookings.durationMinutes })
      .from(eventBookings)
      .where(
        and(
          // Only check non-pending bookings
          or(
            eq(eventBookings.status, "approved"),
            eq(eventBookings.status, "reviewing"),
            eq(eventBookings.status, "completed")
          ),
          // Booking starts before our slot ends
          lte(eventBookings.startAt, endTime)
          // Note: We'd need a computed column or additional logic to check booking end time
          // For now, this is a simplified availability check
        )
      )
      .limit(5); // Get a few potential conflicts to check
    
    // Check each potential conflict for actual overlap
    for (const booking of conflictingBookings) {
      const bookingStart = new Date(booking.startAt);
      const bookingEnd = new Date(bookingStart.getTime() + booking.durationMinutes * 60000);
      
      // Check for overlap: booking_start < our_end AND booking_end > our_start
      if (bookingStart < endTime && bookingEnd > startTime) {
        return false; // Conflict found
      }
    }
    
    return true; // No conflicts found
  }
  
  async getActivityLogsForBooking(bookingId: string): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.bookingId, bookingId))
      .orderBy(desc(activityLogs.timestamp));
  }

  // Calendar-specific operations for public view
  async getBlockedSlotsForCalendar(): Promise<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    eventType: EventType;
  }[]> {
    // Only get approved bookings for public calendar display
    const approvedBookings = await db
      .select()
      .from(eventBookings)
      .where(eq(eventBookings.status, "approved"))
      .orderBy(eventBookings.startAt);

    // Transform booking data to calendar format using consistent Europe/Stockholm timezone
    return approvedBookings.map(booking => {
      const startDate = new Date(booking.startAt);
      const endDate = new Date(startDate.getTime() + booking.durationMinutes * 60000);
      
      // Use Europe/Stockholm timezone for consistent date/time formatting
      const swedenTimeZone = 'Europe/Stockholm';
      
      // Format date consistently in Swedish timezone (YYYY-MM-DD)
      const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: swedenTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const dateParts = dateFormatter.formatToParts(startDate);
      const swedenDate = `${dateParts.find(p => p.type === 'year')?.value}-${dateParts.find(p => p.type === 'month')?.value}-${dateParts.find(p => p.type === 'day')?.value}`;
      
      // Format times consistently in Swedish timezone (HH:MM)
      const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: swedenTimeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const swedenStartTime = timeFormatter.format(startDate);
      const swedenEndTime = timeFormatter.format(endDate);
      
      return {
        id: booking.id,
        date: swedenDate, // YYYY-MM-DD format in Swedish timezone
        startTime: swedenStartTime, // HH:MM format in Swedish timezone
        endTime: swedenEndTime, // HH:MM format in Swedish timezone
        eventType: booking.eventType,
      };
    });
  }
}

export const storage = new DatabaseStorage();
