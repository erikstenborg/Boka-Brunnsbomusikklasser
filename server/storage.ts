import {
  users,
  eventBookings,
  activityLogs,
  workflowStatuses,
  type User,
  type UpsertUser,
  type EventBooking,
  type EventBookingWithStatus,
  type InsertEventBooking,
  type UpdateEventBooking,
  type ActivityLog,
  type InsertActivityLog,
  type EventBookingForm,
  type EventType,
  type WorkflowStatus,
  type InsertWorkflowStatus,
  type UpdateWorkflowStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, not, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for storage operations with enhanced calendar queries
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Workflow status operations
  getWorkflowStatuses(filters?: { isActive?: boolean }): Promise<WorkflowStatus[]>;
  getWorkflowStatus(id: string): Promise<WorkflowStatus | undefined>;
  getWorkflowStatusBySlug(slug: string): Promise<WorkflowStatus | undefined>;
  getDefaultWorkflowStatus(): Promise<WorkflowStatus>;
  createWorkflowStatus(status: InsertWorkflowStatus): Promise<WorkflowStatus>;
  updateWorkflowStatus(id: string, updates: UpdateWorkflowStatus): Promise<WorkflowStatus | undefined>;
  deleteWorkflowStatus(id: string): Promise<boolean>;
  
  // Event booking operations with status relationships
  createEventBooking(booking: InsertEventBooking): Promise<EventBookingWithStatus>;
  createEventBookingFromForm(form: EventBookingForm): Promise<EventBookingWithStatus>;
  getEventBookings(filters?: {
    statusIds?: string[];
    statusSlugs?: string[];
    eventType?: EventType;
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EventBookingWithStatus[]>;
  getEventBooking(id: string): Promise<EventBookingWithStatus | undefined>;
  updateEventBooking(id: string, updates: UpdateEventBooking, userId?: string, userName?: string): Promise<EventBookingWithStatus | undefined>;
  
  // Calendar-specific queries for availability checking
  getBookingsInTimeRange(startTime: Date, endTime: Date): Promise<EventBookingWithStatus[]>;
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
    statusSlug: string;
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

  // Workflow status operations
  async getWorkflowStatuses(filters?: { isActive?: boolean }): Promise<WorkflowStatus[]> {
    let query = db.select().from(workflowStatuses);
    
    if (filters?.isActive !== undefined) {
      query = query.where(eq(workflowStatuses.isActive, filters.isActive));
    }
    
    return await query.orderBy(workflowStatuses.displayOrder, workflowStatuses.name);
  }

  async getWorkflowStatus(id: string): Promise<WorkflowStatus | undefined> {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.id, id));
    return status;
  }

  async getWorkflowStatusBySlug(slug: string): Promise<WorkflowStatus | undefined> {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.slug, slug));
    return status;
  }

  async getDefaultWorkflowStatus(): Promise<WorkflowStatus> {
    const [defaultStatus] = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.isDefault, true));
    
    if (!defaultStatus) {
      throw new Error("No default workflow status found. Please run the workflow status seed script.");
    }
    
    return defaultStatus;
  }

  async createWorkflowStatus(statusData: InsertWorkflowStatus): Promise<WorkflowStatus> {
    // If this is being set as default, unset other defaults first
    if (statusData.isDefault) {
      await db
        .update(workflowStatuses)
        .set({ isDefault: false })
        .where(eq(workflowStatuses.isDefault, true));
    }

    const [status] = await db
      .insert(workflowStatuses)
      .values({
        ...statusData,
        id: randomUUID(),
      })
      .returning();
    return status;
  }

  async updateWorkflowStatus(id: string, updates: UpdateWorkflowStatus): Promise<WorkflowStatus | undefined> {
    // If this is being set as default, unset other defaults first
    if (updates.isDefault) {
      await db
        .update(workflowStatuses)
        .set({ isDefault: false })
        .where(eq(workflowStatuses.isDefault, true));
    }

    const [status] = await db
      .update(workflowStatuses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(workflowStatuses.id, id))
      .returning();
    return status;
  }

  async deleteWorkflowStatus(id: string): Promise<boolean> {
    // Check if this status is in use by any bookings
    const [bookingUsingStatus] = await db
      .select({ count: eventBookings.id })
      .from(eventBookings)
      .where(eq(eventBookings.statusId, id))
      .limit(1);

    if (bookingUsingStatus) {
      throw new Error("Cannot delete workflow status that is currently in use by bookings.");
    }

    // Check if this is the default status
    const status = await this.getWorkflowStatus(id);
    if (status?.isDefault) {
      throw new Error("Cannot delete the default workflow status. Set another status as default first.");
    }

    const result = await db
      .delete(workflowStatuses)
      .where(eq(workflowStatuses.id, id));

    return result.rowCount > 0;
  }

  // Event booking operations with status relationships
  async createEventBooking(bookingData: InsertEventBooking): Promise<EventBookingWithStatus> {
    // If no status is provided, use the default
    let statusId = bookingData.statusId;
    if (!statusId) {
      const defaultStatus = await this.getDefaultWorkflowStatus();
      statusId = defaultStatus.id;
    }

    const [booking] = await db
      .insert(eventBookings)
      .values({
        ...bookingData,
        statusId,
        id: randomUUID(),
      })
      .returning();
    
    // Return booking with status information
    const bookingWithStatus = await this.getEventBooking(booking.id);
    if (!bookingWithStatus) {
      throw new Error("Failed to retrieve created booking with status");
    }
    
    return bookingWithStatus;
  }

  async createEventBookingFromForm(formData: EventBookingForm): Promise<EventBookingWithStatus> {
    // Convert form data to proper temporal format
    const startAt = new Date(`${formData.requestedDate}T${formData.startTime}`);
    const durationMinutes = Math.round(formData.durationHours * 60);
    
    // Debug logging
    console.log('DEBUG - Form data:', formData);
    console.log('DEBUG - Created startAt:', startAt);
    console.log('DEBUG - startAt type:', typeof startAt);
    console.log('DEBUG - startAt instanceof Date:', startAt instanceof Date);
    console.log('DEBUG - startAt.toISOString():', startAt.toISOString());
    
    // Get default status for new bookings
    const defaultStatus = await this.getDefaultWorkflowStatus();
    
    const bookingData: InsertEventBooking = {
      eventType: formData.eventType,
      contactName: formData.contactName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      startAt: startAt, // Pass Date object directly, not ISO string
      durationMinutes,
      statusId: defaultStatus.id,
      additionalNotes: formData.additionalNotes || null,
    };
    
    console.log('DEBUG - Booking data before insert:', bookingData);
    
    return this.createEventBooking(bookingData);
  }

  async getEventBookings(filters?: {
    statusIds?: string[];
    statusSlugs?: string[];
    eventType?: EventType;
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EventBookingWithStatus[]> {
    let query = db
      .select({
        id: eventBookings.id,
        eventType: eventBookings.eventType,
        contactName: eventBookings.contactName,
        contactEmail: eventBookings.contactEmail,
        contactPhone: eventBookings.contactPhone,
        startAt: eventBookings.startAt,
        durationMinutes: eventBookings.durationMinutes,
        additionalNotes: eventBookings.additionalNotes,
        statusId: eventBookings.statusId,
        assignedTo: eventBookings.assignedTo,
        createdAt: eventBookings.createdAt,
        updatedAt: eventBookings.updatedAt,
        status: workflowStatuses,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id));
    
    if (filters) {
      const conditions = [];
      
      if (filters.statusIds && filters.statusIds.length > 0) {
        // For array of status IDs, use IN condition (OR logic)
        conditions.push(inArray(eventBookings.statusId, filters.statusIds));
      }
      
      if (filters.statusSlugs && filters.statusSlugs.length > 0) {
        // For array of status slugs, use IN condition (OR logic)
        conditions.push(inArray(workflowStatuses.slug, filters.statusSlugs));
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

  async getEventBooking(id: string): Promise<EventBookingWithStatus | undefined> {
    const [booking] = await db
      .select({
        id: eventBookings.id,
        eventType: eventBookings.eventType,
        contactName: eventBookings.contactName,
        contactEmail: eventBookings.contactEmail,
        contactPhone: eventBookings.contactPhone,
        startAt: eventBookings.startAt,
        durationMinutes: eventBookings.durationMinutes,
        additionalNotes: eventBookings.additionalNotes,
        statusId: eventBookings.statusId,
        assignedTo: eventBookings.assignedTo,
        createdAt: eventBookings.createdAt,
        updatedAt: eventBookings.updatedAt,
        status: workflowStatuses,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .where(eq(eventBookings.id, id));
    return booking;
  }

  async updateEventBooking(id: string, updates: UpdateEventBooking, userId?: string, userName?: string): Promise<EventBookingWithStatus | undefined> {
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

    // Get the updated booking with status information
    const updatedBookingWithStatus = await this.getEventBooking(id);
    if (!updatedBookingWithStatus) {
      return undefined;
    }

    // Track changes and create activity logs with Swedish descriptions
    const changes = [];
    
    if (updates.statusId && updates.statusId !== existingBooking.statusId) {
      const oldStatusName = existingBooking.status.name;
      const newStatusName = updatedBookingWithStatus.status.name;
      
      changes.push(`Status ändrad från "${oldStatusName}" till "${newStatusName}"`);
      
      await this.createActivityLog({
        bookingId: id,
        action: 'status_changed',
        details: `Status ändrad från "${oldStatusName}" till "${newStatusName}"`,
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
    
    return updatedBookingWithStatus;
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
  async getBookingsInTimeRange(startTime: Date, endTime: Date): Promise<EventBookingWithStatus[]> {
    // Get bookings excluding those with "pending" status as they may be rejected
    const pendingStatus = await this.getWorkflowStatusBySlug("pending");
    
    let query = db
      .select({
        id: eventBookings.id,
        eventType: eventBookings.eventType,
        contactName: eventBookings.contactName,
        contactEmail: eventBookings.contactEmail,
        contactPhone: eventBookings.contactPhone,
        startAt: eventBookings.startAt,
        durationMinutes: eventBookings.durationMinutes,
        additionalNotes: eventBookings.additionalNotes,
        statusId: eventBookings.statusId,
        assignedTo: eventBookings.assignedTo,
        createdAt: eventBookings.createdAt,
        updatedAt: eventBookings.updatedAt,
        status: workflowStatuses,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .where(
        and(
          gte(eventBookings.startAt, startTime),
          lte(eventBookings.startAt, endTime)
        )
      );
    
    // Exclude pending bookings if status exists
    if (pendingStatus) {
      query = query.where(
        and(
          gte(eventBookings.startAt, startTime),
          lte(eventBookings.startAt, endTime),
          not(eq(eventBookings.statusId, pendingStatus.id))
        )
      );
    }
    
    return await query.orderBy(eventBookings.startAt);
  }
  
  async isTimeSlotAvailable(startTime: Date, durationMinutes: number): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    
    // Get pending status to exclude it from availability check
    const pendingStatus = await this.getWorkflowStatusBySlug("pending");
    
    // Check for any overlapping bookings (excluding pending status which might be rejected)
    let query = db
      .select({ id: eventBookings.id, startAt: eventBookings.startAt, durationMinutes: eventBookings.durationMinutes })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .where(
        and(
          // Booking starts before our slot ends
          lte(eventBookings.startAt, endTime),
          // Only check active workflow statuses
          eq(workflowStatuses.isActive, true)
        )
      )
      .limit(10); // Get potential conflicts to check
    
    // Exclude pending status if it exists
    if (pendingStatus) {
      query = query.where(
        and(
          lte(eventBookings.startAt, endTime),
          eq(workflowStatuses.isActive, true),
          not(eq(eventBookings.statusId, pendingStatus.id))
        )
      );
    }
    
    const conflictingBookings = await query;
    
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
    statusSlug: string;
  }[]> {
    // Only get approved bookings for public calendar display
    const approvedStatus = await this.getWorkflowStatusBySlug("approved");
    
    if (!approvedStatus) {
      console.warn("No approved status found, returning empty blocked slots");
      return [];
    }

    const approvedBookings = await db
      .select({
        id: eventBookings.id,
        eventType: eventBookings.eventType,
        startAt: eventBookings.startAt,
        durationMinutes: eventBookings.durationMinutes,
        statusSlug: workflowStatuses.slug,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .where(eq(eventBookings.statusId, approvedStatus.id))
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
        statusSlug: booking.statusSlug,
      };
    });
  }
}

export const storage = new DatabaseStorage();
