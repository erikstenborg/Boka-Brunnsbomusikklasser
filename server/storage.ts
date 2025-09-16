import {
  users,
  eventBookings,
  eventTypes,
  activityLogs,
  workflowStatuses,
  type User,
  type UpsertUser,
  type EventBooking,
  type EventBookingWithStatus,
  type EventBookingWithStatusAndType,
  type InsertEventBooking,
  type UpdateEventBooking,
  type ActivityLog,
  type InsertActivityLog,
  type EventBookingForm,
  type EventType,
  type InsertEventType,
  type UpdateEventType,
  type WorkflowStatus,
  type InsertWorkflowStatus,
  type UpdateWorkflowStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, not, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for storage operations with enhanced calendar queries and buffer times
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Event type operations
  getEventTypes(filters?: { isActive?: boolean }): Promise<EventType[]>;
  getEventType(id: string): Promise<EventType | undefined>;
  getEventTypeBySlug(slug: string): Promise<EventType | undefined>;
  createEventType(eventType: InsertEventType): Promise<EventType>;
  updateEventType(id: string, updates: UpdateEventType): Promise<EventType | undefined>;
  deleteEventType(id: string): Promise<boolean>;
  
  // Workflow status operations
  getWorkflowStatuses(filters?: { isActive?: boolean }): Promise<WorkflowStatus[]>;
  getWorkflowStatus(id: string): Promise<WorkflowStatus | undefined>;
  getWorkflowStatusBySlug(slug: string): Promise<WorkflowStatus | undefined>;
  getDefaultWorkflowStatus(): Promise<WorkflowStatus>;
  createWorkflowStatus(status: InsertWorkflowStatus): Promise<WorkflowStatus>;
  updateWorkflowStatus(id: string, updates: UpdateWorkflowStatus): Promise<WorkflowStatus | undefined>;
  deleteWorkflowStatus(id: string): Promise<boolean>;
  
  // Event booking operations with status and type relationships
  createEventBooking(booking: InsertEventBooking): Promise<EventBookingWithStatusAndType>;
  createEventBookingFromForm(form: EventBookingForm): Promise<EventBookingWithStatusAndType>;
  getEventBookings(filters?: {
    statusIds?: string[];
    statusSlugs?: string[];
    eventTypeId?: string;
    eventTypeIds?: string[];
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EventBookingWithStatusAndType[]>;
  getEventBooking(id: string): Promise<EventBookingWithStatusAndType | undefined>;
  updateEventBooking(id: string, updates: UpdateEventBooking, userId?: string, userName?: string): Promise<EventBookingWithStatusAndType | undefined>;
  
  // Calendar-specific queries for availability checking with buffer times
  getBookingsInTimeRange(startTime: Date, endTime: Date): Promise<EventBookingWithStatusAndType[]>;
  isTimeSlotAvailable(startTime: Date, durationMinutes: number, eventTypeId?: string): Promise<boolean>;
  
  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsForBooking(bookingId: string): Promise<ActivityLog[]>;
  
  // Calendar-specific operations for public view with buffer times
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
  // Event type operations
  async getEventTypes(filters?: { isActive?: boolean }): Promise<EventType[]> {
    let query = db.select().from(eventTypes);
    
    if (filters?.isActive !== undefined) {
      query = query.where(eq(eventTypes.isActive, filters.isActive));
    }
    
    return await query.orderBy(eventTypes.displayOrder, eventTypes.name);
  }

  async getEventType(id: string): Promise<EventType | undefined> {
    const [eventType] = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.id, id));
    return eventType;
  }

  async getEventTypeBySlug(slug: string): Promise<EventType | undefined> {
    const [eventType] = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.slug, slug));
    return eventType;
  }

  async createEventType(eventTypeData: InsertEventType): Promise<EventType> {
    const [eventType] = await db
      .insert(eventTypes)
      .values({
        ...eventTypeData,
        id: randomUUID(),
      })
      .returning();
    return eventType;
  }

  async updateEventType(id: string, updates: UpdateEventType): Promise<EventType | undefined> {
    const [eventType] = await db
      .update(eventTypes)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(eventTypes.id, id))
      .returning();
    return eventType;
  }

  async deleteEventType(id: string): Promise<boolean> {
    // Check if this event type is in use by any bookings
    const [bookingUsingEventType] = await db
      .select({ count: eventBookings.id })
      .from(eventBookings)
      .where(eq(eventBookings.eventTypeId, id))
      .limit(1);

    if (bookingUsingEventType) {
      throw new Error("Cannot delete event type that is currently in use by bookings.");
    }

    const result = await db
      .delete(eventTypes)
      .where(eq(eventTypes.id, id));

    return result.rowCount > 0;
  }

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

  async createEventBookingFromForm(formData: EventBookingForm): Promise<EventBookingWithStatusAndType> {
    // Convert form data to proper temporal format
    const startAt = new Date(`${formData.requestedDate}T${formData.startTime}`);
    
    // Use eventTypeId from form, or fallback to backwards compatibility with eventType
    let eventTypeId = formData.eventTypeId;
    if (!eventTypeId && formData.eventType) {
      // Backwards compatibility: convert eventType string to eventTypeId
      const eventType = await this.getEventTypeBySlug(formData.eventType);
      if (!eventType) {
        throw new Error(`Event type with slug '${formData.eventType}' not found`);
      }
      eventTypeId = eventType.id;
    }
    
    if (!eventTypeId) {
      throw new Error("Event type is required");
    }
    
    // Get event type to check defaults
    const eventType = await this.getEventType(eventTypeId);
    if (!eventType) {
      throw new Error("Invalid event type ID");
    }
    
    // Use provided duration or event type default
    const durationMinutes = formData.durationHours ? 
      Math.round(formData.durationHours * 60) : 
      eventType.defaultDurationMinutes;
    
    // Debug logging
    console.log('DEBUG - Form data:', formData);
    console.log('DEBUG - Event type:', eventType);
    console.log('DEBUG - Using duration:', durationMinutes, 'minutes');
    console.log('DEBUG - Created startAt:', startAt);
    
    // Get default status for new bookings
    const defaultStatus = await this.getDefaultWorkflowStatus();
    
    const bookingData: InsertEventBooking = {
      eventTypeId: eventTypeId,
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
    eventTypeId?: string;
    eventTypeIds?: string[];
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EventBookingWithStatusAndType[]> {
    let query = db
      .select({
        id: eventBookings.id,
        eventTypeId: eventBookings.eventTypeId,
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
        eventType: eventTypes,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .innerJoin(eventTypes, eq(eventBookings.eventTypeId, eventTypes.id));
    
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
      
      if (filters.eventTypeId) {
        conditions.push(eq(eventBookings.eventTypeId, filters.eventTypeId));
      }
      
      if (filters.eventTypeIds && filters.eventTypeIds.length > 0) {
        conditions.push(inArray(eventBookings.eventTypeId, filters.eventTypeIds));
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

  async getEventBooking(id: string): Promise<EventBookingWithStatusAndType | undefined> {
    const [booking] = await db
      .select({
        id: eventBookings.id,
        eventTypeId: eventBookings.eventTypeId,
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
        eventType: eventTypes,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .innerJoin(eventTypes, eq(eventBookings.eventTypeId, eventTypes.id))
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
  
  async isTimeSlotAvailable(startTime: Date, durationMinutes: number, eventTypeId?: string): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    
    // Get buffer times if event type is provided
    let bufferBefore = 0;
    let bufferAfter = 0;
    
    if (eventTypeId) {
      const eventType = await this.getEventType(eventTypeId);
      if (eventType) {
        bufferBefore = eventType.bufferBeforeMinutes;
        bufferAfter = eventType.bufferAfterMinutes;
      }
    }
    
    // Extend the check range to include buffer times
    const checkStartTime = new Date(startTime.getTime() - bufferBefore * 60000);
    const checkEndTime = new Date(endTime.getTime() + bufferAfter * 60000);
    
    // Get pending status to exclude it from availability check
    const pendingStatus = await this.getWorkflowStatusBySlug("pending");
    
    // Check for any overlapping bookings (excluding pending status which might be rejected)
    // Include event type information to get buffer times for existing bookings
    let query = db
      .select({ 
        id: eventBookings.id, 
        startAt: eventBookings.startAt, 
        durationMinutes: eventBookings.durationMinutes,
        eventType: eventTypes
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .innerJoin(eventTypes, eq(eventBookings.eventTypeId, eventTypes.id))
      .where(
        and(
          // Booking starts before our extended slot ends
          lte(eventBookings.startAt, checkEndTime),
          // Only check active workflow statuses
          eq(workflowStatuses.isActive, true)
        )
      )
      .limit(10); // Get potential conflicts to check
    
    // Exclude pending status if it exists
    if (pendingStatus) {
      query = query.where(
        and(
          lte(eventBookings.startAt, checkEndTime),
          eq(workflowStatuses.isActive, true),
          not(eq(eventBookings.statusId, pendingStatus.id))
        )
      );
    }
    
    const conflictingBookings = await query;
    
    // Check each potential conflict for actual overlap including buffer times
    for (const booking of conflictingBookings) {
      const bookingStart = new Date(booking.startAt);
      const bookingEnd = new Date(bookingStart.getTime() + booking.durationMinutes * 60000);
      
      // Apply buffer times to existing booking
      const bookingBufferedStart = new Date(bookingStart.getTime() - booking.eventType.bufferBeforeMinutes * 60000);
      const bookingBufferedEnd = new Date(bookingEnd.getTime() + booking.eventType.bufferAfterMinutes * 60000);
      
      // Check for overlap with buffer times: 
      // booking_buffered_start < our_buffered_end AND booking_buffered_end > our_buffered_start
      if (bookingBufferedStart < checkEndTime && bookingBufferedEnd > checkStartTime) {
        console.log(`DEBUG - Conflict found: existing booking ${booking.id} (${booking.eventType.name}) conflicts with requested slot`);
        console.log(`  Existing: ${bookingBufferedStart.toISOString()} - ${bookingBufferedEnd.toISOString()}`);
        console.log(`  Requested: ${checkStartTime.toISOString()} - ${checkEndTime.toISOString()}`);
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

  // Calendar-specific operations for public view with buffer times
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
        startAt: eventBookings.startAt,
        durationMinutes: eventBookings.durationMinutes,
        statusSlug: workflowStatuses.slug,
        eventType: eventTypes,
      })
      .from(eventBookings)
      .innerJoin(workflowStatuses, eq(eventBookings.statusId, workflowStatuses.id))
      .innerJoin(eventTypes, eq(eventBookings.eventTypeId, eventTypes.id))
      .where(eq(eventBookings.statusId, approvedStatus.id))
      .orderBy(eventBookings.startAt);

    // Transform booking data to calendar format using consistent Europe/Stockholm timezone
    // Include buffer times to show the full blocked period
    return approvedBookings.map(booking => {
      const eventStartDate = new Date(booking.startAt);
      const eventEndDate = new Date(eventStartDate.getTime() + booking.durationMinutes * 60000);
      
      // Apply buffer times to show the full blocked period
      const blockedStartDate = new Date(eventStartDate.getTime() - booking.eventType.bufferBeforeMinutes * 60000);
      const blockedEndDate = new Date(eventEndDate.getTime() + booking.eventType.bufferAfterMinutes * 60000);
      
      // Use Europe/Stockholm timezone for consistent date/time formatting
      const swedenTimeZone = 'Europe/Stockholm';
      
      // Format date consistently in Swedish timezone (YYYY-MM-DD)
      const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: swedenTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const dateParts = dateFormatter.formatToParts(blockedStartDate);
      const swedenDate = `${dateParts.find(p => p.type === 'year')?.value}-${dateParts.find(p => p.type === 'month')?.value}-${dateParts.find(p => p.type === 'day')?.value}`;
      
      // Format times consistently in Swedish timezone (HH:MM)
      const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: swedenTimeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const swedenStartTime = timeFormatter.format(blockedStartDate);
      const swedenEndTime = timeFormatter.format(blockedEndDate);
      
      return {
        id: booking.id,
        date: swedenDate, // YYYY-MM-DD format in Swedish timezone
        startTime: swedenStartTime, // HH:MM format in Swedish timezone (includes buffer)
        endTime: swedenEndTime, // HH:MM format in Swedish timezone (includes buffer)
        eventType: booking.eventType,
        statusSlug: booking.statusSlug,
      };
    });
  }
}

export const storage = new DatabaseStorage();
